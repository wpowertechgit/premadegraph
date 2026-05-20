using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Rendering;

namespace TribalNeuroSim.Client.UI;

public sealed record DebugHudState(
    string ModeText,
    long Tick,
    int LivingTribes,
    int DisputedTiles,
    string? SelectedName,
    int SelectedPopulation,
    float SelectedFood,
    bool IsConnected,
    int TicksPerSecond,
    bool Paused,
    string? LastError,
    float Fps = 0f,
    int TerrainTiles = 0,
    int SettlementClose = 0,
    int SettlementMid = 0,
    int SettlementFarCulled = 0,
    int VegetationInstances = 0,
    int EstimatedPrimitives = 0,
    int AssetLoadFailures = 0,
    double FrameDecodeLatencyMs = -1,
    float CameraDistance = 0f,
    string ZoomLevelLabel = "mid",
    bool VSyncEnabled = true,
    // R8: Expansion metrics
    int SelectedTerritoryCount = 0,
    long ExpansionCooldownRemaining = 0,
    float SelectedExpansionCost = 0f,
    bool SelectedOverextended = false,
    // M6: Extra debug lines for network mode
    string? ExtraDebugLine1 = null,
    string? ExtraDebugLine2 = null,
    // M18B: Empire stress tracking
    string HighestTierLabel = "Tribe",
    int MergeCount = 0,
    // M5: V3 fields display
    int ProtocolVersion = 0,
    int ActiveWarCount = 0,
    int TotalEntityCount = 0,
    int TombstoneCount = 0,
    int LineageDepth = 0,
    string PolityTierCounts = "",
    string AssetDiagSummary = "",
    // E2: E1 brain / fitness / migration data for selected tribe
    float SelectedFitnessScore = 0f,
    bool SelectedIsMigrating = false,
    string SelectedTopDrive = "")
{
    public static DebugHudState Empty { get; } = new(
        "LOCAL",
        0,
        0,
        0,
        null,
        0,
        0f,
        false,
        0,
        false,
        null);
}

public sealed class DebugHud : IDisposable
{
    private const int PanelWidth = 330;
    private const int PanelMargin = 10;
    private const int PerfPanelWidth = 240;
    private const int PerfPanelTop = 250;
    private const int ViewportMargin = 12;

    private static readonly Color PanelColor = new(10, 12, 14, 184);
    private static readonly Color PanelBorderColor = new(255, 255, 255, 34);
    private static readonly Color TextColor = new(228, 235, 224, 240);
    private static readonly Color MutedColor = new(142, 154, 148, 230);
    private static readonly Color AccentColor = new(103, 188, 255, 230);
    private static readonly Color GoodColor = new(92, 220, 132, 230);
    private static readonly Color WarningColor = new(250, 195, 92, 240);
    private static readonly Color ErrorColor = new(245, 82, 82, 240);

    private Texture2D? _pixel;
    private FontRenderer? _font;
    private GraphicsDevice? _graphicsDevice;

    public FontRenderer? Font => _font;
    public Rectangle? ReservedTopRightPanel { get; set; }
    public Point? PerformancePanelOriginOverride { get; set; }
    public Rectangle LastBounds { get; private set; } = Rectangle.Empty;
    public Rectangle LastPerformanceBounds { get; private set; } = Rectangle.Empty;

    /// <summary>Toggle V3 stats section visibility (default: true). Use 'V' key.</summary>
    public bool ShowV3Stats { get; set; } = true;

    public void Draw(SpriteBatch spriteBatch, DebugHudState state)
    {
        Draw(spriteBatch, state, new Point(12, 12));
    }

    public void Draw(SpriteBatch spriteBatch, DebugHudState state, Point origin)
    {
        ArgumentNullException.ThrowIfNull(spriteBatch);
        ArgumentNullException.ThrowIfNull(state);

        EnsureResources(spriteBatch.GraphicsDevice);

        var lineHeight = _font!.LineHeight(FontSize.Body);
        var smallHeight = _font.LineHeight(FontSize.Small);
        var hasError = !string.IsNullOrWhiteSpace(state.LastError);

        var hasSelection = !string.IsNullOrWhiteSpace(state.SelectedName) && state.SelectedPopulation > 0;
        var hasExtra1 = !string.IsNullOrWhiteSpace(state.ExtraDebugLine1);
        var hasExtra2 = !string.IsNullOrWhiteSpace(state.ExtraDebugLine2);
        var extraLineCount = (hasExtra1 ? 1 : 0) + (hasExtra2 ? 1 : 0);
        // M18B: Always include 1 row for highest tier / merge count
        var hasTierInfo = !string.IsNullOrWhiteSpace(state.HighestTierLabel);
        var tierRowCount = hasTierInfo ? 1 : 0;
        // M5: V3 stats section (3 compact rows when visible)
        var showV3Stats = ShowV3Stats && !string.IsNullOrWhiteSpace(state.PolityTierCounts);
        var v3RowCount = showV3Stats ? 2 : 0;
        // E2: brain / fitness rows when selection has E1 data
        var hasBrainData = hasSelection && (!string.IsNullOrEmpty(state.SelectedTopDrive) || state.SelectedFitnessScore > 0f);
        var brainRowCount = hasBrainData ? 2 : 0;
        var rowCount = 6 + (hasSelection ? 2 : 0) + brainRowCount + (hasError ? 2 : 0) + extraLineCount + tierRowCount + v3RowCount;
        var panelHeight = PanelMargin * 2 + rowCount * lineHeight + 4;
        var panel = new Rectangle(origin.X, origin.Y, PanelWidth, panelHeight);
        LastBounds = panel;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawRectOutline(spriteBatch, panel, PanelBorderColor, 1);

        // Status strip (left edge)
        var stripColor = state.LastError is { Length: > 0 }
            ? ErrorColor
            : state.Paused
                ? WarningColor
                : state.IsConnected
                    ? GoodColor
                    : AccentColor;
        FillRect(spriteBatch, new Rectangle(panel.X, panel.Y, 4, panel.Height), stripColor);

        var x = panel.X + PanelMargin + 4;
        var y = panel.Y + PanelMargin;

        // Title
        _font.DrawString(spriteBatch, "TRIBAL NEUROSIM", new Vector2(x, y), FontSize.Header, AccentColor);
        y += _font.LineHeight(FontSize.Header) + 4;

        // Row: MODE
        var mode = state.Paused ? "PAUSED" : string.IsNullOrWhiteSpace(state.ModeText) ? "RUN" : state.ModeText;
        DrawRow(spriteBatch, x, y, lineHeight, "MODE", mode, state.Paused ? WarningColor : TextColor);
        y += lineHeight;

        // Row: TICK / TPS
        DrawRow(spriteBatch, x, y, lineHeight, "TICK", state.Tick.ToString(), TextColor);
        DrawRow(spriteBatch, x + 164, y, lineHeight, "TPS", Math.Max(0, state.TicksPerSecond).ToString(), TextColor);
        y += lineHeight;

        // Row: TRIBES / DISPUTES
        DrawRow(spriteBatch, x, y, lineHeight, "TRIBES", Math.Max(0, state.LivingTribes).ToString(), TextColor);
        DrawRow(spriteBatch, x + 164, y, lineHeight, "DISP", Math.Max(0, state.DisputedTiles).ToString(),
            state.DisputedTiles > 0 ? WarningColor : TextColor);
        y += lineHeight + 2;

        // M18B: Highest polity tier reached / active merge count
        if (!string.IsNullOrWhiteSpace(state.HighestTierLabel))
        {
            DrawRow(spriteBatch, x, y, lineHeight, "PEAK", state.HighestTierLabel, GoodColor);
            DrawRow(spriteBatch, x + 164, y, lineHeight, "MERGE", Math.Max(0, state.MergeCount).ToString(),
                state.MergeCount > 0 ? AccentColor : MutedColor);
            y += lineHeight + 2;
        }

        // Selected tribe summary
        var selName = string.IsNullOrWhiteSpace(state.SelectedName) ? "NONE" : state.SelectedName;
        DrawRow(spriteBatch, x, y, lineHeight, "SEL", Truncate(selName, 16), TextColor);
        y += lineHeight;

        DrawRow(spriteBatch, x, y, lineHeight, "POP", state.SelectedPopulation.ToString(),
            state.SelectedPopulation > 0 ? GoodColor : MutedColor);
        DrawRow(spriteBatch, x + 164, y, lineHeight, "FOOD", ((int)MathF.Round(Math.Max(0f, state.SelectedFood))).ToString(),
            state.SelectedFood > 10 ? AccentColor : WarningColor);
        y += lineHeight + 2;

        // E2: brain / fitness rows (network mode only when E1 data present)
        if (hasBrainData)
        {
            var fitColor = state.SelectedFitnessScore >= 0.6f ? GoodColor : state.SelectedFitnessScore >= 0.3f ? AccentColor : WarningColor;
            DrawRow(spriteBatch, x, y, lineHeight, "FIT", $"{state.SelectedFitnessScore:F2}", fitColor);
            DrawRow(spriteBatch, x + 164, y, lineHeight, "DRIVE",
                string.IsNullOrEmpty(state.SelectedTopDrive) ? "N/A" : state.SelectedTopDrive, AccentColor);
            y += lineHeight;
            DrawRow(spriteBatch, x, y, lineHeight, "MIGR",
                state.SelectedIsMigrating ? "MOVING" : "settled",
                state.SelectedIsMigrating ? WarningColor : MutedColor);
            y += lineHeight + 2;
        }

        // Connection + controls
        var indicator = state.IsConnected ? "●" : "○";
        var indicatorColor = state.IsConnected ? GoodColor : WarningColor;
        _font.DrawString(spriteBatch, indicator, new Vector2(x, y + 1), FontSize.Small, indicatorColor);
        _font.DrawString(spriteBatch, state.IsConnected ? "NODE" : "LOCAL", new Vector2(x + 14, y), FontSize.Body, TextColor);

        var pauseIndicator = state.Paused ? "⏸" : "▶";
        var pauseColor = state.Paused ? WarningColor : GoodColor;
        _font.DrawString(spriteBatch, pauseIndicator, new Vector2(x + 90, y + 1), FontSize.Small, pauseColor);
        _font.DrawString(spriteBatch, state.Paused ? "PAUSED" : "RUN", new Vector2(x + 104, y), FontSize.Body, TextColor);

        _font.DrawString(spriteBatch, "SPC N R K ESC +/-", new Vector2(x + 160, y), FontSize.Small, MutedColor);
        y += lineHeight + 2;

        // M5: V3 simulation stats (polity tiers, wars, entities, tombstones, lineage, protocol)
        if (showV3Stats)
        {
            // Thin separator
            FillRect(spriteBatch, new Rectangle(x - 4, y - 2, PanelWidth - PanelMargin - 12, 1), new Color(255, 255, 255, 12));

            // Row 1: Polity tier counts (compact: T:392 C:16 D:0 K:0 E:0)
            DrawRow(spriteBatch, x, y, lineHeight, "POLITY", state.PolityTierCounts, GoodColor);
            y += lineHeight;

            // Row 2: Wars / Entities / Tombstones (3-column compact)
            DrawTripleRow(spriteBatch, x, y, lineHeight,
                "WARS", state.ActiveWarCount.ToString(), TextColor,
                "ENT", state.TotalEntityCount.ToString("#,0"), TextColor,
                "TOMB", state.TombstoneCount.ToString(), state.TombstoneCount > 0 ? WarningColor : MutedColor);
            y += lineHeight + 2;
        }

        // M6: Extra debug lines (network mode diagnostic info)
        if (!string.IsNullOrWhiteSpace(state.ExtraDebugLine1))
        {
            _font.DrawString(spriteBatch, state.ExtraDebugLine1, new Vector2(x, y), FontSize.Small, AccentColor);
            y += smallHeight + 1;
        }

        if (!string.IsNullOrWhiteSpace(state.ExtraDebugLine2))
        {
            _font.DrawString(spriteBatch, state.ExtraDebugLine2, new Vector2(x, y), FontSize.Small, AccentColor);
            y += smallHeight + 1;
        }

        // R8: Expansion metrics (shown when tribe selected)
        if (hasSelection)
        {
            DrawRow(spriteBatch, x, y, lineHeight, "TERR", $"{state.SelectedTerritoryCount} tiles",
                state.SelectedOverextended ? WarningColor : TextColor);
            DrawRow(spriteBatch, x + 164, y, lineHeight, "OEXT",
                state.SelectedOverextended ? "YES" : "no",
                state.SelectedOverextended ? WarningColor : MutedColor);
            y += lineHeight;

            var cooldownColor = state.ExpansionCooldownRemaining > 0 ? WarningColor : GoodColor;
            var cooldownLabel = state.ExpansionCooldownRemaining > 0 ? $"{state.ExpansionCooldownRemaining}t" : "READY";
            DrawRow(spriteBatch, x, y, lineHeight, "EXP-CD", cooldownLabel, cooldownColor);
            DrawRow(spriteBatch, x + 164, y, lineHeight, "EXP$", ((int)MathF.Round(state.SelectedExpansionCost)).ToString(),
                state.SelectedExpansionCost > 100 ? WarningColor : AccentColor);
            y += lineHeight;
        }

        // Error line
        if (hasError)
        {
            y += lineHeight + 4;
            FillRect(spriteBatch, new Rectangle(x - 2, y - 3, PanelWidth - PanelMargin - 12, lineHeight + 6),
                new Color(90, 20, 20, 150));
            _font.DrawString(spriteBatch, "ERR", new Vector2(x, y), FontSize.Body, ErrorColor);
            _font.DrawString(spriteBatch, Truncate(state.LastError ?? "", 32), new Vector2(x + 36, y), FontSize.Body, TextColor);
        }

        spriteBatch.End();

        // ── Performance panel (right side) ──
        if (state.Fps > 0f || state.TerrainTiles > 0)
        {
            DrawPerformancePanel(spriteBatch, state);
        }
        else
        {
            LastPerformanceBounds = Rectangle.Empty;
        }
    }

    private void DrawPerformancePanel(SpriteBatch spriteBatch, DebugHudState state)
    {
        var lineHeight = _font!.LineHeight(FontSize.Small);
        var perfPanel = ResolvePerformancePanelBounds(spriteBatch.GraphicsDevice.Viewport, ReservedTopRightPanel);
        if (PerformancePanelOriginOverride is { } origin)
        {
            perfPanel = new Rectangle(origin.X, origin.Y, perfPanel.Width, perfPanel.Height);
        }
        LastPerformanceBounds = perfPanel;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, perfPanel, PanelColor);
        DrawRectOutline(spriteBatch, perfPanel, PanelBorderColor, 1);

        var fpsColor = state.Fps >= 30f ? GoodColor : state.Fps >= 15f ? WarningColor : ErrorColor;
        var stripColor = state.Fps >= 30f ? GoodColor : state.Fps >= 15f ? WarningColor : ErrorColor;
        FillRect(spriteBatch, new Rectangle(perfPanel.X, perfPanel.Y, 4, perfPanel.Height), stripColor);

        var x = perfPanel.X + PanelMargin + 4;
        var y = perfPanel.Y + PanelMargin;

        _font.DrawString(spriteBatch, "PERFORMANCE", new Vector2(x, y), FontSize.Small, AccentColor);
        y += lineHeight + 4;

        DrawPerfRow(spriteBatch, x, ref y, lineHeight, "FPS", $"{state.Fps:0.0}", fpsColor);
        DrawPerfRow(spriteBatch, x, ref y, lineHeight, "VSync", state.VSyncEnabled ? "ON" : "OFF", state.VSyncEnabled ? MutedColor : WarningColor);
        DrawPerfRow(spriteBatch, x, ref y, lineHeight, "Camera", $"{state.CameraDistance:0} ({state.ZoomLevelLabel})", MutedColor);
        DrawPerfRow(spriteBatch, x, ref y, lineHeight, "Terrain", $"{state.TerrainTiles} tiles", TextColor);
        DrawPerfRow(spriteBatch, x, ref y, lineHeight, "Settlements", $"C:{state.SettlementClose} M:{state.SettlementMid} F:{state.SettlementFarCulled}", TextColor);
        DrawPerfRow(spriteBatch, x, ref y, lineHeight, "Vegetation", $"{state.VegetationInstances} inst", TextColor);
        DrawPerfRow(spriteBatch, x, ref y, lineHeight, "Primitives", $"{state.EstimatedPrimitives:#,0}", TextColor);

        var latencyColor = state.FrameDecodeLatencyMs < 0 ? MutedColor : state.FrameDecodeLatencyMs < 16 ? GoodColor : WarningColor;
        var latencyLabel = state.FrameDecodeLatencyMs < 0 ? "N/A" : $"{state.FrameDecodeLatencyMs:0.0} ms";
        DrawPerfRow(spriteBatch, x, ref y, lineHeight, "Decode", latencyLabel, latencyColor);

        var failColor = state.AssetLoadFailures > 0 ? ErrorColor : GoodColor;
        DrawPerfRow(spriteBatch, x, ref y, lineHeight, "Asset fails", state.AssetLoadFailures.ToString(), failColor);

        // Draw budget bar: percentage of estimated "budget" used
        y += 4;
        var budgetMax = 18; // ~18k primitives is a reasonable soft budget for this scene
        var budgetRatio = MathHelper.Clamp(state.EstimatedPrimitives / (budgetMax * 1000f), 0f, 1f);
        var barColor = budgetRatio < 0.5f ? GoodColor : budgetRatio < 0.85f ? WarningColor : ErrorColor;
        _font.DrawString(spriteBatch, "BUDGET", new Vector2(x, y), FontSize.Small, AccentColor);
        var barX = x + 52;
        var barY = y + 4;
        var barW = PerfPanelWidth - PanelMargin - 70;
        var barH = 6;
        FillRect(spriteBatch, new Rectangle(barX, barY, barW, barH), new Color(40, 44, 40, 180));
        FillRect(spriteBatch, new Rectangle(barX, barY, (int)(barW * budgetRatio), barH), barColor);
        _font.DrawString(spriteBatch, $"{budgetRatio * 100:0}%", new Vector2(barX + barW + 4, y), FontSize.Small, barColor);

        spriteBatch.End();
    }

    public static Rectangle ResolvePerformancePanelBounds(Viewport viewport, Rectangle? selectionPanel = null)
    {
        var lineHeight = 14;
        var perfPanelHeight = PanelMargin * 2 + 11 * lineHeight + 6;
        var perfX = Math.Max(ViewportMargin, viewport.Width - PerfPanelWidth - ViewportMargin);
        var perfY = PerfPanelTop;

        if (selectionPanel is { } selected)
            perfY = Math.Max(perfY, selected.Bottom + ViewportMargin);

        if (perfY + perfPanelHeight > viewport.Height - ViewportMargin)
            perfY = Math.Max(ViewportMargin, viewport.Height - perfPanelHeight - ViewportMargin);

        return new Rectangle(perfX, perfY, PerfPanelWidth, perfPanelHeight);
    }

    private void DrawPerfRow(SpriteBatch spriteBatch, int x, ref int y, int lineHeight, string key, string value, Color valueColor)
    {
        _font!.DrawString(spriteBatch, key, new Vector2(x, y), FontSize.Small, MutedColor);
        _font!.DrawString(spriteBatch, value, new Vector2(x + 72, y), FontSize.Small, valueColor);
        y += lineHeight + 1;
    }

    public void Dispose()
    {
        _pixel?.Dispose();
        _pixel = null;
        _font?.Dispose();
        _font = null;
        _graphicsDevice = null;
    }

    private void EnsureResources(GraphicsDevice graphicsDevice)
    {
        if (_pixel is not null && _font is not null && ReferenceEquals(_graphicsDevice, graphicsDevice))
            return;

        _pixel?.Dispose();
        _font?.Dispose();

        _graphicsDevice = graphicsDevice;
        _pixel = new Texture2D(graphicsDevice, 1, 1);
        _pixel.SetData(new[] { Microsoft.Xna.Framework.Color.White });
        _font = new FontRenderer(graphicsDevice, FontRole.Debug);
    }

    private void DrawRow(SpriteBatch spriteBatch, int x, int y, int lineHeight, string key, string value, Color valueColor)
    {
        _font!.DrawString(spriteBatch, key, new Vector2(x, y), FontSize.Body, MutedColor);
        _font!.DrawString(spriteBatch, value, new Vector2(x + 62, y), FontSize.Body, valueColor);
    }

    /// <summary>Compact 3-column row: key1 val1 | key2 val2 | key3 val3</summary>
    private void DrawTripleRow(SpriteBatch spriteBatch, int x, int y, int lineHeight,
        string key1, string val1, Color color1,
        string key2, string val2, Color color2,
        string key3, string val3, Color color3)
    {
        var col2 = x + 110;
        var col3 = x + 220;
        _font!.DrawString(spriteBatch, key1, new Vector2(x, y), FontSize.Body, MutedColor);
        _font!.DrawString(spriteBatch, val1, new Vector2(x + 44, y), FontSize.Body, color1);
        _font!.DrawString(spriteBatch, key2, new Vector2(col2, y), FontSize.Body, MutedColor);
        _font!.DrawString(spriteBatch, val2, new Vector2(col2 + 32, y), FontSize.Body, color2);
        _font!.DrawString(spriteBatch, key3, new Vector2(col3, y), FontSize.Body, MutedColor);
        _font!.DrawString(spriteBatch, val3, new Vector2(col3 + 44, y), FontSize.Body, color3);
    }

    private void FillRect(SpriteBatch spriteBatch, Rectangle rect, Color color)
    {
        spriteBatch.Draw(_pixel, rect, color);
    }

    private void DrawRectOutline(SpriteBatch spriteBatch, Rectangle rect, Color color, int thickness)
    {
        FillRect(spriteBatch, new Rectangle(rect.Left, rect.Top, rect.Width, thickness), color);
        FillRect(spriteBatch, new Rectangle(rect.Left, rect.Bottom - thickness, rect.Width, thickness), color);
        FillRect(spriteBatch, new Rectangle(rect.Left, rect.Top, thickness, rect.Height), color);
        FillRect(spriteBatch, new Rectangle(rect.Right - thickness, rect.Top, thickness, rect.Height), color);
    }

    private static string Truncate(string text, int maxLength)
    {
        if (string.IsNullOrEmpty(text) || maxLength <= 0) return string.Empty;
        return text.Length <= maxLength ? text : text[..maxLength];
    }
}
