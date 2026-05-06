using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Assets;

namespace TribalNeuroSim.Client.Rendering;

public readonly record struct RenderableTile(
    ushort TileId,
    Vector2 Center,
    float Size,
    Color BaseColor,
    string? TextureKey = null,
    string? ModelKey = null,
    float FoodAmount = 0f,
    float MaxFoodAmount = 100f,
    bool IsDisputed = false,
    int OwnerTribeId = -1,
    bool HasCamp = false);

public readonly record struct RenderableTribe(
    int Id,
    Vector2 Position,
    float Radius,
    Color Color,
    int Population = 0,
    bool HasCamp = false,
    Vector2 CampPosition = default,
    float TerritoryRadius = 0f);

public sealed class WorldRenderer : IDisposable
{
    private Texture2D? _pixel;
    private GraphicsDevice? _graphicsDevice;
    private BasicEffect? _modelEffect;
    private BasicEffect? _fallbackEffect;

    public void DrawWorld(
        SpriteBatch spriteBatch,
        IReadOnlyList<RenderableTile> tiles,
        IReadOnlyList<RenderableTribe> tribes,
        IsometricCamera camera,
        int selectedTribeId,
        IReadOnlyDictionary<string, Texture2D>? texturesByKey = null,
        IReadOnlyDictionary<string, RuntimeModel>? modelsByKey = null)
    {
        EnsureEffects(spriteBatch.GraphicsDevice);
        DrawTerrainModels(spriteBatch.GraphicsDevice, tiles, camera, texturesByKey, modelsByKey);
        DrawOverlays(spriteBatch, tiles, tribes, camera, selectedTribeId);
    }

    public void Dispose()
    {
        _modelEffect?.Dispose();
        _modelEffect = null;
        _fallbackEffect?.Dispose();
        _fallbackEffect = null;
        _pixel?.Dispose();
        _pixel = null;
        _graphicsDevice = null;
    }

    private void EnsureEffects(GraphicsDevice graphicsDevice)
    {
        if (_pixel is not null && ReferenceEquals(_graphicsDevice, graphicsDevice))
            return;

        _pixel?.Dispose();
        _graphicsDevice = graphicsDevice;
        _pixel = new Texture2D(graphicsDevice, 1, 1);
        _pixel.SetData(new[] { Color.White });

        _modelEffect?.Dispose();
        _modelEffect = new BasicEffect(graphicsDevice)
        {
            TextureEnabled = true,
            VertexColorEnabled = false,
            LightingEnabled = true,
            PreferPerPixelLighting = true,
            AmbientLightColor = new Vector3(0.35f, 0.35f, 0.35f),
            DiffuseColor = new Vector3(0.7f, 0.7f, 0.65f),
        };
        _modelEffect.DirectionalLight0.Enabled = true;
        _modelEffect.DirectionalLight0.Direction = Vector3.Normalize(new Vector3(0.6f, -1f, -0.4f));
        _modelEffect.DirectionalLight0.DiffuseColor = new Vector3(0.9f, 0.85f, 0.7f);

        _fallbackEffect?.Dispose();
        _fallbackEffect = new BasicEffect(graphicsDevice)
        {
            TextureEnabled = true,
            VertexColorEnabled = true,
            LightingEnabled = false,
        };
    }

    // ─────────────────────────────────────────────────────────────
    //  3D terrain model rendering
    // ─────────────────────────────────────────────────────────────

    private void DrawTerrainModels(
        GraphicsDevice graphicsDevice,
        IReadOnlyList<RenderableTile> tiles,
        IsometricCamera camera,
        IReadOnlyDictionary<string, Texture2D>? texturesByKey,
        IReadOnlyDictionary<string, RuntimeModel>? modelsByKey)
    {
        if (_modelEffect is null || _fallbackEffect is null || tiles.Count == 0)
            return;

        var view = camera.GetView();
        var projection = camera.GetProjection();

        graphicsDevice.BlendState = BlendState.AlphaBlend;
        graphicsDevice.DepthStencilState = DepthStencilState.Default;
        graphicsDevice.RasterizerState = RasterizerState.CullNone;
        graphicsDevice.SamplerStates[0] = SamplerState.LinearWrap;

        foreach (var tile in tiles)
        {
            var model = ResolveModel(tile, modelsByKey);
            var texture = ResolveTexture(tile.TextureKey, texturesByKey) ?? _pixel!;
            var scale = tile.Size;

            if (model is not null)
            {
                RenderModel(
                    graphicsDevice, model, texture!, tile.Center, scale, view, projection, _modelEffect);
            }
            else
            {
                RenderFallbackHex(
                    graphicsDevice, tile, texture!, scale, view, projection, _fallbackEffect);
            }
        }
    }

    private static void RenderModel(
        GraphicsDevice graphicsDevice,
        RuntimeModel model,
        Texture2D texture,
        Vector2 tileCenter,
        float scale,
        Matrix view,
        Matrix projection,
        BasicEffect effect)
    {
        var world = Matrix.CreateScale(scale) *
                    Matrix.CreateTranslation(new Vector3(tileCenter.X, 0f, tileCenter.Y));

        effect.World = world;
        effect.View = view;
        effect.Projection = projection;
        effect.Texture = texture;

        foreach (var pass in effect.CurrentTechnique.Passes)
        {
            pass.Apply();
            model.Draw(graphicsDevice);
        }
    }

    private void RenderFallbackHex(
        GraphicsDevice graphicsDevice,
        RenderableTile tile,
        Texture2D texture,
        float scale,
        Matrix view,
        Matrix projection,
        BasicEffect effect)
    {
        effect.World = Matrix.Identity;
        effect.View = view;
        effect.Projection = projection;
        effect.Texture = texture;

        foreach (var pass in effect.CurrentTechnique.Passes)
        {
            pass.Apply();
            var vertices = BuildHexFan3D(tile, scale);
            graphicsDevice.DrawUserPrimitives(PrimitiveType.TriangleList, vertices, 0, 6);
        }
    }

    private static RuntimeModel? ResolveModel(
        RenderableTile tile,
        IReadOnlyDictionary<string, RuntimeModel>? modelsByKey)
    {
        if (modelsByKey is null || tile.ModelKey is null)
            return null;

        return modelsByKey.TryGetValue(tile.ModelKey, out var model) ? model : null;
    }

    // ─────────────────────────────────────────────────────────────
    //  2D SpriteBatch overlays
    // ─────────────────────────────────────────────────────────────

    private void DrawOverlays(
        SpriteBatch spriteBatch,
        IReadOnlyList<RenderableTile> tiles,
        IReadOnlyList<RenderableTribe> tribes,
        IsometricCamera camera,
        int selectedTribeId)
    {
        if (_graphicsDevice is null) return;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        foreach (var tile in tiles)
            DrawTileOverlays(spriteBatch, tile, camera, _graphicsDevice.Viewport);

        foreach (var tribe in tribes)
            DrawTribe(spriteBatch, tribe, tribe.Id == selectedTribeId, camera, _graphicsDevice.Viewport);

        spriteBatch.End();
    }

    private void DrawTileOverlays(SpriteBatch spriteBatch, RenderableTile tile, IsometricCamera camera, Viewport viewport)
    {
        var screenCenter = camera.HexToScreen(tile.Center, viewport);

        var worldRadius = Math.Max(1f, tile.Size);
        var edgeScreen = camera.HexToScreen(tile.Center + new Vector2(worldRadius, 0f), viewport);
        var screenRadius = Vector2.Distance(screenCenter, edgeScreen);

        if (screenRadius < 2f) return;

        if (tile.OwnerTribeId >= 0)
            DrawTerritoryTint(spriteBatch, screenCenter, screenRadius * 0.94f, TribeColor(tile.OwnerTribeId));

        if (tile.IsDisputed)
            DrawHexOutline(spriteBatch, screenCenter, screenRadius * 0.96f, new Color(240, 98, 72, 220), 2.2f);

        if (tile.HasCamp)
            DrawCampMarker(spriteBatch, screenCenter + new Vector2(screenRadius * 0.10f, -screenRadius * 0.08f), screenRadius * 0.34f, new Color(232, 205, 126, 210));
    }

    private void DrawTribe(SpriteBatch spriteBatch, RenderableTribe tribe, bool isSelected, IsometricCamera camera, Viewport viewport)
    {
        var screenPos = camera.HexToScreen(tribe.Position, viewport);
        var edgeScreen = camera.HexToScreen(tribe.Position + new Vector2(tribe.Radius, 0f), viewport);
        var screenRadius = Math.Max(3f, Vector2.Distance(screenPos, edgeScreen));

        if (screenRadius < 1f) return;

        if (tribe.TerritoryRadius > 0f)
        {
            var terEdge = camera.HexToScreen(tribe.Position + new Vector2(tribe.TerritoryRadius, 0f), viewport);
            var terScreen = Vector2.Distance(screenPos, terEdge);
            DrawCircleOutline(spriteBatch, screenPos, terScreen, new Color(tribe.Color, 45), 36, 1.5f);
        }

        if (tribe.HasCamp)
        {
            var camp = tribe.CampPosition == default ? tribe.Position : tribe.CampPosition;
            var campScreen = camera.HexToScreen(camp, viewport);
            DrawCampMarker(spriteBatch, campScreen, screenRadius * 1.45f, new Color(tribe.Color, 112));
            DrawCampMarker(spriteBatch, campScreen, screenRadius * 1.10f, new Color(28, 30, 24, 150));
        }

        DrawCircle(spriteBatch, screenPos, screenRadius, tribe.Color, 24);
        DrawCircleOutline(spriteBatch, screenPos, screenRadius + 1.5f, new Color(20, 20, 20, 200), 24, 2f);

        if (isSelected)
            DrawCircleOutline(spriteBatch, screenPos, screenRadius + 6f, new Color(255, 238, 128, 240), 32, 3f);

        if (tribe.Population > 0)
        {
            var markerWidth = MathHelper.Clamp(tribe.Population * 0.25f, screenRadius * 0.8f, screenRadius * 2.2f);
            FillRect(spriteBatch, CenteredRect(screenPos + new Vector2(0f, screenRadius + 5f), markerWidth, 3f), new Color(230, 235, 225, 150));
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  3D hex fallback geometry
    // ─────────────────────────────────────────────────────────────

    private static VertexPositionColorTexture[] BuildHexFan3D(RenderableTile tile, float scale)
    {
        var corners = HexCorners(tile.Center, Math.Max(1f, scale));
        var vertices = new VertexPositionColorTexture[18];
        var cursor = 0;

        for (var i = 0; i < corners.Length; i++)
        {
            var next = corners[(i + 1) % corners.Length];
            vertices[cursor++] = TerrainVertex(tile.Center, tile.BaseColor);
            vertices[cursor++] = TerrainVertex(corners[i], tile.BaseColor);
            vertices[cursor++] = TerrainVertex(next, tile.BaseColor);
        }

        return vertices;
    }

    private static VertexPositionColorTexture TerrainVertex(Vector2 position, Color tint)
    {
        return new VertexPositionColorTexture(
            new Vector3(position.X, 0f, position.Y),
            Color.Lerp(tint, Color.White, 0.24f),
            Vector2.Zero);
    }

    private void DrawTerritoryTint(SpriteBatch spriteBatch, Vector2 center, float size, Color color)
    {
        DrawHexFill(spriteBatch, center, size, new Color(color, 36));
        DrawHexOutline(spriteBatch, center, size, new Color(color, 92), 1.15f);
    }

    private static Texture2D? ResolveTexture(string? textureKey, IReadOnlyDictionary<string, Texture2D>? texturesByKey)
    {
        return textureKey is not null &&
            texturesByKey is not null &&
            texturesByKey.TryGetValue(textureKey, out var texture)
                ? texture
                : null;
    }

    private static Vector2[] HexCorners(Vector2 center, float radius)
    {
        var corners = new Vector2[6];
        for (var i = 0; i < corners.Length; i++)
        {
            var angle = MathHelper.ToRadians(-90f + i * 60f);
            corners[i] = center + new Vector2(MathF.Cos(angle), MathF.Sin(angle)) * radius;
        }

        return corners;
    }

    private static Color TribeColor(int id)
    {
        var hue = (id * 0.61803398875f) % 1f;
        return FromHsv(hue, 0.42f, 0.85f);
    }

    private static Color FromHsv(float h, float s, float v)
    {
        var i = (int)MathF.Floor(h * 6f);
        var f = h * 6f - i;
        var p = v * (1f - s);
        var q = v * (1f - f * s);
        var t = v * (1f - (1f - f) * s);

        var (r, g, b) = (i % 6) switch
        {
            0 => (v, t, p),
            1 => (q, v, p),
            2 => (p, v, t),
            3 => (p, q, v),
            4 => (t, p, v),
            _ => (v, p, q),
        };

        return new Color(r, g, b);
    }

    // ─────────────────────────────────────────────────────────────
    //  SpriteBatch 2D drawing primitives
    // ─────────────────────────────────────────────────────────────

    private void DrawCircle(SpriteBatch spriteBatch, Vector2 center, float radius, Color color, int segments)
    {
        var step = MathHelper.TwoPi / segments;
        for (var i = 0; i < segments; i++)
        {
            var angle = i * step;
            var nextAngle = (i + 1) * step;
            var start = center + new Vector2(MathF.Cos(angle), MathF.Sin(angle)) * radius;
            var end = center + new Vector2(MathF.Cos(nextAngle), MathF.Sin(nextAngle)) * radius;
            DrawLine(spriteBatch, center, start, color, radius);
            DrawLine(spriteBatch, start, end, color, 2f);
        }
    }

    private void DrawCircleOutline(SpriteBatch spriteBatch, Vector2 center, float radius, Color color, int segments, float thickness)
    {
        var step = MathHelper.TwoPi / segments;
        for (var i = 0; i < segments; i++)
        {
            var angle = i * step;
            var nextAngle = (i + 1) * step;
            var start = center + new Vector2(MathF.Cos(angle), MathF.Sin(angle)) * radius;
            var end = center + new Vector2(MathF.Cos(nextAngle), MathF.Sin(nextAngle)) * radius;
            DrawLine(spriteBatch, start, end, color, thickness);
        }
    }

    private void DrawHexOutline(SpriteBatch spriteBatch, Vector2 center, float radius, Color color, float thickness)
    {
        var corners = HexCorners(center, radius);
        for (var i = 0; i < corners.Length; i++)
            DrawLine(spriteBatch, corners[i], corners[(i + 1) % corners.Length], color, thickness);
    }

    private void DrawHexFill(SpriteBatch spriteBatch, Vector2 center, float radius, Color color)
    {
        var corners = HexCorners(center, radius);
        for (var i = 0; i < corners.Length; i++)
        {
            DrawLine(spriteBatch, center, corners[i], color, radius * 0.92f);
            DrawLine(spriteBatch, corners[i], corners[(i + 1) % corners.Length], color, 1f);
        }
    }

    private void DrawCampMarker(SpriteBatch spriteBatch, Vector2 center, float size, Color color)
    {
        var top = center + new Vector2(0f, -size * 0.55f);
        var right = center + new Vector2(size * 0.55f, 0f);
        var bottom = center + new Vector2(0f, size * 0.55f);
        var left = center + new Vector2(-size * 0.55f, 0f);

        DrawLine(spriteBatch, center, top, color, size * 0.44f);
        DrawLine(spriteBatch, center, right, color, size * 0.44f);
        DrawLine(spriteBatch, center, bottom, color, size * 0.44f);
        DrawLine(spriteBatch, center, left, color, size * 0.44f);
        DrawLine(spriteBatch, top, right, new Color(28, 30, 24, 130), 1.2f);
        DrawLine(spriteBatch, right, bottom, new Color(28, 30, 24, 130), 1.2f);
        DrawLine(spriteBatch, bottom, left, new Color(28, 30, 24, 130), 1.2f);
        DrawLine(spriteBatch, left, top, new Color(28, 30, 24, 130), 1.2f);
    }

    private void FillRect(SpriteBatch spriteBatch, FloatRect rect, Color color)
    {
        spriteBatch.Draw(_pixel, rect.ToRectangle(), color);
    }

    private void DrawLine(SpriteBatch spriteBatch, Vector2 start, Vector2 end, Color color, float thickness)
    {
        var delta = end - start;
        var length = delta.Length();
        if (length <= 0.001f) return;

        var angle = MathF.Atan2(delta.Y, delta.X);
        spriteBatch.Draw(_pixel, start, null, color, angle, new Vector2(0f, 0.5f), new Vector2(length, Math.Max(1f, thickness)), SpriteEffects.None, 0f);
    }

    private static FloatRect CenteredRect(Vector2 center, float width, float height)
    {
        return new FloatRect(center.X - width * 0.5f, center.Y - height * 0.5f, width, height);
    }

    private readonly record struct FloatRect(float X, float Y, float Width, float Height)
    {
        public float Left => X;
        public float Top => Y;
        public float Right => X + Width;
        public float Bottom => Y + Height;

        public Rectangle ToRectangle()
        {
            return new Rectangle((int)MathF.Round(X), (int)MathF.Round(Y), (int)MathF.Round(Width), (int)MathF.Round(Height));
        }
    }
}
