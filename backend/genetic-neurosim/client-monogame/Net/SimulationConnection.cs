using System.Buffers;
using System.Net.WebSockets;
using System.Text;

namespace TribalNeuroSim.Client.Net;

public sealed class SimulationConnection : IAsyncDisposable
{
    private ClientWebSocket? _socket;

    public Uri? Endpoint { get; private set; }

    public bool IsConnected => _socket?.State == WebSocketState.Open;

    public async Task ConnectAsync(Uri nodeWebSocketEndpoint, CancellationToken cancellationToken)
    {
        if (IsConnected)
        {
            return;
        }

        _socket?.Dispose();
        _socket = new ClientWebSocket();
        Endpoint = nodeWebSocketEndpoint;

        await _socket.ConnectAsync(nodeWebSocketEndpoint, cancellationToken).ConfigureAwait(false);
    }

    public async Task<byte[]> ReceiveBinaryFrameAsync(CancellationToken cancellationToken)
    {
        var socket = _socket ?? throw new InvalidOperationException("Simulation connection has not been opened.");
        var buffer = ArrayPool<byte>.Shared.Rent(64 * 1024);

        try
        {
            using var frame = new MemoryStream();

            while (true)
            {
                var result = await socket.ReceiveAsync(buffer.AsMemory(0, buffer.Length), cancellationToken)
                    .ConfigureAwait(false);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    throw new WebSocketException("Simulation stream closed before a complete frame was received.");
                }

                if (result.MessageType != WebSocketMessageType.Binary)
                {
                    continue;
                }

                frame.Write(buffer, 0, result.Count);

                if (result.EndOfMessage)
                {
                    return frame.ToArray();
                }
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    public async Task SendCommandAsync(string commandJson, CancellationToken cancellationToken)
    {
        var socket = _socket ?? throw new InvalidOperationException("Simulation connection has not been opened.");
        var payload = Encoding.UTF8.GetBytes(commandJson);
        await socket.SendAsync(payload, WebSocketMessageType.Text, true, cancellationToken).ConfigureAwait(false);
    }

    public async ValueTask DisposeAsync()
    {
        if (_socket is null)
        {
            return;
        }

        if (_socket.State == WebSocketState.Open)
        {
            await _socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Client disposed", CancellationToken.None)
                .ConfigureAwait(false);
        }

        _socket.Dispose();
        _socket = null;
    }
}
