using Microsoft.Xna.Framework;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Protocol;

namespace TribalNeuroSim.Client.Assets;

public sealed class FactionInsigniaProfile
{
    public Color PrimaryColor { get; }
    public string IconKey { get; }
    public string PolityFrameKey { get; }

    public FactionInsigniaProfile(Color primaryColor, string iconKey, string polityFrameKey)
    {
        PrimaryColor = primaryColor;
        IconKey = iconKey;
        PolityFrameKey = polityFrameKey;
    }

    /// <summary>
    /// Derive faction color from artifact profile.
    /// Combat → martial reds/oranges. Team → unity blues/golds.
    /// Risk → endurance greens/slates. Resource → earthy ambers.
    /// MapObjective → purples/silvers.
    /// </summary>
    public static Color ColorFromArtifacts(ArtifactVector artifacts)
    {
        var scores = new (float Value, Color[] Palette)[]
        {
            (artifacts.Combat,        CombatPalette),
            (artifacts.Risk,          RiskPalette),
            (artifacts.Resource,      ResourcePalette),
            (artifacts.MapObjective,  MapObjectivePalette),
            (artifacts.Team,          TeamPalette),
        };

        var (_, palette) = scores.MaxBy(s => s.Value);
        var hueIndex = Math.Abs(HashFloat(artifacts.Combat + artifacts.Risk * 31f + artifacts.Resource * 17f)) % palette.Length;
        return palette[hueIndex];
    }

    private static readonly Color[] CombatPalette =
    [
        new(214, 52, 44),   // Crimson
        new(220, 112, 36),  // Bronze
        new(236, 84, 30),   // Deep Orange
    ];

    private static readonly Color[] RiskPalette =
    [
        new(48, 128, 74),   // Forest Green
        new(96, 118, 116),  // Slate Grey
        new(74, 108, 88),   // Olive-grey
    ];

    private static readonly Color[] ResourcePalette =
    [
        new(212, 164, 42),  // Amber/Gold
        new(192, 118, 52),  // Copper
        new(152, 114, 72),  // Earth Brown
    ];

    private static readonly Color[] MapObjectivePalette =
    [
        new(144, 72, 196),  // Purple
        new(184, 192, 204), // Silver
        new(52, 148, 162),  // Teal
    ];

    private static readonly Color[] TeamPalette =
    [
        new(44, 118, 224),  // Azure
        new(224, 186, 52),  // Gold
        new(62, 88, 196),   // Royal Blue
    ];

    /// <summary>
    /// Deterministically pick an icon from available icons using tribe ID as seed.
    /// </summary>
    public static string PickIcon(int tribeId, IReadOnlyList<string> availableIcons)
    {
        if (availableIcons.Count == 0)
            return "icons/fallback";

        var index = (tribeId * 2654435761u) % (uint)availableIcons.Count;
        return availableIcons[(int)index];
    }

    /// <summary>
    /// Map polity tier to frame asset key used by RuntimeAssetCatalog.
    /// </summary>
    public static string PolityFrameKeyForTier(PolityTier tier)
    {
        return tier switch
        {
            PolityTier.Tribe => "insignia/tribe_polity",
            PolityTier.City => "insignia/city_polity",
            PolityTier.Duchy => "insignia/duchy_polity",
            PolityTier.Kingdom => "insignia/kingdom_polity",
            PolityTier.Empire => "insignia/empire_polity",
            _ => "insignia/tribe_polity",
        };
    }

    private static int HashFloat(float value)
    {
        var bits = BitConverter.SingleToInt32Bits(value);
        return (int)((uint)bits * 2654435761u);
    }
}
