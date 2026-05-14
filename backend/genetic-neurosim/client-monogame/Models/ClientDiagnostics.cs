using TribalNeuroSim.Client.Protocol;

namespace TribalNeuroSim.Client.Models;

public sealed class ClientDiagnostics
{
    private readonly object _gate = new();

    public bool IsFrameReceiverRunning { get; private set; }

    public bool IsConnected { get; private set; }

    public Uri? Endpoint { get; private set; }

    public string? LastConnectionError { get; private set; }

    public long DecodedFrameCount { get; private set; }

    public int LastFrameBytes { get; private set; }

    public ulong LastFrameTick { get; private set; }

    public string? LastDecodeError { get; private set; }

    public DateTimeOffset? LastFrameReceivedAt { get; private set; }

    public void MarkFrameReceiverRunning(bool isRunning)
    {
        lock (_gate)
        {
            IsFrameReceiverRunning = isRunning;
        }
    }

    public void RecordConnectionOpened(Uri endpoint)
    {
        lock (_gate)
        {
            Endpoint = endpoint;
            IsConnected = true;
            LastConnectionError = null;
        }
        Console.WriteLine($"[net] connected: {endpoint}");
    }

    public void RecordConnectionError(Uri endpoint, Exception error)
    {
        lock (_gate)
        {
            Endpoint = endpoint;
            IsConnected = false;
            LastConnectionError = error.Message;
        }
        Console.WriteLine($"[net] connection error: {endpoint} — {error.GetType().Name}: {error.Message}");
    }

    public void RecordDecodedFrame(SimulationFrame frame, int payloadBytes)
    {
        lock (_gate)
        {
            DecodedFrameCount++;
            LastFrameBytes = payloadBytes;
            LastFrameTick = frame.Tick;
            LastDecodeError = null;
            LastFrameReceivedAt = DateTimeOffset.UtcNow;
        }
    }

    public void RecordDecodeError(Exception error, int payloadBytes)
    {
        lock (_gate)
        {
            LastFrameBytes = payloadBytes;
            LastDecodeError = error.Message;
        }
        Console.WriteLine($"[net] decode error: bytes={payloadBytes} {error.GetType().Name}: {error.Message}");
    }
}
