using TribalNeuroSim.Client.Domain;

namespace TribalNeuroSim.Client.Assets;

public sealed record BiomeVisualProfile(
    BiomeId Biome,
    string DisplayName,
    string TerrainTextureKey,
    IReadOnlyList<string> PropAssetKeys,
    string FallbackColorHex);
