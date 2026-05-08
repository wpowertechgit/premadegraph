using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Protocol;
using TribalNeuroSim.Client.Rendering;

namespace TribalNeuroSim.Client.Models;

public enum DemoMode
{
    Normal,
    EmpireStress,
    DisputeStress,
}

public sealed class PlayableSimulation
{
    private const int MaxRecentEvents = 80;

    // M18B: Polity tier progression thresholds (constituent tribe count)
    private const int TierCityThreshold = 3;
    private const int TierCountyThreshold = 6;
    private const int TierKingdomThreshold = 12;
    private const int TierEmpireThreshold = 20;

    private readonly Random _random;
    private readonly int _centerTileId;
    private readonly int _initialTribeCount;
    private readonly DemoMode _demoMode;
    private readonly Dictionary<(int FirstTribeId, int SecondTribeId), int> _disputeCounts = new();
    private readonly HashSet<int> _thisTickClaims = new();

    private PlayableSimulation(int seed, int width, int height, int tribeCount, DemoMode mode = DemoMode.Normal)
    {
        Seed = seed;
        Width = width;
        Height = height;
        _initialTribeCount = Math.Max(2, tribeCount);
        _demoMode = mode;
        _random = new Random(seed + (int)mode * 9973);
        _centerTileId = ToTileId(width / 2, height / 2);
    }

    public int Seed { get; }

    public int Width { get; }

    public int Height { get; }

    public ulong Tick { get; private set; }

    // M18B: Highest polity tier ever reached across all living tribes
    public PolityTier HighestTierReached { get; private set; }

    // M18B: Number of active merged polity entities (tribes with constituentCount >= 3)
    public int ActiveMergeCount { get; private set; }

    public DemoMode Mode => _demoMode;

    /// <summary>M18C: Count of currently disputed tiles (2+ occupants with different tribe IDs).</summary>
    public int DisputedTileCount => Tiles.Count(t => t.IsDisputed);

    public List<PlayableTile> Tiles { get; } = new();

    public List<PlayableTribe> Tribes { get; } = new();

    public List<PlayableEvent> RecentEvents { get; } = new();

    public List<PlayableTribeTombstone> Tombstones { get; } = new();

    public bool IsPaused { get; set; }

    public int SelectedTribeId { get; set; } = -1;

    public int SelectedTileId { get; set; } = -1;

    public static PlayableSimulation CreateDemo(int seed = 1337, int? width = null, int? height = null, int tribeCount = 12)
    {
        var size = PlayableWorldGenerator.CalculateDemoSize(tribeCount);
        var simulation = new PlayableSimulation(
            seed,
            width ?? size.Width,
            height ?? size.Height,
            Math.Max(2, tribeCount),
            DemoMode.Normal);
        simulation.GenerateTiles();
        simulation.GenerateTribes(Math.Max(2, tribeCount), DemoMode.Normal);
        return simulation;
    }

    /// <summary>
    /// M18C: Dispute stress preset — dense map, aggressive tribes, forced proximity.
    /// Designed to reliably produce disputed tiles for visual validation.
    /// </summary>
    public static PlayableSimulation CreateDisputeStress(int seed = 5173, int tribeCount = 12)
    {
        var count = Math.Max(4, tribeCount);
        var size = PlayableWorldGenerator.CalculateDisputeStressSize(count);
        var simulation = new PlayableSimulation(
            seed,
            size.Width,
            size.Height,
            count,
            DemoMode.DisputeStress);
        simulation.GenerateTiles();
        simulation.GenerateTribes(count, DemoMode.DisputeStress);
        return simulation;
    }

    /// <summary>
    /// M18B: Empire stress preset — more tribes, biased artifacts, clustered spawns.
    /// Designed to reach high polity tiers within a reasonable tick budget.
    /// </summary>
    public static PlayableSimulation CreateEmpireStress(int seed = 7331, int tribeCount = 28)
    {
        var count = Math.Max(6, tribeCount);
        var size = PlayableWorldGenerator.CalculateEmpireStressSize(count);
        var simulation = new PlayableSimulation(
            seed,
            size.Width,
            size.Height,
            count,
            DemoMode.EmpireStress);
        simulation.GenerateTiles();
        simulation.GenerateTribes(count, DemoMode.EmpireStress);
        return simulation;
    }

    public void Reset()
    {
        Tick = 0;
        Tiles.Clear();
        Tribes.Clear();
        RecentEvents.Clear();
        Tombstones.Clear();
        HighestTierReached = PolityTier.Tribe;
        ActiveMergeCount = 0;
        SelectedTileId = -1;
        _disputeCounts.Clear();
        GenerateTiles();
        GenerateTribes(_initialTribeCount, _demoMode);
    }

    public void Step()
    {
        Tick++;
        _thisTickClaims.Clear();
        GrowFood();

        foreach (var tribe in Tribes.Where(tribe => tribe.IsAlive))
        {
            Harvest(tribe);
            ApplyPopulationPressure(tribe);

            // R8: Expansion runs every tick; cooldown/cost gates are per-tribe inside Expand
            Expand(tribe);
        }

        // M18B: Track highest polity tier and active merge count each tick
        UpdateTierTracking();

        // R8: Periodic integration cleanup (every 80 ticks, with 5-tick grace beyond INTEGRATION_TICKS)
        if (Tick % 80 == 0)
        {
            var cleanThreshold = Tick > 80 ? Tick - 80 : 0;
            foreach (var tribe in Tribes)
            {
                var expired = tribe.TileClaimedTick
                    .Where(kv => kv.Value <= cleanThreshold)
                    .Select(kv => kv.Key)
                    .ToList();
                foreach (var tileId in expired)
                    tribe.TileClaimedTick.Remove(tileId);
            }
        }
    }

    private void UpdateTierTracking()
    {
        var maxTier = PolityTier.Tribe;
        var mergeCount = 0;
        foreach (var tribe in Tribes)
        {
            if (!tribe.IsAlive) continue;
            if (tribe.Tier > maxTier) maxTier = tribe.Tier;
            if (tribe.ConstituentCount >= TierCityThreshold) mergeCount++;
        }
        if (maxTier > HighestTierReached) HighestTierReached = maxTier;
        ActiveMergeCount = mergeCount;
    }

    public IEnumerable<int> NeighborTileIds(int tileId)
    {
        var x = tileId % Width;
        var y = tileId / Width;

        foreach (var (nx, ny) in HexNeighborCoordinates(x, y))
            if (nx >= 0 && nx < Width && ny >= 0 && ny < Height)
                yield return ToTileId(nx, ny);
    }

    private void GenerateTiles()
    {
        Tiles.AddRange(PlayableWorldGenerator.GenerateTiles(Seed, Width, Height));
    }

    private void GenerateTribes(int tribeCount, DemoMode mode)
    {
        var spawnTiles = BuildSpawnTiles(tribeCount);

        for (var i = 0; i < tribeCount; i++)
        {
            var id = i + 1;
            var homeTile = spawnTiles[i % spawnTiles.Count];

            ArtifactVector artifacts;
            if (mode == DemoMode.DisputeStress)
            {
                // M18C: High Combat (0.55-1.0) and Risk (0.55-1.0) → aggressive expansion.
                // Moderate Resource (0.35-0.8), low Team (0.15-0.45) → reluctant to merge.
                // This encourages territorial encroachment and disputed border creation.
                artifacts = new ArtifactVector(
                    Combat: 0.55f + (float)_random.NextDouble() * 0.45f,
                    Resource: 0.35f + (float)_random.NextDouble() * 0.45f,
                    MapObjective: 0.25f + (float)_random.NextDouble() * 0.75f,
                    Risk: 0.55f + (float)_random.NextDouble() * 0.45f,
                    Team: 0.15f + (float)_random.NextDouble() * 0.30f);
            }
            else if (mode == DemoMode.EmpireStress)
            {
                // M18B: Bias artifacts toward merge-compatible tribes.
                // Tribes are arranged into clusters of 3-4; each cluster gets high Team/Resource
                // for internal alliance/merge. Different clusters still compete.
                var clusterGroup = i / 4; // every 4 tribes form a compatible cluster
                var clusterSeed = (clusterGroup * 7919 + Seed * 137) ^ 0xA3E1;
                var localRng = new Random(clusterSeed);

                // Shared cluster bias: high Team (0.65-1.0) and Resource (0.5-0.95)
                var clusterTeam = 0.65f + (float)localRng.NextDouble() * 0.35f;
                var clusterResource = 0.50f + (float)localRng.NextDouble() * 0.45f;

                artifacts = new ArtifactVector(
                    Combat: 0.15f + (float)localRng.NextDouble() * 0.85f,
                    Resource: clusterResource,
                    MapObjective: 0.15f + (float)localRng.NextDouble() * 0.85f,
                    Risk: 0.15f + (float)localRng.NextDouble() * 0.85f,
                    Team: clusterTeam);
            }
            else
            {
                artifacts = new ArtifactVector(
                    Combat: 0.25f + (float)_random.NextDouble() * 0.75f,
                    Resource: 0.25f + (float)_random.NextDouble() * 0.75f,
                    MapObjective: 0.25f + (float)_random.NextDouble() * 0.75f,
                    Risk: 0.25f + (float)_random.NextDouble() * 0.75f,
                    Team: 0.25f + (float)_random.NextDouble() * 0.75f);
            }

            // Mode-specific starting resources
            var popBase = mode switch
            {
                DemoMode.EmpireStress => 100,
                DemoMode.DisputeStress => 90,
                _ => 80,
            };
            var popExtra = mode switch
            {
                DemoMode.EmpireStress => 110,
                DemoMode.DisputeStress => 100,
                _ => 90,
            };
            var foodBase = mode switch
            {
                DemoMode.EmpireStress => 40f,
                DemoMode.DisputeStress => 38f,
                _ => 30f,
            };
            var foodExtra = mode switch
            {
                DemoMode.EmpireStress => 40f,
                DemoMode.DisputeStress => 38f,
                _ => 35f,
            };

            var tribe = new PlayableTribe(
                id: id,
                name: $"Tribe {id}",
                mainCampTileId: homeTile,
                population: popBase + _random.Next(20, popExtra),
                foodStores: foodBase + (float)_random.NextDouble() * foodExtra,
                tier: PolityTier.Tribe,
                artifacts: artifacts);

            // M18B: Track constituent count for polity tier progression
            tribe.ConstituentCount = 1;

            Tribes.Add(tribe);
            ClaimTile(tribe, homeTile, contestedShare: 1f, emitEvents: false);
            tribe.LastGrowthMilestone = tribe.Population / 50;
        }

        SelectedTribeId = Tribes.FirstOrDefault()?.Id ?? -1;
        SelectedTileId = Tribes.FirstOrDefault()?.MainCampTileId ?? -1;
    }

    private List<int> BuildSpawnTiles(int tribeCount)
    {
        return PlayableWorldGenerator.BuildSpawnTiles(Seed, Tiles, Width, Height, tribeCount);
    }

    private void GrowFood()
    {
        foreach (var tile in Tiles)
        {
            tile.Food = MathF.Min(tile.MaxFood, tile.Food + tile.MaxFood * 0.030f);
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
            // R8: Integration yield multiplier (newly claimed tiles start at 25% yield)
            var integrationMult = IntegrationMultiplier(tribe, tileId);
            var amount = MathF.Min(tile.Food, tile.MaxFood * (0.018f + tribe.Artifacts.Resource * 0.022f) * share * disputeMultiplier * integrationMult);
            tile.Food -= amount;
            harvest += amount;
        }

        tribe.FoodStores += harvest;
    }

    private void ApplyPopulationPressure(PlayableTribe tribe)
    {
        var upkeep = tribe.Population * 0.016f;
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

    // ═══════════════════════════════════════════════════════════════════════════
    // R8: Expansion cost model constants
    // ═══════════════════════════════════════════════════════════════════════════
    private const float ClaimBaseCost = 12f;
    private const float ClaimTerritoryCostPerTile = 5f;
    private const float ClaimDistanceCostPerStep = 3f;
    private const float ClaimPressureCost = 12f;
    private const float ClaimFoodFloor = 6f;
    private const int ClaimPopBase = 55;
    private const int ClaimPopPerTile = 14;
    private const int IntegrationTicks = 75;
    private const float IntegrationStartYield = 0.25f;
    private const int OverextensionPopDivisor = 120;
    private const float OverextensionClaimPenalty = 10f;

    private void Expand(PlayableTribe tribe)
    {
        // Cooldown gate
        if (Tick - tribe.LastExpansionTick < tribe.ExpansionCooldownTicks)
            return;

        // Population gate
        var tileCount = tribe.Territory.Count;
        var requiredPop = ClaimPopBase + ClaimPopPerTile * tileCount;
        if (tribe.Population < requiredPop)
            return;

        var overextended = tileCount > 1 + tribe.Population / OverextensionPopDivisor;

        // Find neutral neighbors and pick cheapest (skip tiles already claimed this tick)
        var neutralCandidates = tribe.Territory
            .SelectMany(NeighborTileIds)
            .Distinct()
            .Where(id => Tiles[id].Controls.Count == 0 && !_thisTickClaims.Contains(id))
            .ToList();

        var candidate = -1;
        var cost = 0f;
        var contestedShare = 1f;

        if ((_demoMode == DemoMode.EmpireStress || _demoMode == DemoMode.DisputeStress)
            && (neutralCandidates.Count == 0 || (_demoMode == DemoMode.EmpireStress && Tick % 3 == 0)))
        {
            var hostileCandidates = tribe.Territory
                .SelectMany(NeighborTileIds)
                .Distinct()
                .Where(id => !_thisTickClaims.Contains(id))
                .Where(id => Tiles[id].Controls.Count > 0
                             && Tiles[id].Controls.All(control => control.TribeId != tribe.Id)
                             && Tiles[id].Controls.Count < 4)
                .ToList();

            if (hostileCandidates.Count > 0)
            {
                var contestedPick = hostileCandidates
                    .Select(id => (Id: id, Cost: CalculateClaimCost(tribe, id, overextended) * 0.82f))
                    .MinBy(x => x.Cost);
                candidate = contestedPick.Id;
                cost = contestedPick.Cost;
                contestedShare = 0.58f;
            }
        }

        if (candidate < 0)
        {
            if (neutralCandidates.Count == 0)
                return;

            var neutralPick = neutralCandidates
                .Select(id => (Id: id, Cost: CalculateClaimCost(tribe, id, overextended)))
                .MinBy(x => x.Cost);
            candidate = neutralPick.Id;
            cost = neutralPick.Cost;
        }

        // Food affordability check
        if (tribe.FoodStores - cost < ClaimFoodFloor)
            return;

        // Apply claim
        tribe.FoodStores -= cost;
        tribe.LastExpansionTick = Tick;
        tribe.LastClaimCost = cost;
        tribe.TileClaimedTick[candidate] = Tick;
        _thisTickClaims.Add(candidate);
        ClaimTile(tribe, candidate, contestedShare: contestedShare, emitEvents: true);

        AddEvent(new PlayableEvent(
            Tick,
            PlayableEventKind.Expansion,
            tribe.Id,
            OtherTribeId: null,
            TileId: candidate,
            PopulationDelta: 0,
            Reason: null));
    }

    private float CalculateClaimCost(PlayableTribe tribe, int tileId, bool overextended)
    {
        var territoryCost = ClaimTerritoryCostPerTile * tribe.Territory.Count;
        var dist = HexDistance(tribe.MainCampTileId, tileId);
        var distanceCost = ClaimDistanceCostPerStep * MathF.Max(0f, (float)dist - 1f);
        var terrainCost = TerrainClaimCost(tileId);
        var pressureCost = HasHostileNeighbor(tileId, tribe.Id) ? ClaimPressureCost : 0f;

        var total = ClaimBaseCost + territoryCost + distanceCost + terrainCost + pressureCost;
        if (overextended)
            total += OverextensionClaimPenalty;
        return total;
    }

    private float TerrainClaimCost(int tileId)
    {
        var biome = Tiles[tileId].Biome;
        var baseCost = biome switch
        {
            BiomeId.Plains => 0f,
            BiomeId.FertileValley => 0f,
            BiomeId.Riverland => 0f,
            BiomeId.DenseForest => 10f,
            BiomeId.SparseWoodland => 10f,
            BiomeId.DrySteppe => 15f,
            BiomeId.Cold => 15f,
            BiomeId.Hills => 20f,
            BiomeId.Mountains => 20f,
            BiomeId.Marsh => 20f,
            _ => 10f,
        };

        // +25 if adjacent to river
        if (NeighborTileIds(tileId).Any(n => n < Tiles.Count && Tiles[n].Biome == BiomeId.Riverland))
            baseCost += 25f;

        return baseCost;
    }

    private uint HexDistance(int tileIdA, int tileIdB)
    {
        var (colA, rowA) = (tileIdA % Width, tileIdA / Width);
        var (colB, rowB) = (tileIdB % Width, tileIdB / Width);
        var qA = colA - (rowA - (rowA & 1)) / 2;
        var rA = rowA;
        var qB = colB - (rowB - (rowB & 1)) / 2;
        var rB = rowB;
        var sA = -qA - rA;
        var sB = -qB - rB;
        return (uint)Math.Max(Math.Abs(qA - qB), Math.Max(Math.Abs(rA - rB), Math.Abs(sA - sB)));
    }

    private bool HasHostileNeighbor(int tileId, int tribeId)
    {
        return NeighborTileIds(tileId).Any(n =>
            n < Tiles.Count && Tiles[n].Controls.Count > 0 &&
            !Tiles[n].Controls.Any(c => c.TribeId == tribeId));
    }

    /// <summary>
    /// R8: Integration yield multiplier. New tiles start at 25% yield,
    /// rise linearly to 100% over 75 ticks. Disputed/overextended at half speed.
    /// </summary>
    private float IntegrationMultiplier(PlayableTribe tribe, int tileId)
    {
        if (!tribe.TileClaimedTick.TryGetValue(tileId, out var claimedAt))
            return 1f; // fully integrated or not tracked

        var elapsed = Tick - claimedAt;
        var tile = Tiles[tileId];
        var isDisputed = tile.IsDisputed;
        var overextended = tribe.Territory.Count > 1 + tribe.Population / OverextensionPopDivisor;
        var rate = (isDisputed || overextended) ? 0.5f : 1f;

        var effectiveTicks = MathF.Min((float)elapsed * rate, IntegrationTicks);
        var progress = effectiveTicks / IntegrationTicks;
        return IntegrationStartYield + (1f - IntegrationStartYield) * progress;
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

    private int ToTileId(int x, int y) => y * Width + x;

    private static IEnumerable<(int X, int Y)> HexNeighborCoordinates(int x, int y)
    {
        yield return (x - 1, y);
        yield return (x + 1, y);

        if (y % 2 == 0)
        {
            yield return (x - 1, y - 1);
            yield return (x, y - 1);
            yield return (x - 1, y + 1);
            yield return (x, y + 1);
        }
        else
        {
            yield return (x, y - 1);
            yield return (x + 1, y - 1);
            yield return (x, y + 1);
            yield return (x + 1, y + 1);
        }
    }

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

        var mergeTrigger = _demoMode == DemoMode.EmpireStress ? 2 : 4;
        if (_disputeCounts[key] >= mergeTrigger)
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
        var mergeThreshold = _demoMode == DemoMode.EmpireStress ? 0.68f : 0.78f;
        if (averageTeam < mergeThreshold)
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

        // M18B: Polity tier progression — merge constituent counts,
        // then upgrade tier if threshold crossed.
        survivor.ConstituentCount += absorbed.ConstituentCount;
        foreach (var member in absorbed.MemberTribes)
        {
            if (survivor.MemberTribes.Any(existing => existing.TribeId == member.TribeId))
                continue;

            survivor.MemberTribes.Add(member with { IsLeader = false });
        }
        var newTier = PolityTierForCount(survivor.ConstituentCount);
        if (newTier > survivor.Tier)
        {
            survivor.Tier = newTier;
        }

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

    /// <summary>
    /// M18B: Map constituent tribe count to appropriate polity tier.
    /// Thresholds: 1=Tribe, 3=City, 6=County, 12=Kingdom, 20=Empire.
    /// </summary>
    private static PolityTier PolityTierForCount(int constituentCount)
    {
        if (constituentCount >= TierEmpireThreshold) return PolityTier.Empire;
        if (constituentCount >= TierKingdomThreshold) return PolityTier.Kingdom;
        if (constituentCount >= TierCountyThreshold) return PolityTier.Duchy;
        if (constituentCount >= TierCityThreshold) return PolityTier.City;
        return PolityTier.Tribe;
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

    /// <summary>
    /// M18C: Force a disputed tile between two nearby living tribes for visual validation.
    /// Finds a neutral tile bordering two different-owner territories, then claims it for both.
    /// Returns the tile ID if a dispute was created, or -1 if no suitable tile found.
    /// </summary>
    public int ForceDispute()
    {
        var livingTribes = Tribes.Where(t => t.IsAlive).ToList();
        if (livingTribes.Count < 2)
            return -1;

        // Find neutral tiles that border at least two different tribes' territories
        foreach (var tile in Tiles)
        {
            if (tile.Controls.Count > 0)
                continue; // only target neutral tiles

            var borderOwners = NeighborTileIds(tile.Id)
                .Where(n => n < Tiles.Count)
                .SelectMany(n => Tiles[n].Controls)
                .Select(c => c.TribeId)
                .Distinct()
                .Where(id => livingTribes.Any(t => t.Id == id))
                .Take(3) // need at least 2 distinct owners
                .ToList();

            if (borderOwners.Count < 2)
                continue;

            // Choose the two border-owning tribes and grant them each 50% control
            var tribeA = livingTribes.First(t => t.Id == borderOwners[0]);
            var tribeB = livingTribes.First(t => t.Id == borderOwners[1]);

            tile.Controls.Clear();
            tile.Controls.Add(new TileControlClaim(tribeA.Id, 0.5f));
            tile.Controls.Add(new TileControlClaim(tribeB.Id, 0.5f));
            tribeA.Territory.Add(tile.Id);
            tribeB.Territory.Add(tile.Id);

            AddEvent(new PlayableEvent(
                Tick,
                PlayableEventKind.DisputedTileCreated,
                tribeA.Id,
                tribeB.Id,
                tile.Id,
                PopulationDelta: 0,
                Reason: null));

            RecordDispute(tribeA.Id, tribeB.Id, tile.Id);
            return tile.Id;
        }

        return -1;
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
            tribe.MainCampTileId,
            PopulationAtDeath: tribe.Population,
            TerritoryAtDeath: tribe.Territory.Count));

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
    int MainCampTileId,
    int PopulationAtDeath = 0,
    int TerritoryAtDeath = 0);

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
        MemberTribes.Add(new PlayablePolityMember(id, name, TribeVisuals.RoleLabel(artifacts), IsLeader: true));
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

    // R8: Expansion pacing
    public ulong LastExpansionTick { get; set; }
    public ulong ExpansionCooldownTicks { get; set; } = 25;
    /// <summary>Maps tileId → claimed tick for integration yield calculation.</summary>
    public Dictionary<int, ulong> TileClaimedTick { get; } = new();
    /// <summary>Current claim cost for debug display (set by Expand).</summary>
    public float LastClaimCost { get; set; }

    // M18B: Number of original tribes absorbed into this merged polity
    public int ConstituentCount { get; set; } = 1;

    public List<PlayablePolityMember> MemberTribes { get; } = new();
}

public sealed record PlayablePolityMember(
    int TribeId,
    string TribeName,
    string Role,
    bool IsLeader);
