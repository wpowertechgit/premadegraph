using System.Buffers.Binary;

namespace TribalNeuroSim.Client.Protocol;

public sealed class FrameDecoder
{
    public const ushort LegacyTribalFrameVersion = 0;
    private const int HeaderBytes = 20;
    private const int TribeRecordBytes = 36;
    private const int FoodDeltaBytes = 6;

    // TNS3 envelope always occupies these first 32 bytes.
    // The headerBytes field may claim 40 (V1 forward-looking), but actual data starts at 32.
    private const int Tns3EnvelopeBytes = 32;

    public SimulationFrame Decode(ReadOnlySpan<byte> payload)
    {
        if (IsDesktopV1Frame(payload))
        {
            return DecodeDesktopV1(payload);
        }

        return DecodeLegacyTribal(payload, LegacyTribalFrameVersion);
    }

    private static bool IsDesktopV1Frame(ReadOnlySpan<byte> payload)
    {
        return payload.Length >= DesktopProtocol.HeaderBytes &&
            payload[..4].SequenceEqual(DesktopProtocol.Magic);
    }

    private SimulationFrame DecodeDesktopV1(ReadOnlySpan<byte> payload)
    {
        var version = ReadUInt16(payload, 4);
        var headerBytes = ReadUInt16(payload, 6);
        var payloadKind = ReadUInt16(payload, 8);
        var payloadByteCount = ReadUInt32(payload, 12);
        var tick = ReadUInt64(payload, 16);
        var generation = ReadUInt32(payload, 24);
        var recordCount = ReadUInt32(payload, 28);

        if (version != DesktopProtocol.Version)
        {
            throw new InvalidDataException($"Unsupported desktop frame version {version}.");
        }

        // Payload offset: Rust wrap_frame_v1 writes 32 envelope bytes then payload.
        // The headerBytes field may claim 40 (V1) but data starts at offset 32.
        var payloadOffset = payloadKind == DesktopProtocol.PayloadKindFrameV1
            ? Tns3EnvelopeBytes
            : headerBytes;

        var expectedBytes = checked(payloadOffset + (int)payloadByteCount);
        if (payload.Length < expectedBytes)
        {
            throw new InvalidDataException(
                $"Desktop frame ended at {payload.Length} bytes, expected {expectedBytes} bytes.");
        }

        var innerPayload = payload.Slice(payloadOffset, (int)payloadByteCount);

        if (payloadKind == DesktopProtocol.PayloadKindFrameV1)
        {
            return DecodeFrameV1(innerPayload, version, tick, generation, recordCount);
        }

        // Legacy V0 tribal frame
        if (headerBytes != DesktopProtocol.HeaderBytes)
        {
            throw new InvalidDataException($"Unsupported desktop frame header size {headerBytes}.");
        }

        if (payloadKind != DesktopProtocol.PayloadKindTribalLegacyV0)
        {
            throw new InvalidDataException($"Unsupported desktop payload kind {payloadKind}.");
        }

        return DecodeLegacyTribal(innerPayload, version);
    }

    // ── FrameV1 decoder ──────────────────────────────────────────────────────

    private static SimulationFrame DecodeFrameV1(
        ReadOnlySpan<byte> payload,
        ushort protocolVersion,
        ulong tick,
        uint generation,
        uint tribeRecordCount)
    {
        var offset = 0;

        // ── Tribe records (50 bytes each) ──
        var v1Tribes = new List<TribeFrameV1Record>((int)tribeRecordCount);
        for (var i = 0; i < tribeRecordCount; i++)
        {
            var tribe = ReadTribeFrameV1Record(payload, offset);
            v1Tribes.Add(tribe);
            offset += DesktopProtocol.FrameV1TribeRecordBytes;
        }

        // ── Flags byte ──
        var flags = payload[offset];
        offset += 1;

        // ── Tile records (9 bytes each) ──
        List<TileFrameV1Record>? tiles = null;
        if ((flags & DesktopProtocol.FlagTileData) != 0)
        {
            var tileCount = ReadUInt16(payload, offset);
            offset += 2;
            tiles = new List<TileFrameV1Record>(tileCount);
            for (var i = 0; i < tileCount; i++)
            {
                tiles.Add(ReadTileFrameV1Record(payload, offset));
                offset += DesktopProtocol.FrameV1TileRecordBytes;
            }
        }

        // ── War records (21 bytes each) ──
        List<WarFrameV1Record>? wars = null;
        if ((flags & DesktopProtocol.FlagWarData) != 0)
        {
            var warCount = ReadUInt16(payload, offset);
            offset += 2;
            wars = new List<WarFrameV1Record>(warCount);
            for (var i = 0; i < warCount; i++)
            {
                wars.Add(ReadWarFrameV1Record(payload, offset));
                offset += DesktopProtocol.FrameV1WarRecordBytes;
            }
        }

        // ── Event delta (5 bytes each) ──
        List<EventDeltaRecord>? events = null;
        if ((flags & DesktopProtocol.FlagEventData) != 0)
        {
            var eventCount = ReadUInt16(payload, offset);
            offset += 2;
            events = new List<EventDeltaRecord>(eventCount);
            for (var i = 0; i < eventCount; i++)
            {
                events.Add(ReadEventDeltaRecord(payload, offset));
                offset += DesktopProtocol.FrameV1EventRecordBytes;
            }
        }

        // ── Territory section ──
        if ((flags & DesktopProtocol.FlagTerritoryData) != 0)
        {
            var tribeCount = ReadUInt16(payload, offset);
            offset += 2;
            var territoryMap = new Dictionary<uint, ushort[]>(tribeCount);
            for (var i = 0; i < tribeCount; i++)
            {
                var tribeId = ReadUInt32(payload, offset); offset += 4;
                var tileCount = ReadUInt16(payload, offset); offset += 2;
                var tileIds = new ushort[tileCount];
                for (var j = 0; j < tileCount; j++)
                {
                    tileIds[j] = ReadUInt16(payload, offset); offset += 2;
                }
                territoryMap[tribeId] = tileIds;
            }
            for (var i = 0; i < v1Tribes.Count; i++)
            {
                if (territoryMap.TryGetValue(v1Tribes[i].Id, out var tileIds))
                    v1Tribes[i] = v1Tribes[i] with { TerritoryTiles = tileIds };
            }
        }

        var v1Data = new SimulationFrameV1(
            protocolVersion, tick, generation, v1Tribes, tiles, wars, events);

        // Build backward-compatible V0 frame from V1 tribe data
        var v0Tribes = new List<TribeFrameRecord>(v1Tribes.Count);
        foreach (var t in v1Tribes)
        {
            v0Tribes.Add(new TribeFrameRecord(
                t.Id, t.Population, t.MainCampTile, t.BehaviorState,
                t.FoodStores, t.Artifacts, t.TerritoryCount, 0));
        }

        return new SimulationFrame(protocolVersion, tick, generation, v0Tribes, Array.Empty<FoodTileDelta>())
        {
            FrameV1Data = v1Data
        };
    }

    private static TribeFrameV1Record ReadTribeFrameV1Record(ReadOnlySpan<byte> payload, int offset)
    {
        // E1: NN outputs — 7 floats starting at byte 60
        var nnOutputs = new float[7];
        for (var i = 0; i < 7; i++)
            nnOutputs[i] = ReadSingle(payload, offset + 60 + i * 4);

        return new TribeFrameV1Record(
            Id: ReadUInt32(payload, offset),
            PolityTier: payload[offset + 4],
            SpecializationRole: payload[offset + 5],
            MainCampTile: ReadUInt16(payload, offset + 6),
            Population: ReadUInt32(payload, offset + 8),
            ConstituentCount: ReadUInt32(payload, offset + 12),
            FoodStores: ReadSingle(payload, offset + 16),
            Artifacts: new ArtifactVector(
                ReadSingle(payload, offset + 20),
                ReadSingle(payload, offset + 24),
                ReadSingle(payload, offset + 28),
                ReadSingle(payload, offset + 32),
                ReadSingle(payload, offset + 36)),
            TerritoryCount: ReadUInt16(payload, offset + 40),
            EntityCount: ReadUInt32(payload, offset + 42),
            VeterancyXp: ReadUInt16(payload, offset + 46),
            BehaviorState: payload[offset + 48],
            IsAlive: payload[offset + 49] != 0,
            // E1 extension
            FitnessScore: ReadSingle(payload, offset + 50),
            MigrationTargetTile: ReadUInt16(payload, offset + 54),
            AllyTribeId: ReadUInt32(payload, offset + 56),
            NeuralOutputs: nnOutputs);
    }

    private static TileFrameV1Record ReadTileFrameV1Record(ReadOnlySpan<byte> payload, int offset)
    {
        var controlsByte = payload[offset + 8];
        return new TileFrameV1Record(
            TileId: ReadUInt16(payload, offset),
            BiomeId: payload[offset + 2],
            OccupantCount: payload[offset + 3],
            FoodAmount: ReadSingle(payload, offset + 4),
            IsDisputed: (controlsByte & 0x01) != 0);
    }

    private static WarFrameV1Record ReadWarFrameV1Record(ReadOnlySpan<byte> payload, int offset)
    {
        return new WarFrameV1Record(
            WarId: ReadUInt32(payload, offset),
            AttackerId: ReadUInt32(payload, offset + 4),
            DefenderId: ReadUInt32(payload, offset + 8),
            StartTick: ReadUInt64(payload, offset + 12),
            WarStatus: payload[offset + 20]);
    }

    private static EventDeltaRecord ReadEventDeltaRecord(ReadOnlySpan<byte> payload, int offset)
    {
        return new EventDeltaRecord(
            EventType: payload[offset],
            TribeId: ReadUInt32(payload, offset + 1));
    }

    // ── Legacy V0 decoder ────────────────────────────────────────────────────

    private SimulationFrame DecodeLegacyTribal(ReadOnlySpan<byte> payload, ushort protocolVersion)
    {
        if (payload.Length < HeaderBytes)
        {
            throw new InvalidDataException($"Frame is too short. Expected at least {HeaderBytes} bytes.");
        }

        var tickLow = ReadUInt32(payload, 0);
        var tickHigh = ReadUInt32(payload, 4);
        var tribeCount = ReadUInt32(payload, 8);
        var foodDeltaCount = ReadUInt32(payload, 12);
        var generation = ReadUInt32(payload, 16);
        var tick = ((ulong)tickHigh << 32) | tickLow;

        var expectedBytes = checked(HeaderBytes +
            (int)tribeCount * TribeRecordBytes +
            (int)foodDeltaCount * FoodDeltaBytes);

        if (payload.Length < expectedBytes)
        {
            throw new InvalidDataException($"Frame ended at {payload.Length} bytes, expected {expectedBytes} bytes.");
        }

        var tribes = new List<TribeFrameRecord>((int)tribeCount);
        var offset = HeaderBytes;

        for (var i = 0; i < tribeCount; i++)
        {
            tribes.Add(ReadTribeRecord(payload, offset));
            offset += TribeRecordBytes;
        }

        var foodDeltas = new List<FoodTileDelta>((int)foodDeltaCount);

        for (var i = 0; i < foodDeltaCount; i++)
        {
            foodDeltas.Add(new FoodTileDelta(
                ReadUInt16(payload, offset),
                ReadSingle(payload, offset + 2)));
            offset += FoodDeltaBytes;
        }

        return new SimulationFrame(
            protocolVersion,
            tick,
            generation,
            tribes,
            foodDeltas);
    }

    private static TribeFrameRecord ReadTribeRecord(ReadOnlySpan<byte> payload, int offset)
    {
        return new TribeFrameRecord(
            Id: ReadUInt32(payload, offset),
            Population: ReadUInt32(payload, offset + 4),
            HomeTileId: ReadUInt16(payload, offset + 8),
            BehaviorState: payload[offset + 10],
            FoodStores: ReadSingle(payload, offset + 12),
            Artifacts: new ArtifactVector(
                ReadSingle(payload, offset + 16),
                ReadSingle(payload, offset + 20),
                ReadSingle(payload, offset + 24),
                ReadSingle(payload, offset + 28),
                0),
            TerritoryCount: ReadUInt16(payload, offset + 32),
            Generation: ReadUInt16(payload, offset + 34));
    }

    // ── Binary readers ───────────────────────────────────────────────────────

    private static ushort ReadUInt16(ReadOnlySpan<byte> payload, int offset) =>
        BinaryPrimitives.ReadUInt16LittleEndian(payload.Slice(offset, sizeof(ushort)));

    private static uint ReadUInt32(ReadOnlySpan<byte> payload, int offset) =>
        BinaryPrimitives.ReadUInt32LittleEndian(payload.Slice(offset, sizeof(uint)));

    private static ulong ReadUInt64(ReadOnlySpan<byte> payload, int offset) =>
        BinaryPrimitives.ReadUInt64LittleEndian(payload.Slice(offset, sizeof(ulong)));

    private static float ReadSingle(ReadOnlySpan<byte> payload, int offset) =>
        BitConverter.Int32BitsToSingle(BinaryPrimitives.ReadInt32LittleEndian(payload.Slice(offset, sizeof(int))));
}
