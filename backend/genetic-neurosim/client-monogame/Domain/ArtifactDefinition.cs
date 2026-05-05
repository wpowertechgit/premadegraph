namespace TribalNeuroSim.Client.Domain;

public sealed record ArtifactDefinition(
    string Id,
    ArtifactRole Role,
    string DisplayName,
    string Description,
    string IconKey);
