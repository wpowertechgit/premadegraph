using Microsoft.Xna.Framework;

namespace TribalNeuroSim.Client;

public static class WindowDefaults
{
    public static Point ResolveStartupBackBuffer(int displayWidth, int displayHeight)
    {
        var width = Math.Max(1280, displayWidth);
        var height = Math.Max(720, displayHeight);
        return new Point(width, height);
    }
}
