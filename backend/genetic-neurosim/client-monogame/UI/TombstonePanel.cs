using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Rendering;

namespace TribalNeuroSim.Client.UI;

public enum TombstoneSortMode
{
    TickDesc,
    TickAsc,
    NameAsc,
    Cause,
}

public sealed class TombstonePanel
{
    private const int PanelWidth = 380;
    private const int PanelMargin = 12;
    private const int MaxVisibleRows = 12;

    private static readonly Color PanelColor = new(12, 14, 17, 210);
    private static readonly Color PanelBorderColor = new(255, 255, 255, 36);
    private static readonly Color TextColor = new(228, 235, 224, 245);
    private static readonly Color MutedColor = new(138, 150, 144, 220);
    private static readonly Color AccentColor = new(103, 188, 255, 230);
    private static readonly Color WarningColor = new(250, 195, 92, 240);
    private static readonly Color DeathColor = new(220, 100, 100, 230);
    private static readonly Color MergerColor = new(120, 210, 120, 220);

    private TombstoneSortMode _sortMode = TombstoneSortMode.TickDesc;
    private int _scrollOffset;

    private Texture2D? _pixel;
    private FontRenderer? _font;
    private GraphicsDevice? _graphicsDevice;
    public Rectangle LastBounds { get; private set; } = Rectangle.Empty;

    public TombstoneSortMode SortMode
    {
        get => _sortMode;
        set => _sortMode = value;
    }

    public void Draw(
        SpriteBatch spriteBatch,
        PlayableSimulation simulation,
        FontRenderer fontRenderer,
        Point origin,
        bool isVisible)
    {
        if (!isVisible)
        {
            LastBounds = Rectangle.Empty;
            return;
        }

        ArgumentNullException.ThrowIfNull(spriteBatch);

        if (_font is null || !ReferenceEquals(_graphicsDevice, spriteBatch.GraphicsDevice))
        {
            _pixel?.Dispose();
            _graphicsDevice = spriteBatch.GraphicsDevice;
            _pixel = new Texture2D(_graphicsDevice, 1, 1);
            _pixel.SetData(new[] { Microsoft.Xna.Framework.Color.White });
            _font = fontRenderer;
        }

        if (simulation.Tombstones.Count == 0)
        {
            DrawEmptyState(spriteBatch, origin);
            return;
        }

        DrawTombstoneList(spriteBatch, simulation, origin);
    }

    /// <summary>
    /// Handle sort-toggle and scroll input. Call from GameRoot update loop.
    /// Returns true if any state changed.
    /// </summary>
    public bool HandleInput(
        bool nextSortRequested,
        bool prevSortRequested,
        bool scrollUp,
        bool scrollDown,
        int totalTombstones)
    {
        var changed = false;

        if (nextSortRequested)
        {
            _sortMode = _sortMode switch
            {
                TombstoneSortMode.TickDesc => TombstoneSortMode.TickAsc,
                TombstoneSortMode.TickAsc => TombstoneSortMode.NameAsc,
                TombstoneSortMode.NameAsc => TombstoneSortMode.Cause,
                TombstoneSortMode.Cause => TombstoneSortMode.TickDesc,
                _ => TombstoneSortMode.TickDesc,
            };
            changed = true;
        }

        if (totalTombstones > MaxVisibleRows)
        {
            if (scrollUp && _scrollOffset > 0)
            {
                _scrollOffset--;
                changed = true;
            }

            if (scrollDown && _scrollOffset + MaxVisibleRows < totalTombstones)
            {
                _scrollOffset++;
                changed = true;
            }
        }

        return changed;
    }

    public void ResetScroll()
    {
        _scrollOffset = 0;
    }

    private void DrawEmptyState(SpriteBatch spriteBatch, Point origin)
    {
        var lineHeight = _font!.LineHeight(FontSize.Body);
        var smallHeight = _font.LineHeight(FontSize.Small);
        var panel = new Rectangle(
            origin.X, origin.Y, PanelWidth,
            PanelMargin * 2 + lineHeight + smallHeight + 12 + _font.LineHeight(FontSize.Header));
        LastBounds = panel;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawRectOutline(spriteBatch, panel, PanelBorderColor, 1);

        var x = panel.X + PanelMargin;
        var y = panel.Y + PanelMargin;

        _font.DrawString(spriteBatch, "TOMBSTONE LEDGER", new Vector2(x, y), FontSize.Header, AccentColor);
        y += _font.LineHeight(FontSize.Header) + 6;

        _font.DrawString(spriteBatch, "No extinctions yet", new Vector2(x, y), FontSize.Body, TextColor);
        y += lineHeight;

        _font.DrawString(spriteBatch, "All tribes survive so far. Check back after more simulation ticks.",
            new Vector2(x, y), FontSize.Small, MutedColor);
        y += smallHeight + 4;

        _font.DrawString(spriteBatch, "Press K to toggle panel",
            new Vector2(x, y), FontSize.Small, MutedColor);

        spriteBatch.End();
    }

    private void DrawTombstoneList(SpriteBatch spriteBatch, PlayableSimulation simulation, Point origin)
    {
        var lineHeight = _font!.LineHeight(FontSize.Body);
        var smallHeight = _font.LineHeight(FontSize.Small);
        var headerHeight = _font.LineHeight(FontSize.Header);

        // Build sorted tombstone list
        var tombstones = SortTombstones(simulation);

        var visibleCount = Math.Min(MaxVisibleRows, tombstones.Count);
        var hasScroll = tombstones.Count > MaxVisibleRows;

        var panelHeight = PanelMargin * 2 + headerHeight + 6
                          + smallHeight + 4  // sort header row
                          + visibleCount * lineHeight + 4;

        if (hasScroll)
            panelHeight += smallHeight + 4;

        var panel = new Rectangle(origin.X, origin.Y, PanelWidth, panelHeight);
        LastBounds = panel;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawRectOutline(spriteBatch, panel, PanelBorderColor, 1);
        // Red left strip for death ledger
        FillRect(spriteBatch, new Rectangle(panel.X, panel.Y, 4, panel.Height), new Color(120, 40, 40, 200));

        var x = panel.X + PanelMargin + 4;
        var y = panel.Y + PanelMargin;

        // Title
        _font.DrawString(spriteBatch, "TOMBSTONE LEDGER", new Vector2(x, y), FontSize.Header, AccentColor);
        y += headerHeight + 4;

        // Count
        _font.DrawString(spriteBatch, $"{tombstones.Count} extinct", new Vector2(x, y), FontSize.Small, MutedColor);
        _font.DrawStringAligned(spriteBatch, "Sort: N to cycle | Scroll: [ ]",
            new Vector2(panel.Right - PanelMargin, y), FontSize.Small, TextAlign.Right, MutedColor);
        y += smallHeight + 4;

        // Column headers
        DrawColumnHeaders(spriteBatch, x, y, panel.Right - PanelMargin, smallHeight);
        y += smallHeight + 2;

        FillRect(spriteBatch, new Rectangle(x, y, PanelWidth - PanelMargin * 2 - 8, 1), new Color(255, 255, 255, 16));
        y += 4;

        // Visible rows
        var endIdx = Math.Min(_scrollOffset + MaxVisibleRows, tombstones.Count);
        for (var i = _scrollOffset; i < endIdx; i++)
        {
            var (tombstone, tribeName) = tombstones[i];
            DrawTombstoneRow(spriteBatch, x, y, lineHeight, panel.Right - PanelMargin, tombstone, tribeName);
            y += lineHeight;

            // Light separator between rows
            if (i < endIdx - 1)
                FillRect(spriteBatch, new Rectangle(x, y - 1, PanelWidth - PanelMargin * 2 - 8, 1), new Color(255, 255, 255, 6));
        }

        y += 4;

        // Scroll indicator
        if (hasScroll)
        {
            var scrollInfo = $"Page {_scrollOffset / MaxVisibleRows + 1}/{(tombstones.Count + MaxVisibleRows - 1) / MaxVisibleRows}";
            _font.DrawString(spriteBatch, scrollInfo, new Vector2(x, y), FontSize.Small, MutedColor);
        }

        spriteBatch.End();
    }

    private void DrawColumnHeaders(
        SpriteBatch spriteBatch, int x, int y, int rightEdge, int lineHeight)
    {
        var sortLabel = _sortMode switch
        {
            TombstoneSortMode.TickDesc => "▼ TICK",
            TombstoneSortMode.TickAsc => "▲ TICK",
            TombstoneSortMode.NameAsc => "▲ NAME",
            TombstoneSortMode.Cause => "▼ CAUSE",
            _ => "TICK",
        };

        _font!.DrawString(spriteBatch, sortLabel, new Vector2(x, y), FontSize.Small, AccentColor);
        _font!.DrawString(spriteBatch, "TRIBE", new Vector2(x + 70, y), FontSize.Small, MutedColor);
        _font!.DrawString(spriteBatch, "POP", new Vector2(x + 190, y), FontSize.Small, MutedColor);
        _font!.DrawString(spriteBatch, "CAUSE", new Vector2(x + 250, y), FontSize.Small, MutedColor);
    }

    private void DrawTombstoneRow(
        SpriteBatch spriteBatch, int x, int y, int lineHeight, int rightEdge,
        PlayableTribeTombstone tombstone, string tribeName)
    {
        // Tick
        _font!.DrawString(spriteBatch, tombstone.Tick.ToString(), new Vector2(x, y), FontSize.Body, TextColor);

        // Tribe name
        _font!.DrawString(spriteBatch, Truncate(tribeName, 14), new Vector2(x + 70, y), FontSize.Body, TextColor);

        // Population at death
        var popText = tombstone.PopulationAtDeath > 0 ? tombstone.PopulationAtDeath.ToString() : "?";
        _font!.DrawString(spriteBatch, popText, new Vector2(x + 190, y), FontSize.Body, MutedColor);

        // Cause of death
        var (causeLabel, causeColor) = tombstone.Reason switch
        {
            PlayableExtinctionReason.Starvation => ("STARVE", DeathColor),
            PlayableExtinctionReason.Merger => ("MERGE", MergerColor),
            _ => ("UNKNOWN", MutedColor),
        };
        _font!.DrawString(spriteBatch, causeLabel, new Vector2(x + 250, y), FontSize.Body, causeColor);
    }

    private List<(PlayableTribeTombstone Tombstone, string TribeName)> SortTombstones(
        PlayableSimulation simulation)
    {
        var tribeNameMap = simulation.Tribes.ToDictionary(t => t.Id, t => t.Name);

        var list = simulation.Tombstones
            .Select(t => (
                Tombstone: t,
                TribeName: tribeNameMap.TryGetValue(t.TribeId, out var name) ? name : $"Tribe {t.TribeId}"))
            .ToList();

        return _sortMode switch
        {
            TombstoneSortMode.TickAsc => list.OrderBy(x => x.Tombstone.Tick).ToList(),
            TombstoneSortMode.NameAsc => list.OrderBy(x => x.TribeName).ThenBy(x => x.Tombstone.Tick).ToList(),
            TombstoneSortMode.Cause => list.OrderBy(x => x.Tombstone.Reason).ThenByDescending(x => x.Tombstone.Tick).ToList(),
            _ => list.OrderByDescending(x => x.Tombstone.Tick).ToList(),
        };
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
