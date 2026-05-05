namespace TribalNeuroSim.Client.Domain;

public sealed class Empire : PolityBase
{
    public Empire(uint id, string name)
        : base(id, name, PolityTier.Empire)
    {
    }
}
