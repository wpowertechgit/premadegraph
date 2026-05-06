using TribalNeuroSim.Client.Domain;

namespace TribalNeuroSim.Client.Assets;

/// <summary>
/// Per-biome rule controlling which prop families appear, how many per tile,
/// and placement constraints. Multiple rules per biome (one per family).
/// </summary>
public sealed record BiomePropRule(
    BiomeId Biome,
    PropFamily Family,
    float Density,
    int MinPerTile,
    int MaxPerTile,
    float MinDistanceFromTileCenter,
    float MaxDistanceFromTileCenter,
    float AvoidCapitalRadius,
    float ElevationBias,
    string[] CandidatePropKeys);
