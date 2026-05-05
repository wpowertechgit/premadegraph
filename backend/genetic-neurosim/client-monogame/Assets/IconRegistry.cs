namespace TribalNeuroSim.Client.Assets;

public sealed class IconRegistry
{
    private readonly Dictionary<string, string> _icons = new(StringComparer.OrdinalIgnoreCase);

    public IReadOnlyDictionary<string, string> Icons => _icons;

    public void Register(string key, string assetKey)
    {
        _icons[key] = assetKey;
    }

    public string Resolve(string key, string fallback = "icons/fallback")
    {
        return _icons.TryGetValue(key, out var assetKey) ? assetKey : fallback;
    }
}
