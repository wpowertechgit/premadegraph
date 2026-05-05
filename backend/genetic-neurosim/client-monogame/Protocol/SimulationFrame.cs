namespace TribalNeuroSim.Client.Protocol;

public sealed record SimulationFrame(
    ushort ProtocolVersion,
    ulong Tick,
    uint Generation,
    IReadOnlyList<TribeFrameRecord> Tribes,
    IReadOnlyList<FoodTileDelta> FoodDeltas);

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
