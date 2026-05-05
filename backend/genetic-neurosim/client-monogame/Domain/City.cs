namespace TribalNeuroSim.Client.Domain;

public sealed class City : PolityBase
{
    public City(uint id, string name)
        : base(id, name, PolityTier.City)
    {
    }
}
