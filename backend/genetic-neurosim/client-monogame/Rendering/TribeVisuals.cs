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

    private static readonly Dictionary<int, Color> _colorCache = new();

    public static Color ColorForTribe(int tribeId)
    {
        if (_colorCache.TryGetValue(tribeId, out var cached))
            return cached;
        var color = GenerateDistinctColor(_colorCache.Count);
        _colorCache[tribeId] = color;
        return color;
    }

    private static Color GenerateDistinctColor(int index)
    {
        // Golden ratio HSV: hue cycles with maximum spread
        const float GoldenRatio = 0.618033988749895f;
        var hue = (index * GoldenRatio) % 1f;
        var saturation = 0.75f + (index % 3) * 0.08f;    // 0.75..0.91
        var value = 0.80f + (index % 2) * 0.10f;          // 0.80..0.90
        return HsvToRgb(hue, saturation, value);
    }

    private static Color HsvToRgb(float h, float s, float v)
    {
        var hi = (int)(h * 6f) % 6;
        var f = h * 6f - MathF.Floor(h * 6f);
        var p = v * (1f - s);
        var q = v * (1f - f * s);
        var t = v * (1f - (1f - f) * s);
        var (r, g, b) = hi switch
        {
            0 => (v, t, p),
            1 => (q, v, p),
            2 => (p, v, t),
            3 => (p, q, v),
            4 => (t, p, v),
            _ => (v, p, q),
        };
        return new Color(ClampChannel(r), ClampChannel(g), ClampChannel(b));
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
