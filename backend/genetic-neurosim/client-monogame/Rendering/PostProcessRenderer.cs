using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace TribalNeuroSim.Client.Rendering;

/// <summary>
/// Post-process pass: warm parchment color grade + soft vignette.
/// Scene renders to a RenderTarget2D; Apply() composites it to the back buffer.
/// No custom shaders — CPU-generated vignette texture + SpriteBatch tint only.
/// </summary>
public sealed class PostProcessRenderer : IDisposable
{
    private RenderTarget2D? _sceneTarget;
    private Texture2D? _vignetteOverlay;
    private SpriteBatch? _spriteBatch;
    private int _lastWidth;
    private int _lastHeight;

    /// <summary>Warm parchment tint applied to the scene.</summary>
    private static readonly Color WarmTint = new Color(255, 248, 235) * 0.90f;

    public RenderTarget2D SceneTarget => _sceneTarget!;

    /// <summary>Create (or recreate) render target and vignette for the current viewport size.</summary>
    public void EnsureTargets(GraphicsDevice gd, int width, int height)
    {
        if (width <= 0 || height <= 0)
            return;

        if (_sceneTarget is not null && width == _lastWidth && height == _lastHeight)
            return;

        _sceneTarget?.Dispose();
        _vignetteOverlay?.Dispose();

        _sceneTarget = new RenderTarget2D(
            gd, width, height, false,
            gd.PresentationParameters.BackBufferFormat,
            gd.PresentationParameters.DepthStencilFormat);

        _vignetteOverlay = GenerateVignette(gd, width, height);

        _lastWidth = width;
        _lastHeight = height;
    }

    /// <summary>
    /// Composite the scene render target to the back buffer:
    /// 1. Draw scene RT with warm parchment tint
    /// 2. Overlay soft vignette (dark edges → transparent center)
    /// </summary>
    public void Apply(GraphicsDevice gd)
    {
        if (_sceneTarget is null || _vignetteOverlay is null)
            return;

        if (_spriteBatch is null)
            _spriteBatch = new SpriteBatch(gd);

        _spriteBatch.Begin(SpriteSortMode.Deferred, BlendState.AlphaBlend, SamplerState.LinearClamp);
        _spriteBatch.Draw(_sceneTarget, gd.Viewport.Bounds, WarmTint);
        _spriteBatch.Draw(_vignetteOverlay, gd.Viewport.Bounds, Color.White);
        _spriteBatch.End();
    }

    /// <summary>CPU-generated radial vignette: black at edges, transparent at center.</summary>
    private static Texture2D GenerateVignette(GraphicsDevice gd, int width, int height)
    {
        var pixels = new Color[width * height];
        var cx = width * 0.5f;
        var cy = height * 0.5f;
        var maxDist = MathF.Sqrt(cx * cx + cy * cy);

        for (var y = 0; y < height; y++)
        for (var x = 0; x < width; x++)
        {
            var dx = (x - cx) / maxDist;
            var dy = (y - cy) / maxDist;
            var dist = MathF.Sqrt(dx * dx + dy * dy);
            var alpha = MathF.Pow(MathHelper.Clamp(dist - 0.45f, 0f, 1f) / 0.55f, 2.2f);
            pixels[y * width + x] = Color.Black * alpha;
        }

        var tex = new Texture2D(gd, width, height);
        tex.SetData(pixels);
        return tex;
    }

    public void Dispose()
    {
        _sceneTarget?.Dispose();
        _vignetteOverlay?.Dispose();
        _spriteBatch?.Dispose();
    }
}
