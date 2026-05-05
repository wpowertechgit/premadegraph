namespace TribalNeuroSim.Client.Domain;

public sealed class Tribe : PolityBase
{
    public Tribe(uint id, string name, string? sourceClusterId = null)
        : base(id, name, PolityTier.Tribe)
    {
        SourceClusterId = sourceClusterId;
    }

    public string? SourceClusterId { get; }
}
