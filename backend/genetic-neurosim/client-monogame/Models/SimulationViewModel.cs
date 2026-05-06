using TribalNeuroSim.Client.Protocol;

namespace TribalNeuroSim.Client.Models;

public sealed class SimulationViewModel
{
    private readonly Dictionary<uint, TribeFrameRecord> _tribes = new();
    private readonly Dictionary<ushort, float> _foodByTile = new();

    // ── V1-specific state ──
    private readonly Dictionary<uint, TribeFrameV1Record> _v1Tribes = new();
    private readonly Dictionary<ushort, TileFrameV1Record> _tileData = new();
    private readonly List<WarFrameV1Record> _wars = new();
    private readonly List<EventDeltaRecord> _events = new();

    public ushort ProtocolVersion { get; private set; }

    public ulong Tick { get; private set; }

    public uint Generation { get; private set; }

    public IReadOnlyDictionary<uint, TribeFrameRecord> Tribes => _tribes;

    public IReadOnlyDictionary<ushort, float> FoodByTile => _foodByTile;

    // ── V1 accessors ──
    public bool HasV1Data => _v1Tribes.Count > 0;

    public IReadOnlyDictionary<uint, TribeFrameV1Record> V1Tribes => _v1Tribes;

    public IReadOnlyDictionary<ushort, TileFrameV1Record> TileData => _tileData;

    public IReadOnlyList<WarFrameV1Record> Wars => _wars;

    public IReadOnlyList<EventDeltaRecord> Events => _events;

    public byte LastSectionFlags => 0;

    public void ApplyFrame(SimulationFrame frame)
    {
        ProtocolVersion = frame.ProtocolVersion;
        Tick = frame.Tick;
        Generation = frame.Generation;

        // V0 fields
        _tribes.Clear();
        foreach (var tribe in frame.Tribes)
        {
            _tribes[tribe.Id] = tribe;
        }

        foreach (var delta in frame.FoodDeltas)
        {
            _foodByTile[delta.TileId] = delta.FoodAmount;
        }

        // V1 fields
        if (frame.FrameV1Data is { } v1)
        {
            _v1Tribes.Clear();
            foreach (var t in v1.Tribes)
            {
                _v1Tribes[t.Id] = t;
            }

            if (v1.Tiles is { } tiles)
            {
                _tileData.Clear();
                foreach (var tile in tiles)
                {
                    _tileData[tile.TileId] = tile;
                }
            }

            _wars.Clear();
            if (v1.Wars is { } wars)
            {
                _wars.AddRange(wars);
            }

            _events.Clear();
            if (v1.Events is { } events)
            {
                _events.AddRange(events);
            }
        }
    }
}
