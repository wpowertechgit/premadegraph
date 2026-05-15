using System.Linq;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Assets;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Protocol;

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
    BiomeId Biome = BiomeId.Unknown,
    int TerrainSeed = 0,
    int MapWidth = 1,
    int MapHeight = 1,
    int ReliefNeighborMask = 0);

public readonly record struct RenderableTribe(
    int Id,
    string Name,
    Vector2 Position,
    float Radius,
    Color Color,
    int Population = 0,
    bool HasCamp = false,
    Vector2 CampPosition = default,
    float TerritoryRadius = 0f,
    PolityTier Tier = PolityTier.Tribe,
    int MainCampTileId = -1,
    BiomeId? Biome = null,
    ArtifactVector Artifacts = default,
    int ConstituentCount = 1);

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

    public int LastTerrainTilesDrawn { get; private set; }
    public string LastTerrainMode { get; private set; } = "none";

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
        LastTerrainTilesDrawn = 0;
        LastTerrainMode = "none";

        if (camera.Distance <= 900f)
        {
            LastTerrainMode = "hex";
            DrawHexTerrain(spriteBatch.GraphicsDevice, tiles, camera);
            DrawTerritoryOverlays(spriteBatch, tiles, camera);
            DrawWaterOverlay(spriteBatch, tiles, camera);
        }
        else
        {
            LastTerrainMode = "flat";
            // Strategic/overview zoom: render flat 2D biome quads so the map is always visible.
            // Owned tiles show tribe color. Much cheaper than 3D mesh at this scale.
            DrawFlatTerrainOverview(spriteBatch, tiles, camera);
            DrawTerritoryOverlays(spriteBatch, tiles, camera);
        }
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
        };
        SceneLighting.ApplyTo(_hexEffect);

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
    //  Flat 2D overview rendering (strategic/far zoom)
    // ─────────────────────────────────────────────────────────────

    private void DrawFlatTerrainOverview(
        SpriteBatch spriteBatch,
        IReadOnlyList<RenderableTile> tiles,
        IsometricCamera camera)
    {
        if (_pixel is null || _graphicsDevice is null || tiles.Count == 0)
            return;

        var viewport = _graphicsDevice.Viewport;
        var (aabbMinX, aabbMinY, aabbMaxX, aabbMaxY) = ComputeVisibleAabb(camera, viewport, tiles[0].Size * 3f);

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.PointClamp);

        // Pre-project two reference points to get screen tile size
        var sampleCenter = tiles[tiles.Count / 2].Center;
        var screenSample = camera.HexToScreen(sampleCenter, viewport);
        var screenSampleEdge = camera.HexToScreen(sampleCenter + new Vector2(tiles[0].Size, 0f), viewport);
        var screenTileRadius = Math.Max(1f, Vector2.Distance(screenSample, screenSampleEdge));
        var pixelSize = Math.Max(1, (int)MathF.Ceiling(screenTileRadius * 2.0f));

        foreach (var tile in tiles)
        {
            if (tile.Center.X < aabbMinX || tile.Center.X > aabbMaxX ||
                tile.Center.Y < aabbMinY || tile.Center.Y > aabbMaxY)
                continue;

            var screenCenter = camera.HexToScreen(tile.Center, viewport);
            var x = (int)(screenCenter.X - pixelSize * 0.5f);
            var y = (int)(screenCenter.Y - pixelSize * 0.5f);

            Color color;
            if (tile.OwnerTribeId >= 0)
            {
                var tribeColor = TribeVisuals.ColorForTribe(tile.OwnerTribeId);
                color = new Color(tribeColor.R, tribeColor.G, tribeColor.B, (byte)200);
            }
            else
            {
                color = new Color(tile.BaseColor.R, tile.BaseColor.G, tile.BaseColor.B, (byte)220);
            }

            spriteBatch.Draw(_pixel, new Rectangle(x, y, pixelSize, pixelSize), color);
            LastTerrainTilesDrawn++;
        }

        spriteBatch.End();
    }

    // ─────────────────────────────────────────────────────────────
    //  Hex terrain rendering (proper hex tiles with UV-mapped textures)
    // ─────────────────────────────────────────────────────────────

    /// Compute visible world-space AABB from viewport corners with margin.
    public static (float MinX, float MinY, float MaxX, float MaxY) ComputeVisibleAabbStatic(
        IsometricCamera camera, Viewport viewport, float margin)
        => ComputeVisibleAabb(camera, viewport, margin);

    private static (float MinX, float MinY, float MaxX, float MaxY) ComputeVisibleAabb(
        IsometricCamera camera, Viewport viewport, float margin)
    {
        Span<Vector2> corners = stackalloc Vector2[4];
        corners[0] = camera.ScreenToWorld2D(new Vector2(0f, 0f), viewport);
        corners[1] = camera.ScreenToWorld2D(new Vector2(viewport.Width, 0f), viewport);
        corners[2] = camera.ScreenToWorld2D(new Vector2(0f, viewport.Height), viewport);
        corners[3] = camera.ScreenToWorld2D(new Vector2(viewport.Width, viewport.Height), viewport);

        var minX = float.MaxValue;
        var minY = float.MaxValue;
        var maxX = float.MinValue;
        var maxY = float.MinValue;
        foreach (var c in corners)
        {
            if (c.X < minX) minX = c.X;
            if (c.Y < minY) minY = c.Y;
            if (c.X > maxX) maxX = c.X;
            if (c.Y > maxY) maxY = c.Y;
        }
        return (minX - margin, minY - margin, maxX + margin, maxY + margin);
    }

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
        graphicsDevice.RasterizerState = RasterizerState.CullNone;
        graphicsDevice.SamplerStates[0] = SamplerState.LinearWrap;

        var viewport = graphicsDevice.Viewport;
        var (aabbMinX, aabbMinY, aabbMaxX, aabbMaxY) = ComputeVisibleAabb(camera, viewport, tiles[0].Size * 2f);

        // AABB cull is the only filter — terrain is only called at Distance <= 900f
        // so the visible tile count is already small; stride sampling removed because
        // modulo-index skipping creates visible zigzag seams.
        var groups = new Dictionary<(BiomeId Biome, string TextureKey), List<RenderableTile>>();
        foreach (var tile in tiles)
        {
            if (tile.Center.X < aabbMinX || tile.Center.X > aabbMaxX ||
                tile.Center.Y < aabbMinY || tile.Center.Y > aabbMaxY)
                continue;

            var key = tile.TextureKey ?? "default";
            var groupKey = (tile.Biome, key);
            if (!groups.TryGetValue(groupKey, out var list))
            {
                list = new List<RenderableTile>();
                groups[groupKey] = list;
            }
            list.Add(tile);
            LastTerrainTilesDrawn++;
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
                _hexMesh.Draw(
                    graphicsDevice,
                    _hexEffect,
                    tile.TileId,
                    tile.Center,
                    tile.Size,
                    tile.VisualElevation,
                    tile.Biome,
                    tile.TerrainSeed,
                    tile.MapWidth,
                    tile.MapHeight,
                    tile.ReliefNeighborMask);
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

        // MapWidth/MapHeight are baked into every tile — O(1) vs O(n) LINQ
        var gridWidth  = tiles[0].MapWidth;
        var gridHeight = tiles[0].MapHeight;
        if (gridWidth <= 0 || gridHeight <= 0)
            return;

        _territoryRenderer.DrawBorders(spriteBatch, tiles, gridWidth, gridHeight, camera, _graphicsDevice!.Viewport, camera.Distance);
        _territoryRenderer.DrawDisputedZones(spriteBatch, tiles, camera, _graphicsDevice!.Viewport, camera.Distance);
    }

    // ─────────────────────────────────────────────────────────────
    //  Riverland water overlay
    // ─────────────────────────────────────────────────────────────

    private void DrawWaterOverlay(
        SpriteBatch spriteBatch,
        IReadOnlyList<RenderableTile> tiles,
        IsometricCamera camera)
    {
        if (_pixel is null || _graphicsDevice is null) return;

        if (camera.Distance > 900f) return;

        var waterColor = new Color(30, 90, 180, 90);
        var viewport = _graphicsDevice.Viewport;
        var (aabbMinX, aabbMinY, aabbMaxX, aabbMaxY) = ComputeVisibleAabb(camera, viewport, tiles[0].Size * 2f);

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend);

        foreach (var tile in tiles)
        {
            if (tile.Biome != BiomeId.Riverland) continue;
            if (tile.Center.X < aabbMinX || tile.Center.X > aabbMaxX ||
                tile.Center.Y < aabbMinY || tile.Center.Y > aabbMaxY)
                continue;

            var screenCenter = camera.HexToScreen(tile.Center, viewport);
            var screenEdge = camera.HexToScreen(tile.Center + new Vector2(tile.Size, 0f), viewport);
            var screenRadius = Vector2.Distance(screenCenter, screenEdge);
            if (screenRadius < 2f) continue;

            var corners = HexCorners(screenCenter, screenRadius);
            FillHexScanline(spriteBatch, corners, waterColor);
        }

        spriteBatch.End();
    }

    private void FillHexScanline(SpriteBatch spriteBatch, Vector2[] corners, Color color)
    {
        var minY = corners[0].Y;
        var maxY = corners[0].Y;
        for (var i = 1; i < corners.Length; i++)
        {
            if (corners[i].Y < minY) minY = corners[i].Y;
            if (corners[i].Y > maxY) maxY = corners[i].Y;
        }

        for (var y = (int)MathF.Ceiling(minY); y <= (int)MathF.Floor(maxY); y++)
        {
            var xMin = float.MaxValue;
            var xMax = float.MinValue;
            for (var i = 0; i < corners.Length; i++)
            {
                var a = corners[i];
                var b = corners[(i + 1) % corners.Length];
                if ((a.Y <= y && b.Y >= y) || (b.Y <= y && a.Y >= y))
                {
                    var dy = b.Y - a.Y;
                    if (MathF.Abs(dy) < 0.001f) continue;
                    var x = a.X + (y - a.Y) * (b.X - a.X) / dy;
                    if (x < xMin) xMin = x;
                    if (x > xMax) xMax = x;
                }
            }
            if (xMax > xMin)
                spriteBatch.Draw(_pixel, new Rectangle((int)xMin, y, (int)(xMax - xMin) + 1, 1), color);
        }
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

        var vp = _graphicsDevice.Viewport;
        var tileSize = tiles.Count > 0 ? tiles[0].Size : 28f;
        var (aabbMinX, aabbMinY, aabbMaxX, aabbMaxY) = ComputeVisibleAabb(camera, vp, tileSize * 2f);

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        foreach (var tile in tiles)
        {
            if (tile.Center.X < aabbMinX || tile.Center.X > aabbMaxX ||
                tile.Center.Y < aabbMinY || tile.Center.Y > aabbMaxY)
                continue;
            DrawTileMarker(spriteBatch, tile, camera, vp);
        }

        foreach (var tribe in tribes)
        {
            if (tribe.Position.X < aabbMinX || tribe.Position.X > aabbMaxX ||
                tribe.Position.Y < aabbMinY || tribe.Position.Y > aabbMaxY)
                continue;
            DrawTribe(spriteBatch, tribe, tribe.Id == selectedTribeId, camera, vp);
        }

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
