using Microsoft.Xna.Framework;
using TribalNeuroSim.Client.Domain;

namespace TribalNeuroSim.Client.Assets;

/// <summary>
/// Per-biome visual properties for terrain rendering.
/// AmbientTint modulates the hex terrain ambient light for distinct biome feel.
/// </summary>
public sealed record BiomeVisualProfile(
    BiomeId Biome,
    string DisplayName,
    string TerrainTextureKey,
    IReadOnlyList<string> PropAssetKeys,
    float PropDensity,
    string FallbackColorHex,
    Color AmbientTint);
