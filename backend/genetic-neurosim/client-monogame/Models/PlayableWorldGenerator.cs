using TribalNeuroSim.Client.Domain;

namespace TribalNeuroSim.Client.Models;

public static class PlayableWorldGenerator
{
    private const float SpawnEdgePadding = 2f;
    public const float BaseTerrainSurfaceElevation = 0f;
    public const float MinimumVisualElevation = -1.15f;
    public const float MaximumVisualElevation = 4.50f;
    public const float MaximumVisualSurfaceElevation = 32.0f;

    public static (int Width, int Height) CalculateDemoSize(int tribeCount)
    {
        var tribes = Math.Max(2, tribeCount);
        var targetTiles = Math.Clamp(tribes * 95, 260, 3200);
        var width = (int)MathF.Ceiling(MathF.Sqrt(targetTiles * 1.45f));
        var height = (int)MathF.Ceiling(targetTiles / (float)width);

        return (Math.Max(18, width), Math.Max(14, height));
    }

    /// <summary>
    /// M18B: Empire stress preset map size — denser than normal demo to force interaction.
    /// Fewer tiles per tribe means closer neighbors, more disputes, faster merges.
    /// </summary>
    public static (int Width, int Height) CalculateEmpireStressSize(int tribeCount)
    {
        var tribes = Math.Max(6, tribeCount);
        // Denser: ~65 tiles per tribe vs default 95 — forces closer interaction
        var targetTiles = Math.Clamp(tribes * 65, 400, 5000);
        var width = (int)MathF.Ceiling(MathF.Sqrt(targetTiles * 1.45f));
        var height = (int)MathF.Ceiling(targetTiles / (float)width);

        return (Math.Max(24, width), Math.Max(18, height));
    }

    /// <summary>
    /// M18C: Compact dispute stress map size. It keeps tribes close enough that the
    /// local demo can reliably create contested border tiles for visual validation.
    /// </summary>
    public static (int Width, int Height) CalculateDisputeStressSize(int tribeCount)
    {
        var tribes = Math.Max(4, tribeCount);
        var targetTiles = Math.Clamp(tribes * 42, 220, 1800);
        var width = (int)MathF.Ceiling(MathF.Sqrt(targetTiles * 1.35f));
        var height = (int)MathF.Ceiling(targetTiles / (float)width);

        return (Math.Max(16, width), Math.Max(12, height));
    }

    public static List<PlayableTile> GenerateTiles(int seed, int width, int height)
    {
        var tiles = new List<PlayableTile>(width * height);

        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var biome = PickBiome(seed, width, height, x, y);
                var maxFood = BiomeFertility(biome);
                var abundance = 0.54f + 0.36f * Noise01(seed + 91, x * 0.31f, y * 0.31f);

                tiles.Add(new PlayableTile(
                    id: ToTileId(x, y, width),
                    x: x,
                    y: y,
                    biome: biome,
                    food: maxFood * abundance,
                    maxFood: maxFood));
            }
        }

        return tiles;
    }

    public static List<int> BuildSpawnTiles(
        int seed,
        IReadOnlyList<PlayableTile> tiles,
        int width,
        int height,
        int tribeCount)
    {
        var count = Math.Max(2, tribeCount);
        var centerX = (width - 1) * 0.5f;
        var centerY = (height - 1) * 0.5f;
        var minDistance = MathF.Max(4f, MathF.Sqrt(width * height / (float)count) * 0.62f);

        var candidates = tiles
            .Where(tile => IsSpawnBiome(tile.Biome))
            .Where(tile => tile.X >= SpawnEdgePadding && tile.Y >= SpawnEdgePadding)
            .Where(tile => tile.X <= width - 1 - SpawnEdgePadding && tile.Y <= height - 1 - SpawnEdgePadding)
            .Select(tile =>
            {
                var centerDistance = MathF.Sqrt(MathF.Pow(tile.X - centerX, 2f) + MathF.Pow(tile.Y - centerY, 2f));
                var centerPenalty = centerDistance < MathF.Min(width, height) * 0.18f ? 0.45f : 0f;
                var edgeDistance = MathF.Min(MathF.Min(tile.X, width - 1 - tile.X), MathF.Min(tile.Y, height - 1 - tile.Y));
                var noise = Noise01(seed + 211, tile.X * 0.47f, tile.Y * 0.47f);
                var fertility = BiomeFertility(tile.Biome) / 100f;
                var score = fertility * 0.54f + noise * 0.38f + MathF.Min(edgeDistance / 8f, 1f) * 0.12f - centerPenalty;
                return new SpawnCandidate(tile.Id, score);
            })
            .OrderByDescending(candidate => candidate.Score)
            .ToList();

        var selected = new List<int>(count);

        while (selected.Count < count && minDistance >= 2f)
        {
            foreach (var candidate in candidates)
            {
                if (selected.Count >= count)
                    break;

                if (selected.Contains(candidate.TileId))
                    continue;

                var tile = tiles[candidate.TileId];
                if (selected.All(id => GridDistance(tile, tiles[id]) >= minDistance))
                    selected.Add(candidate.TileId);
            }

            minDistance *= 0.82f;
        }

        foreach (var candidate in candidates)
        {
            if (selected.Count >= count)
                break;

            if (!selected.Contains(candidate.TileId))
                selected.Add(candidate.TileId);
        }

        return selected;
    }

    public static BiomeId PickBiome(int seed, int width, int height, int x, int y)
    {
        var nx = width <= 1 ? 0f : x / (float)(width - 1);
        var ny = height <= 1 ? 0f : y / (float)(height - 1);
        var elevation = Fbm(seed + 17, nx * 3.1f, ny * 3.1f, 4);
        var moisture = Fbm(seed + 43, nx * 3.6f + 12.5f, ny * 3.6f - 7.5f, 4);
        var warmth = Math.Clamp(1f - ny + (Fbm(seed + 71, nx * 1.8f, ny * 1.8f, 3) - 0.5f) * 0.32f, 0f, 1f);
        var riverPath = MathF.Abs(Fbm(seed + 109, nx * 2.0f + 3.3f, ny * 2.0f, 3) - 0.5f);

        if (riverPath < 0.035f && elevation < 0.70f)
            return BiomeId.Riverland;

        if (warmth < 0.23f)
            return BiomeId.Cold;

        if (elevation > 0.77f)
            return BiomeId.Mountains;

        if (elevation > 0.64f)
            return BiomeId.Hills;

        if (moisture > 0.73f && elevation < 0.45f)
            return BiomeId.Marsh;

        if (moisture < 0.25f && warmth > 0.44f)
            return BiomeId.DrySteppe;

        if (moisture > 0.67f)
            return BiomeId.DenseForest;

        if (moisture > 0.54f)
            return BiomeId.SparseWoodland;

        if (moisture > 0.40f && warmth > 0.36f)
            return BiomeId.FertileValley;

        return BiomeId.Plains;
    }

    public static float BiomeFertility(BiomeId biome)
    {
        return biome switch
        {
            BiomeId.FertileValley => 100f,
            BiomeId.Riverland => 88f,
            BiomeId.Plains => 76f,
            BiomeId.SparseWoodland => 68f,
            BiomeId.DenseForest => 62f,
            BiomeId.Marsh => 54f,
            BiomeId.Hills => 48f,
            BiomeId.Cold => 40f,
            BiomeId.Mountains => 34f,
            BiomeId.DrySteppe => 32f,
            _ => 45f,
        };
    }

    /// <summary>
    /// Subtle visual elevation for hex terrain relief. The map must still read as a
    /// coherent board/parchment map at normal strategy angle. Mountains, hills, and
    /// valleys are expressed by gentle height offset, texture, tint, and prop density
    /// — never by spawning giant terrain chunk models.
    /// </summary>
    public static float VisualElevation(int seed, int width, int height, int x, int y, BiomeId biome)
    {
        var nx = width <= 1 ? 0f : x / (float)(width - 1);
        var ny = height <= 1 ? 0f : y / (float)(height - 1);
        var elevation = Fbm(seed + 17, nx * 3.1f, ny * 3.1f, 4);
        var biomeLift = biome switch
        {
            BiomeId.Hills => 0.40f,
            BiomeId.Mountains => 0.65f,
            BiomeId.Cold => 0.18f,
            BiomeId.Riverland => -0.15f,
            BiomeId.Marsh => -0.10f,
            _ => 0f,
        };

        return Math.Clamp((elevation - 0.5f) * 2.35f + biomeLift * 2.55f, MinimumVisualElevation, MaximumVisualElevation);
    }

    /// <summary>
    /// Biome-aware surface height sampled in world space. This is visual-only relief:
    /// ownership, movement, yields, and expansion still use the underlying tile model.
    /// </summary>
    public static float VisualSurfaceElevation(
        int seed,
        int width,
        int height,
        float worldX,
        float worldZ,
        BiomeId biome,
        float tileElevation,
        float localX = 0f,
        float localZ = 0f,
        float tileRadius = 0f,
        int elevatedNeighborMask = 0b11_1111,
        int reliefNeighborMask = -1)
    {
        var mapScale = 1f / MathF.Max(1f, MathF.Sqrt(width * height));
        var x = worldX * mapScale;
        var z = worldZ * mapScale;

        var shaped = biome switch
        {
            BiomeId.Hills => Math.Clamp(HillRelief(seed, x, z), BaseTerrainSurfaceElevation, 11.0f),
            BiomeId.Mountains => Math.Clamp(MountainRelief(seed, x, z), BaseTerrainSurfaceElevation, MaximumVisualSurfaceElevation),
            _ => BaseTerrainSurfaceElevation,
        };

        if (biome is not (BiomeId.Hills or BiomeId.Mountains) || tileRadius <= 0f)
            return shaped;

        var neighborMask = reliefNeighborMask >= 0
            ? reliefNeighborMask
            : LegacyReliefNeighborMask(elevatedNeighborMask);
        return Math.Clamp(ApplyReliefEdgeTransitions(
            shaped,
            biome,
            localX,
            localZ,
            tileRadius,
            neighborMask), MinimumVisualElevation, MaximumVisualSurfaceElevation);
    }

    private static float HillRelief(int seed, float x, float z)
    {
        var broad = SmoothStep(Fbm(seed + 503, x * 1.45f, z * 1.45f, 3));
        var softDetail = Fbm(seed + 541, x * 4.25f, z * 4.25f, 3);
        return 0.35f + broad * 5.75f + (softDetail - 0.5f) * 1.45f;
    }

    private static float MountainRelief(int seed, float x, float z)
    {
        var baseMass = SmoothStep(Fbm(seed + 607, x * 1.15f, z * 1.15f, 4));
        var ridges = RidgedFbm(seed + 641, x * 8.50f, z * 8.50f, 5);
        var fractures = RidgedFbm(seed + 673, x * 15.0f, z * 15.0f, 3);
        var liftedMass = MathF.Pow(Math.Clamp(baseMass, 0f, 1f), 2.15f) * 17.0f;
        var ridgeLift = MathF.Pow(Math.Clamp(ridges, 0f, 1f), 1.25f) * 13.0f;
        var fractureLift = MathF.Pow(Math.Clamp(fractures, 0f, 1f), 1.80f) * 5.5f;
        var valleyCut = (1f - baseMass) * 3.0f;
        return 0.25f + liftedMass + ridgeLift + fractureLift - valleyCut;
    }

    private static float ApplyReliefEdgeTransitions(
        float shapedHeight,
        BiomeId biome,
        float localX,
        float localZ,
        float tileRadius,
        int reliefNeighborMask)
    {
        var blendWidth = tileRadius * (biome == BiomeId.Mountains ? 0.78f : 0.62f);
        var height = shapedHeight;

        for (var side = 0; side < 6; side++)
        {
            var (ax, az) = HexCorner2(tileRadius, side);
            var (bx, bz) = HexCorner2(tileRadius, (side + 1) % 6);
            var edgeX = bx - ax;
            var edgeZ = bz - az;
            var lengthSquared = edgeX * edgeX + edgeZ * edgeZ;
            if (lengthSquared <= 0.0001f)
                continue;

            var projection = ((localX - ax) * edgeX + (localZ - az) * edgeZ) / lengthSquared;
            if (projection is < 0f or > 1f)
                continue;

            var length = MathF.Sqrt(lengthSquared);
            var distance = MathF.Abs(edgeX * (az - localZ) - (ax - localX) * edgeZ) / length;
            var neighborBiome = DecodeReliefNeighbor(reliefNeighborMask, side);
            if (ShouldPreserveReliefAcrossEdge(biome, neighborBiome))
                continue;

            var blend = SmoothStep(Math.Clamp(distance / blendWidth, 0f, 1f));
            var target = EdgeTargetHeight(biome, neighborBiome);
            height = Lerp(target, height, blend);
        }

        return height;
    }

    private static float EdgeTargetHeight(BiomeId biome, BiomeId neighborBiome)
    {
        return biome switch
        {
            BiomeId.Mountains when neighborBiome == BiomeId.Hills => 9.5f,
            BiomeId.Hills when neighborBiome == BiomeId.Mountains => 9.5f,
            _ => BaseTerrainSurfaceElevation,
        };
    }

    private static bool ShouldPreserveReliefAcrossEdge(BiomeId biome, BiomeId neighborBiome)
    {
        return biome == neighborBiome && biome is BiomeId.Hills or BiomeId.Mountains;
    }

    private static BiomeId DecodeReliefNeighbor(int reliefNeighborMask, int side)
    {
        return ((reliefNeighborMask >> (side * 2)) & 0b11) switch
        {
            1 => BiomeId.Hills,
            2 => BiomeId.Mountains,
            _ => BiomeId.Unknown,
        };
    }

    private static int LegacyReliefNeighborMask(int elevatedNeighborMask)
    {
        var mask = 0;
        for (var side = 0; side < 6; side++)
        {
            if ((elevatedNeighborMask & (1 << side)) != 0)
                mask |= 2 << (side * 2);
        }

        return mask;
    }

    private static (float X, float Z) HexCorner2(float radius, int corner)
    {
        var angle = MathF.PI / 180f * (-90f + corner * 60f);
        return (MathF.Cos(angle) * radius, MathF.Sin(angle) * radius);
    }

    private static bool IsSpawnBiome(BiomeId biome)
    {
        return biome is BiomeId.Plains
            or BiomeId.FertileValley
            or BiomeId.SparseWoodland
            or BiomeId.DenseForest
            or BiomeId.DrySteppe
            or BiomeId.Hills;
    }

    private static float GridDistance(PlayableTile first, PlayableTile second)
    {
        var dx = first.X - second.X;
        var dy = first.Y - second.Y;
        return MathF.Sqrt(dx * dx + dy * dy);
    }

    private static float Fbm(int seed, float x, float y, int octaves)
    {
        var total = 0f;
        var amplitude = 0.5f;
        var frequency = 1f;
        var normalizer = 0f;

        for (var i = 0; i < octaves; i++)
        {
            total += Noise01(seed + i * 101, x * frequency, y * frequency) * amplitude;
            normalizer += amplitude;
            amplitude *= 0.5f;
            frequency *= 2f;
        }

        return normalizer <= 0f ? 0f : total / normalizer;
    }

    private static float RidgedFbm(int seed, float x, float y, int octaves)
    {
        var total = 0f;
        var amplitude = 0.5f;
        var frequency = 1f;
        var normalizer = 0f;

        for (var i = 0; i < octaves; i++)
        {
            var signed = Noise01(seed + i * 131, x * frequency, y * frequency) * 2f - 1f;
            var ridge = 1f - MathF.Abs(signed);
            total += ridge * ridge * amplitude;
            normalizer += amplitude;
            amplitude *= 0.52f;
            frequency *= 2.15f;
        }

        return normalizer <= 0f ? 0f : total / normalizer;
    }

    private static float Noise01(int seed, float x, float y)
    {
        var x0 = (int)MathF.Floor(x);
        var y0 = (int)MathF.Floor(y);
        var tx = SmoothStep(x - x0);
        var ty = SmoothStep(y - y0);

        var a = Hash01(seed, x0, y0);
        var b = Hash01(seed, x0 + 1, y0);
        var c = Hash01(seed, x0, y0 + 1);
        var d = Hash01(seed, x0 + 1, y0 + 1);

        return Lerp(Lerp(a, b, tx), Lerp(c, d, tx), ty);
    }

    private static float Hash01(int seed, int x, int y)
    {
        unchecked
        {
            var n = seed;
            n ^= x * 374761393;
            n = (n << 13) ^ n;
            n ^= y * 668265263;
            n = (n * 1274126177) ^ (n >> 16);
            return (n & 0x7fffffff) / (float)int.MaxValue;
        }
    }

    private static float SmoothStep(float t)
    {
        return t * t * (3f - 2f * t);
    }

    private static float Lerp(float a, float b, float t)
    {
        return a + (b - a) * t;
    }

    private static int ToTileId(int x, int y, int width) => y * width + x;

    private readonly record struct SpawnCandidate(int TileId, float Score);
}
