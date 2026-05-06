using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Assets;

namespace TribalNeuroSim.Client.Rendering;

/// <summary>
/// Draws a large flat table quad and a textured parchment quad underneath the hex map.
/// The table extends far beyond the camera frustum so the player never sees black void.
/// The parchment sits on top of the table and provides the map surface.
/// Both are world-space 3D quads, not screen-space HUD panels.
/// </summary>
public sealed class TabletopRenderer : IDisposable
{
    private GraphicsDevice? _graphicsDevice;
    private BasicEffect? _effect;
    private VertexBuffer? _quadVertices;
    private IndexBuffer? _quadIndices;
    private Texture2D? _parchmentTexture;
    private bool _parchmentAttempted;

    private const float TableY = -1.2f;
    private const float ParchmentY = -0.55f;
    private const float TableHalfSize = 5000f;
    private const float ParchmentMargin = 90f;

    public Texture2D? ParchmentTexture => _parchmentTexture;

    public void Initialize(GraphicsDevice graphicsDevice)
    {
        if (ReferenceEquals(_graphicsDevice, graphicsDevice) && _effect is not null)
            return;

        _graphicsDevice?.Dispose();
        _graphicsDevice = graphicsDevice;

        _effect?.Dispose();
        _effect = new BasicEffect(graphicsDevice)
        {
            TextureEnabled = false,
            VertexColorEnabled = false,
            LightingEnabled = false,
        };

        var half = 0.5f;
        var vertices = new[]
        {
            new VertexPositionTexture(new Vector3(-half, 0f, -half), new Vector2(0, 0)),
            new VertexPositionTexture(new Vector3( half, 0f, -half), new Vector2(1, 0)),
            new VertexPositionTexture(new Vector3(-half, 0f,  half), new Vector2(0, 1)),
            new VertexPositionTexture(new Vector3( half, 0f,  half), new Vector2(1, 1)),
        };

        _quadVertices?.Dispose();
        _quadVertices = new VertexBuffer(graphicsDevice, typeof(VertexPositionTexture), 4, BufferUsage.WriteOnly);
        _quadVertices.SetData(vertices);

        var indices = new short[] { 0, 1, 2, 2, 1, 3 };
        _quadIndices?.Dispose();
        _quadIndices = new IndexBuffer(graphicsDevice, IndexElementSize.SixteenBits, 6, BufferUsage.WriteOnly);
        _quadIndices.SetData(indices);
    }

    public void EnsureParchmentTexture(GraphicsDevice graphicsDevice)
    {
        if (_parchmentAttempted)
            return;

        _parchmentAttempted = true;
        var contentRoot = RuntimeAssetLoader.ResolveContentRoot();
        if (contentRoot is null)
            return;

        var path = Path.Combine(contentRoot, "Image", "parchment-bg.jpg");
        if (!File.Exists(path))
            return;

        try
        {
            using var stream = File.OpenRead(path);
            _parchmentTexture = Texture2D.FromStream(graphicsDevice, stream);
        }
        catch
        {
            // Texture stays null; fallback color used
        }
    }

    public void Draw(
        GraphicsDevice graphicsDevice,
        IsometricCamera camera,
        float mapMinX,
        float mapMinZ,
        float mapMaxX,
        float mapMaxZ)
    {
        if (_effect is null || _quadVertices is null || _quadIndices is null)
            return;

        var view = camera.GetView();
        var projection = camera.GetProjection();

        var mapCenterX = (mapMinX + mapMaxX) * 0.5f;
        var mapCenterZ = (mapMinZ + mapMaxZ) * 0.5f;
        var mapWidth = mapMaxX - mapMinX;
        var mapHeight = mapMaxZ - mapMinZ;

        graphicsDevice.BlendState = BlendState.Opaque;
        graphicsDevice.DepthStencilState = DepthStencilState.Default;
        graphicsDevice.RasterizerState = RasterizerState.CullNone;

        _effect.View = view;
        _effect.Projection = projection;

        // 1. Table — large dark quad centered under the map
        _effect.TextureEnabled = false;
        _effect.DiffuseColor = new Vector3(0.14f, 0.12f, 0.09f);
        _effect.World =
            Matrix.CreateScale(TableHalfSize * 2f, 1f, TableHalfSize * 2f) *
            Matrix.CreateTranslation(mapCenterX, TableY, mapCenterZ);

        DrawQuad(graphicsDevice);

        // 2. Parchment — textured quad slightly larger than the map
        var parchmentW = MathF.Max(mapWidth + ParchmentMargin * 2f, 10f);
        var parchmentH = MathF.Max(mapHeight + ParchmentMargin * 2f, 10f);

        _effect.TextureEnabled = _parchmentTexture is not null;
        _effect.Texture = _parchmentTexture;
        _effect.DiffuseColor = new Vector3(0.90f, 0.85f, 0.72f);
        _effect.World =
            Matrix.CreateScale(parchmentW, 1f, parchmentH) *
            Matrix.CreateTranslation(mapCenterX, ParchmentY, mapCenterZ);

        graphicsDevice.SamplerStates[0] = SamplerState.LinearWrap;
        DrawQuad(graphicsDevice);
    }

    private void DrawQuad(GraphicsDevice graphicsDevice)
    {
        foreach (var pass in _effect!.CurrentTechnique.Passes)
        {
            pass.Apply();
            graphicsDevice.SetVertexBuffer(_quadVertices);
            graphicsDevice.Indices = _quadIndices;
            graphicsDevice.DrawIndexedPrimitives(PrimitiveType.TriangleList, 0, 0, 2);
        }
    }

    public void Dispose()
    {
        _effect?.Dispose();
        _effect = null;
        _quadVertices?.Dispose();
        _quadVertices = null;
        _quadIndices?.Dispose();
        _quadIndices = null;
        _parchmentTexture?.Dispose();
        _parchmentTexture = null;
        _graphicsDevice = null;
    }
}
