using Microsoft.Xna.Framework;
using TribalNeuroSim.Client.Assets;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Protocol;

namespace TribalNeuroSim.Client.Rendering;

/// <summary>
/// Single planned prop instance ready for batch grouping and GPU draw.
/// </summary>
public readonly record struct PlannedPropInstance(
    string ModelKey,
    Matrix World,
    float WindPhase,
    PropFamily Family);

/// <summary>
/// Deterministic prop placement planner. Consumes biome prop rules and produces
/// per-tile PlannedPropInstance lists with placement constraints applied.
/// V0: 2-3 prop families per biome, deterministic seeds, LOD-aware count reduction.
/// </summary>
public static class PropPlacementPlanner
{
    private const float TileRadius = 12f;
    private const float CapitalClearRadius = 6f;
    private const float MinCenterAvoidRock = 3f;
    private const float MinCenterAvoidTree = 4f;

    // Per-model scale resolution matching VegetationRenderer convention
    private const float TreeScale = 0.16f;
    private const float BushScale = 0.12f;
    private const float RockScale = 0.10f;
    private const float DefaultScale = 0.14f;

    // LOD thresholds matching camera distance
    private const float LodCloseDistance = 200f;
    private const float LodMidDistance = 500f;
    private const float LodFarDistance = 800f;

    // Cap total props per tile for performance
    private const int MaxPropsPerTile = 42;

    /// <summary>
    /// Generate planned prop instances for all tiles in the simulation.
    /// </summary>
    public static List<PlannedPropInstance> Plan(
        PlayableSimulation simulation,
        IReadOnlyList<BiomePropRule> rules,
        IReadOnlyList<PropVisualProfile> profiles,
        float cameraDistance = 200f)
    {
        var instances = new List<PlannedPropInstance>();
        var profileByKey = profiles.ToDictionary(p => p.Key, StringComparer.OrdinalIgnoreCase);
        var capitalTileIds = new HashSet<int>(
            simulation.Tribes.Where(t => t.IsAlive).Select(t => t.MainCampTileId));

        // Group rules by biome for fast lookup
        var rulesByBiome = rules
            .GroupBy(r => r.Biome)
            .ToDictionary(g => g.Key, g => g.ToArray());

        foreach (var tile in simulation.Tiles)
        {
            if (!rulesByBiome.TryGetValue(tile.Biome, out var biomeRules))
                continue;

            var isCapital = capitalTileIds.Contains(tile.Id);
            var center = TileToWorld(simulation, tile);
            var rng = new Random(tile.Id * 1337 + 42); // Deterministic per tile
            var lodMultiplier = LodCountMultiplier(cameraDistance);

            var tileInstances = PlanTile(
                simulation, center, tile, biomeRules, profileByKey, isCapital, rng, lodMultiplier);
            instances.AddRange(tileInstances);
        }

        return instances;
    }

    /// Network-mode overload: plans props from RenderableTile list (no PlayableSimulation needed).
    /// Uses tile.VisualElevation (0 in network mode) for Y position.
    public static List<PlannedPropInstance> Plan(
        IReadOnlyList<RenderableTile> tiles,
        HashSet<int> capitalTileIds,
        IReadOnlyList<BiomePropRule> rules,
        IReadOnlyList<PropVisualProfile> profiles,
        float cameraDistance = 200f)
    {
        var instances = new List<PlannedPropInstance>();
        var profileByKey = profiles.ToDictionary(p => p.Key, StringComparer.OrdinalIgnoreCase);
        var rulesByBiome = rules.GroupBy(r => r.Biome).ToDictionary(g => g.Key, g => g.ToArray());
        var lodMultiplier = LodCountMultiplier(cameraDistance);

        foreach (var tile in tiles)
        {
            if (!rulesByBiome.TryGetValue(tile.Biome, out var biomeRules))
                continue;

            var isCapital = capitalTileIds.Contains(tile.TileId);
            var center = new Vector3(tile.Center.X, tile.VisualElevation, tile.Center.Y);
            var rng = new Random(tile.TileId * 1337 + 42);

            var tileInstances = PlanTileFlat(center, tile.Biome, biomeRules, profileByKey, isCapital, rng, lodMultiplier);
            instances.AddRange(tileInstances);
        }

        return instances;
    }

    private static List<PlannedPropInstance> PlanTileFlat(
        Vector3 center,
        Domain.BiomeId biome,
        BiomePropRule[] biomeRules,
        Dictionary<string, PropVisualProfile> profileByKey,
        bool isCapital,
        Random rng,
        float lodMultiplier)
    {
        var results = new List<PlannedPropInstance>();

        foreach (var rule in biomeRules)
        {
            if (rule.CandidatePropKeys.Length == 0)
                continue;

            var densityMultiplier = DensityMultiplier(rule.Family);
            var minCount = (int)MathF.Max(1, MathF.Ceiling(rule.MinPerTile * lodMultiplier * densityMultiplier));
            var maxCount = (int)MathF.Max(minCount, MathF.Ceiling(rule.MaxPerTile * lodMultiplier * densityMultiplier));
            var count = minCount + rng.Next(maxCount - minCount + 1);
            var remaining = MaxPropsPerTile - results.Count;
            if (remaining <= 0) break;
            count = Math.Min(count, remaining);

            for (var i = 0; i < count; i++)
            {
                if (results.Count >= MaxPropsPerTile) break;

                var propKey = rule.CandidatePropKeys[rng.Next(rule.CandidatePropKeys.Length)];
                if (!profileByKey.TryGetValue(propKey, out var profile)) continue;

                var angle = (float)(rng.NextDouble() * Math.Tau);
                var minDist = rule.MinDistanceFromTileCenter;
                var maxDist = rule.MaxDistanceFromTileCenter;

                if (profile.Family is PropFamily.Tree or PropFamily.Rock)
                    minDist = MathF.Max(minDist, isCapital ? CapitalClearRadius : MinCenterAvoidTree);

                var dist = minDist + (float)rng.NextDouble() * (maxDist - minDist);
                dist = Math.Clamp(dist, 0f, TileRadius - 1f);

                var scale = ResolveVisibleScale(profile)
                          * (1f - profile.ScaleVariance * 0.5f + (float)rng.NextDouble() * profile.ScaleVariance);
                var rotation = (float)(rng.NextDouble() * Math.Tau);

                var world = Matrix.CreateScale(scale)
                          * Matrix.CreateRotationY(rotation)
                          * Matrix.CreateTranslation(
                              center.X + MathF.Cos(angle) * dist,
                              center.Y + rule.ElevationBias,
                              center.Z + MathF.Sin(angle) * dist);

                results.Add(new PlannedPropInstance(
                    profile.ModelKey, world, (float)rng.NextDouble() * MathHelper.TwoPi, profile.Family));
            }
        }

        return results;
    }

    private static List<PlannedPropInstance> PlanTile(
        PlayableSimulation simulation,
        Vector3 center,
        PlayableTile tile,
        BiomePropRule[] biomeRules,
        Dictionary<string, PropVisualProfile> profileByKey,
        bool isCapital,
        Random rng,
        float lodMultiplier)
    {
        var results = new List<PlannedPropInstance>();

        foreach (var rule in biomeRules)
        {
            if (rule.CandidatePropKeys.Length == 0)
                continue;

            // Apply LOD multiplier to count range
            var densityMultiplier = DensityMultiplier(rule.Family);
            var minCount = (int)MathF.Max(1, MathF.Ceiling(rule.MinPerTile * lodMultiplier * densityMultiplier));
            var maxCount = (int)MathF.Max(minCount, MathF.Ceiling(rule.MaxPerTile * lodMultiplier * densityMultiplier));
            var count = minCount + rng.Next(maxCount - minCount + 1);

            // Cap remaining slots
            var remaining = MaxPropsPerTile - results.Count;
            if (remaining <= 0)
                break;
            count = Math.Min(count, remaining);

            for (var i = 0; i < count; i++)
            {
                if (results.Count >= MaxPropsPerTile)
                    break;

                var propKey = rule.CandidatePropKeys[rng.Next(rule.CandidatePropKeys.Length)];
                if (!profileByKey.TryGetValue(propKey, out var profile))
                    continue;

                // Placement constraints
                var angle = (float)(rng.NextDouble() * Math.Tau);
                var minDist = rule.MinDistanceFromTileCenter;
                var maxDist = rule.MaxDistanceFromTileCenter;

                // Push trees and rocks away from tile center
                if (profile.Family is PropFamily.Tree or PropFamily.Rock)
                    minDist = MathF.Max(minDist,
                        isCapital ? CapitalClearRadius : MinCenterAvoidTree);

                var dist = minDist + (float)rng.NextDouble() * (maxDist - minDist);
                dist = Math.Clamp(dist, 0f, TileRadius - 1f);

                var offsetX = MathF.Cos(angle) * dist;
                var offsetZ = MathF.Sin(angle) * dist;

                var scale = ResolveVisibleScale(profile)
                          * (1f - profile.ScaleVariance * 0.5f + (float)rng.NextDouble() * profile.ScaleVariance);
                var rotation = (float)(rng.NextDouble() * Math.Tau);
                var worldX = center.X + offsetX;
                var worldZ = center.Z + offsetZ;
                var elevation = PlayableWorldGenerator.VisualSurfaceElevation(
                    simulation.Seed,
                    simulation.Width,
                    simulation.Height,
                    worldX,
                    worldZ,
                    tile.Biome,
                    center.Y) + rule.ElevationBias;

                var world = Matrix.CreateScale(scale)
                          * Matrix.CreateRotationY(rotation)
                          * Matrix.CreateTranslation(
                              worldX,
                              elevation,
                              worldZ);

                results.Add(new PlannedPropInstance(
                    profile.ModelKey, world, (float)rng.NextDouble() * MathHelper.TwoPi, profile.Family));
            }
        }

        return results;
    }

    /// <summary>
    /// Returns a multiplier for prop counts based on camera distance.
    /// Close: full count. Mid: ~60%. Far: no grass, reduced everything else.
    /// </summary>
    public static float LodCountMultiplier(float cameraDistance)
    {
        if (cameraDistance <= LodCloseDistance)
            return 1.0f;
        if (cameraDistance <= LodMidDistance)
            return 0.6f;
        return 0.25f;
    }

    /// <summary>
    /// Whether a prop family should be visible at a given camera distance.
    /// Far zoom drops grass patches entirely.
    /// </summary>
    public static bool IsFamilyVisibleAtDistance(PropFamily family, float cameraDistance)
    {
        if (cameraDistance > LodFarDistance && family == PropFamily.GrassPatch)
            return false;
        return true;
    }

    public static float FamilyDistanceMultiplier(PropFamily family, float cameraDistance)
    {
        if (cameraDistance <= LodCloseDistance)
            return 1f;

        if (cameraDistance <= LodMidDistance)
        {
            return family switch
            {
                PropFamily.Rock => 0.72f,
                PropFamily.Tree => 0.60f,
                PropFamily.Bush => 0.42f,
                PropFamily.DeadWood or PropFamily.Log => 0.52f,
                PropFamily.Reed or PropFamily.Flower => 0.34f,
                PropFamily.GrassPatch => 0.22f,
                _ => 0.40f,
            };
        }

        return family switch
        {
            PropFamily.Rock => 0.34f,
            PropFamily.Tree => 0.18f,
            PropFamily.DeadWood or PropFamily.Log => 0.16f,
            PropFamily.Bush => 0.10f,
            PropFamily.Reed or PropFamily.Flower => 0.08f,
            PropFamily.GrassPatch => 0f,
            _ => 0.10f,
        };
    }

    private static float ResolveVisibleScale(PropVisualProfile profile)
    {
        var multiplier = profile.Family switch
        {
            PropFamily.Tree => 7.4f,
            PropFamily.Rock => 4.2f,
            PropFamily.DeadWood or PropFamily.Log => 5.6f,
            PropFamily.Bush => 4.8f,
            PropFamily.GrassPatch or PropFamily.Reed or PropFamily.Flower => 3.8f,
            _ => 1f,
        };

        return profile.BaseScale * multiplier;
    }

    private static float DensityMultiplier(PropFamily family)
    {
        return family switch
        {
            PropFamily.Tree => 1.75f,
            PropFamily.Bush => 1.55f,
            PropFamily.Rock => 1.65f,
            PropFamily.DeadWood or PropFamily.Log => 1.35f,
            PropFamily.GrassPatch or PropFamily.Reed or PropFamily.Flower => 1.35f,
            _ => 1.15f,
        };
    }

    private static Vector3 TileToWorld(PlayableSimulation simulation, PlayableTile tile)
    {
        const float tileSize = 28f;
        var horizontalSpacing = MathF.Sqrt(3f) * tileSize;
        var rowOffset = tile.Y % 2 == 0 ? 0f : horizontalSpacing * 0.5f;
        var x = tile.X * horizontalSpacing + rowOffset;
        var z = tile.Y * tileSize * 1.5f;
        var tileElevation = PlayableWorldGenerator.VisualElevation(
            simulation.Seed, simulation.Width, simulation.Height,
            tile.X, tile.Y, tile.Biome);
        var y = PlayableWorldGenerator.VisualSurfaceElevation(
            simulation.Seed, simulation.Width, simulation.Height,
            x, z, tile.Biome, tileElevation);
        return new Vector3(x, y, z);
    }

    /// <summary>
    /// Resolve a model scale from prop key by heuristic, matching VegetationRenderer convention.
    /// </summary>
    public static float ResolveModelScale(string modelKey)
    {
        var lower = modelKey.ToLowerInvariant();
        if (lower.Contains("tree") || lower.Contains("pine") || lower.Contains("birch")
            || lower.Contains("willow") || lower.Contains("palm") || lower.Contains("oak")
            || lower.Contains("spruce"))
            return TreeScale;
        if (lower.Contains("bush") || lower.Contains("fern") || lower.Contains("grass")
            || lower.Contains("plant") || lower.Contains("flower"))
            return BushScale;
        if (lower.Contains("rock") || lower.Contains("stone") || lower.Contains("boulder"))
            return RockScale;
        if (lower.Contains("log") || lower.Contains("stump"))
            return BushScale * 1.5f;
        if (lower.Contains("cactus"))
            return TreeScale * 0.8f;

        return DefaultScale;
    }
}
