using System.Text.Json.Serialization;

namespace TribalNeuroSim.Client.Models;

public sealed record LineageNodeViewState(
    [property: JsonPropertyName("entity_id")] uint EntityId,
    [property: JsonPropertyName("generation")] uint Generation,
    [property: JsonPropertyName("parent_a_id")] uint? ParentAId,
    [property: JsonPropertyName("parent_b_id")] uint? ParentBId,
    [property: JsonPropertyName("seed_player_id")] uint? SeedPlayerId,
    [property: JsonPropertyName("lineage_hash")] ulong LineageHash);

public sealed record LineageQueryResult(
    [property: JsonPropertyName("root_entity_id")] uint RootEntityId,
    [property: JsonPropertyName("nodes")] IReadOnlyList<LineageNodeViewState> Nodes);
