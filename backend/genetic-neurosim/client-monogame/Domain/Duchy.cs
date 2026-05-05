namespace TribalNeuroSim.Client.Domain;

public sealed class Duchy : PolityBase
{
    public Duchy(uint id, string name)
        : base(id, name, PolityTier.Duchy)
    {
    }
}
