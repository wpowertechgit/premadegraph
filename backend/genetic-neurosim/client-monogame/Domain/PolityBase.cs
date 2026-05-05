using TribalNeuroSim.Client.Protocol;

namespace TribalNeuroSim.Client.Domain;

public abstract class PolityBase
{
    private readonly List<uint> _memberPolityIds = new();

    protected PolityBase(uint id, string name, PolityTier tier)
    {
        Id = id;
        Name = name;
        Tier = tier;
    }

    public uint Id { get; }

    public string Name { get; protected set; }

    public PolityTier Tier { get; }

    public uint? ParentPolityId { get; private set; }

    public ushort CoreTileId { get; private set; }

    public uint Population { get; private set; }

    public ArtifactVector Artifacts { get; private set; } = ArtifactVector.Empty;

    public IReadOnlyList<uint> MemberPolityIds => _memberPolityIds;

    public void AttachToParent(uint parentPolityId)
    {
        ParentPolityId = parentPolityId;
    }

    public void SetFrameState(ushort coreTileId, uint population, ArtifactVector artifacts)
    {
        CoreTileId = coreTileId;
        Population = population;
        Artifacts = artifacts;
    }

    public void AddMember(uint polityId)
    {
        if (!_memberPolityIds.Contains(polityId))
        {
            _memberPolityIds.Add(polityId);
        }
    }
}
