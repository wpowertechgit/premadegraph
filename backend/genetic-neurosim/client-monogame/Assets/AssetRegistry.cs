using TribalNeuroSim.Client.Domain;

namespace TribalNeuroSim.Client.Assets;

public sealed class AssetRegistry
{
    private readonly Dictionary<BiomeId, BiomeVisualProfile> _biomes = new();
    private readonly Dictionary<(PolityTier Tier, BiomeId? Biome), SettlementVisualProfile> _settlements = new();

    public AssetRegistry(IconRegistry icons)
    {
        Icons = icons;
    }

    public IconRegistry Icons { get; }

    public IReadOnlyDictionary<BiomeId, BiomeVisualProfile> Biomes => _biomes;

    public IReadOnlyDictionary<(PolityTier Tier, BiomeId? Biome), SettlementVisualProfile> Settlements => _settlements;

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
