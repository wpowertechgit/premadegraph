namespace TribalNeuroSim.Client.Assets;

public sealed class AssetLoadDiagnostics
{
    private readonly object _sync = new();

    public AssetLoadDiagnostics(string contentRoot)
    {
        var clientRoot = Directory.GetParent(contentRoot)?.FullName ?? contentRoot;
        LogPath = Path.Combine(clientRoot, "asset-load.log");
    }

    public string LogPath { get; }

    public void Reset()
    {
        lock (_sync)
        {
            File.WriteAllText(LogPath, $"Asset load log started {DateTimeOffset.Now:O}{Environment.NewLine}");
        }
    }

    public void Info(string message) => Write("INFO", message);

    public void Error(string message, Exception? exception = null)
    {
        Write("ERROR", exception is null ? message : $"{message}: {exception}");
    }

    private void Write(string level, string message)
    {
        lock (_sync)
        {
            File.AppendAllText(
                LogPath,
                $"[{DateTimeOffset.Now:O}] {level} {message}{Environment.NewLine}");
        }
    }
}
