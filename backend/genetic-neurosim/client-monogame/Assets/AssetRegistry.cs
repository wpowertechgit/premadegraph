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
        icons.Register("artifact/combat", "icons/artifacts/combat");
        icons.Register("artifact/resource", "icons/artifacts/resource");
        icons.Register("artifact/map-objective", "icons/artifacts/map-objective");
        icons.Register("artifact/risk", "icons/artifacts/risk");
        icons.Register("artifact/team", "icons/artifacts/team");

        var registry = new AssetRegistry(icons);
        registry.RegisterBiome(new BiomeVisualProfile(
            BiomeId.Unknown,
            "Unknown",
            "biomes/fallback/terrain",
            Array.Empty<string>(),
            "#3b3b3b"));

        foreach (PolityTier tier in Enum.GetValues<PolityTier>())
        {
            registry.RegisterSettlement(new SettlementVisualProfile(
                tier,
                null,
                $"settlements/fallback/{tier.ToString().ToLowerInvariant()}",
                $"icons/polities/{tier.ToString().ToLowerInvariant()}",
                "lod/default"));
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
