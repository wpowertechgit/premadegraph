using System.Net.Http.Json;
using TribalNeuroSim.Client.Models;

namespace TribalNeuroSim.Client.Net;

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
