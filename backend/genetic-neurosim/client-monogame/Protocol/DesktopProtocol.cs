namespace TribalNeuroSim.Client.Protocol;

public static class DesktopProtocol
{
    public static ReadOnlySpan<byte> Magic => "TNS3"u8;

    public const ushort Version = 1;
    public const int HeaderBytes = 32;
    public const ushort PayloadKindTribalLegacyV0 = 1;

    // ── FrameV1 ──
    public const ushort PayloadKindFrameV1 = 2;

    // Section flags (after tribe records in FrameV1 payload)
    public const byte FlagTileData = 0x01;
    public const byte FlagWarData = 0x02;
    public const byte FlagEventData = 0x04;
    public const byte FlagTerritoryData = 0x08;

    // Record sizes (match Rust frame_v1.rs constants)
    public const int FrameV1TribeRecordBytes = 50;
    public const int FrameV1TileRecordBytes = 9;
    public const int FrameV1WarRecordBytes = 21;
    public const int FrameV1EventRecordBytes = 5;
}
