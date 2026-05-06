using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace TribalNeuroSim.Client.Assets;

/// <summary>
/// Loads PBR terrain texture sets (diffuse, AO, normal, roughness) and bakes
/// AO into diffuse on the CPU for use with BasicEffect.
/// This gives proper ambient occlusion without custom shaders.
/// </summary>
public sealed class PbrTextureBaker : IDisposable
{
    private readonly GraphicsDevice _graphicsDevice;
    private readonly string _contentRoot;
    private readonly Dictionary<string, Texture2D> _bakedTextures = new(StringComparer.OrdinalIgnoreCase);

    public PbrTextureBaker(GraphicsDevice graphicsDevice, string contentRoot)
    {
        _graphicsDevice = graphicsDevice;
        _contentRoot = contentRoot;
    }

    /// <summary>
    /// Load a PBR terrain set and return an AO-baked diffuse texture.
    /// Expects files at: {contentRoot}/Materials/Terrain/{baseName}_diff_1k.png
    ///                    {contentRoot}/Materials/Terrain/{baseName}_ao_1k.png
    /// </summary>
    public Texture2D? LoadBakedTerrain(string biomeKey, string baseName)
    {
        if (_bakedTextures.TryGetValue(biomeKey, out var cached))
            return cached;

        var diffPath = Path.Combine(_contentRoot, "Materials", "Terrain", $"{baseName}_diff_1k.png");
        var aoPath = Path.Combine(_contentRoot, "Materials", "Terrain", $"{baseName}_ao_1k.png");

        if (!File.Exists(diffPath))
        {
            System.Diagnostics.Debug.WriteLine($"[PbrTextureBaker] Missing diffuse: {diffPath}");
            return null;
        }

        Texture2D diffTex;
        using (var diffStream = File.OpenRead(diffPath))
            diffTex = Texture2D.FromStream(_graphicsDevice, diffStream);

        // If AO exists, bake it into the diffuse
        if (File.Exists(aoPath))
        {
            Texture2D aoTex;
            using (var aoStream = File.OpenRead(aoPath))
                aoTex = Texture2D.FromStream(_graphicsDevice, aoStream);

            var baked = BakeAoIntoDiffuse(diffTex, aoTex);
            aoTex.Dispose();
            diffTex.Dispose();
            _bakedTextures[biomeKey] = baked;
            return baked;
        }

        // No AO available — use diffuse as-is
        _bakedTextures[biomeKey] = diffTex;
        return diffTex;
    }

    /// <summary>
    /// Multiply diffuse × AO on CPU. AO is grayscale, so we multiply each RGB channel
    /// by the AO luminance. This produces a properly shaded diffuse texture.
    /// </summary>
    private Texture2D BakeAoIntoDiffuse(Texture2D diffuse, Texture2D ao)
    {
        var width = diffuse.Width;
        var height = diffuse.Height;

        var diffPixels = new Color[width * height];
        diffuse.GetData(diffPixels);

        // AO may be a different resolution — resize if needed
        Color[] aoPixels;
        if (ao.Width == width && ao.Height == height)
        {
            aoPixels = new Color[width * height];
            ao.GetData(aoPixels);
        }
        else
        {
            // Nearest-neighbor resample AO to match diffuse dimensions
            var aoSource = new Color[ao.Width * ao.Height];
            ao.GetData(aoSource);
            aoPixels = new Color[width * height];
            for (var y = 0; y < height; y++)
            {
                for (var x = 0; x < width; x++)
                {
                    var srcX = (int)((float)x / width * ao.Width);
                    var srcY = (int)((float)y / height * ao.Height);
                    srcX = Math.Min(srcX, ao.Width - 1);
                    srcY = Math.Min(srcY, ao.Height - 1);
                    aoPixels[y * width + x] = aoSource[srcY * ao.Width + srcX];
                }
            }
        }

        // Bake: diffuse.RGB * ao.R (AO is grayscale, R channel is sufficient)
        for (var i = 0; i < diffPixels.Length; i++)
        {
            var aoFactor = aoPixels[i].R / 255f;
            // Boost AO slightly so we don't make everything too dark
            aoFactor = MathF.Sqrt(aoFactor); // Gamma-correct the AO for softer shadows
            diffPixels[i] = new Color(
                (byte)(diffPixels[i].R * aoFactor),
                (byte)(diffPixels[i].G * aoFactor),
                (byte)(diffPixels[i].B * aoFactor),
                diffPixels[i].A);
        }

        var result = new Texture2D(_graphicsDevice, width, height);
        result.SetData(diffPixels);
        return result;
    }

    public void Dispose()
    {
        foreach (var tex in _bakedTextures.Values)
            tex.Dispose();
        _bakedTextures.Clear();
    }
}
