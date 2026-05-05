using System.Buffers.Binary;

namespace TribalNeuroSim.Client.Protocol;

public sealed class FrameDecoder
{
    public const ushort LegacyTribalFrameVersion = 0;
    private const int HeaderBytes = 20;
    private const int TribeRecordBytes = 36;
    private const int FoodDeltaBytes = 6;

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
        var payloadBytes = ReadUInt32(payload, 12);

        if (version != DesktopProtocol.Version)
        {
            throw new InvalidDataException($"Unsupported desktop frame version {version}.");
        }

        if (headerBytes != DesktopProtocol.HeaderBytes)
        {
            throw new InvalidDataException($"Unsupported desktop frame header size {headerBytes}.");
        }

        if (payloadKind != DesktopProtocol.PayloadKindTribalLegacyV0)
        {
            throw new InvalidDataException($"Unsupported desktop payload kind {payloadKind}.");
        }

        var expectedBytes = checked((int)headerBytes + (int)payloadBytes);
        if (payload.Length < expectedBytes)
        {
            throw new InvalidDataException($"Desktop frame ended at {payload.Length} bytes, expected {expectedBytes} bytes.");
        }

        return DecodeLegacyTribal(payload.Slice(headerBytes, (int)payloadBytes), version);
    }

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

    private static ushort ReadUInt16(ReadOnlySpan<byte> payload, int offset) =>
        BinaryPrimitives.ReadUInt16LittleEndian(payload.Slice(offset, sizeof(ushort)));

    private static uint ReadUInt32(ReadOnlySpan<byte> payload, int offset) =>
        BinaryPrimitives.ReadUInt32LittleEndian(payload.Slice(offset, sizeof(uint)));

    private static float ReadSingle(ReadOnlySpan<byte> payload, int offset) =>
        BitConverter.Int32BitsToSingle(BinaryPrimitives.ReadInt32LittleEndian(payload.Slice(offset, sizeof(int))));
}
