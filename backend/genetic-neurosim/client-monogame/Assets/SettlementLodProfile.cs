using TribalNeuroSim.Client.Domain;

namespace TribalNeuroSim.Client.Assets;

public enum SettlementLodLevel
{
    /// <summary>Full 3D model with textures. Used when selected or camera very close.</summary>
    Close,
    /// <summary>Full 3D model at reduced draw priority. Used for unselected settlements within mid-range.</summary>
    Mid,
    /// <summary>No 3D model — 2D spritebatch markers handle camp visibility at this distance.</summary>
    Far,
}

/// <summary>
/// Per-tier LOD thresholds. Distances are in camera-world units, matching IsometricCamera.Distance.
/// Close threshold: within this range the model renders at highest detail (selected tribes always Close).
/// Mid threshold: between Close and Mid, 3D model renders but at lower priority. Beyond Mid, skip 3D.
/// </summary>
public sealed record SettlementLodProfile(
    SettlementLodLevel MaxLevel,
    float CloseDistance,
    float MidDistance);

public static class SettlementLodCatalog
{
    /// <summary>High safety cap only; normal/demo maps should draw every living capital.</summary>
    public const int MaxSettlementDraws = 512;

    /// <summary>Default LOD profile used when no per-tier override exists.</summary>
    public static readonly SettlementLodProfile Default = new(SettlementLodLevel.Far, 200f, 500f);

    public static IReadOnlyDictionary<PolityTier, SettlementLodProfile> Profiles { get; } =
        new Dictionary<PolityTier, SettlementLodProfile>
        {
            [PolityTier.Tribe] = new(SettlementLodLevel.Close, 180f, 450f),
            [PolityTier.City] = new(SettlementLodLevel.Close, 200f, 500f),
            [PolityTier.Duchy] = new(SettlementLodLevel.Close, 220f, 550f),
            [PolityTier.Kingdom] = new(SettlementLodLevel.Close, 250f, 600f),
            [PolityTier.Empire] = new(SettlementLodLevel.Close, 280f, 700f),
        };

    public static SettlementLodProfile Resolve(PolityTier tier)
    {
        return Profiles.TryGetValue(tier, out var profile) ? profile : Default;
    }

    public static int CountVisibleSettlements(int livingSettlementCount, float cameraDistance)
    {
        return Math.Clamp(livingSettlementCount, 0, MaxSettlementDraws);
    }
}
