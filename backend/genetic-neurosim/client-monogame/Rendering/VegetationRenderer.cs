using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using SharpGLTF.Schema2;
using TribalNeuroSim.Client.Assets;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Models;
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
    private readonly Dictionary<string, ModelMeshData> _loadedModels = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, List<Matrix>> _instancesByModel = new(StringComparer.OrdinalIgnoreCase);
    private BasicEffect? _effect;
    private GraphicsDevice? _effectDevice;

    // Default model scale — glTF models from StylizedNatureMegaKit tend to be large (meters),
    // so we scale down to fit hex tiles (~28 world units per hex).
    private const float TreeScale = 0.16f;
    private const float BushScale = 0.12f;
    private const float TentScale = 0.20f;
    private const float RockScale = 0.10f;

    // Maximum instances per model key before we start culling (performance safety)
    private const int MaxInstancesPerModel = 2000;

    public VegetationRenderer(GraphicsDevice graphicsDevice, string? contentRoot = null)
    {
        _graphicsDevice = graphicsDevice ?? throw new ArgumentNullException(nameof(graphicsDevice));
        _contentRoot = RuntimeAssetLoader.ResolveContentRoot(contentRoot)
                       ?? throw new InvalidOperationException(
                           "Cannot resolve Content root for VegetationRenderer.");
    }

    // ─────────────────────────────────────────────────────────────
    //  Model loading
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Load a glTF/GLB model from disk. <paramref name="relativePath"/> should NOT include
    /// an extension — we try .gltf then .glb automatically.
    /// </summary>
    public void LoadModel(string modelKey, string relativePath)
    {
        if (_loadedModels.ContainsKey(modelKey))
            return;

        var basePath = Path.Combine(
            _contentRoot,
            relativePath.Replace('/', Path.DirectorySeparatorChar));

        var fullPath = ResolveModelPath(basePath);
        if (fullPath is null)
        {
            System.Diagnostics.Debug.WriteLine(
                $"[VegetationRenderer] Model not found (tried .gltf/.glb): {basePath}");
            return;
        }

        try
        {
            var modelRoot = ModelRoot.Load(fullPath);
            var meshData = ExtractMeshData(_graphicsDevice, modelRoot);
            _loadedModels[modelKey] = meshData;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine(
                $"[VegetationRenderer] Failed to load {fullPath}: {ex.Message}");
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

        return null;
    }

    // ─────────────────────────────────────────────────────────────
    //  Instance collection from simulation
    // ─────────────────────────────────────────────────────────────

    public void ClearInstances()
    {
        foreach (var list in _instancesByModel.Values)
            list.Clear();
    }

    public void CollectInstances(PlayableSimulation simulation, AssetRegistry registry)
    {
        ClearInstances();

        foreach (var tile in simulation.Tiles)
        {
            var biome = tile.Biome;
            var profile = registry.ResolveBiome(biome);
            var center = TileToWorld(tile);
            var rng = new Random(tile.Id * 1337 + 42); // Deterministic per tile

            // --- Camp tent ---
            var hasCamp = simulation.Tribes.Any(
                t => t.MainCampTileId == tile.Id && t.IsAlive);
            if (hasCamp)
            {
                PlaceTent(center, rng);
            }

            // --- Vegetation by biome ---
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
                    ScatterProps(center, rng, profile.PropAssetKeys, 0, 3);
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
                    // Riverland, Unknown: no vegetation props (river/docks are structures)
                    break;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Render
    // ─────────────────────────────────────────────────────────────

    public void Render(IsometricCamera camera, GraphicsDevice graphicsDevice)
    {
        if (_loadedModels.Count == 0 || _instancesByModel.Count == 0)
            return;

        EnsureEffect(graphicsDevice);

        var view = camera.GetView();
        var projection = camera.GetProjection();

        graphicsDevice.BlendState = BlendState.AlphaBlend;
        graphicsDevice.DepthStencilState = DepthStencilState.Default;
        graphicsDevice.RasterizerState = RasterizerState.CullCounterClockwise;
        graphicsDevice.SamplerStates[0] = SamplerState.LinearWrap;

        foreach (var (modelKey, instances) in _instancesByModel)
        {
            if (instances.Count == 0)
                continue;

            if (!_loadedModels.TryGetValue(modelKey, out var meshData))
                continue;

            graphicsDevice.SetVertexBuffer(meshData.VertexBuffer);
            graphicsDevice.Indices = meshData.IndexBuffer;

            foreach (var world in instances)
            {
                _effect!.World = world;
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
        _instancesByModel.Clear();
        _effect?.Dispose();
        _effect = null;
        _effectDevice = null;
    }

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

            AddInstance(propKey, world);
        }
    }

    private void PlaceTent(Vector3 center, Random rng)
    {
        const string tentKey = "Models/Structures/KenneySurvivalKit/tent";
        const string campfireKey = "Models/Structures/KenneySurvivalKit/campfire-pit";

        if (_loadedModels.ContainsKey(tentKey))
        {
            var rot = (float)(rng.NextDouble() * Math.Tau * 0.5); // Limited rotation
            var world = Matrix.CreateScale(TentScale)
                      * Matrix.CreateRotationY(rot)
                      * Matrix.CreateTranslation(center + new Vector3(0f, 0.05f, 0f));
            AddInstance(tentKey, world);
        }

        if (_loadedModels.ContainsKey(campfireKey))
        {
            var world = Matrix.CreateScale(TentScale * 0.7f)
                      * Matrix.CreateTranslation(
                          center + new Vector3(2.5f, 0f, -2f));
            AddInstance(campfireKey, world);
        }
    }

    private void AddInstance(string modelKey, Matrix world)
    {
        if (!_instancesByModel.TryGetValue(modelKey, out var list))
        {
            list = new List<Matrix>();
            _instancesByModel[modelKey] = list;
        }

        if (list.Count < MaxInstancesPerModel)
            list.Add(world);
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

    private static Vector3 TileToWorld(PlayableTile tile)
    {
        // Match PlayableRenderAdapter.TileCenter() hex layout
        const float tileSize = 28f;
        var horizontalSpacing = MathF.Sqrt(3f) * tileSize;
        var rowOffset = tile.Y % 2 == 0 ? 0f : horizontalSpacing * 0.5f;
        var x = tile.X * horizontalSpacing + rowOffset;
        var z = tile.Y * tileSize * 1.5f;
        return new Vector3(x, 0f, z);
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
            VertexColorEnabled = true,
            LightingEnabled = true,
            AmbientLightColor = new Vector3(0.22f, 0.24f, 0.20f),
            DiffuseColor = new Vector3(0.35f, 0.48f, 0.22f),
        };
        _effect.EnableDefaultLighting();
    }

    // ─────────────────────────────────────────────────────────────
    //  glTF mesh extraction via SharpGLTF
    // ─────────────────────────────────────────────────────────────

    private static ModelMeshData ExtractMeshData(GraphicsDevice graphicsDevice, ModelRoot modelRoot)
    {
        var allVertices = new List<VertexPositionNormalTexture>();
        var allIndices = new List<ushort>();
        var primitiveCount = 0;

        foreach (var mesh in modelRoot.LogicalMeshes)
        {
            foreach (var primitive in mesh.Primitives)
            {
                var positions = primitive.GetVertexAccessor("POSITION")?.AsVector3Array();
                var normals = primitive.GetVertexAccessor("NORMAL")?.AsVector3Array();
                var texCoords = primitive.GetVertexAccessor("TEXCOORD_0")?.AsVector2Array();
                var indices = primitive.GetIndices();

                if (positions is null || indices is null)
                    continue;

                var baseVertex = allVertices.Count;

                for (var i = 0; i < positions.Count; i++)
                {
                    var pos = positions[i];
                    var nrm = normals is not null && i < normals.Count
                        ? normals[i] : Vector3.UnitY;
                    var tex = texCoords is not null && i < texCoords.Count
                        ? texCoords[i] : Vector2.Zero;

                    // glTF Y-up → MonoGame Y-up (same), no conversion needed.
                    // Flip texture V coordinate (glTF origin bottom-left, MonoGame top-left).
                    allVertices.Add(new VertexPositionNormalTexture(
                        new Vector3(pos.X, pos.Y, pos.Z),
                        new Vector3(nrm.X, nrm.Y, nrm.Z),
                        new Vector2(tex.X, 1f - tex.Y)));
                }

                foreach (var idx in indices)
                {
                    allIndices.Add((ushort)(baseVertex + idx));
                }

                primitiveCount += indices.Count / 3;
            }
        }

        if (allVertices.Count == 0 || allIndices.Count == 0)
            throw new InvalidOperationException("Model contains no usable geometry.");

        var vertexArray = new VertexPositionNormalTexture[allVertices.Count];
        allVertices.CopyTo(vertexArray);

        var indexArray = new ushort[allIndices.Count];
        allIndices.CopyTo(indexArray);

        return new ModelMeshData(graphicsDevice, vertexArray, indexArray, primitiveCount);
    }

    // ─────────────────────────────────────────────────────────────
    //  GPU buffer holder (eagerly created at load time)
    // ─────────────────────────────────────────────────────────────

    private sealed class ModelMeshData : IDisposable
    {
        public VertexBuffer VertexBuffer { get; }
        public IndexBuffer IndexBuffer { get; }
        public int VertexCount { get; }
        public int PrimitiveCount { get; }

        public ModelMeshData(
            GraphicsDevice graphicsDevice,
            VertexPositionNormalTexture[] vertices,
            ushort[] indices,
            int primitiveCount)
        {
            VertexCount = vertices.Length;
            PrimitiveCount = primitiveCount;

            VertexBuffer = new VertexBuffer(
                graphicsDevice,
                typeof(VertexPositionNormalTexture),
                vertices.Length,
                BufferUsage.WriteOnly);
            VertexBuffer.SetData(vertices);

            IndexBuffer = new IndexBuffer(
                graphicsDevice,
                IndexElementSize.SixteenBits,
                indices.Length,
                BufferUsage.WriteOnly);
            IndexBuffer.SetData(indices);
        }

        public void Dispose()
        {
            VertexBuffer.Dispose();
            IndexBuffer.Dispose();
        }
    }
}
