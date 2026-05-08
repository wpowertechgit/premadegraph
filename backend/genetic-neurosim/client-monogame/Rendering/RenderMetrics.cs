namespace TribalNeuroSim.Client.Rendering;

using TribalNeuroSim.Client.Models;

/// <summary>
/// Per-frame render performance counters. Collected in GameRoot.Draw and displayed in DebugHud.
/// All fields are computed fresh each frame; zero allocations in hot path.
/// </summary>
public sealed class RenderMetrics
{
    public static int CalculateAssetLoadFailures(ClientDiagnostics diagnostics)
    {
        return diagnostics.LastDecodeError is null ? 0 : 1;
    }

    /// <summary>Exponential-moving-average FPS (smoothed over ~0.5s).</summary>
    public float Fps { get; set; }

    /// <summary>Number of hex terrain tiles drawn this frame.</summary>
    public int TerrainTilesDrawn { get; set; }

    /// <summary>Settlements drawn at Close LOD (full 3D, includes selected).</summary>
    public int SettlementCloseCount { get; set; }

    /// <summary>Settlements drawn at Mid LOD (reduced 3D).</summary>
    public int SettlementMidCount { get; set; }

    /// <summary>Settlements culled at Far LOD (0 means all culled, as expected at far zoom).</summary>
    public int SettlementFarCulledCount { get; set; }

    /// <summary>Total prop/vegetation instances submitted this frame.</summary>
    public int VegetationInstanceCount { get; set; }

    /// <summary>Estimated total triangle primitives submitted (hex + props + settlements).</summary>
    public int EstimatedPrimitives { get; set; }

    /// <summary>Count of asset load failures since startup.</summary>
    public int AssetLoadFailures { get; set; }

    /// <summary>Frame decode latency in milliseconds, or -1 if not connected.</summary>
    public double FrameDecodeLatencyMs { get; set; } = -1;

    /// <summary>Camera distance (for diagnosing LOD switching).</summary>
    public float CameraDistance { get; set; }

    /// <summary>Camera zoom level label.</summary>
    public string ZoomLevelLabel { get; set; } = "mid";

    /// <summary>Whether VSync is enabled.</summary>
    public bool VSyncEnabled { get; set; }
}
