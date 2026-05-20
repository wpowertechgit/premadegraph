using System.Net.Http.Json;
using System.Text.Json.Serialization;
using TribalNeuroSim.Client.Models;

namespace TribalNeuroSim.Client.Net;

public sealed record TombstoneArtifactsDto(
    [property: JsonPropertyName("a_combat")]       float Combat,
    [property: JsonPropertyName("a_risk")]         float Risk,
    [property: JsonPropertyName("a_resource")]     float Resource,
    [property: JsonPropertyName("a_map_objective")] float MapObjective,
    [property: JsonPropertyName("a_team")]         float Team);

public sealed record TombstoneFounderDto(
    [property: JsonPropertyName("tribe_id")]           uint TribeId,
    [property: JsonPropertyName("cluster_id")]         string ClusterId,
    [property: JsonPropertyName("tick_died")]          ulong TickDied,
    [property: JsonPropertyName("generation_died")]    uint GenerationDied,
    [property: JsonPropertyName("population_at_death")] uint PopulationAtDeath,
    [property: JsonPropertyName("max_population")]     uint MaxPopulation,
    [property: JsonPropertyName("territory_at_death")] int TerritoryAtDeath,
    [property: JsonPropertyName("polity_tier_reached")] string PolityTierReached,
    [property: JsonPropertyName("cause")]              string Cause,
    [property: JsonPropertyName("final_artifacts")]    TombstoneArtifactsDto? FinalArtifacts,
    [property: JsonPropertyName("founder_puuids")]     List<string> FounderPuuids,
    [property: JsonPropertyName("founder_names")]      List<string> FounderNames);

public sealed record TombstonesResponseDto(
    [property: JsonPropertyName("count")] int Count,
    [property: JsonPropertyName("records")] List<TombstoneFounderDto> Records);

public sealed class SimulationControlClient
{
    private readonly HttpClient _httpClient;
    private readonly Uri _nodeDesktopEndpoint;

    public SimulationControlClient(HttpClient httpClient, Uri nodeDesktopEndpoint)
    {
        _httpClient = httpClient;
        _nodeDesktopEndpoint = nodeDesktopEndpoint;
    }

    public Task<SimulationStatus?> GetStatusAsync(CancellationToken cancellationToken)
    {
        return _httpClient.GetFromJsonAsync<SimulationStatus>(
            Resolve("status"),
            cancellationToken);
    }

    public Task<Models.WorldSnapshotDto?> GetWorldSnapshotAsync(CancellationToken cancellationToken)
    {
        return _httpClient.GetFromJsonAsync<Models.WorldSnapshotDto>(
            Resolve("world-snapshot"), cancellationToken);
    }

    public Task<TombstonesResponseDto?> GetTombstonesAsync(CancellationToken cancellationToken)
    {
        return _httpClient.GetFromJsonAsync<TombstonesResponseDto>(
            Resolve("tombstones"), cancellationToken);
    }

    public Task PauseAsync(CancellationToken cancellationToken)
    {
        return SendControlAsync("pause", cancellationToken);
    }

    public Task ResumeAsync(CancellationToken cancellationToken)
    {
        return SendControlAsync("resume", cancellationToken);
    }

    public Task StepTickAsync(CancellationToken cancellationToken)
    {
        return SendControlAsync("step-tick", cancellationToken);
    }

    public Task ResetAsync(CancellationToken cancellationToken)
    {
        return SendControlAsync("reset", cancellationToken);
    }

    private async Task SendControlAsync(string command, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.PostAsync(
            Resolve($"control/{command}"),
            content: null,
            cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
    }

    private Uri Resolve(string relativePath)
    {
        return new Uri($"{_nodeDesktopEndpoint.ToString().TrimEnd('/')}/{relativePath}");
    }
}
