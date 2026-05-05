using TribalNeuroSim.Client.Domain;

namespace TribalNeuroSim.Client.Assets;

public sealed record AssetDiagnostics(
    int RegisteredBiomeCount,
    int RegisteredSettlementCount,
    int RegisteredIconCount,
    IReadOnlyList<BiomeId> MissingBiomes,
    IReadOnlyList<PolityTier> MissingSettlementTiers,
    IReadOnlyList<string> MissingIconKeys,
    IReadOnlyList<string> FallbackSettlementKeys)
{
    public bool HasMissingBindings =>
        MissingBiomes.Count > 0 ||
        MissingSettlementTiers.Count > 0 ||
        MissingIconKeys.Count > 0;

    public static AssetDiagnostics FromRegistry(AssetRegistry registry)
    {
        var missingBiomes = Enum.GetValues<BiomeId>()
            .Where(biome => !registry.Biomes.ContainsKey(biome))
            .ToArray();

        var missingSettlementTiers = Enum.GetValues<PolityTier>()
            .Where(tier => !registry.Settlements.ContainsKey((tier, null)))
            .ToArray();

        var missingIconKeys = AssetManifest.IconBindings
            .Select(binding => binding.Key)
            .Where(key => !registry.Icons.Icons.ContainsKey(key))
            .ToArray();

        var fallbackSettlementKeys = registry.Settlements
            .Where(entry => entry.Key.Biome is null)
            .Select(entry => entry.Value.ModelAssetKey)
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return new AssetDiagnostics(
            registry.Biomes.Count,
            registry.Settlements.Count,
            registry.Icons.Icons.Count,
            missingBiomes,
            missingSettlementTiers,
            missingIconKeys,
            fallbackSettlementKeys);
    }
}
