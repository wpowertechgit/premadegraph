using Assimp;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using SharpGLTF.Schema2;
using AssimpMesh = Assimp.Mesh;

namespace TribalNeuroSim.Client.Assets;

/// <summary>
/// GPU buffer holder for runtime-loaded models. Created at load time and shared by renderers.
/// Always uses 32-bit index buffers for compatibility with high-poly settlement FBX models.
/// </summary>
public sealed class ModelMeshData : IDisposable
{
    public VertexBuffer VertexBuffer { get; }
    public IndexBuffer IndexBuffer { get; }
    public int VertexCount { get; }
    public int IndexCount { get; }
    public int PrimitiveCount { get; }
    public BoundingBox Bounds { get; }
    public float HorizontalExtent { get; }
    public bool HasNormals { get; }

    public ModelMeshData(
        GraphicsDevice graphicsDevice,
        VertexPositionNormalTexture[] vertices,
        int[] indices,
        int primitiveCount,
        BoundingBox? bounds = null)
    {
        VertexCount = vertices.Length;
        IndexCount = indices.Length;
        PrimitiveCount = primitiveCount;
        HasNormals = vertices.Length > 0 && vertices.Any(vertex => vertex.Normal != Vector3.UnitY);
        Bounds = bounds ?? CalculateBounds(vertices);
        HorizontalExtent = MathF.Max(
            MathF.Max(0.001f, Bounds.Max.X - Bounds.Min.X),
            MathF.Max(0.001f, Bounds.Max.Z - Bounds.Min.Z));

        VertexBuffer = new VertexBuffer(
            graphicsDevice,
            typeof(VertexPositionNormalTexture),
            vertices.Length,
            BufferUsage.WriteOnly);
        VertexBuffer.SetData(vertices);

        IndexBuffer = new IndexBuffer(
            graphicsDevice,
            IndexElementSize.ThirtyTwoBits,
            indices.Length,
            BufferUsage.WriteOnly);
        IndexBuffer.SetData(indices);
    }

    public void Dispose()
    {
        VertexBuffer.Dispose();
        IndexBuffer.Dispose();
    }

    private static BoundingBox CalculateBounds(VertexPositionNormalTexture[] vertices)
    {
        if (vertices.Length == 0)
            return new BoundingBox(Vector3.Zero, Vector3.One);

        var min = new Vector3(float.MaxValue);
        var max = new Vector3(float.MinValue);
        foreach (var vertex in vertices)
        {
            min = Vector3.Min(min, vertex.Position);
            max = Vector3.Max(max, vertex.Position);
        }

        return new BoundingBox(min, max);
    }

    // ─────────────────────────────────────────────────────────────
    //  FBX extraction via AssimpNet
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// FBX load via AssimpNet. Transform pipeline:
    ///   1. Triangulate
    ///   2. JoinIdenticalVertices
    ///   3. GenerateSmoothNormals
    ///   4. PreTransformVertices — bake all node transforms, flatten hierarchy
    ///   5. MakeLeftHanded — convert RH (FBX default) to LH (MonoGame XNA convention)
    ///   6. FlipUVs — adjust texture V for MonoGame top-left origin
    /// </summary>
    public static ModelMeshData FromFbx(GraphicsDevice graphicsDevice, string fullPath, AssetLoadDiagnostics diagnostics)
    {
        using var importer = new AssimpContext();
        var scene = importer.ImportFile(
            fullPath,
            PostProcessSteps.Triangulate |
            PostProcessSteps.JoinIdenticalVertices |
            PostProcessSteps.GenerateSmoothNormals |
            PostProcessSteps.PreTransformVertices |
            PostProcessSteps.MakeLeftHanded |
            PostProcessSteps.FlipUVs);

        diagnostics.Info(
            $"FBX scene key={Path.GetFileNameWithoutExtension(fullPath)} meshCount={scene.MeshCount} materialCount={scene.MaterialCount}");

        foreach (var material in scene.Materials)
        {
            var texRefs = new List<string>();
            if (material.HasTextureDiffuse) texRefs.Add($"diffuse={material.TextureDiffuse.FilePath}");
            if (material.HasTextureNormal) texRefs.Add($"normal={material.TextureNormal.FilePath}");
            if (material.HasTextureSpecular) texRefs.Add($"specular={material.TextureSpecular.FilePath}");
            if (material.HasTextureEmissive) texRefs.Add($"emissive={material.TextureEmissive.FilePath}");
            if (material.HasTextureLightMap) texRefs.Add($"lightmap={material.TextureLightMap.FilePath}");

            diagnostics.Info(
                $"FBX material name={material.Name} texCount={texRefs.Count} " +
                $"{(texRefs.Count > 0 ? string.Join(" ", texRefs) : "none (embedded or untextured)")}");
        }

        var allVertices = new List<VertexPositionNormalTexture>();
        var allIndices = new List<int>();
        var boundsMin = new Vector3(float.MaxValue);
        var boundsMax = new Vector3(float.MinValue);

        foreach (var mesh in scene.Meshes)
        {
            var baseVertex = allVertices.Count;
            var hasMeshNormals = mesh.HasNormals;

            for (var i = 0; i < mesh.VertexCount; i++)
            {
                var pos = mesh.Vertices[i];
                var normal = hasMeshNormals ? mesh.Normals[i] : new Vector3D(0f, 1f, 0f);
                var tex = mesh.HasTextureCoords(0) ? mesh.TextureCoordinateChannels[0][i] : new Vector3D();

                allVertices.Add(new VertexPositionNormalTexture(
                    new Vector3(pos.X, pos.Y, pos.Z),
                    new Vector3(normal.X, normal.Y, normal.Z),
                    new Vector2(tex.X, tex.Y)));
                boundsMin = Vector3.Min(boundsMin, new Vector3(pos.X, pos.Y, pos.Z));
                boundsMax = Vector3.Max(boundsMax, new Vector3(pos.X, pos.Y, pos.Z));
            }

            foreach (var face in mesh.Faces)
            {
                if (face.IndexCount != 3)
                    continue;

                allIndices.Add(checked(baseVertex + face.Indices[0]));
                allIndices.Add(checked(baseVertex + face.Indices[1]));
                allIndices.Add(checked(baseVertex + face.Indices[2]));
            }
        }

        if (allVertices.Count == 0 || allIndices.Count == 0)
            throw new InvalidOperationException("FBX contains no usable geometry.");

        var needs32Bit = allIndices.Count > ushort.MaxValue || allVertices.Count > ushort.MaxValue;
        if (needs32Bit)
        {
            diagnostics.Info(
                $"FBX 32bitIndexBuffer required key={Path.GetFileNameWithoutExtension(fullPath)} " +
                $"vertexCount={allVertices.Count} indexCount={allIndices.Count} ushortMax={ushort.MaxValue}");
        }

        return new ModelMeshData(
            graphicsDevice,
            allVertices.ToArray(),
            allIndices.ToArray(),
            allIndices.Count / 3,
            new BoundingBox(boundsMin, boundsMax));
    }

    // ─────────────────────────────────────────────────────────────
    //  glTF extraction via SharpGLTF
    // ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Extract glTF mesh data. glTF Y-up → MonoGame Y-up (same). Flip V coordinate for top-left origin.
    /// </summary>
    public static ModelMeshData FromGltf(GraphicsDevice graphicsDevice, ModelRoot modelRoot)
    {
        var allVertices = new List<VertexPositionNormalTexture>();
        var allIndices = new List<int>();
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

                    allVertices.Add(new VertexPositionNormalTexture(
                        new Vector3(pos.X, pos.Y, pos.Z),
                        new Vector3(nrm.X, nrm.Y, nrm.Z),
                        new Vector2(tex.X, 1f - tex.Y)));
                }

                foreach (var idx in indices)
                {
                    allIndices.Add(checked(baseVertex + (int)idx));
                }

                primitiveCount += indices.Count / 3;
            }
        }

        if (allVertices.Count == 0 || allIndices.Count == 0)
            throw new InvalidOperationException("Model contains no usable geometry.");

        return new ModelMeshData(
            graphicsDevice,
            allVertices.ToArray(),
            allIndices.ToArray(),
            primitiveCount);
    }
}
