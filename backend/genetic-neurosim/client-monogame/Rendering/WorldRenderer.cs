using System.Linq;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Assets;
using TribalNeuroSim.Client.Domain;

// ReSharper disable NotAccessedPositionalProperty.Global — BiomeId used by WorldRenderer

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
    bool HasCamp = false,
    int X = 0,
    int Y = 0,
    float VisualElevation = 0f,
    int[]? ContestingTribeIds = null,
    BiomeId Biome = BiomeId.Unknown);

public readonly record struct RenderableTribe(
    int Id,
    Vector2 Position,
    float Radius,
    Color Color,
    int Population = 0,
    bool HasCamp = false,
    Vector2 CampPosition = default,
    float TerritoryRadius = 0f,
    PolityTier Tier = PolityTier.Tribe,
    int MainCampTileId = -1,
    BiomeId? Biome = null);

public sealed class WorldRenderer : IDisposable
{
    private Texture2D? _pixel;
    private GraphicsDevice? _graphicsDevice;
    private BasicEffect? _hexEffect;
    private TerritoryRenderer? _territoryRenderer;
    private HexTerrainMesh? _hexMesh;

    // Biome-keyed AO-baked diffuse textures
    private readonly Dictionary<string, Texture2D> _biomeTextures = new(StringComparer.OrdinalIgnoreCase);
    private PbrTextureBaker? _textureBaker;
    private bool _texturesLoaded;

    // Cache biome profiles by BiomeId for fast ambient-tint lookups
    private readonly Dictionary<BiomeId, Color> _ambientTintCache = new();

    public void DrawWorld(
        SpriteBatch spriteBatch,
        IReadOnlyList<RenderableTile> tiles,
        IReadOnlyList<RenderableTribe> tribes,
        IsometricCamera camera,
        int selectedTribeId,
        IReadOnlyDictionary<string, Texture2D>? texturesByKey = null)
    {
        DrawTerrainLayers(spriteBatch, tiles, camera);
        DrawSymbolOverlays(spriteBatch, tiles, tribes, camera, selectedTribeId);
    }

    public void DrawTerrainLayers(
        SpriteBatch spriteBatch,
        IReadOnlyList<RenderableTile> tiles,
        IsometricCamera camera)
    {
        EnsureEffects(spriteBatch.GraphicsDevice);
        LoadBiomeTextures();
        DrawHexTerrain(spriteBatch.GraphicsDevice, tiles, camera);
        DrawTerritoryOverlays(spriteBatch, tiles, camera);
    }

    public void DrawSymbolOverlays(
        SpriteBatch spriteBatch,
        IReadOnlyList<RenderableTile> tiles,
        IReadOnlyList<RenderableTribe> tribes,
        IsometricCamera camera,
        int selectedTribeId)
    {
        EnsureEffects(spriteBatch.GraphicsDevice);
        DrawSpriteOverlays(spriteBatch, tiles, tribes, camera, selectedTribeId);
    }

    public void Dispose()
    {
        _hexEffect?.Dispose();
        _hexEffect = null;
        _pixel?.Dispose();
        _pixel = null;
        _territoryRenderer?.Dispose();
        _territoryRenderer = null;
        _hexMesh?.Dispose();
        _hexMesh = null;
        _textureBaker?.Dispose();
        _textureBaker = null;
        foreach (var tex in _biomeTextures.Values)
            tex.Dispose();
        _biomeTextures.Clear();
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

        // --- Hex terrain effect: textured + lit ---
        _hexEffect?.Dispose();
        _hexEffect = new BasicEffect(graphicsDevice)
        {
            TextureEnabled = true,
            VertexColorEnabled = false,
            LightingEnabled = true,
            PreferPerPixelLighting = true,
            AmbientLightColor = new Vector3(0.45f, 0.45f, 0.42f),
            DiffuseColor = new Vector3(1.0f, 1.0f, 0.98f),
        };
        _hexEffect.DirectionalLight0.Enabled = true;
        _hexEffect.DirectionalLight0.Direction = Vector3.Normalize(new Vector3(0.5f, -1f, -0.3f));
        _hexEffect.DirectionalLight0.DiffuseColor = new Vector3(0.85f, 0.82f, 0.70f);
        _hexEffect.DirectionalLight1.Enabled = true;
        _hexEffect.DirectionalLight1.Direction = Vector3.Normalize(new Vector3(-0.3f, -0.6f, 0.5f));
        _hexEffect.DirectionalLight1.DiffuseColor = new Vector3(0.25f, 0.28f, 0.35f);

        // --- Hex mesh (shared geometry for all tiles) ---
        _hexMesh?.Dispose();
        _hexMesh = new HexTerrainMesh();
        _hexMesh.Initialize(graphicsDevice, 28f); // hex radius = tile size

        // --- Territory renderer ---
        _territoryRenderer?.Dispose();
        _territoryRenderer = new TerritoryRenderer();
        _territoryRenderer.Initialize(graphicsDevice);

        // --- PBR texture baker ---
        var contentRoot = RuntimeAssetLoader.ResolveContentRoot();
        if (contentRoot is not null)
        {
            _textureBaker?.Dispose();
            _textureBaker = new PbrTextureBaker(graphicsDevice, contentRoot);
        }

        _texturesLoaded = false;
    }

    // ─────────────────────────────────────────────────────────────
    //  PBR texture loading (AO-baked diffuse per biome)
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Biome texture mapping: biome texture key → PBR base name.
    /// Each entry maps to {baseName}_diff_1k.png and {baseName}_ao_1k.png.
    /// </summary>
    private static readonly (string Key, string BaseName)[] BiomeTextureMap =
    [
        // Default/primary terrain — rocky_terrain_02 (grass + rocks, used for most biomes)
        (RuntimeAssetCatalog.GrassMedium, "rocky_terrain_02"),
        (RuntimeAssetCatalog.ForestGround, "forrest_ground_01"),
        (RuntimeAssetCatalog.BrownMud, "brown_mud"),
        (RuntimeAssetCatalog.Dirt, "dirt"),
        (RuntimeAssetCatalog.CoastSand, "coast_sand_01"),
        (RuntimeAssetCatalog.Snow, "snow_01"),
        (RuntimeAssetCatalog.GrayRocks, "gray_rocks"),
        (RuntimeAssetCatalog.StoneWall, "stone_wall"),
    ];

    private void LoadBiomeTextures()
    {
        if (_texturesLoaded || _textureBaker is null)
            return;

        foreach (var (key, baseName) in BiomeTextureMap)
        {
            var tex = _textureBaker.LoadBakedTerrain(key, baseName);
            if (tex is not null)
                _biomeTextures[key] = tex;
        }

        // Populate ambient tint cache from AssetManifest
        _ambientTintCache.Clear();
        foreach (var profile in AssetManifest.BiomeProfiles)
            _ambientTintCache[profile.Biome] = profile.AmbientTint;

        _texturesLoaded = true;
    }

    private Texture2D? ResolveBiomeTexture(string? textureKey)
    {
        if (textureKey is null) return null;
        return _biomeTextures.TryGetValue(textureKey, out var tex) ? tex : null;
    }

    // ─────────────────────────────────────────────────────────────
    //  Hex terrain rendering (proper hex tiles with UV-mapped textures)
    // ─────────────────────────────────────────────────────────────

    private void DrawHexTerrain(
        GraphicsDevice graphicsDevice,
        IReadOnlyList<RenderableTile> tiles,
        IsometricCamera camera)
    {
        if (_hexEffect is null || _hexMesh is null || tiles.Count == 0)
            return;

        var view = camera.GetView();
        var projection = camera.GetProjection();

        _hexEffect.View = view;
        _hexEffect.Projection = projection;

        graphicsDevice.BlendState = BlendState.Opaque;
        graphicsDevice.DepthStencilState = DepthStencilState.Default;
        graphicsDevice.RasterizerState = RasterizerState.CullCounterClockwise;
        graphicsDevice.SamplerStates[0] = SamplerState.LinearWrap;

        // Group tiles by (BiomeId, TextureKey) for per-biome ambient tint
        var groups = new Dictionary<(BiomeId Biome, string TextureKey), List<RenderableTile>>();
        foreach (var tile in tiles)
        {
            var key = tile.TextureKey ?? "default";
            var groupKey = (tile.Biome, key);
            if (!groups.TryGetValue(groupKey, out var list))
            {
                list = new List<RenderableTile>();
                groups[groupKey] = list;
            }
            list.Add(tile);
        }

        foreach (var ((biome, textureKey), batch) in groups)
        {
            // Resolve texture; fall back to Plains texture if missing
            var texture = ResolveBiomeTexture(textureKey);
            if (texture is null)
            {
                texture = ResolveBiomeTexture(RuntimeAssetCatalog.GrassMedium) ?? _pixel!;
            }
            _hexEffect.Texture = texture;

            // Apply per-biome ambient tint
            if (_ambientTintCache.TryGetValue(biome, out var tint))
                _hexEffect.AmbientLightColor = tint.ToVector3();
            else
                _hexEffect.AmbientLightColor = new Vector3(0.45f, 0.45f, 0.42f); // default

            foreach (var tile in batch)
            {
                _hexMesh.Draw(graphicsDevice, _hexEffect, tile.Center, tile.Size, tile.VisualElevation);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Territory border overlay (clean borders only, no crosshatch noise)
    // ─────────────────────────────────────────────────────────────

    private void DrawTerritoryOverlays(
        SpriteBatch spriteBatch,
        IReadOnlyList<RenderableTile> tiles,
        IsometricCamera camera)
    {
        if (_territoryRenderer is null || tiles.Count == 0)
            return;

        var gridWidth = tiles.Max(t => t.X) + 1;
        var gridHeight = tiles.Max(t => t.Y) + 1;

        _territoryRenderer.DrawBorders(spriteBatch, tiles, gridWidth, gridHeight, camera, _graphicsDevice!.Viewport, camera.Distance);
        _territoryRenderer.DrawDisputedZones(spriteBatch, tiles, camera, _graphicsDevice!.Viewport, camera.Distance);
    }

    // ─────────────────────────────────────────────────────────────
    //  2D SpriteBatch overlays (camps, tribes)
    // ─────────────────────────────────────────────────────────────

    private void DrawSpriteOverlays(
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
            DrawTileMarker(spriteBatch, tile, camera, _graphicsDevice.Viewport);

        foreach (var tribe in tribes)
            DrawTribe(spriteBatch, tribe, tribe.Id == selectedTribeId, camera, _graphicsDevice.Viewport);

        spriteBatch.End();
    }

    private void DrawTileMarker(SpriteBatch spriteBatch, RenderableTile tile, IsometricCamera camera, Viewport viewport)
    {
        var screenCenter = camera.HexToScreen(tile.Center, viewport);

        var worldRadius = Math.Max(1f, tile.Size);
        var edgeScreen = camera.HexToScreen(tile.Center + new Vector2(worldRadius, 0f), viewport);
        var screenRadius = Vector2.Distance(screenCenter, edgeScreen);

        if (screenRadius < 2f) return;
    }

    private void DrawTribe(SpriteBatch spriteBatch, RenderableTribe tribe, bool isSelected, IsometricCamera camera, Viewport viewport)
    {
        var screenPos = camera.HexToScreen(tribe.Position, viewport);
        var edgeScreen = camera.HexToScreen(tribe.Position + new Vector2(tribe.Radius, 0f), viewport);
        var screenRadius = Math.Max(3f, Vector2.Distance(screenPos, edgeScreen));

        if (screenRadius < 1f) return;

        if (isSelected)
        {
            DrawHexOutline(spriteBatch, screenPos, screenRadius, new Color(255, 238, 128, 230), 2.5f);
        }

    }

    // ─────────────────────────────────────────────────────────────
    //  SpriteBatch 2D drawing primitives
    // ─────────────────────────────────────────────────────────────

    private void DrawHexOutline(SpriteBatch spriteBatch, Vector2 center, float radius, Color color, float thickness)
    {
        var corners = HexCorners(center, radius);
        for (var i = 0; i < corners.Length; i++)
            DrawLine(spriteBatch, corners[i], corners[(i + 1) % corners.Length], color, thickness);
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
