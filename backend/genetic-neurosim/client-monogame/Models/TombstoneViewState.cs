using System.Text.Json.Serialization;

namespace TribalNeuroSim.Client.Models;

public enum TombstoneKind
{
    Entity = 0,
    Tribe = 1,
    Polity = 2
}

public enum TombstoneReason
{
    Unknown = 0,
    Starvation = 1,
    Combat = 2,
    TerritoryLoss = 3,
    SimulationEnd = 4,
    Superseded = 5
}

public sealed record TombstoneViewState(
    [property: JsonPropertyName("tombstone_id")] ulong TombstoneId,
    [property: JsonPropertyName("kind")] TombstoneKind Kind,
    [property: JsonPropertyName("entity_id")] uint? EntityId,
    [property: JsonPropertyName("tribe_id")] uint? TribeId,
    [property: JsonPropertyName("polity_id")] uint? PolityId,
    [property: JsonPropertyName("tick")] ulong Tick,
    [property: JsonPropertyName("generation")] uint Generation,
    [property: JsonPropertyName("reason")] TombstoneReason Reason,
    [property: JsonPropertyName("event_id")] ulong? EventId);
