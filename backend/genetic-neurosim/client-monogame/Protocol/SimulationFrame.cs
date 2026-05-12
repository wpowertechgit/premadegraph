namespace TribalNeuroSim.Client.Protocol;

// ── Legacy V0 types ──

public sealed record SimulationFrame(
    ushort ProtocolVersion,
    ulong Tick,
    uint Generation,
    IReadOnlyList<TribeFrameRecord> Tribes,
    IReadOnlyList<FoodTileDelta> FoodDeltas)
{
    /// Optional V1 payload data. Non-null when frame came from FrameV1 decoder path.
    public SimulationFrameV1? FrameV1Data { get; init; }
}

public sealed record TribeFrameRecord(
    uint Id,
    uint Population,
    ushort HomeTileId,
    byte BehaviorState,
    float FoodStores,
    ArtifactVector Artifacts,
    ushort TerritoryCount,
    ushort Generation);

public sealed record FoodTileDelta(ushort TileId, float FoodAmount);

// ── FrameV1 types ──

public sealed record SimulationFrameV1(
    ushort ProtocolVersion,
    ulong Tick,
    uint Generation,
    IReadOnlyList<TribeFrameV1Record> Tribes,
    IReadOnlyList<TileFrameV1Record>? Tiles,
    IReadOnlyList<WarFrameV1Record>? Wars,
    IReadOnlyList<EventDeltaRecord>? Events);

public sealed record TribeFrameV1Record(
    uint Id,
    byte PolityTier,
    byte SpecializationRole,
    ushort MainCampTile,
    uint Population,
    uint ConstituentCount,
    float FoodStores,
    ArtifactVector Artifacts,
    ushort TerritoryCount,
    uint EntityCount,
    ushort VeterancyXp,
    byte BehaviorState,
    bool IsAlive,
    // E1: brain / migration / fitness visibility
    float FitnessScore,
    ushort MigrationTargetTile,
    uint AllyTribeId,
    float[] NeuralOutputs)
{
    /// Territory tile IDs decoded from the FLAG_TERRITORY_DATA section. Null when section absent.
    public ushort[]? TerritoryTiles { get; init; }

    /// True when MigrationTargetTile is a real destination (not the sentinel 0xFFFF).
    public bool IsMigrating => MigrationTargetTile != ushort.MaxValue;

    /// True when allied with another tribe (AllyTribeId is not sentinel 0xFFFFFFFF).
    public bool HasAlly => AllyTribeId != uint.MaxValue;
}

public sealed record TileFrameV1Record(
    ushort TileId,
    byte BiomeId,
    byte OccupantCount,
    float FoodAmount,
    bool IsDisputed);

public sealed record WarFrameV1Record(
    uint WarId,
    uint AttackerId,
    uint DefenderId,
    ulong StartTick,
    byte WarStatus);

public sealed record EventDeltaRecord(
    byte EventType,
    uint TribeId);
