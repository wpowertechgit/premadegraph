using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace TribalNeuroSim.Client.Assets;

public sealed class ObjModelData
{
    public VertexPositionNormalTexture[] Vertices { get; init; } = [];
    public ushort[] Indices { get; init; } = [];
    public BoundingBox Bounds { get; init; }
}

public static class ObjParser
{
    public static ObjModelData Parse(string path)
    {
        var lines = File.ReadAllLines(path);

        var positions = new List<Vector3>();
        var texCoords = new List<Vector2>();
        var normals = new List<Vector3>();
        var outVertices = new List<VertexPositionNormalTexture>();
        var outIndices = new List<ushort>();
        var vertexMap = new Dictionary<string, ushort>();

        Vector3 boundsMin = new(float.MaxValue);
        Vector3 boundsMax = new(float.MinValue);

        foreach (var rawLine in lines)
        {
            var line = rawLine.AsSpan().Trim();
            if (line.IsEmpty || line[0] == '#')
                continue;

            if (line[0] == 'v' && line.Length > 1 && line[1] == ' ')
            {
                var parts = SplitFloats(line[2..]);
                if (parts.Count >= 3)
                {
                    var pos = new Vector3(parts[0], parts[1], parts[2]);
                    positions.Add(pos);
                    boundsMin = Vector3.Min(boundsMin, pos);
                    boundsMax = Vector3.Max(boundsMax, pos);
                }
            }
            else if (line[0] == 'v' && line.Length > 2 && line[1] == 't' && line[2] == ' ')
            {
                var parts = SplitFloats(line[3..]);
                if (parts.Count >= 2)
                    texCoords.Add(new Vector2(parts[0], parts[1]));
            }
            else if (line[0] == 'v' && line.Length > 2 && line[1] == 'n' && line[2] == ' ')
            {
                var parts = SplitFloats(line[3..]);
                if (parts.Count >= 3)
                    normals.Add(new Vector3(parts[0], parts[1], parts[2]));
            }
            else if (line[0] == 'f' && line.Length > 1 && line[1] == ' ')
            {
                var faceIndices = ParseFaceIndices(line[2..], out var vertexCount);
                if (faceIndices.Count < 3 || vertexCount < 3)
                    continue;

                var localIndices = new ushort[vertexCount];
                for (var i = 0; i < vertexCount; i++)
                {
                    var key = faceIndices[i];
                    if (!vertexMap.TryGetValue(key, out var idx))
                    {
                        idx = (ushort)outVertices.Count;
                        vertexMap[key] = idx;

                        var parts = key.Split('/');
                        var vi = int.Parse(parts[0]) - 1;
                        var ti = parts.Length > 1 && parts[1].Length > 0 ? int.Parse(parts[1]) - 1 : -1;
                        var ni = parts.Length > 2 && parts[2].Length > 0 ? int.Parse(parts[2]) - 1 : -1;

                        var pos = vi >= 0 && vi < positions.Count ? positions[vi] : Vector3.Zero;
                        var tex = ti >= 0 && ti < texCoords.Count ? texCoords[ti] : Vector2.Zero;
                        var nrm = ni >= 0 && ni < normals.Count ? normals[ni] : Vector3.Up;

                        outVertices.Add(new VertexPositionNormalTexture(pos, nrm, tex));
                    }

                    localIndices[i] = idx;
                }

                for (var i = 1; i < vertexCount - 1; i++)
                {
                    outIndices.Add(localIndices[0]);
                    outIndices.Add(localIndices[i]);
                    outIndices.Add(localIndices[i + 1]);
                }
            }
        }

        var bounds = new BoundingBox(
            boundsMin.X < float.MaxValue ? boundsMin : Vector3.Zero,
            boundsMax.X > float.MinValue ? boundsMax : Vector3.One);

        return new ObjModelData
        {
            Vertices = outVertices.ToArray(),
            Indices = outIndices.ToArray(),
            Bounds = bounds,
        };
    }

    private static List<float> SplitFloats(ReadOnlySpan<char> span)
    {
        var result = new List<float>();
        foreach (var token in SplitWhitespace(span))
        {
            if (float.TryParse(token, System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out var value))
                result.Add(value);
        }

        return result;
    }

    private static List<string> ParseFaceIndices(ReadOnlySpan<char> span, out int vertexCount)
    {
        var tokens = SplitWhitespace(span);
        vertexCount = tokens.Count;
        return tokens;
    }

    private static List<string> SplitWhitespace(ReadOnlySpan<char> span)
    {
        var result = new List<string>();
        var start = -1;

        for (var i = 0; i < span.Length; i++)
        {
            if (span[i] == ' ' || span[i] == '\t')
            {
                if (start >= 0)
                {
                    result.Add(span[start..i].ToString());
                    start = -1;
                }
            }
            else if (start < 0)
            {
                start = i;
            }
        }

        if (start >= 0)
            result.Add(span[start..].ToString());

        return result;
    }
}
