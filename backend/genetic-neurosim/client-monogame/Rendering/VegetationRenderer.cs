using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using SharpGLTF.Schema2;
using TribalNeuroSim.Client.Assets;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Protocol;
using PrimitiveType = Microsoft.Xna.Framework.Graphics.PrimitiveType;

namespace TribalNeuroSim.Client.Rendering;

/// <summary>
/// Loads vegetation/structure models at runtime and renders them with batched GPU draw calls.
/// Forest biomes get scattered trees. Camp tiles get tent models.
/// </summary>
public sealed class VegetationRenderer : IDisposable
{
    private readonly GraphicsDevice _graphicsDevice;
    private readonly string _contentRoot;
    private readonly AssetLoadDiagnostics _diagnostics;
    private readonly Dictionary<string, ModelMeshData> _loadedModels = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Texture2D> _loadedTextures = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _reportedMissingBatchModels = new(StringComparer.OrdinalIgnoreCase);
    private readonly PropInstanceBatch _batch = new();
    private BasicEffect? _effect;
    private GraphicsDevice? _effectDevice;

    // Default model scale — glTF models from StylizedNatureMegaKit tend to be large (meters),
    // so we scale down to fit hex tiles (~28 world units per hex).
    private const float TreeScale = 0.16f;
    private const float BushScale = 0.12f;
    private const float TentScale = 0.20f;
    private const float RockScale = 0.10f;

    public VegetationRenderer(GraphicsDevice graphicsDevice, string? contentRoot = null)
    {
        _graphicsDevice = graphicsDevice ?? throw new ArgumentNullException(nameof(graphicsDevice));
        _contentRoot = RuntimeAssetLoader.ResolveContentRoot(contentRoot)
                       ?? throw new InvalidOperationException(
                           "Cannot resolve Content root for VegetationRenderer.");
        _diagnostics = new AssetLoadDiagnostics(_contentRoot);
        _diagnostics.Reset();
        _diagnostics.Info($"Content root: {_contentRoot}");
    }

    // ─────────────────────────────────────────────────────────────
    //  Model loading
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Load a runtime model from disk. Extensionless paths try .gltf, .glb, then .fbx.
    /// </summary>
    public void LoadModel(string modelKey, string relativePath)
    {
        if (_loadedModels.ContainsKey(modelKey))
        {
            _diagnostics.Info($"SKIP already loaded key={modelKey}");
            return;
        }

        var basePath = Path.Combine(
            _contentRoot,
            relativePath.Replace('/', Path.DirectorySeparatorChar));

        var fullPath = ResolveModelPath(basePath);
        if (fullPath is null)
        {
            _diagnostics.Error($"MISSING key={modelKey} basePath={basePath} tried=.gltf,.glb,.fbx");
            return;
        }

        try
        {
            var isFbx = Path.GetExtension(fullPath).Equals(".fbx", StringComparison.OrdinalIgnoreCase);
            var importerLabel = isFbx ? "AssimpNet" : "SharpGLTF";
            _diagnostics.Info($"LOAD begin key={modelKey} path={fullPath} importer={importerLabel}");
            var meshData = isFbx
                ? ModelMeshData.FromFbx(_graphicsDevice, fullPath, _diagnostics)
                : ModelMeshData.FromGltfFile(_graphicsDevice, fullPath, _diagnostics);
            _loadedModels[modelKey] = meshData;
            if (TryLoadMaterialTextures(fullPath, modelKey))
            {
                _diagnostics.Info($"TEXTURE loaded key={modelKey} pbr=checked");
            }
            else
            {
                _diagnostics.Info($"TEXTURE none key={modelKey} fallback=diffuseColor");
            }

            _diagnostics.Info(
                $"LOAD ok key={modelKey} vertices={meshData.VertexCount} indices={meshData.IndexCount} primitives={meshData.PrimitiveCount} " +
                $"boundsMin={meshData.Bounds.Min} boundsMax={meshData.Bounds.Max} horizontalExtent={meshData.HorizontalExtent:0.###} " +
                $"indexFormat=32bit culling=CullNone winding=unverified normals={meshData.HasNormals} " +
                $"transformPolicy=PreTransformVertices+MakeLeftHanded+FlipUVs");
        }
        catch (Exception ex)
        {
            _diagnostics.Error($"LOAD failed key={modelKey} path={fullPath}", ex);
        }
    }

    public bool IsModelLoaded(string modelKey)
    {
        return _loadedModels.ContainsKey(modelKey);
    }

    private static string? ResolveModelPath(string basePath)
    {
        var gltf = basePath + ".gltf";
        if (File.Exists(gltf))
            return gltf;

        var glb = basePath + ".glb";
        if (File.Exists(glb))
            return glb;

        var fbx = basePath + ".fbx";
        if (File.Exists(fbx))
            return fbx;

        if (File.Exists(basePath))
            return basePath;

        return null;
    }

    // ─────────────────────────────────────────────────────────────
    //  Instance collection from simulation
    // ─────────────────────────────────────────────────────────────

    public void ClearInstances()
    {
        _batch.Clear();
    }

    /// Network-mode overload: collect instances from RenderableTile list (no PlayableSimulation).
    public void CollectInstances(IReadOnlyList<RenderableTile> tiles, IReadOnlyList<RenderableTribe> tribes, AssetRegistry registry, float cameraDistance = 200f)
    {
        // Skip vegetation entirely when camera is extremely far or the map is very large.
        // This prevents planning/building hundreds of thousands of prop instances on large network maps.
        const int LargeMapTileThreshold = 3000;
        const float MaxVegetationDistance = 1500f;

        if (cameraDistance > MaxVegetationDistance || tiles.Count > LargeMapTileThreshold)
        {
            ClearInstances();
            return;
        }

        ClearInstances();

        var rules = AssetManifest.BiomePropRules;
        var profiles = AssetManifest.PropProfiles;

        if (rules.Count > 0 && profiles.Count > 0)
        {
            var capitalTileIds = new HashSet<int>(tribes.Select(t => t.MainCampTileId));
            var planned = PropPlacementPlanner.Plan(tiles, capitalTileIds, rules, profiles, cameraDistance);
            _batch.Build(planned, cameraDistance);
        }
    }

    /// <summary>
    /// Collect prop instances from the rule-driven placement planner.
    /// Falls back to inline scattering if no biome prop rules are registered.
    /// </summary>
    public void CollectInstances(PlayableSimulation simulation, AssetRegistry registry, float cameraDistance = 200f)
    {
        ClearInstances();

        var rules = AssetManifest.BiomePropRules;
        var profiles = AssetManifest.PropProfiles;

        if (rules.Count > 0 && profiles.Count > 0)
        {
            var planned = PropPlacementPlanner.Plan(simulation, rules, profiles, cameraDistance);
            _batch.Build(planned, cameraDistance);
        }
        else
        {
            // Fallback: inline scattering for backward compatibility
            CollectInstancesInline(simulation, registry);
        }
    }

    /// <summary>
    /// Legacy inline prop collection — used when manifest rules are not available.
    /// </summary>
    private void CollectInstancesInline(PlayableSimulation simulation, AssetRegistry registry)
    {
        foreach (var tile in simulation.Tiles)
        {
            var biome = tile.Biome;
            var profile = registry.ResolveBiome(biome);
            var center = TileToWorld(simulation, tile);
            var rng = new Random(tile.Id * 1337 + 42);

            switch (biome)
            {
                case BiomeId.DenseForest:
                    ScatterProps(center, rng, profile.PropAssetKeys, 5, 12);
                    break;
                case BiomeId.SparseWoodland:
                    ScatterProps(center, rng, profile.PropAssetKeys, 2, 6);
                    break;
                case BiomeId.Plains:
                case BiomeId.FertileValley:
                    ScatterProps(center, rng, profile.PropAssetKeys, 5, 11);
                    break;
                case BiomeId.Marsh:
                    ScatterProps(center, rng, profile.PropAssetKeys, 1, 4);
                    break;
                case BiomeId.Cold:
                    ScatterProps(center, rng, profile.PropAssetKeys, 1, 5);
                    break;
                case BiomeId.DrySteppe:
                    ScatterProps(center, rng, profile.PropAssetKeys, 1, 3);
                    break;
                case BiomeId.Hills:
                    ScatterProps(center, rng, profile.PropAssetKeys, 1, 4);
                    break;
                case BiomeId.Mountains:
                    ScatterProps(center, rng, profile.PropAssetKeys, 1, 3);
                    break;
                default:
                    break;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Render
    // ─────────────────────────────────────────────────────────────

    public void Render(IsometricCamera camera, GraphicsDevice graphicsDevice, float totalSeconds)
    {
        if (_loadedModels.Count == 0 || _batch.TotalInstanceCount == 0)
            return;

        EnsureEffect(graphicsDevice);

        var view = camera.GetView();
        var projection = camera.GetProjection();

        graphicsDevice.BlendState = BlendState.AlphaBlend;
        graphicsDevice.DepthStencilState = DepthStencilState.Default;
        graphicsDevice.RasterizerState = RasterizerState.CullNone;
        graphicsDevice.SamplerStates[0] = SamplerState.LinearWrap;

        foreach (var (modelKey, instances) in _batch.Batches)
        {
            if (instances.Count == 0)
                continue;

            if (!_loadedModels.TryGetValue(modelKey, out var meshData))
            {
                if (_reportedMissingBatchModels.Add(modelKey))
                    _diagnostics.Error($"BATCH skipped missing model key={modelKey} instances={instances.Count}");
                continue;
            }

            graphicsDevice.SetVertexBuffer(meshData.VertexBuffer);
            graphicsDevice.Indices = meshData.IndexBuffer;
            if (_loadedTextures.TryGetValue(modelKey, out var texture))
            {
                _effect!.TextureEnabled = true;
                _effect.Texture = texture;
            }
            else
            {
                _effect!.TextureEnabled = false;
                _effect.Texture = null;
            }

            foreach (var instance in instances)
            {
                _effect!.World = ApplyWind(modelKey, instance.World, instance.WindPhase, totalSeconds);
                _effect.DiffuseColor = DiffuseColorFor(modelKey);
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
    }

    public void Dispose()
    {
        foreach (var mesh in _loadedModels.Values)
            mesh.Dispose();
        _loadedModels.Clear();
        foreach (var texture in _loadedTextures.Values)
            texture.Dispose();
        _loadedTextures.Clear();
        _batch.Clear();
        _effect?.Dispose();
        _effect = null;
        _effectDevice = null;
    }

    // ─────────────────────────────────────────────────────────────
    //  M12E: Isolated viewer mode — render one model at origin
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Render a single model at world origin with basic lighting for validation.
    /// Culling disabled so unverified winding still produces visible geometry.
    /// Caller provides a fixed camera already aimed at origin.
    /// </summary>
    public void RenderIsolatedModel(
        string modelKey,
        GraphicsDevice graphicsDevice,
        IsometricCamera camera,
        float scale,
        float rotationRadians,
        float totalSeconds)
    {
        if (!_loadedModels.TryGetValue(modelKey, out var meshData))
        {
            _diagnostics.Error($"ISOLATED missing key={modelKey}");
            return;
        }

        EnsureEffect(graphicsDevice);

        var view = camera.GetView();
        var projection = camera.GetProjection();

        graphicsDevice.BlendState = BlendState.AlphaBlend;
        graphicsDevice.DepthStencilState = DepthStencilState.Default;
        graphicsDevice.RasterizerState = RasterizerState.CullNone;
        graphicsDevice.SamplerStates[0] = SamplerState.LinearWrap;

        graphicsDevice.SetVertexBuffer(meshData.VertexBuffer);
        graphicsDevice.Indices = meshData.IndexBuffer;

        if (_loadedTextures.TryGetValue(modelKey, out var texture))
        {
            _effect!.TextureEnabled = true;
            _effect.Texture = texture;
        }
        else
        {
            _effect!.TextureEnabled = false;
            _effect.Texture = null;
        }

        var world = Matrix.CreateScale(scale)
                  * Matrix.CreateRotationY(rotationRadians)
                  * Matrix.CreateTranslation(Vector3.Zero);

        _effect!.World = world;
        _effect.DiffuseColor = DiffuseColorFor(modelKey);
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

        _diagnostics.Info(
            $"ISOLATED render key={modelKey} vertices={meshData.VertexCount} indices={meshData.IndexCount} " +
            $"primitives={meshData.PrimitiveCount} boundsMin={meshData.Bounds.Min} boundsMax={meshData.Bounds.Max} " +
            $"horizontalExtent={meshData.HorizontalExtent:0.###} hasNormals={meshData.HasNormals} " +
            $"scale={scale:0.###} rotation={rotationRadians:0.###}");
    }

    public IReadOnlyList<string> LoadedModelKeys => _loadedModels.Keys.ToArray();

    /// <summary>Total prop instances across all batches (for M17 performance HUD).</summary>
    public int BatchTotalInstances => _batch.TotalInstanceCount;

    // ─────────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────────

    private void ScatterProps(
        Vector3 center,
        Random rng,
        IReadOnlyList<string> propKeys,
        int minCount,
        int maxCount)
    {
        if (propKeys.Count == 0)
            return;

        var count = minCount + rng.Next(maxCount - minCount + 1);
        var tileRadius = 12f; // Half of ~24 world-unit tile

        for (var i = 0; i < count; i++)
        {
            // Random position within tile radius, avoiding center
            var angle = (float)(rng.NextDouble() * Math.Tau);
            var dist = 2f + (float)rng.NextDouble() * (tileRadius - 3f);
            var offsetX = MathF.Cos(angle) * dist;
            var offsetZ = MathF.Sin(angle) * dist;

            // Pick a random prop from the biome's list
            var propKey = propKeys[rng.Next(propKeys.Count)];

            // Only place models that have been loaded
            if (!_loadedModels.ContainsKey(propKey))
                continue;

            var rotation = (float)(rng.NextDouble() * Math.Tau);
            var scale = GetModelScale(propKey);
            // Slight random scale variation for natural look
            var scaleVar = scale * (0.85f + (float)rng.NextDouble() * 0.30f);

            var world = Matrix.CreateScale(scaleVar)
                      * Matrix.CreateRotationY(rotation)
                      * Matrix.CreateTranslation(
                          center.X + offsetX,
                          0f, // Ground plane
                          center.Z + offsetZ);

            AddInstance(propKey, world, (float)rng.NextDouble() * MathHelper.TwoPi);
        }
    }

    private void AddInstance(string modelKey, Matrix world, float windPhase)
    {
        _batch.Add(modelKey, world, windPhase);
    }

    private static float GetModelScale(string modelKey)
    {
        var lower = modelKey.ToLowerInvariant();
        if (lower.Contains("tree") || lower.Contains("pine") || lower.Contains("birch")
            || lower.Contains("willow") || lower.Contains("palm") || lower.Contains("oak")
            || lower.Contains("spruce"))
            return TreeScale;
        if (lower.Contains("bush") || lower.Contains("fern") || lower.Contains("grass")
            || lower.Contains("plant") || lower.Contains("flower"))
            return BushScale;
        if (lower.Contains("rock") || lower.Contains("stone") || lower.Contains("boulder"))
            return RockScale;
        if (lower.Contains("tent") || lower.Contains("campfire"))
            return TentScale;
        if (lower.Contains("log") || lower.Contains("stump"))
            return BushScale * 1.5f;
        if (lower.Contains("cactus"))
            return TreeScale * 0.8f;

        return TreeScale;
    }

    private static Vector3 TileToWorld(PlayableSimulation simulation, PlayableTile tile)
    {
        // Match PlayableRenderAdapter.TileCenter() hex layout
        const float tileSize = 28f;
        var horizontalSpacing = MathF.Sqrt(3f) * tileSize;
        var rowOffset = tile.Y % 2 == 0 ? 0f : horizontalSpacing * 0.5f;
        var x = tile.X * horizontalSpacing + rowOffset;
        var z = tile.Y * tileSize * 1.5f;
        var tileElevation = PlayableWorldGenerator.VisualElevation(
            simulation.Seed,
            simulation.Width,
            simulation.Height,
            tile.X,
            tile.Y,
            tile.Biome);
        var y = PlayableWorldGenerator.VisualSurfaceElevation(
            simulation.Seed,
            simulation.Width,
            simulation.Height,
            x,
            z,
            tile.Biome,
            tileElevation);
        return new Vector3(x, y, z);
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
            AmbientLightColor = new Vector3(0.22f, 0.24f, 0.20f),
            DiffuseColor = new Vector3(0.35f, 0.48f, 0.22f),
        };
        _effect.EnableDefaultLighting();
    }

    private static Matrix ApplyWind(string modelKey, Matrix world, float windPhase, float totalSeconds)
    {
        if (!IsWindAffected(modelKey))
            return world;

        var translation = world.Translation;
        var local = world;
        local.Translation = Vector3.Zero;

        var sway = MathF.Sin(totalSeconds * 1.7f + windPhase + translation.X * 0.04f + translation.Z * 0.03f) * 0.055f;
        return local
             * Matrix.CreateRotationX(sway)
             * Matrix.CreateRotationZ(sway * 0.42f)
             * Matrix.CreateTranslation(translation);
    }

    private static bool IsWindAffected(string modelKey)
    {
        var lower = modelKey.ToLowerInvariant();
        return lower.Contains("grass")
            || lower.Contains("plant")
            || lower.Contains("fern")
            || lower.Contains("flower")
            || lower.Contains("bush");
    }

    private static Vector3 DiffuseColorFor(string modelKey)
    {
        var lower = modelKey.ToLowerInvariant();
        if (lower.Contains("rock") || lower.Contains("stone"))
            return new Vector3(0.48f, 0.48f, 0.43f);
        if (lower.Contains("dead"))
            return new Vector3(0.42f, 0.36f, 0.28f);
        if (lower.Contains("tent") || lower.Contains("structure") || lower.Contains("fence") || lower.Contains("workbench"))
            return new Vector3(0.58f, 0.45f, 0.31f);
        if (lower.Contains("resource-wood"))
            return new Vector3(0.45f, 0.33f, 0.22f);
        if (lower.Contains("campfire"))
            return new Vector3(0.70f, 0.42f, 0.22f);
        if (lower.Contains("pine") || lower.Contains("tree"))
            return new Vector3(0.25f, 0.40f, 0.20f);
        if (lower.Contains("grass") || lower.Contains("fern") || lower.Contains("plant"))
            return new Vector3(0.38f, 0.56f, 0.22f);

        return new Vector3(0.36f, 0.48f, 0.24f);
    }

    // ─────────────────────────────────────────────────────────────
    //  glTF / FBX helpers
    // ─────────────────────────────────────────────────────────────

    private bool TryLoadMaterialTextures(string modelPath, string modelKey)
    {
        var extensionless = Path.Combine(
            Path.GetDirectoryName(modelPath) ?? string.Empty,
            Path.GetFileNameWithoutExtension(modelPath));

        // 1. Diffuse (primary — always try first)
        var diffuse = FindFirstExisting([
            extensionless + ".png",
            extensionless + "_diffuse.png",
            extensionless + "_albedo.png",
            extensionless + "_AlbedoTransparency.png",
        ]);

        if (diffuse is null)
            return false;

        using var stream = File.OpenRead(diffuse);
        _loadedTextures[modelKey] = Texture2D.FromStream(_graphicsDevice, stream);
        _diagnostics.Info($"TEXTURE diffuse key={modelKey} path={Path.GetFileName(diffuse)} size={_loadedTextures[modelKey].Width}x{_loadedTextures[modelKey].Height}");

        // 2. Normal (optional)
        var normal = FindFirstExisting([
            extensionless + "_normal.png",
            extensionless + "_Normal.png",
        ]);
        if (normal is not null)
            _diagnostics.Info($"TEXTURE normal key={modelKey} path={Path.GetFileName(normal)} found");

        // 3. Metallic (optional)
        var metallic = FindFirstExisting([
            extensionless + "_metallic.png",
            extensionless + "_Metallic.png",
        ]);
        if (metallic is not null)
            _diagnostics.Info($"TEXTURE metallic key={modelKey} path={Path.GetFileName(metallic)} found");

        // 4. Roughness (optional)
        var roughness = FindFirstExisting([
            extensionless + "_roughness.png",
            extensionless + "_Roughness.png",
        ]);
        if (roughness is not null)
            _diagnostics.Info($"TEXTURE roughness key={modelKey} path={Path.GetFileName(roughness)} found");

        return true;
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
}
