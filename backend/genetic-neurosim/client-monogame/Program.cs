using TribalNeuroSim.Client.Launcher;

namespace TribalNeuroSim.Client;

public static class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        var launchOptions = LaunchOptions.FromArgs(args);

        using var game = new GameRoot(launchOptions);
        game.Run();
    }
}
