using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Assets;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Models;
using PrimitiveType = Microsoft.Xna.Framework.Graphics.PrimitiveType;

namespace TribalNeuroSim.Client.Rendering;

public sealed class SettlementRenderer : IDisposable
{
    private readonly GraphicsDevice _graphicsDevice;
    private readonly string _contentRoot;
    private readonly AssetLoadDiagnostics _diagnostics;
    private readonly Dictionary<string, ModelMeshData> _loadedModels = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Texture2D> _loadedTextures = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<SettlementDraw> _drawList = new();
    private BasicEffect? _effect;
    private GraphicsDevice? _effectDevice;

    /// <summary>Render stats from the most recent Render() call.</summary>
    public SettlementRenderStats LastStats { get; private set; }

    private const float DefaultSettlementScale = 0.22f;
    private const float TileWidth = 34f;

    public SettlementRenderer(GraphicsDevice graphicsDevice, string? contentRoot = null)
    {
        _graphicsDevice = graphicsDevice ?? throw new ArgumentNullException(nameof(graphicsDevice));
        _contentRoot = RuntimeAssetLoader.ResolveContentRoot(contentRoot)
                       ?? throw new InvalidOperationException("Cannot resolve Content root for SettlementRenderer.");
        _diagnostics = new AssetLoadDiagnostics(_contentRoot);
        _diagnostics.Reset();
        _diagnostics.Info($"SettlementRenderer content root: {_contentRoot}");
    }

    // ─────────────────────────────────────────────────────────────
    //  Model loading
    // ─────────────────────────────────────────────────────────────

    public void LoadModel(string modelKey, string relativePath)
    {
        if (_loadedModels.ContainsKey(modelKey))
        {
            _diagnostics.Info($"SKIP already loaded settlement key={modelKey}");
            return;
        }

        var basePath = Path.Combine(
            _contentRoot,
            relativePath.Replace('/', Path.DirectorySeparatorChar));

        var fullPath = ResolveModelPath(basePath);
        if (fullPath is null)
        {
            _diagnostics.Error($"MISSING settlement key={modelKey} basePath={basePath} tried=.gltf,.glb,.fbx");
            return;
        }

        try
        {
            var isFbx = Path.GetExtension(fullPath).Equals(".fbx", StringComparison.OrdinalIgnoreCase);
            _diagnostics.Info($"LOAD settlement begin key={modelKey} path={fullPath} importer={(isFbx ? "AssimpNet" : "SharpGLTF")}");
            var meshData = isFbx
                ? ModelMeshData.FromFbx(_graphicsDevice, fullPath, _diagnostics)
                : ModelMeshData.FromGltfFile(_graphicsDevice, fullPath, _diagnostics);
            _loadedModels[modelKey] = meshData;
            TryLoadTextures(fullPath, modelKey);

            _diagnostics.Info(
                $"LOAD settlement ok key={modelKey} vertices={meshData.VertexCount} indices={meshData.IndexCount} " +
                $"primitives={meshData.PrimitiveCount} boundsMin={meshData.Bounds.Min} boundsMax={meshData.Bounds.Max} " +
                $"horizontalExtent={meshData.HorizontalExtent:0.###} hasNormals={meshData.HasNormals}");
        }
        catch (Exception ex)
        {
            _diagnostics.Error($"LOAD settlement failed key={modelKey} path={fullPath}", ex);
        }
    }

    public bool IsModelLoaded(string modelKey) => _loadedModels.ContainsKey(modelKey);

    public IReadOnlyList<string> LoadedModelKeys => _loadedModels.Keys.ToArray();

    /// <summary>Draw list populated by CollectInstances, consumed by BlobShadowRenderer.</summary>
    public IReadOnlyList<SettlementDraw> DrawList => _drawList;

    // ─────────────────────────────────────────────────────────────
    //  Instance collection from simulation
    // ─────────────────────────────────────────────────────────────

    public void CollectInstances(PlayableSimulation simulation, AssetRegistry registry)
    {
        _drawList.Clear();

        foreach (var tribe in simulation.Tribes.Where(t => t.IsAlive))
        {
            if (tribe.MainCampTileId < 0 || tribe.MainCampTileId >= simulation.Tiles.Count)
                continue;

            var tile = simulation.Tiles[tribe.MainCampTileId];
            var center = TileToWorld(simulation, tile);

            // Resolve model key via tier + biome fallback chain
            var profile = registry.ResolveSettlement(tribe.Tier, tile.Biome);
            var modelKey = ResolveLoadedSettlementKey(profile.ModelAssetKey, tribe.Tier, tile.Biome, registry);

            if (modelKey is not null && _loadedModels.TryGetValue(modelKey, out var meshData))
            {
                var scale = FitModelToTile(meshData, TileWidth) * TierScaleMultiplier(tribe.Tier);
                var yLift = GroundLift(meshData, scale, tribe.Tier);
                _drawList.Add(new SettlementDraw(
                    TribeId: tribe.Id,
                    Position: center + new Vector3(0f, yLift, 0f),
                    Scale: scale,
                    ModelKey: modelKey,
                    Tier: tribe.Tier,
                    HorizontalExtent: meshData.HorizontalExtent));
            }
            else
            {
                // Fallback: Kenney compound from available structure models
                AddKenneyCompound(center, new Random(tribe.Id * 1337 + 42));
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Render with LOD
    // ─────────────────────────────────────────────────────────────

    public void Render(GraphicsDevice graphicsDevice, IsometricCamera camera, int selectedTribeId)
    {
        if (_drawList.Count == 0 || _loadedModels.Count == 0)
            return;

        EnsureEffect(graphicsDevice);

        var view = camera.GetView();
        var projection = camera.GetProjection();
        var cameraDistance = camera.Distance;

        graphicsDevice.BlendState = BlendState.AlphaBlend;
        graphicsDevice.DepthStencilState = DepthStencilState.Default;
        graphicsDevice.RasterizerState = RasterizerState.CullNone;
        graphicsDevice.SamplerStates[0] = SamplerState.LinearWrap;

        // Sort draws: selected first, then by LOD level (close before far), then by tier
        var allWithLod = _drawList
            .Select(draw => (Draw: draw, Lod: SelectLod(draw, cameraDistance, selectedTribeId)))
            .ToArray();

        var drawn = allWithLod
            .OrderByDescending(x => x.Draw.TribeId == selectedTribeId)
            .ThenBy(x => x.Lod)
            .ThenByDescending(x => (int)x.Draw.Tier)
            .Take(SettlementLodCatalog.MaxSettlementDraws)
            .ToArray();

        // Populate render stats
        var closeCount = 0;
        var midCount = 0;
        var farCulled = 0;
        long totalPrimitives = 0;
        foreach (var (_, lod) in allWithLod)
        {
            switch (lod)
            {
                case SettlementLodLevel.Close: closeCount++; break;
                case SettlementLodLevel.Mid: midCount++; break;
                case SettlementLodLevel.Far: farCulled++; break;
            }
        }
        foreach (var (draw, _) in drawn)
        {
            if (_loadedModels.TryGetValue(draw.ModelKey, out var md))
                totalPrimitives += md.PrimitiveCount;
        }
        LastStats = new SettlementRenderStats(closeCount, midCount, farCulled, (int)Math.Min(totalPrimitives, int.MaxValue));

        foreach (var (draw, lod) in drawn)
        {
            if (!_loadedModels.TryGetValue(draw.ModelKey, out var meshData))
                continue;

            graphicsDevice.SetVertexBuffer(meshData.VertexBuffer);
            graphicsDevice.Indices = meshData.IndexBuffer;

            if (_loadedTextures.TryGetValue(draw.ModelKey, out var texture))
            {
                _effect!.TextureEnabled = true;
                _effect.Texture = texture;
            }
            else
            {
                _effect!.TextureEnabled = false;
                _effect.Texture = null;
            }

            var world = Matrix.CreateScale(draw.Scale)
                      * Matrix.CreateTranslation(draw.Position);

            _effect!.World = world;
            _effect.DiffuseColor = DiffuseColorFor(draw.ModelKey);
            _effect.View = view;
            _effect.Projection = projection;

            foreach (var pass in _effect.CurrentTechnique.Passes)
            {
                pass.Apply();
                graphicsDevice.DrawIndexedPrimitives(
                    PrimitiveType.TriangleList,
                    0,
                    0,
                    meshData.PrimitiveCount);
            }
        }
    }

    public void Dispose()
    {
        foreach (var mesh in _loadedModels.Values)
            mesh.Dispose();
        _loadedModels.Clear();
        foreach (var tex in _loadedTextures.Values)
            tex.Dispose();
        _loadedTextures.Clear();
        _drawList.Clear();
        _effect?.Dispose();
        _effect = null;
        _effectDevice = null;
    }

    // ─────────────────────────────────────────────────────────────
    //  LOD selection
    // ─────────────────────────────────────────────────────────────

    private static SettlementLodLevel SelectLod(SettlementDraw draw, float cameraDistance, int selectedTribeId)
    {
        if (draw.TribeId == selectedTribeId)
            return SettlementLodLevel.Close;

        var profile = SettlementLodCatalog.Resolve(draw.Tier);

        if (cameraDistance <= profile.CloseDistance)
            return SettlementLodLevel.Close;
        if (cameraDistance <= profile.MidDistance)
            return SettlementLodLevel.Mid;

        return SettlementLodLevel.Mid;
    }

    // ─────────────────────────────────────────────────────────────
    //  Settlement model resolution with tier fallback
    // ─────────────────────────────────────────────────────────────

    private string? ResolveLoadedSettlementKey(
        string preferredKey,
        PolityTier tier,
        BiomeId biome,
        AssetRegistry registry)
    {
        if (_loadedModels.ContainsKey(preferredKey))
            return preferredKey;

        var fallbackTiers = tier switch
        {
            PolityTier.Empire => new[] { PolityTier.Kingdom, PolityTier.Duchy, PolityTier.City, PolityTier.Tribe },
            PolityTier.Kingdom => new[] { PolityTier.Duchy, PolityTier.City, PolityTier.Tribe },
            PolityTier.Duchy => new[] { PolityTier.City, PolityTier.Tribe },
            PolityTier.City => new[] { PolityTier.Tribe },
            _ => Array.Empty<PolityTier>(),
        };

        foreach (var fallbackTier in fallbackTiers)
        {
            var fallbackProfile = registry.ResolveSettlement(fallbackTier, biome);
            if (_loadedModels.ContainsKey(fallbackProfile.ModelAssetKey))
                return fallbackProfile.ModelAssetKey;
        }

        return null;
    }

    // ─────────────────────────────────────────────────────────────
    //  Kenney compound fallback
    // ─────────────────────────────────────────────────────────────

    private void AddKenneyCompound(Vector3 center, Random rng)
    {
        const string tentKey = "Models/Structures/KenneySurvivalKit/tent";
        const string tentCanvasKey = "Models/Structures/KenneySurvivalKit/tent-canvas";
        const string structureKey = "Models/Structures/KenneySurvivalKit/structure";
        const string fenceKey = "Models/Structures/KenneySurvivalKit/fence";
        const string campfireKey = "Models/Structures/KenneySurvivalKit/campfire-pit";
        const string resourceWoodKey = "Models/Structures/KenneySurvivalKit/resource-wood";
        const string resourceStoneKey = "Models/Structures/KenneySurvivalKit/resource-stone";
        const string workbenchKey = "Models/Structures/KenneySurvivalKit/workbench";

        const float tentScale = 0.20f;
        const float structureScale = 0.22f;

        TryAddKenneyPiece(structureKey, center + new Vector3(0f, 0.05f, 0f), structureScale, rng, 0f);
        TryAddKenneyPiece(tentKey, center + new Vector3(-4.5f, 0.04f, 2.8f), tentScale * 0.78f, rng, -0.4f);
        TryAddKenneyPiece(tentCanvasKey, center + new Vector3(4.4f, 0.04f, 2.4f), tentScale * 0.72f, rng, 0.3f);
        TryAddKenneyPiece(campfireKey, center + new Vector3(1.8f, 0.04f, -3.1f), tentScale * 0.62f, rng, 0f);
        TryAddKenneyPiece(resourceWoodKey, center + new Vector3(-5.2f, 0.04f, -3.4f), tentScale * 0.58f, rng, 0.2f);
        TryAddKenneyPiece(resourceStoneKey, center + new Vector3(5.0f, 0.04f, -3.6f), tentScale * 0.54f, rng, -0.2f);
        TryAddKenneyPiece(workbenchKey, center + new Vector3(0.2f, 0.04f, 5.0f), tentScale * 0.58f, rng, 0.4f);

        for (var i = 0; i < 4; i++)
        {
            var angle = MathHelper.PiOver2 * i;
            var offset = new Vector3(MathF.Cos(angle) * 7.0f, 0.03f, MathF.Sin(angle) * 7.0f);
            TryAddKenneyPiece(fenceKey, center + offset, tentScale * 0.62f, rng, angle);
        }
    }

    private void TryAddKenneyPiece(string modelKey, Vector3 position, float scale, Random rng, float rotationOffset)
    {
        if (!_loadedModels.TryGetValue(modelKey, out _))
            return;

        var rotation = rotationOffset + (float)(rng.NextDouble() * 0.18 - 0.09);
        var scaleVar = scale * (0.92f + (float)rng.NextDouble() * 0.14f);
        var world = Matrix.CreateScale(scaleVar)
                  * Matrix.CreateRotationY(rotation)
                  * Matrix.CreateTranslation(position);

        _drawList.Add(new SettlementDraw(
            TribeId: -1000 - rng.Next(1000), // Negative range to avoid collision with real tribe IDs
            Position: position,
            Scale: scaleVar,
            ModelKey: modelKey,
            Tier: PolityTier.Tribe,
            HorizontalExtent: 0f));
    }

    // ─────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────

    private static float FitModelToTile(ModelMeshData model, float targetWidth)
    {
        var scale = targetWidth / MathF.Max(0.001f, model.HorizontalExtent);
        return MathHelper.Clamp(scale, 0.001f, 20f);
    }

    private static float TierScaleMultiplier(PolityTier tier)
    {
        return tier switch
        {
            PolityTier.City => 1.12f,
            PolityTier.Duchy => 1.24f,
            PolityTier.Kingdom => 1.38f,
            PolityTier.Empire => 1.54f,
            _ => 1f,
        };
    }

    private static float GroundLift(ModelMeshData meshData, float scale, PolityTier tier)
    {
        var tierBoost = tier switch
        {
            PolityTier.City => 0.12f,
            PolityTier.Duchy => 0.18f,
            PolityTier.Kingdom => 0.24f,
            PolityTier.Empire => 0.30f,
            _ => 0.08f,
        };

        return MathF.Max(0.05f, -meshData.Bounds.Min.Y * scale + tierBoost);
    }

    private static Vector3 TileToWorld(PlayableSimulation simulation, PlayableTile tile)
    {
        const float tileSize = 28f;
        var horizontalSpacing = MathF.Sqrt(3f) * tileSize;
        var rowOffset = tile.Y % 2 == 0 ? 0f : horizontalSpacing * 0.5f;
        var x = tile.X * horizontalSpacing + rowOffset;
        var z = tile.Y * tileSize * 1.5f;
        var tileElevation = PlayableWorldGenerator.VisualElevation(
            simulation.Seed, simulation.Width, simulation.Height,
            tile.X, tile.Y, tile.Biome);
        var y = PlayableWorldGenerator.VisualSurfaceElevation(
            simulation.Seed, simulation.Width, simulation.Height,
            x, z, tile.Biome, tileElevation);
        return new Vector3(x, y, z);
    }

    private void TryLoadTextures(string modelPath, string modelKey)
    {
        var extensionless = Path.Combine(
            Path.GetDirectoryName(modelPath) ?? string.Empty,
            Path.GetFileNameWithoutExtension(modelPath));

        var diffuse = FindFirstExisting([
            extensionless + ".png",
            extensionless + "_diffuse.png",
            extensionless + "_albedo.png",
            extensionless + "_AlbedoTransparency.png",
        ]);

        if (diffuse is null)
        {
            _diagnostics.Info($"TEXTURE none settlement key={modelKey} fallback=diffuseColor");
            return;
        }

        using var stream = File.OpenRead(diffuse);
        _loadedTextures[modelKey] = Texture2D.FromStream(_graphicsDevice, stream);
        _diagnostics.Info($"TEXTURE diffuse settlement key={modelKey} path={Path.GetFileName(diffuse)} size={_loadedTextures[modelKey].Width}x{_loadedTextures[modelKey].Height}");
    }

    private static string? FindFirstExisting(string[] candidates)
    {
        foreach (var candidate in candidates)
        {
            if (File.Exists(candidate))
                return candidate;
        }
        return null;
    }

    private static string? ResolveModelPath(string basePath)
    {
        var gltf = basePath + ".gltf";
        if (File.Exists(gltf)) return gltf;

        var glb = basePath + ".glb";
        if (File.Exists(glb)) return glb;

        var fbx = basePath + ".fbx";
        if (File.Exists(fbx)) return fbx;

        if (File.Exists(basePath)) return basePath;

        return null;
    }

    private void EnsureEffect(GraphicsDevice graphicsDevice)
    {
        if (_effect is not null && ReferenceEquals(_effectDevice, graphicsDevice))
            return;

        _effect?.Dispose();
        _effectDevice = graphicsDevice;
        _effect = new BasicEffect(graphicsDevice)
        {
            TextureEnabled = false,
            VertexColorEnabled = false,
            LightingEnabled = true,
            PreferPerPixelLighting = true,
        };
        SceneLighting.ApplyTo(_effect);
    }

    private static Vector3 DiffuseColorFor(string modelKey)
    {
        var lower = modelKey.ToLowerInvariant();
        if (lower.Contains("tent") || lower.Contains("structure") || lower.Contains("fence") || lower.Contains("workbench"))
            return new Vector3(0.58f, 0.45f, 0.31f);
        if (lower.Contains("resource-wood"))
            return new Vector3(0.45f, 0.33f, 0.22f);
        if (lower.Contains("campfire"))
            return new Vector3(0.70f, 0.42f, 0.22f);
        // Settlement buildings — warmer tones
        if (lower.Contains("tribal") || lower.Contains("city") || lower.Contains("duchy") ||
            lower.Contains("kingdom") || lower.Contains("empire") || lower.Contains("settlement"))
            return new Vector3(0.75f, 0.68f, 0.55f);

        return new Vector3(0.58f, 0.55f, 0.48f);
    }

    public readonly record struct SettlementDraw(
        int TribeId,
        Vector3 Position,
        float Scale,
        string ModelKey,
        PolityTier Tier,
        float HorizontalExtent);
}

public readonly record struct SettlementRenderStats(
    int CloseCount,
    int MidCount,
    int FarCulledCount,
    int TotalPrimitives);
