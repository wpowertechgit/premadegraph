using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace TribalNeuroSim.Client.Rendering;

public readonly record struct RenderableTile(
    ushort TileId,
    Vector2 Center,
    float Size,
    Color BaseColor,
    string? TextureKey = null,
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
    private BasicEffect? _terrainEffect;

    private const float MaterialWorldScale = 124f;

    public void DrawWorld(
        SpriteBatch spriteBatch,
        IReadOnlyList<RenderableTile> tiles,
        IReadOnlyList<RenderableTribe> tribes,
        CameraController camera,
        int selectedTribeId,
        IReadOnlyDictionary<string, Texture2D>? texturesByKey = null)
    {
        EnsurePixel(spriteBatch.GraphicsDevice);
        DrawTerrainHexes(spriteBatch.GraphicsDevice, tiles, camera, texturesByKey);

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp,
            transformMatrix: camera.CreateTransformMatrix());

        foreach (var tile in tiles)
        {
            DrawTileOverlays(spriteBatch, tile);
        }

        foreach (var tribe in tribes)
        {
            DrawTribe(spriteBatch, tribe, tribe.Id == selectedTribeId);
        }

        spriteBatch.End();
    }

    public void Dispose()
    {
        _terrainEffect?.Dispose();
        _terrainEffect = null;
        _pixel?.Dispose();
        _pixel = null;
        _graphicsDevice = null;
    }

    private void EnsurePixel(GraphicsDevice graphicsDevice)
    {
        if (_pixel is not null && ReferenceEquals(_graphicsDevice, graphicsDevice))
        {
            return;
        }

        _pixel?.Dispose();
        _graphicsDevice = graphicsDevice;
        _pixel = new Texture2D(graphicsDevice, 1, 1);
        _pixel.SetData(new[] { Color.White });
        _terrainEffect?.Dispose();
        _terrainEffect = new BasicEffect(graphicsDevice)
        {
            TextureEnabled = true,
            VertexColorEnabled = true,
            LightingEnabled = false,
        };
    }

    private void DrawTerrainHexes(
        GraphicsDevice graphicsDevice,
        IReadOnlyList<RenderableTile> tiles,
        CameraController camera,
        IReadOnlyDictionary<string, Texture2D>? texturesByKey)
    {
        if (_terrainEffect is null || _pixel is null || tiles.Count == 0)
        {
            return;
        }

        _terrainEffect.World = camera.CreateTransformMatrix();
        _terrainEffect.View = Matrix.Identity;
        _terrainEffect.Projection = Matrix.CreateOrthographicOffCenter(
            0f,
            graphicsDevice.Viewport.Width,
            graphicsDevice.Viewport.Height,
            0f,
            0f,
            1f);

        graphicsDevice.BlendState = BlendState.AlphaBlend;
        graphicsDevice.DepthStencilState = DepthStencilState.None;
        graphicsDevice.RasterizerState = RasterizerState.CullNone;
        graphicsDevice.SamplerStates[0] = SamplerState.LinearWrap;

        foreach (var tile in tiles)
        {
            var texture = ResolveTexture(tile.TextureKey, texturesByKey) ?? _pixel;
            _terrainEffect.Texture = texture;

            foreach (var pass in _terrainEffect.CurrentTechnique.Passes)
            {
                pass.Apply();
                var vertices = BuildHexFan(tile, MaterialTint(tile.BaseColor));
                graphicsDevice.DrawUserPrimitives(
                    PrimitiveType.TriangleList,
                    vertices,
                    0,
                    6);
            }
        }
    }

    private void DrawTileOverlays(SpriteBatch spriteBatch, RenderableTile tile)
    {
        var size = Math.Max(1f, tile.Size);
        if (tile.OwnerTribeId >= 0)
        {
            DrawTerritoryTint(spriteBatch, tile.Center, size * 0.94f, TribeColor(tile.OwnerTribeId));
        }

        if (tile.IsDisputed)
        {
            DrawHexOutline(spriteBatch, tile.Center, size * 0.96f, new Color(240, 98, 72, 220), 2.2f);
        }

        if (tile.HasCamp)
        {
            DrawCampMarker(spriteBatch, tile.Center + new Vector2(size * 0.10f, -size * 0.08f), size * 0.34f, new Color(232, 205, 126, 210));
        }
    }

    private void DrawTribe(SpriteBatch spriteBatch, RenderableTribe tribe, bool isSelected)
    {
        var radius = Math.Max(3f, tribe.Radius);

        if (tribe.TerritoryRadius > 0f)
        {
            DrawCircleOutline(spriteBatch, tribe.Position, tribe.TerritoryRadius, new Color(tribe.Color, 45), 36, 1.5f);
        }

        if (tribe.HasCamp)
        {
            var camp = tribe.CampPosition == default ? tribe.Position : tribe.CampPosition;
            DrawCampMarker(spriteBatch, camp, radius * 1.45f, new Color(tribe.Color, 112));
            DrawCampMarker(spriteBatch, camp, radius * 1.10f, new Color(28, 30, 24, 150));
        }

        DrawCircle(spriteBatch, tribe.Position, radius, tribe.Color, 24);
        DrawCircleOutline(spriteBatch, tribe.Position, radius + 1.5f, new Color(20, 20, 20, 200), 24, 2f);

        if (isSelected)
        {
            DrawCircleOutline(spriteBatch, tribe.Position, radius + 6f, new Color(255, 238, 128, 240), 32, 3f);
        }

        if (tribe.Population > 0)
        {
            var markerWidth = MathHelper.Clamp(tribe.Population * 0.25f, radius * 0.8f, radius * 2.2f);
            FillRect(spriteBatch, CenteredRect(tribe.Position + new Vector2(0f, radius + 5f), markerWidth, 3f), new Color(230, 235, 225, 150));
        }
    }

    private static VertexPositionColorTexture[] BuildHexFan(RenderableTile tile, Color tint)
    {
        var corners = HexCorners(tile.Center, Math.Max(1f, tile.Size));
        var vertices = new VertexPositionColorTexture[18];
        var cursor = 0;

        for (var i = 0; i < corners.Length; i++)
        {
            var next = corners[(i + 1) % corners.Length];
            vertices[cursor++] = TerrainVertex(tile.Center, tint);
            vertices[cursor++] = TerrainVertex(corners[i], tint);
            vertices[cursor++] = TerrainVertex(next, tint);
        }

        return vertices;
    }

    private static VertexPositionColorTexture TerrainVertex(Vector2 position, Color tint)
    {
        return new VertexPositionColorTexture(
            new Vector3(position, 0f),
            tint,
            new Vector2(position.X / MaterialWorldScale, position.Y / MaterialWorldScale));
    }

    private static Color MaterialTint(Color baseColor)
    {
        return Color.Lerp(baseColor, Color.White, 0.24f);
    }

    private void DrawTerritoryTint(SpriteBatch spriteBatch, Vector2 center, float size, Color color)
    {
        DrawHexFill(spriteBatch, center, size, new Color(color, 36));
        DrawHexOutline(spriteBatch, center, size, new Color(color, 92), 1.15f);
    }

    private static Texture2D? ResolveTexture(
        string? textureKey,
        IReadOnlyDictionary<string, Texture2D>? texturesByKey)
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

    private void DrawRectOutline(SpriteBatch spriteBatch, FloatRect rect, Color color, float thickness)
    {
        DrawLine(spriteBatch, new Vector2(rect.Left, rect.Top), new Vector2(rect.Right, rect.Top), color, thickness);
        DrawLine(spriteBatch, new Vector2(rect.Right, rect.Top), new Vector2(rect.Right, rect.Bottom), color, thickness);
        DrawLine(spriteBatch, new Vector2(rect.Right, rect.Bottom), new Vector2(rect.Left, rect.Bottom), color, thickness);
        DrawLine(spriteBatch, new Vector2(rect.Left, rect.Bottom), new Vector2(rect.Left, rect.Top), color, thickness);
    }

    private void DrawHexOutline(SpriteBatch spriteBatch, Vector2 center, float radius, Color color, float thickness)
    {
        var corners = HexCorners(center, radius);
        for (var i = 0; i < corners.Length; i++)
        {
            DrawLine(spriteBatch, corners[i], corners[(i + 1) % corners.Length], color, thickness);
        }
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
        if (length <= 0.001f)
        {
            return;
        }

        var angle = MathF.Atan2(delta.Y, delta.X);
        spriteBatch.Draw(
            _pixel,
            start,
            null,
            color,
            angle,
            new Vector2(0f, 0.5f),
            new Vector2(length, Math.Max(1f, thickness)),
            SpriteEffects.None,
            0f);
    }

    private static FloatRect CenteredRect(Vector2 center, float width, float height)
    {
        return new FloatRect(center.X - width * 0.5f, center.Y - height * 0.5f, width, height);
    }

    private static float Clamp01(float value)
    {
        return MathHelper.Clamp(value, 0f, 1f);
    }

    private readonly record struct FloatRect(float X, float Y, float Width, float Height)
    {
        public float Left => X;

        public float Top => Y;

        public float Right => X + Width;

        public float Bottom => Y + Height;

        public Rectangle ToRectangle()
        {
            return new Rectangle(
                (int)MathF.Round(X),
                (int)MathF.Round(Y),
                (int)MathF.Round(Width),
                (int)MathF.Round(Height));
        }
    }
}
