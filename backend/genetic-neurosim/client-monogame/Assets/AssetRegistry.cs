using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Protocol;

namespace TribalNeuroSim.Client.Assets;

public sealed class AssetRegistry
{
    private readonly Dictionary<BiomeId, BiomeVisualProfile> _biomes = new();
    private readonly Dictionary<(PolityTier Tier, BiomeId? Biome), SettlementVisualProfile> _settlements = new();
    private readonly Dictionary<int, FactionInsigniaProfile> _insignias = new();

    public AssetRegistry(IconRegistry icons)
    {
        Icons = icons;
    }

    public IconRegistry Icons { get; }

    public IReadOnlyDictionary<BiomeId, BiomeVisualProfile> Biomes => _biomes;

    public IReadOnlyDictionary<(PolityTier Tier, BiomeId? Biome), SettlementVisualProfile> Settlements => _settlements;

    /// <summary>
    /// All 44 icon asset keys available for random assignment.
    /// </summary>
    public IReadOnlyList<string> AvailableIconKeys { get; private set; } = Array.Empty<string>();

    public static AssetRegistry CreateWithFallbacks()
    {
        var icons = new IconRegistry();
        foreach (var (key, assetKey) in AssetManifest.IconBindings)
        {
            icons.Register(key, assetKey);
        }

        var registry = new AssetRegistry(icons);

        foreach (var biome in AssetManifest.BiomeProfiles)
        {
            registry.RegisterBiome(biome);
        }

        foreach (var settlement in AssetManifest.SettlementProfiles)
        {
            registry.RegisterSettlement(settlement);
        }

        // Register all 44 faction icon keys from the catalog
        registry.AvailableIconKeys = RuntimeAssetCatalog.InsigniaIcons
            .Select(def => def.Key)
            .ToList();

        return registry;
    }

    public void RegisterBiome(BiomeVisualProfile profile)
    {
        _biomes[profile.Biome] = profile;
    }

    public void RegisterSettlement(SettlementVisualProfile profile)
    {
        _settlements[(profile.Tier, profile.Biome)] = profile;
    }

    /// <summary>
    /// Resolve or create a faction insignia profile for a tribe.
    /// Uses artifact-driven colors and deterministic icon assignment.
    /// </summary>
    public FactionInsigniaProfile ResolveInsignia(int tribeId, PolityTier tier, Protocol.ArtifactVector artifacts)
    {
        if (_insignias.TryGetValue(tribeId, out var cached))
            return cached;

        var color = FactionInsigniaProfile.ColorFromArtifacts(artifacts);
        var iconKey = FactionInsigniaProfile.PickIcon(tribeId, AvailableIconKeys);
        var frameKey = FactionInsigniaProfile.PolityFrameKeyForTier(tier);

        var profile = new FactionInsigniaProfile(color, iconKey, frameKey);
        _insignias[tribeId] = profile;
        return profile;
    }

    public BiomeVisualProfile ResolveBiome(BiomeId biome)
    {
        return _biomes.TryGetValue(biome, out var profile)
            ? profile
            : _biomes[BiomeId.Unknown];
    }

    public SettlementVisualProfile ResolveSettlement(PolityTier tier, BiomeId biome)
    {
        if (_settlements.TryGetValue((tier, biome), out var biomeSpecific))
        {
            return biomeSpecific;
        }

        return _settlements[(tier, null)];
    }
}
