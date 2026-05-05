using TribalNeuroSim.Client.Protocol;

namespace TribalNeuroSim.Client.Models;

public sealed class SimulationViewModel
{
    private readonly Dictionary<uint, TribeFrameRecord> _tribes = new();
    private readonly Dictionary<ushort, float> _foodByTile = new();

    public ushort ProtocolVersion { get; private set; }

    public ulong Tick { get; private set; }

    public uint Generation { get; private set; }

    public IReadOnlyDictionary<uint, TribeFrameRecord> Tribes => _tribes;

    public IReadOnlyDictionary<ushort, float> FoodByTile => _foodByTile;

    public void ApplyFrame(SimulationFrame frame)
    {
        ProtocolVersion = frame.ProtocolVersion;
        Tick = frame.Tick;
        Generation = frame.Generation;

        _tribes.Clear();
        foreach (var tribe in frame.Tribes)
        {
            _tribes[tribe.Id] = tribe;
        }

        foreach (var delta in frame.FoodDeltas)
        {
            _foodByTile[delta.TileId] = delta.FoodAmount;
        }
    }
}
