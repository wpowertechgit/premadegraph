using TribalNeuroSim.Client.Launcher;
using TribalNeuroSim.Client.Assets;

namespace TribalNeuroSim.Client;

public static class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        var logPath = Path.Combine(AppContext.BaseDirectory, "neurosim-client.log");
        using var logFile = new StreamWriter(logPath, append: false) { AutoFlush = true };
        using var multi = new MultiWriter(Console.Out, logFile);
        Console.SetOut(multi);
        Console.SetError(multi);

        Console.WriteLine($"[launch] {DateTime.Now:O} args={string.Join(" ", args)}");

        var launchOptions = LaunchOptions.FromArgs(args);
        Console.WriteLine($"[launch] ws={launchOptions.NodeWebSocketEndpoint} http={launchOptions.NodeHttpEndpoint} session={launchOptions.SessionId} connect={launchOptions.ConnectMode}");

        try
        {
            ContentBootstrapper.EnsureContentAsync(cancellationToken: CancellationToken.None)
                .GetAwaiter()
                .GetResult();

            using var game = new GameRoot(launchOptions);
            game.Run();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[fatal] {ex}");
            throw;
        }
    }

    private sealed class MultiWriter(TextWriter a, TextWriter b) : TextWriter
    {
        public override System.Text.Encoding Encoding => a.Encoding;
        public override void Write(char value) { a.Write(value); b.Write(value); }
        public override void WriteLine(string? value) { a.WriteLine(value); b.WriteLine(value); }
        public override void Flush() { a.Flush(); b.Flush(); }
    }
}
