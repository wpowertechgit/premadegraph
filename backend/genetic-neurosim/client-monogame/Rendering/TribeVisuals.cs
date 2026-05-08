using Microsoft.Xna.Framework;
using TribalNeuroSim.Client.Protocol;

namespace TribalNeuroSim.Client.Rendering;

public static class TribeVisuals
{
    private static readonly Color[] OverviewPalette =
    [
        new(230, 64, 64),
        new(56, 176, 78),
        new(62, 118, 232),
        new(242, 208, 54),
        new(154, 82, 220),
        new(56, 202, 220),
        new(244, 128, 34),
        new(236, 76, 180),
        new(160, 228, 64),
        new(120, 26, 26),
        new(24, 68, 156),
        new(132, 255, 210),
    ];

    public static Color ColorForTribe(int tribeId)
    {
        if (tribeId <= 0)
            return OverviewPalette[0];

        var baseColor = OverviewPalette[(tribeId - 1) % OverviewPalette.Length];
        var cycle = (tribeId - 1) / OverviewPalette.Length;
        if (cycle == 0)
            return baseColor;

        var brighten = Math.Min(0.18f, 0.06f * cycle);
        var darken = Math.Min(0.16f, 0.05f * cycle);
        return new Color(
            ClampChannel(baseColor.R / 255f * (1f - darken) + brighten),
            ClampChannel(baseColor.G / 255f * (1f - darken) + brighten),
            ClampChannel(baseColor.B / 255f * (1f - darken) + brighten));
    }

    public static string RoleLabel(ArtifactVector artifacts)
    {
        var dominant = DominantStat(artifacts);
        return dominant switch
        {
            "Combat" => "Warband",
            "Resource" => "Supply",
            "MapObjective" => "Pathfinders",
            "Risk" => "Vanguard",
            "Team" => "Council",
            _ => "Generalists",
        };
    }

    public static string DominantStat(ArtifactVector artifacts)
    {
        var stats = new (string Label, float Value)[]
        {
            ("Combat", artifacts.Combat),
            ("Resource", artifacts.Resource),
            ("MapObjective", artifacts.MapObjective),
            ("Risk", artifacts.Risk),
            ("Team", artifacts.Team),
        };

        return stats
            .OrderByDescending(item => item.Value)
            .ThenBy(item => item.Label, StringComparer.Ordinal)
            .First()
            .Label;
    }

    private static float ClampChannel(float value) => MathHelper.Clamp(value, 0f, 1f);
}
