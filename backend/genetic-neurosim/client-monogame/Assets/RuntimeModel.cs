using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace TribalNeuroSim.Client.Assets;

public sealed class RuntimeModel : IDisposable
{
    private VertexBuffer? _vertexBuffer;
    private IndexBuffer? _indexBuffer;
    private bool _disposed;

    public int VertexCount { get; private set; }
    public int IndexCount { get; private set; }
    public int PrimitiveCount => IndexCount / 3;
    public BoundingBox Bounds { get; private set; }

    public static RuntimeModel FromObjData(GraphicsDevice graphicsDevice, ObjModelData data)
    {
        var model = new RuntimeModel();
        if (data.Vertices.Length == 0 || data.Indices.Length == 0)
            return model;

        model._vertexBuffer = new VertexBuffer(
            graphicsDevice,
            typeof(VertexPositionNormalTexture),
            data.Vertices.Length,
            BufferUsage.WriteOnly);
        model._vertexBuffer.SetData(data.Vertices);

        model._indexBuffer = new IndexBuffer(
            graphicsDevice,
            IndexElementSize.SixteenBits,
            data.Indices.Length,
            BufferUsage.WriteOnly);
        model._indexBuffer.SetData(data.Indices);

        model.VertexCount = data.Vertices.Length;
        model.IndexCount = data.Indices.Length;
        model.Bounds = data.Bounds;

        return model;
    }

    public void Draw(GraphicsDevice graphicsDevice)
    {
        if (_disposed || _vertexBuffer is null || _indexBuffer is null || IndexCount == 0)
            return;

        graphicsDevice.SetVertexBuffer(_vertexBuffer);
        graphicsDevice.Indices = _indexBuffer;
        graphicsDevice.DrawIndexedPrimitives(
            PrimitiveType.TriangleList,
            baseVertex: 0,
            startIndex: 0,
            PrimitiveCount);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _vertexBuffer?.Dispose();
        _indexBuffer?.Dispose();
    }
}
