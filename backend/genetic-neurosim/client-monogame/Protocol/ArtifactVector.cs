namespace TribalNeuroSim.Client.Protocol;

public readonly record struct ArtifactVector(
    float Combat,
    float Risk,
    float Resource,
    float MapObjective,
    float Team)
{
    public static ArtifactVector Empty { get; } = new(0, 0, 0, 0, 0);
}
