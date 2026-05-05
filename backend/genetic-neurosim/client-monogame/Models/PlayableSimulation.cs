using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Protocol;

namespace TribalNeuroSim.Client.Models;

public sealed class PlayableSimulation
{
    private const int MaxRecentEvents = 80;

    private readonly Random _random;
    private readonly int _centerTileId;
    private readonly Dictionary<(int FirstTribeId, int SecondTribeId), int> _disputeCounts = new();

    private PlayableSimulation(int seed, int width, int height)
    {
        Seed = seed;
        Width = width;
        Height = height;
        _random = new Random(seed);
        _centerTileId = ToTileId(width / 2, height / 2);
    }

    public int Seed { get; }

    public int Width { get; }

    public int Height { get; }

    public ulong Tick { get; private set; }

    public List<PlayableTile> Tiles { get; } = new();

    public List<PlayableTribe> Tribes { get; } = new();

    public List<PlayableEvent> RecentEvents { get; } = new();

    public List<PlayableTribeTombstone> Tombstones { get; } = new();

    public bool IsPaused { get; set; }

    public int SelectedTribeId { get; set; } = -1;

    public static PlayableSimulation CreateDemo(int seed = 1337, int width = 40, int height = 28, int tribeCount = 12)
    {
        var simulation = new PlayableSimulation(seed, width, height);
        simulation.GenerateTiles();
        simulation.GenerateTribes(Math.Max(2, tribeCount));
        return simulation;
    }

    public void Reset()
    {
        Tick = 0;
        Tiles.Clear();
        Tribes.Clear();
        RecentEvents.Clear();
        Tombstones.Clear();
        _disputeCounts.Clear();
        GenerateTiles();
        GenerateTribes(12);
    }

    public void Step()
    {
        Tick++;
        GrowFood();

        foreach (var tribe in Tribes.Where(tribe => tribe.IsAlive))
        {
            Harvest(tribe);
            ApplyPopulationPressure(tribe);

            if (Tick % 5 == 0)
            {
                Expand(tribe);
            }

            if (Tick % 12 == 0)
            {
                ClaimTile(tribe, _centerTileId, contestedShare: 0.24f, emitEvents: true);
            }
        }
    }

    public IEnumerable<int> NeighborTileIds(int tileId)
    {
        var x = tileId % Width;
        var y = tileId / Width;

        if (x > 0)
        {
            yield return ToTileId(x - 1, y);
        }

        if (x < Width - 1)
        {
            yield return ToTileId(x + 1, y);
        }

        if (y > 0)
        {
            yield return ToTileId(x, y - 1);
        }

        if (y < Height - 1)
        {
            yield return ToTileId(x, y + 1);
        }
    }

    private void GenerateTiles()
    {
        for (var y = 0; y < Height; y++)
        {
            for (var x = 0; x < Width; x++)
            {
                var biome = PickBiome(x, y);
                var maxFood = BiomeFertility(biome);
                Tiles.Add(new PlayableTile(
                    id: ToTileId(x, y),
                    x: x,
                    y: y,
                    biome: biome,
                    food: maxFood * (0.55f + (float)_random.NextDouble() * 0.35f),
                    maxFood: maxFood));
            }
        }
    }

    private void GenerateTribes(int tribeCount)
    {
        var spawnTiles = BuildSpawnTiles(tribeCount);

        for (var i = 0; i < tribeCount; i++)
        {
            var id = i + 1;
            var homeTile = spawnTiles[i % spawnTiles.Count];
            var artifacts = new ArtifactVector(
                Combat: 0.25f + (float)_random.NextDouble() * 0.75f,
                Resource: 0.25f + (float)_random.NextDouble() * 0.75f,
                MapObjective: 0.25f + (float)_random.NextDouble() * 0.75f,
                Risk: 0.25f + (float)_random.NextDouble() * 0.75f,
                Team: 0.25f + (float)_random.NextDouble() * 0.75f);

            var tribe = new PlayableTribe(
                id: id,
                name: $"Tribe {id}",
                mainCampTileId: homeTile,
                population: 80 + _random.Next(20, 90),
                foodStores: 30 + (float)_random.NextDouble() * 35,
                tier: PolityTier.Tribe,
                artifacts: artifacts);

            Tribes.Add(tribe);
            ClaimTile(tribe, homeTile, contestedShare: 1f, emitEvents: false);
            tribe.LastGrowthMilestone = tribe.Population / 50;
        }

        SelectedTribeId = Tribes.FirstOrDefault()?.Id ?? -1;
    }

    private List<int> BuildSpawnTiles(int tribeCount)
    {
        var tiles = new List<int>();
        var radius = Math.Max(3, Math.Min(Width, Height) / 5);
        var centerX = Width / 2;
        var centerY = Height / 2;

        for (var i = 0; i < tribeCount; i++)
        {
            var angle = Math.Tau * i / tribeCount;
            var x = Math.Clamp(centerX + (int)Math.Round(Math.Cos(angle) * radius), 1, Width - 2);
            var y = Math.Clamp(centerY + (int)Math.Round(Math.Sin(angle) * radius), 1, Height - 2);
            tiles.Add(ToTileId(x, y));
        }

        return tiles;
    }

    private void GrowFood()
    {
        foreach (var tile in Tiles)
        {
            tile.Food = MathF.Min(tile.MaxFood, tile.Food + tile.MaxFood * 0.012f);
        }
    }

    private void Harvest(PlayableTribe tribe)
    {
        var harvest = 0f;

        foreach (var tileId in tribe.Territory)
        {
            var tile = Tiles[tileId];
            var share = tile.ControlShareFor(tribe.Id);
            var disputeMultiplier = tile.IsDisputed ? 0.60f : 1f;
            var amount = MathF.Min(tile.Food, tile.MaxFood * (0.012f + tribe.Artifacts.Resource * 0.018f) * share * disputeMultiplier);
            tile.Food -= amount;
            harvest += amount;
        }

        tribe.FoodStores += harvest;
    }

    private void ApplyPopulationPressure(PlayableTribe tribe)
    {
        var upkeep = tribe.Population * 0.028f;
        tribe.FoodStores -= upkeep;
        var startingPopulation = tribe.Population;

        if (tribe.FoodStores > tribe.Population * 0.35f)
        {
            tribe.Population += Math.Max(1, (int)(tribe.Artifacts.Resource * 2f));
            tribe.FoodStores *= 0.94f;
            RecordGrowthIfMajor(tribe);
            return;
        }

        if (tribe.FoodStores < -12f)
        {
            tribe.Population -= Math.Max(1, (int)((1f - Math.Clamp(tribe.Artifacts.Risk, 0f, 1f)) * 5f));
            tribe.FoodStores = -6f;
            AddEvent(new PlayableEvent(
                Tick,
                PlayableEventKind.Starvation,
                tribe.Id,
                OtherTribeId: null,
                TileId: tribe.MainCampTileId,
                PopulationDelta: tribe.Population - startingPopulation,
                Reason: PlayableExtinctionReason.Starvation));
        }

        if (tribe.Population <= 0)
        {
            tribe.Population = 0;
            tribe.IsAlive = false;
            RecordExtinction(tribe, PlayableExtinctionReason.Starvation);
        }
    }

    private void Expand(PlayableTribe tribe)
    {
        if (tribe.Population < 25)
        {
            return;
        }

        var candidate = tribe.Territory
            .SelectMany(NeighborTileIds)
            .Distinct()
            .OrderByDescending(tileId => ScoreExpansionTile(tribe, Tiles[tileId]))
            .FirstOrDefault();

        var outcome = ClaimTile(tribe, candidate, contestedShare: 0.34f, emitEvents: true);
        if (outcome == PlayableClaimOutcome.NewClaim)
        {
            AddEvent(new PlayableEvent(
                Tick,
                PlayableEventKind.Expansion,
                tribe.Id,
                OtherTribeId: null,
                TileId: candidate,
                PopulationDelta: 0,
                Reason: null));
        }
    }

    private float ScoreExpansionTile(PlayableTribe tribe, PlayableTile tile)
    {
        var distanceToCenter = Math.Abs(tile.X - Width / 2f) + Math.Abs(tile.Y - Height / 2f);
        var centerPull = 1f / MathF.Max(1f, distanceToCenter);
        var disputedBonus = tile.Controls.Count > 0 && !tile.Controls.Any(control => control.TribeId == tribe.Id)
            ? tribe.Artifacts.Combat * 0.35f + tribe.Artifacts.Team * 0.20f
            : 0f;
        return tile.Food + centerPull * tribe.Artifacts.MapObjective * 5f + disputedBonus;
    }

    private PlayableClaimOutcome ClaimTile(PlayableTribe tribe, int tileId, float contestedShare, bool emitEvents)
    {
        if (tileId < 0 || tileId >= Tiles.Count || !tribe.IsAlive)
        {
            return PlayableClaimOutcome.None;
        }

        var tile = Tiles[tileId];
        var wasDisputed = tile.IsDisputed;
        var priorClaimants = tile.Controls
            .Where(control => control.TribeId != tribe.Id)
            .Select(control => control.TribeId)
            .ToArray();
        var existing = tile.Controls.FirstOrDefault(control => control.TribeId == tribe.Id);
        var outcome = PlayableClaimOutcome.None;

        if (existing is not null)
        {
            existing.ControlShare = MathF.Min(1f, existing.ControlShare + 0.05f);
            outcome = PlayableClaimOutcome.Reinforced;
        }
        else if (tile.Controls.Count == 0)
        {
            tile.Controls.Add(new TileControlClaim(tribe.Id, 1f));
            outcome = PlayableClaimOutcome.NewClaim;
        }
        else if (tile.Controls.Count < 4)
        {
            foreach (var control in tile.Controls)
            {
                control.ControlShare *= 0.76f;
            }

            tile.Controls.Add(new TileControlClaim(tribe.Id, contestedShare));
            outcome = wasDisputed ? PlayableClaimOutcome.DisputeJoined : PlayableClaimOutcome.DisputeCreated;
        }

        NormalizeControls(tile);
        tribe.Territory.Add(tileId);

        if (emitEvents && outcome is PlayableClaimOutcome.DisputeCreated or PlayableClaimOutcome.DisputeJoined)
        {
            var otherTribeId = priorClaimants.FirstOrDefault();
            AddEvent(new PlayableEvent(
                Tick,
                PlayableEventKind.DisputedTileCreated,
                tribe.Id,
                otherTribeId == 0 ? null : otherTribeId,
                tileId,
                PopulationDelta: 0,
                Reason: null));

            foreach (var otherId in priorClaimants)
            {
                RecordDispute(tribe.Id, otherId, tileId);
            }
        }

        return outcome;
    }

    private static void NormalizeControls(PlayableTile tile)
    {
        var total = tile.Controls.Sum(control => control.ControlShare);
        if (total <= 0f)
        {
            return;
        }

        foreach (var control in tile.Controls)
        {
            control.ControlShare /= total;
        }
    }

    private BiomeId PickBiome(int x, int y)
    {
        var nx = (float)x / Math.Max(1, Width - 1);
        var ny = (float)y / Math.Max(1, Height - 1);
        var noise = (float)_random.NextDouble();

        if (ny < 0.12f)
        {
            return BiomeId.Cold;
        }

        if (Math.Abs(nx - 0.50f) < 0.045f)
        {
            return BiomeId.Riverland;
        }

        if (ny > 0.78f && nx > 0.55f)
        {
            return BiomeId.DrySteppe;
        }

        if (nx < 0.16f && ny > 0.55f)
        {
            return BiomeId.Marsh;
        }

        if (nx > 0.80f && ny < 0.45f)
        {
            return BiomeId.Mountains;
        }

        if (noise < 0.16f)
        {
            return BiomeId.DenseForest;
        }

        if (noise < 0.30f)
        {
            return BiomeId.SparseWoodland;
        }

        if (noise < 0.44f)
        {
            return BiomeId.Hills;
        }

        if (noise < 0.56f)
        {
            return BiomeId.FertileValley;
        }

        return BiomeId.Plains;
    }

    private static float BiomeFertility(BiomeId biome)
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

    private int ToTileId(int x, int y) => y * Width + x;

    private void RecordGrowthIfMajor(PlayableTribe tribe)
    {
        var milestone = tribe.Population / 50;
        if (tribe.Population < 150 || milestone <= tribe.LastGrowthMilestone)
        {
            return;
        }

        tribe.LastGrowthMilestone = milestone;
        AddEvent(new PlayableEvent(
            Tick,
            PlayableEventKind.MajorGrowth,
            tribe.Id,
            OtherTribeId: null,
            TileId: tribe.MainCampTileId,
            PopulationDelta: 0,
            Reason: null));
    }

    private void RecordDispute(int tribeId, int otherTribeId, int tileId)
    {
        var key = tribeId < otherTribeId
            ? (FirstTribeId: tribeId, SecondTribeId: otherTribeId)
            : (FirstTribeId: otherTribeId, SecondTribeId: tribeId);

        _disputeCounts.TryGetValue(key, out var count);
        _disputeCounts[key] = count + 1;

        if (_disputeCounts[key] >= 4)
        {
            TryMergeTribes(key.FirstTribeId, key.SecondTribeId, tileId);
        }
    }

    private void TryMergeTribes(int firstTribeId, int secondTribeId, int tileId)
    {
        var first = Tribes.FirstOrDefault(tribe => tribe.Id == firstTribeId);
        var second = Tribes.FirstOrDefault(tribe => tribe.Id == secondTribeId);
        if (first is null || second is null || !first.IsAlive || !second.IsAlive)
        {
            return;
        }

        var averageTeam = (first.Artifacts.Team + second.Artifacts.Team) * 0.5f;
        if (averageTeam < 0.78f)
        {
            return;
        }

        var survivor = first.Population >= second.Population ? first : second;
        var absorbed = survivor.Id == first.Id ? second : first;
        var absorbedPopulation = absorbed.Population;
        var populationGain = Math.Max(1, absorbedPopulation / 2);
        survivor.Population += populationGain;
        survivor.FoodStores += MathF.Max(0f, absorbed.FoodStores * 0.5f);

        foreach (var tileIdInTerritory in absorbed.Territory)
        {
            survivor.Territory.Add(tileIdInTerritory);
        }

        TransferControlClaims(absorbed.Id, survivor.Id);
        absorbed.Population = 0;
        absorbed.IsAlive = false;
        RecordExtinction(absorbed, PlayableExtinctionReason.Merger);
        AddEvent(new PlayableEvent(
            Tick,
            PlayableEventKind.Merger,
            survivor.Id,
            absorbed.Id,
            tileId,
            PopulationDelta: populationGain,
            Reason: PlayableExtinctionReason.Merger));
    }

    private void TransferControlClaims(int absorbedTribeId, int survivorTribeId)
    {
        foreach (var tile in Tiles)
        {
            var absorbedClaim = tile.Controls.FirstOrDefault(control => control.TribeId == absorbedTribeId);
            if (absorbedClaim is null)
            {
                continue;
            }

            var survivorClaim = tile.Controls.FirstOrDefault(control => control.TribeId == survivorTribeId);
            if (survivorClaim is null)
            {
                tile.Controls.Add(new TileControlClaim(survivorTribeId, absorbedClaim.ControlShare));
            }
            else
            {
                survivorClaim.ControlShare += absorbedClaim.ControlShare;
            }

            tile.Controls.Remove(absorbedClaim);
            NormalizeControls(tile);
        }
    }

    private void RecordExtinction(PlayableTribe tribe, PlayableExtinctionReason reason)
    {
        if (Tombstones.Any(tombstone => tombstone.TribeId == tribe.Id))
        {
            return;
        }

        Tombstones.Add(new PlayableTribeTombstone(
            tribe.Id,
            Tick,
            reason,
            tribe.MainCampTileId));

        AddEvent(new PlayableEvent(
            Tick,
            PlayableEventKind.Extinction,
            tribe.Id,
            OtherTribeId: null,
            TileId: tribe.MainCampTileId,
            PopulationDelta: 0,
            Reason: reason));
    }

    private void AddEvent(PlayableEvent playableEvent)
    {
        RecentEvents.Add(playableEvent);
        if (RecentEvents.Count <= MaxRecentEvents)
        {
            return;
        }

        RecentEvents.RemoveRange(0, RecentEvents.Count - MaxRecentEvents);
    }
}

public enum PlayableEventKind
{
    Expansion,
    DisputedTileCreated,
    Starvation,
    Extinction,
    MajorGrowth,
    Merger,
}

public enum PlayableExtinctionReason
{
    Starvation,
    Merger,
}

public sealed record PlayableEvent(
    ulong Tick,
    PlayableEventKind Kind,
    int TribeId,
    int? OtherTribeId,
    int? TileId,
    int PopulationDelta,
    PlayableExtinctionReason? Reason);

public sealed record PlayableTribeTombstone(
    int TribeId,
    ulong Tick,
    PlayableExtinctionReason Reason,
    int MainCampTileId);

internal enum PlayableClaimOutcome
{
    None,
    NewClaim,
    Reinforced,
    DisputeCreated,
    DisputeJoined,
}

public sealed class PlayableTile
{
    public PlayableTile(int id, int x, int y, BiomeId biome, float food, float maxFood)
    {
        Id = id;
        X = x;
        Y = y;
        Biome = biome;
        Food = food;
        MaxFood = maxFood;
    }

    public int Id { get; }

    public int X { get; }

    public int Y { get; }

    public BiomeId Biome { get; }

    public float Food { get; set; }

    public float MaxFood { get; }

    public List<TileControlClaim> Controls { get; } = new();

    public bool IsDisputed => Controls.Count > 1;

    public float ControlShareFor(int tribeId)
    {
        return Controls.FirstOrDefault(control => control.TribeId == tribeId)?.ControlShare ?? 0f;
    }
}

public sealed class TileControlClaim
{
    public TileControlClaim(int tribeId, float controlShare)
    {
        TribeId = tribeId;
        ControlShare = controlShare;
    }

    public int TribeId { get; }

    public float ControlShare { get; set; }
}

public sealed class PlayableTribe
{
    public PlayableTribe(
        int id,
        string name,
        int mainCampTileId,
        int population,
        float foodStores,
        PolityTier tier,
        ArtifactVector artifacts)
    {
        Id = id;
        Name = name;
        MainCampTileId = mainCampTileId;
        Population = population;
        FoodStores = foodStores;
        Tier = tier;
        Artifacts = artifacts;
    }

    public int Id { get; }

    public string Name { get; }

    public int MainCampTileId { get; }

    public int Population { get; set; }

    public float FoodStores { get; set; }

    public PolityTier Tier { get; set; }

    public ArtifactVector Artifacts { get; }

    public HashSet<int> Territory { get; } = new();

    public bool IsAlive { get; set; } = true;

    public int LastGrowthMilestone { get; set; }
}
