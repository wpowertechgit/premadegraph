using TribalNeuroSim.Client.Domain;

namespace TribalNeuroSim.Client.Assets;

public sealed record SettlementVisualProfile(
    PolityTier Tier,
    BiomeId? Biome,
    string ModelAssetKey,
    string IconKey,
    string LodPolicyKey);
