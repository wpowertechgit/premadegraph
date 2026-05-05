using Microsoft.Xna.Framework.Graphics;

namespace TribalNeuroSim.Client.Assets;

public sealed class RuntimeAssetLoader : IDisposable
{
    private readonly GraphicsDevice _graphicsDevice;
    private readonly Dictionary<string, Texture2D> _textureCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<RuntimeAssetMissingDiagnostic> _missingAssets = [];

    public RuntimeAssetLoader(GraphicsDevice graphicsDevice, string? contentRoot = null)
    {
        _graphicsDevice = graphicsDevice ?? throw new ArgumentNullException(nameof(graphicsDevice));
        ContentRoot = ResolveContentRoot(contentRoot);
    }

    public string? ContentRoot { get; }

    public IReadOnlyList<RuntimeAssetMissingDiagnostic> MissingAssets => _missingAssets;

    public static string? ResolveContentRoot(string? contentRoot = null)
    {
        if (!string.IsNullOrWhiteSpace(contentRoot))
        {
            var candidate = Path.GetFullPath(contentRoot);
            if (Directory.Exists(candidate))
            {
                return candidate;
            }
        }

        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var contentPath = Path.Combine(current.FullName, "Content");
            if (Directory.Exists(contentPath))
            {
                return contentPath;
            }

            current = current.Parent;
        }

        return null;
    }

    public Texture2D? LoadTexture(string key)
    {
        if (_textureCache.TryGetValue(key, out var cachedTexture))
        {
            return cachedTexture;
        }

        if (!RuntimeAssetCatalog.AssetsByKey.TryGetValue(key, out var asset))
        {
            RecordMissing(key, null);
            return null;
        }

        if (ContentRoot is null)
        {
            RecordMissing(key, asset.RelativePath);
            return null;
        }

        var fullPath = Path.Combine(
            ContentRoot,
            asset.RelativePath.Replace('/', Path.DirectorySeparatorChar));

        if (!File.Exists(fullPath))
        {
            RecordMissing(key, asset.RelativePath);
            return null;
        }

        try
        {
            using var stream = File.OpenRead(fullPath);
            var texture = Texture2D.FromStream(_graphicsDevice, stream);
            _textureCache[key] = texture;
            return texture;
        }
        catch
        {
            RecordMissing(key, asset.RelativePath);
            return null;
        }
    }

    public void Dispose()
    {
        foreach (var texture in _textureCache.Values)
        {
            texture.Dispose();
        }

        _textureCache.Clear();
    }

    private void RecordMissing(string key, string? relativePath)
    {
        if (_missingAssets.Any(missing =>
                string.Equals(missing.Key, key, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(missing.RelativePath, relativePath, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        _missingAssets.Add(new RuntimeAssetMissingDiagnostic(key, relativePath));
    }
}

public sealed record RuntimeAssetMissingDiagnostic(string Key, string? RelativePath);
