using System.Collections.Concurrent;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Protocol;

namespace TribalNeuroSim.Client.Net;

public sealed class SimulationFrameReceiver
{
    private readonly Func<CancellationToken, Task<byte[]>> _receiveFrameAsync;
    private readonly Func<byte[], SimulationFrame> _decodeFrame;
    private readonly ClientDiagnostics _diagnostics;
    private readonly ConcurrentQueue<SimulationFrame> _decodedFrames = new();

    public SimulationFrameReceiver(
        Func<CancellationToken, Task<byte[]>> receiveFrameAsync,
        Func<byte[], SimulationFrame> decodeFrame,
        ClientDiagnostics diagnostics)
    {
        _receiveFrameAsync = receiveFrameAsync;
        _decodeFrame = decodeFrame;
        _diagnostics = diagnostics;
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        _diagnostics.MarkFrameReceiverRunning(true);

        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                byte[] payload;

                try
                {
                    payload = await _receiveFrameAsync(cancellationToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    break;
                }

                try
                {
                    var frame = _decodeFrame(payload);
                    _decodedFrames.Enqueue(frame);
                    _diagnostics.RecordDecodedFrame(frame, payload.Length);
                }
                catch (Exception ex) when (ex is InvalidDataException or ArgumentException or OverflowException or IndexOutOfRangeException)
                {
                    _diagnostics.RecordDecodeError(ex, payload.Length);
                }
            }
        }
        finally
        {
            _diagnostics.MarkFrameReceiverRunning(false);
        }
    }

    public bool TryDequeueFrame(out SimulationFrame frame)
    {
        return _decodedFrames.TryDequeue(out frame!);
    }
}
