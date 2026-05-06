namespace TribalNeuroSim.Client.Assets;

public enum PropFamily
{
    GrassPatch,
    Tree,
    Bush,
    Rock,
    Reed,
    DeadWood,
    Log,
    Flower,
    SettlementClutter,
}

/// <summary>
/// Metadata for a single prop model asset. Defines scale, wind, LOD range,
/// and placement constraints before any biome rule is applied.
/// </summary>
public sealed record PropVisualProfile(
    string Key,
    PropFamily Family,
    string ModelKey,
    string? DiffuseTextureKey,
    float BaseScale,
    float ScaleVariance,
    bool WindAffected,
    bool BlocksSettlementFootprint,
    float MinCameraDistance,
    float MaxCameraDistance);
