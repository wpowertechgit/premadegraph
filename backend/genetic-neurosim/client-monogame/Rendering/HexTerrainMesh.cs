using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace TribalNeuroSim.Client.Rendering;

/// <summary>
/// Generates a reusable 3D hex tile mesh with proper UV mapping for terrain textures.
/// The hex is pointy-top oriented and lies on the XZ ground plane (Y = 0).
/// UV coordinates use world-space mapping so the texture tiles seamlessly across adjacent hexes.
/// A small inset creates visible hex borders between tiles.
/// </summary>
public sealed class HexTerrainMesh : IDisposable
{
    private VertexBuffer? _vertexBuffer;
    private IndexBuffer? _indexBuffer;
    private int _primitiveCount;
    private float _hexRadius;

    /// <summary>
    /// Number of triangles in the mesh.
    /// </summary>
    public int PrimitiveCount => _primitiveCount;

    /// <summary>
    /// Create a hex terrain mesh. The hex has 6 outer corners + center = 6 triangles.
    /// A small inset (shrink) creates visible seam lines between adjacent hex tiles.
    /// </summary>
    public void Initialize(GraphicsDevice graphicsDevice, float hexRadius)
    {
        _vertexBuffer?.Dispose();
        _indexBuffer?.Dispose();
        _hexRadius = hexRadius;

        // Keep only a tiny inset. Large seams make the terrain read as a board-game
        // debug grid and make repeated textures feel harsher.
        var insetRadius = hexRadius * 0.995f;

        // Pointy-top hex corners (matching the game's hex layout)
        // Angle starts at -90° (top) and goes clockwise in 60° steps
        var corners = new Vector3[6];
        for (var i = 0; i < 6; i++)
        {
            var angle = MathHelper.ToRadians(-90f + i * 60f);
            corners[i] = new Vector3(
                MathF.Cos(angle) * insetRadius,
                0f,
                MathF.Sin(angle) * insetRadius);
        }

        var center = Vector3.Zero;
        var normal = Vector3.Up;

        // UV coordinates are computed at draw time using world-space mapping.
        // Here we set placeholder UVs — they get overridden per-tile in Draw().
        // For the shared mesh approach, we use local-space UVs that get offset per tile.

        // Use hex-local UV mapping: center = (0.5, 0.5), corners on unit circle.
        // This maps one full texture copy across each hex face.
        var uvCenter = new Vector2(0.5f, 0.5f);

        // Build 6 triangles (fan from center)
        var vertices = new VertexPositionNormalTexture[7]; // center + 6 corners
        vertices[0] = new VertexPositionNormalTexture(center, normal, uvCenter);
        for (var i = 0; i < 6; i++)
        {
            var angle = MathHelper.ToRadians(-90f + i * 60f);
            var uv = new Vector2(
                0.5f + MathF.Cos(angle) * 0.82f,
                0.5f + MathF.Sin(angle) * 0.82f);
            vertices[i + 1] = new VertexPositionNormalTexture(corners[i], normal, uv);
        }

        var indices = new short[18]; // 6 triangles × 3
        for (var i = 0; i < 6; i++)
        {
            indices[i * 3 + 0] = 0; // center
            indices[i * 3 + 1] = (short)(i + 1);
            indices[i * 3 + 2] = (short)((i + 1) % 6 + 1);
        }

        _vertexBuffer = new VertexBuffer(
            graphicsDevice,
            typeof(VertexPositionNormalTexture),
            vertices.Length,
            BufferUsage.WriteOnly);
        _vertexBuffer.SetData(vertices);

        _indexBuffer = new IndexBuffer(
            graphicsDevice,
            IndexElementSize.SixteenBits,
            indices.Length,
            BufferUsage.WriteOnly);
        _indexBuffer.SetData(indices);

        _primitiveCount = 6;
    }

    /// <summary>
    /// Draw this hex mesh at the given world-space tile center using the provided effect.
    /// The caller is responsible for setting View/Projection/Texture on the effect.
    /// </summary>
    public void Draw(GraphicsDevice graphicsDevice, BasicEffect effect, Vector2 tileCenter, float tileSize, float elevation = 0f)
    {
        if (_vertexBuffer is null || _indexBuffer is null)
            return;

        effect.World = Matrix.CreateTranslation(new Vector3(tileCenter.X, elevation, tileCenter.Y));

        graphicsDevice.SetVertexBuffer(_vertexBuffer);
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
        _vertexBuffer?.Dispose();
        _vertexBuffer = null;
        _indexBuffer?.Dispose();
        _indexBuffer = null;
    }
}
