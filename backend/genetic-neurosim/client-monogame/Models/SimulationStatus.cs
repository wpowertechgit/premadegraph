using System.Text.Json.Serialization;

namespace TribalNeuroSim.Client.Models;

public sealed record SimulationStatus(
    [property: JsonPropertyName("tick")] ulong Tick,
    [property: JsonPropertyName("generation")] uint Generation,
    [property: JsonPropertyName("alive_count")] int AliveCount,
    [property: JsonPropertyName("halted")] bool Halted,
    [property: JsonPropertyName("paused")] bool Paused,
    [property: JsonPropertyName("world_width_tiles")] int WorldWidthTiles,
    [property: JsonPropertyName("world_height_tiles")] int WorldHeightTiles,
    [property: JsonPropertyName("total_tiles")] int TotalTiles,
    [property: JsonPropertyName("world_seed")] ulong WorldSeed,
    [property: JsonPropertyName("scenario_id")] string? ScenarioId);
