namespace TribalNeuroSim.Client.Protocol;

public static class DesktopProtocol
{
    public static ReadOnlySpan<byte> Magic => "TNS3"u8;

    public const ushort Version = 1;
    public const int HeaderBytes = 32;
    public const ushort PayloadKindTribalLegacyV0 = 1;
}
