using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Models;

namespace TribalNeuroSim.Client.Rendering;

/// <summary>
/// Generates a reusable pointy-top hex surface. The mesh is subdivided so biome
/// height functions can shape hills and mountains inside each tile.
/// </summary>
public sealed class HexTerrainMesh : IDisposable
{
    private const int ReliefRings = 7;
    public const int TerrainPrimitivesPerTile = ReliefRings * ReliefRings * 6;

    private IndexBuffer? _indexBuffer;
    private readonly Dictionary<TerrainMeshCacheKey, VertexBuffer> _tileVertexBuffers = new();
    private Vector3[] _basePositions = [];
    private Vector2[] _baseUvs = [];
    private VertexPositionNormalTexture[] _vertices = [];
    private int[] _indices = [];
    private int _primitiveCount;
    private float _hexRadius;

    /// <summary>
    /// Number of triangles in the mesh.
    /// </summary>
    public int PrimitiveCount => _primitiveCount;

    /// <summary>
    /// Create a subdivided hex terrain mesh. A small inset creates visible seam
    /// lines between adjacent ownership tiles while keeping the surface nearly
    /// continuous visually.
    /// </summary>
    public void Initialize(GraphicsDevice graphicsDevice, float hexRadius)
    {
        DisposeTileVertexBuffers();
        _indexBuffer?.Dispose();
        _hexRadius = hexRadius;

        var insetRadius = hexRadius;
        var geometry = BuildSubdividedHex(insetRadius, ReliefRings);
        _basePositions = geometry.Positions;
        _baseUvs = geometry.Uvs;
        _indices = geometry.Indices;
        _vertices = new VertexPositionNormalTexture[_basePositions.Length];

        _indexBuffer = new IndexBuffer(
            graphicsDevice,
            IndexElementSize.ThirtyTwoBits,
            _indices.Length,
            BufferUsage.WriteOnly);
        _indexBuffer.SetData(_indices);

        _primitiveCount = _indices.Length / 3;
    }

    /// <summary>
    /// Draw this hex mesh at the given world-space tile center using the provided effect.
    /// The caller is responsible for setting View/Projection/Texture on the effect.
    /// </summary>
    public void Draw(
        GraphicsDevice graphicsDevice,
        BasicEffect effect,
        ushort tileId,
        Vector2 tileCenter,
        float tileSize,
        float elevation = 0f,
        BiomeId biome = BiomeId.Unknown,
        int terrainSeed = 0,
        int mapWidth = 1,
        int mapHeight = 1,
        int reliefNeighborMask = 0)
    {
        if (_indexBuffer is null)
            return;

        var vertexBuffer = GetOrCreateTileVertexBuffer(
            graphicsDevice,
            tileId,
            tileCenter,
            tileSize,
            elevation,
            biome,
            terrainSeed,
            mapWidth,
            mapHeight,
            reliefNeighborMask);

        effect.World = Matrix.CreateTranslation(new Vector3(tileCenter.X, 0f, tileCenter.Y));

        graphicsDevice.SetVertexBuffer(vertexBuffer);
        graphicsDevice.Indices = _indexBuffer;

        foreach (var pass in effect.CurrentTechnique.Passes)
        {
            pass.Apply();
            graphicsDevice.DrawIndexedPrimitives(
                PrimitiveType.TriangleList,
                0, 0, _primitiveCount);
        }
    }

    public void Dispose()
    {
        DisposeTileVertexBuffers();
        _indexBuffer?.Dispose();
        _indexBuffer = null;
    }

    private VertexBuffer GetOrCreateTileVertexBuffer(
        GraphicsDevice graphicsDevice,
        ushort tileId,
        Vector2 tileCenter,
        float tileSize,
        float elevation,
        BiomeId biome,
        int terrainSeed,
        int mapWidth,
        int mapHeight,
        int reliefNeighborMask)
    {
        var key = new TerrainMeshCacheKey(
            tileId,
            biome,
            terrainSeed,
            mapWidth,
            mapHeight,
            reliefNeighborMask,
            Quantize(tileCenter.X),
            Quantize(tileCenter.Y),
            Quantize(tileSize),
            Quantize(elevation));

        if (_tileVertexBuffers.TryGetValue(key, out var cached))
            return cached;

        UpdateVertices(tileCenter, elevation, biome, terrainSeed, mapWidth, mapHeight, reliefNeighborMask);

        var vertexBuffer = new VertexBuffer(
            graphicsDevice,
            typeof(VertexPositionNormalTexture),
            _vertices.Length,
            BufferUsage.WriteOnly);
        vertexBuffer.SetData(_vertices);
        _tileVertexBuffers[key] = vertexBuffer;
        return vertexBuffer;
    }

    private void UpdateVertices(
        Vector2 tileCenter,
        float elevation,
        BiomeId biome,
        int terrainSeed,
        int mapWidth,
        int mapHeight,
        int reliefNeighborMask)
    {
        for (var i = 0; i < _basePositions.Length; i++)
        {
            var local = _basePositions[i];
            var worldX = tileCenter.X + local.X;
            var worldZ = tileCenter.Y + local.Z;
            var surface = PlayableWorldGenerator.VisualSurfaceElevation(
                terrainSeed,
                mapWidth,
                mapHeight,
                worldX,
                worldZ,
                biome,
                elevation,
                local.X,
                local.Z,
                _hexRadius,
                reliefNeighborMask: reliefNeighborMask);

            _vertices[i] = new VertexPositionNormalTexture(
                new Vector3(local.X, surface, local.Z),
                Vector3.Up,
                _baseUvs[i]);
        }

        CalculateNormals(_vertices, _indices);
    }

    private void DisposeTileVertexBuffers()
    {
        foreach (var vertexBuffer in _tileVertexBuffers.Values)
            vertexBuffer.Dispose();
        _tileVertexBuffers.Clear();
    }

    private static int Quantize(float value)
    {
        return (int)MathF.Round(value * 1000f);
    }

    private static (Vector3[] Positions, Vector2[] Uvs, int[] Indices) BuildSubdividedHex(float radius, int rings)
    {
        var positions = new List<Vector3>(1 + 3 * rings * (rings + 1)) { Vector3.Zero };
        var uvs = new List<Vector2>(positions.Capacity) { new(0.5f, 0.5f) };
        var indices = new List<int>(rings * rings * 18);

        for (var ring = 1; ring <= rings; ring++)
        {
            for (var side = 0; side < 6; side++)
            {
                var start = HexCorner(radius * ring / rings, side);
                var end = HexCorner(radius * ring / rings, (side + 1) % 6);
                for (var step = 0; step < ring; step++)
                {
                    var point = Vector3.Lerp(start, end, step / (float)ring);
                    positions.Add(point);
                    uvs.Add(new Vector2(
                        0.5f + point.X / (radius * 2f),
                        0.5f + point.Z / (radius * 2f)));
                }
            }
        }

        for (var side = 0; side < 6; side++)
        {
            indices.Add(0);
            indices.Add(RingIndex(1, side, 0));
            indices.Add(RingIndex(1, (side + 1) % 6, 0));
        }

        for (var ring = 1; ring < rings; ring++)
            StitchRings(ring, indices);

        return (positions.ToArray(), uvs.ToArray(), indices.ToArray());
    }

    private static void StitchRings(int innerRing, List<int> indices)
    {
        var outerRing = innerRing + 1;
        var innerCount = innerRing * 6;
        var outerCount = outerRing * 6;
        var inner = 0;
        var outer = 0;

        while (inner < innerCount || outer < outerCount)
        {
            var nextInner = (inner + 1) / (float)innerCount;
            var nextOuter = (outer + 1) / (float)outerCount;
            var innerCurrent = RingLinearIndex(innerRing, inner % innerCount);
            var outerCurrent = RingLinearIndex(outerRing, outer % outerCount);

            if (outer >= outerCount || (inner < innerCount && nextInner < nextOuter - 0.0001f))
            {
                indices.Add(innerCurrent);
                indices.Add(outerCurrent);
                indices.Add(RingLinearIndex(innerRing, (inner + 1) % innerCount));
                inner++;
            }
            else if (inner >= innerCount || nextOuter < nextInner - 0.0001f)
            {
                indices.Add(innerCurrent);
                indices.Add(outerCurrent);
                indices.Add(RingLinearIndex(outerRing, (outer + 1) % outerCount));
                outer++;
            }
            else
            {
                var innerNext = RingLinearIndex(innerRing, (inner + 1) % innerCount);
                var outerNext = RingLinearIndex(outerRing, (outer + 1) % outerCount);
                indices.Add(innerCurrent);
                indices.Add(outerCurrent);
                indices.Add(innerNext);
                indices.Add(innerNext);
                indices.Add(outerCurrent);
                indices.Add(outerNext);
                inner++;
                outer++;
            }
        }
    }

    private static Vector3 HexCorner(float radius, int corner)
    {
        var angle = MathHelper.ToRadians(-90f + corner * 60f);
        return new Vector3(MathF.Cos(angle) * radius, 0f, MathF.Sin(angle) * radius);
    }

    private static int RingLinearIndex(int ring, int linearIndex)
    {
        return 1 + 3 * (ring - 1) * ring + linearIndex;
    }

    private static int RingIndex(int ring, int side, int step)
    {
        return RingLinearIndex(ring, side * ring + step);
    }

    private static void CalculateNormals(VertexPositionNormalTexture[] vertices, int[] indices)
    {
        for (var i = 0; i < vertices.Length; i++)
            vertices[i].Normal = Vector3.Zero;

        for (var i = 0; i < indices.Length; i += 3)
        {
            var index1 = indices[i];
            var index2 = indices[i + 1];
            var index3 = indices[i + 2];
            var side1 = vertices[index2].Position - vertices[index1].Position;
            var side2 = vertices[index3].Position - vertices[index1].Position;
            var normal = Vector3.Cross(side1, side2);
            if (normal.Y < 0f)
                normal = -normal;

            vertices[index1].Normal += normal;
            vertices[index2].Normal += normal;
            vertices[index3].Normal += normal;
        }

        for (var i = 0; i < vertices.Length; i++)
        {
            if (vertices[i].Normal.LengthSquared() <= 0.000001f)
                vertices[i].Normal = Vector3.Up;
            else
                vertices[i].Normal.Normalize();
        }
    }

    private readonly record struct TerrainMeshCacheKey(
        ushort TileId,
        BiomeId Biome,
        int TerrainSeed,
        int MapWidth,
        int MapHeight,
        int ReliefNeighborMask,
        int CenterX,
        int CenterZ,
        int TileSize,
        int Elevation);
}
