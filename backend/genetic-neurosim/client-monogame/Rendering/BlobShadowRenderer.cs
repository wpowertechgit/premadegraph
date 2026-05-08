using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Assets;

namespace TribalNeuroSim.Client.Rendering;

/// <summary>
/// Draws soft ground-contact shadow ellipses under settlement models so they
/// read as grounded on the terrain instead of floating pasted-on geometry.
/// Shadow pass runs between terrain/vegetation and 3D settlement model passes.
/// </summary>
public sealed class BlobShadowRenderer : IDisposable
{
    private Texture2D? _shadowTexture;
    private SpriteBatch? _spriteBatch;

    public void Initialize(GraphicsDevice gd)
    {
        _spriteBatch = new SpriteBatch(gd);
        _shadowTexture = GenerateShadowTexture(gd, 64);
    }

    /// <summary>
    /// Draw one blob shadow per settlement capital, projected to terrain surface.
    /// Call AFTER terrain/vegetation, BEFORE settlement 3D model passes.
    /// </summary>
    public void DrawShadows(
        GraphicsDevice gd,
        IReadOnlyList<SettlementRenderer.SettlementDraw> draws,
        IsometricCamera camera,
        Viewport viewport,
        int selectedTribeId)
    {
        if (_shadowTexture is null || _spriteBatch is null || draws.Count == 0)
            return;

        _spriteBatch.Begin(
            SpriteSortMode.Deferred,
            BlendState.AlphaBlend,
            SamplerState.LinearClamp,
            DepthStencilState.None,
            RasterizerState.CullNone);

        var cameraDistance = camera.Distance;

        foreach (var draw in draws)
        {
            // Only shadow the main capital model (skip Kenney compound pieces)
            if (draw.TribeId < 0)
                continue;

            // LOD: skip shadows at far zoom where settlement model is culled
            var lodProfile = SettlementLodCatalog.Resolve(draw.Tier);
            if (cameraDistance > lodProfile.MidDistance)
                continue;

            // Project settlement world position to screen
            var screenPos = camera.WorldToScreen(draw.Position, viewport);

            // Shadow radius in world units
            var worldRadius = draw.HorizontalExtent * draw.Scale * 1.2f;

            // Approximate screen-space radius by projecting an edge point
            var edgePoint = draw.Position + new Vector3(worldRadius, 0f, 0f);
            var edgeScreen = camera.WorldToScreen(edgePoint, viewport);
            var screenRadius = Vector2.Distance(screenPos, edgeScreen);

            // Foreshorten vertical to match isometric perspective
            var hRadius = screenRadius;
            var vRadius = screenRadius * 0.4f;

            // Offset in key light direction (+X screen-right, +Y screen-down)
            var offset = new Vector2(8f, 4f);

            // Selected tribe: slightly larger and darker
            var alpha = draw.TribeId == selectedTribeId ? 0.50f : 0.35f;
            var scale = draw.TribeId == selectedTribeId ? 1.15f : 1f;

            var shadowRect = new Rectangle(
                (int)(screenPos.X + offset.X - hRadius * scale),
                (int)(screenPos.Y + offset.Y - vRadius * scale),
                (int)(hRadius * 2 * scale),
                (int)(vRadius * 2 * scale));

            _spriteBatch.Draw(_shadowTexture, shadowRect, Color.Black * alpha);
        }

        _spriteBatch.End();
    }

    /// <summary>
    /// Pre-bake a 64×64 radial gradient: opaque white center → transparent edge.
    /// The SpriteBatch color tint turns this into a soft black shadow.
    /// </summary>
    private static Texture2D GenerateShadowTexture(GraphicsDevice gd, int size)
    {
        var pixels = new Color[size * size];
        var center = size * 0.5f;
        var maxDist = center;

        for (var y = 0; y < size; y++)
        for (var x = 0; x < size; x++)
        {
            var dx = (x - center) / maxDist;
            var dy = (y - center) / maxDist;
            var dist = MathF.Sqrt(dx * dx + dy * dy);
            // Falloff: pow 1.5 gives a concentrated core with soft falloff
            var alpha = 1f - MathF.Pow(MathHelper.Clamp(dist, 0f, 1f), 1.5f);
            pixels[y * size + x] = Color.White * alpha;
        }

        var texture = new Texture2D(gd, size, size);
        texture.SetData(pixels);
        return texture;
    }

    public void Dispose()
    {
        _shadowTexture?.Dispose();
        _shadowTexture = null;
        _spriteBatch?.Dispose();
        _spriteBatch = null;
    }
}
