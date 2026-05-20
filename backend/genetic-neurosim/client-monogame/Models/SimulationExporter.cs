using System.Text;
using System.Text.Json;
using TribalNeuroSim.Client.Domain;

namespace TribalNeuroSim.Client.Models;

public static class SimulationExporter
{
    public static string Export(PlayableSimulation simulation)
    {
        var winner = simulation.Tribes.FirstOrDefault(t => t.IsAlive);

        var doc = new
        {
            exportedAt = DateTimeOffset.UtcNow.ToString("o"),
            seed = simulation.Seed,
            mode = simulation.Mode.ToString(),
            totalTicks = simulation.Tick,
            mapSize = new { width = simulation.Width, height = simulation.Height },
            winner = winner is null ? null : new
            {
                id = winner.Id,
                name = winner.Name,
                population = winner.Population,
                polityTier = winner.Tier.ToString(),
                tiles = winner.Territory.Count,
                maxPopulation = winner.MaxPopulationReached,
                maxTiles = winner.MaxTilesReached,
                artifacts = ArtifactDoc(winner.Artifacts),
                initialArtifacts = ArtifactDoc(winner.InitialArtifacts),
                neuralDrive = TopDrive(winner.Artifacts),
            },
            extinct = simulation.Tombstones
                .OrderBy(t => t.Tick)
                .Select(t =>
                {
                    var name = simulation.Tribes.FirstOrDefault(tr => tr.Id == t.TribeId)?.Name
                               ?? $"Tribe {t.TribeId}";
                    var absorbedBy = t.AbsorbedByTribeId.HasValue
                        ? simulation.Tribes.FirstOrDefault(tr => tr.Id == t.AbsorbedByTribeId.Value)?.Name
                          ?? $"Tribe {t.AbsorbedByTribeId.Value}"
                        : null;
                    return new
                    {
                        tribeId = t.TribeId,
                        name,
                        extinctionTick = t.Tick,
                        cause = t.Reason.ToString(),
                        warCause = t.Reason == PlayableExtinctionReason.Combat
                            ? t.WarCause.ToString()
                            : (string?)null,
                        absorbedBy,
                        polityTierReached = t.PolityTierReached.ToString(),
                        maxPopulation = t.MaxPopulationReached,
                        populationAtDeath = t.PopulationAtDeath,
                        maxTiles = t.MaxTilesReached,
                        tilesAtDeath = t.TerritoryAtDeath,
                        neuralDrive = TopDrive(t.ArtifactsAtDeath),
                        initialArtifacts = ArtifactDoc(t.InitialArtifacts),
                        artifactsAtDeath = ArtifactDoc(t.ArtifactsAtDeath),
                    };
                })
                .ToArray(),
        };

        return JsonSerializer.Serialize(doc, new JsonSerializerOptions { WriteIndented = true });
    }

    public static string SaveToFile(PlayableSimulation simulation)
    {
        var json = Export(simulation);
        var fileName = $"neurosim-run-seed{simulation.Seed}-tick{simulation.Tick}.json";
        var path = Path.Combine(Environment.CurrentDirectory, fileName);
        File.WriteAllText(path, json, Encoding.UTF8);
        return path;
    }

    private static object ArtifactDoc(Protocol.ArtifactVector a) => new
    {
        combat = MathF.Round(a.Combat, 3),
        resource = MathF.Round(a.Resource, 3),
        mapObjective = MathF.Round(a.MapObjective, 3),
        risk = MathF.Round(a.Risk, 3),
        team = MathF.Round(a.Team, 3),
    };

    private static string TopDrive(Protocol.ArtifactVector a)
    {
        var drives = new (string Label, float Value)[]
        {
            ("Combat", a.Combat),
            ("Resource", a.Resource),
            ("Expansion", a.MapObjective),
            ("Risk", a.Risk),
            ("Alliance", a.Team),
        };
        return drives.MaxBy(d => d.Value).Label;
    }
}
