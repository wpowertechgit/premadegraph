namespace TribalNeuroSim.Client.Domain;

public sealed class Kingdom : PolityBase
{
    public Kingdom(uint id, string name)
        : base(id, name, PolityTier.Kingdom)
    {
    }
}
