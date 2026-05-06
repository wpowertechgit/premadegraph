using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace TribalNeuroSim.Client.Diagnostics;

/// <summary>
/// Multi-frame screenshot capture at close, mid, and far zoom levels.
/// Triggered by F6 key in game. Saves PNGs to screenshots/YYYY-MM-DD_HHmmss/.
/// </summary>
public sealed class ScreenshotCapture
{
    private int _step = -1; // -1=idle, 0=close, 1=mid, 2=far
    private string? _outputDir;
    private Vector3 _mapCenter;

    private static readonly float[] Distances = [150f, 350f, 650f];
    private static readonly string[] Labels = ["close", "mid", "far"];

    public bool IsCapturing => _step >= 0;
    public int CurrentStep => _step >= 0 ? _step + 1 : 0;
    public int TotalSteps => Distances.Length;

    public float OverrideDistance => IsCapturing ? Distances[_step] : -1f;
    public Vector3 OverrideFocalPoint => _mapCenter;
    public bool OverrideCamera => IsCapturing;

    public string? LastSavedPath { get; private set; }

    /// <summary>
    /// Begin a 3-frame capture sequence. The next three Draw() calls will capture at close/mid/far.
    /// </summary>
    public void QueueCapture(Vector3 mapCenter)
    {
        _mapCenter = mapCenter;
        _step = 0;
        _outputDir = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory,
            "screenshots",
            DateTime.Now.ToString("yyyy-MM-dd_HHmmss"));
        Directory.CreateDirectory(_outputDir);
        LastSavedPath = null;
    }

    /// <summary>
    /// Call at the start of Draw, before rendering. Returns a RenderTarget2D to render into, or null.
    /// The caller is responsible for disposing the returned RT.
    /// </summary>
    public RenderTarget2D? BeginDraw(GraphicsDevice device)
    {
        if (!IsCapturing)
            return null;

        return new RenderTarget2D(
            device,
            device.PresentationParameters.BackBufferWidth,
            device.PresentationParameters.BackBufferHeight,
            mipMap: false,
            SurfaceFormat.Color,
            DepthFormat.Depth24);
    }

    /// <summary>
    /// Call after the scene has been rendered to the RT. Saves the RT as PNG, presents it to the back buffer, and advances the capture step.
    /// Returns the saved file path, or null if capture is done.
    /// </summary>
    public string? EndDraw(GraphicsDevice device, RenderTarget2D? rt, SpriteBatch spriteBatch)
    {
        if (rt is null)
            return null;

        // Unbind render target — scene is now in the RT texture
        device.SetRenderTarget(null);

        var path = Path.Combine(_outputDir!, $"m19_{Labels[_step]}.png");
        try
        {
            using var stream = File.Create(path);
            rt.SaveAsPng(stream, rt.Width, rt.Height);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[ScreenshotCapture] Failed to save {path}: {ex.Message}");
            LastSavedPath = null;
        }

        // Present captured frame to back buffer so player sees what was captured
        spriteBatch.Begin(
            sortMode: SpriteSortMode.Immediate,
            blendState: BlendState.Opaque,
            samplerState: SamplerState.LinearClamp);
        spriteBatch.Draw(rt, Vector2.Zero, Color.White);
        spriteBatch.End();

        rt.Dispose();
        LastSavedPath = path;

        _step++;
        if (_step >= Distances.Length)
        {
            _step = -1;
            _outputDir = null;
        }

        return path;
    }

    /// <summary>
    /// Human-readable label for current capture step (e.g. "mid").
    /// </summary>
    public string CurrentLabel => IsCapturing ? Labels[_step] : string.Empty;

    /// <summary>
    /// Output directory for the current capture session.
    /// </summary>
    public string? OutputDir => _outputDir;
}
