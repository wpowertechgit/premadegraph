using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Rendering;

namespace TribalNeuroSim.Client.UI;

public sealed class LineageInspectorPanel
{
    private const int PanelWidth = 340;
    private const int PanelMargin = 12;

    private static readonly Color PanelColor = new(12, 14, 17, 210);
    private static readonly Color PanelBorderColor = new(255, 255, 255, 36);
    private static readonly Color TextColor = new(228, 235, 224, 245);
    private static readonly Color MutedColor = new(138, 150, 144, 220);
    private static readonly Color AccentColor = new(103, 188, 255, 230);
    private static readonly Color TierColor = new(220, 188, 96, 240);
    private static readonly Color BranchColor = new(160, 140, 180, 200);
    private static readonly Color SeedColor = new(120, 210, 120, 220);

    private Texture2D? _pixel;
    private FontRenderer? _font;
    private GraphicsDevice? _graphicsDevice;

    public void Draw(
        SpriteBatch spriteBatch,
        PlayableSimulation simulation,
        FontRenderer fontRenderer,
        Point origin,
        bool isVisible)
    {
        if (!isVisible) return;

        ArgumentNullException.ThrowIfNull(spriteBatch);

        if (_font is null || !ReferenceEquals(_graphicsDevice, spriteBatch.GraphicsDevice))
        {
            _pixel?.Dispose();
            _graphicsDevice = spriteBatch.GraphicsDevice;
            _pixel = new Texture2D(_graphicsDevice, 1, 1);
            _pixel.SetData(new[] { Microsoft.Xna.Framework.Color.White });
            _font = fontRenderer;
        }

        var selected = simulation.Tribes.FirstOrDefault(t => t.Id == simulation.SelectedTribeId && t.IsAlive);
        if (selected is null)
        {
            DrawEmptyState(spriteBatch, origin, "Select a living tribe first");
            return;
        }

        // Local demo has no entity-level lineage — show placeholder
        DrawLineageUnavailable(spriteBatch, origin, selected);
    }

    private void DrawEmptyState(SpriteBatch spriteBatch, Point origin, string message)
    {
        var lineHeight = _font!.LineHeight(FontSize.Body);
        var smallHeight = _font.LineHeight(FontSize.Small);
        var panel = new Rectangle(
            origin.X, origin.Y, PanelWidth,
            PanelMargin * 2 + lineHeight + smallHeight + 10);

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawRectOutline(spriteBatch, panel, PanelBorderColor, 1);

        var x = panel.X + PanelMargin;
        var y = panel.Y + PanelMargin;

        _font.DrawString(spriteBatch, "LINEAGE INSPECTOR", new Vector2(x, y), FontSize.Small, AccentColor);
        y += _font.LineHeight(FontSize.Small) + 6;

        _font.DrawString(spriteBatch, message, new Vector2(x, y), FontSize.Body, MutedColor);
        y += lineHeight;

        _font.DrawString(spriteBatch, "Press L to toggle panel",
            new Vector2(x, y), FontSize.Small, MutedColor);

        spriteBatch.End();
    }

    private void DrawLineageUnavailable(SpriteBatch spriteBatch, Point origin, PlayableTribe selected)
    {
        var lineHeight = _font!.LineHeight(FontSize.Body);
        var smallHeight = _font.LineHeight(FontSize.Small);
        var headerHeight = _font.LineHeight(FontSize.Header);

        var panelHeight = PanelMargin * 2 + headerHeight + 6 + lineHeight * 6 + smallHeight + 12;
        var panel = new Rectangle(origin.X, origin.Y, PanelWidth, panelHeight);

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawRectOutline(spriteBatch, panel, PanelBorderColor, 1);

        var x = panel.X + PanelMargin;
        var y = panel.Y + PanelMargin;

        // Header: tribe name
        _font.DrawString(spriteBatch, "LINEAGE INSPECTOR", new Vector2(x, y), FontSize.Header, AccentColor);
        y += headerHeight + 4;

        // Tribe info
        _font.DrawString(spriteBatch, "Tribe", new Vector2(x, y), FontSize.Body, MutedColor);
        _font.DrawStringAligned(spriteBatch, selected.Name,
            new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right, TextColor);
        y += lineHeight;

        _font.DrawString(spriteBatch, "ID", new Vector2(x, y), FontSize.Body, MutedColor);
        _font.DrawStringAligned(spriteBatch, selected.Id.ToString(),
            new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right, TextColor);
        y += lineHeight;

        _font.DrawString(spriteBatch, "Population", new Vector2(x, y), FontSize.Body, MutedColor);
        _font.DrawStringAligned(spriteBatch, selected.Population.ToString(),
            new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right, TextColor);
        y += lineHeight + 4;

        // Separator
        FillRect(spriteBatch, new Rectangle(x, y, PanelWidth - PanelMargin * 2, 1), new Color(255, 255, 255, 18));
        y += 8;

        // Lineage unavailable notice
        _font.DrawString(spriteBatch, "Entity-level lineage tracking", new Vector2(x, y), FontSize.Small, MutedColor);
        y += smallHeight;
        _font.DrawString(spriteBatch, "requires Rust backend (network mode).", new Vector2(x, y), FontSize.Small, MutedColor);
        y += smallHeight + 4;

        // Future wireframe hint
        FillRect(spriteBatch, new Rectangle(x, y, PanelWidth - PanelMargin * 2, 1), new Color(255, 255, 255, 14));
        y += 6;

        _font.DrawString(spriteBatch, "Expected structure (network mode):", new Vector2(x, y), FontSize.Small, MutedColor);
        y += smallHeight + 2;

        DrawPlaceholderNode(spriteBatch, x + 8, ref y, smallHeight, "Entity #0", SeedColor, "seed player A");
        DrawPlaceholderNode(spriteBatch, x + 8, ref y, smallHeight, "Entity #1", SeedColor, "seed player B");
        DrawPlaceholderNode(spriteBatch, x + 8, ref y, smallHeight, "Entity #42", BranchColor, "gen 2 (blend of A+B)");
        DrawPlaceholderNode(spriteBatch, x + 8, ref y, smallHeight, "Entity #127", BranchColor, "gen 3 (blend of #42+#0)");

        spriteBatch.End();
    }

    private void DrawPlaceholderNode(
        SpriteBatch spriteBatch, int x, ref int y, int lineHeight,
        string entityLabel, Color nodeColor, string description)
    {
        // Small color dot
        FillRect(spriteBatch, new Rectangle(x, y + 3, 6, 6), nodeColor);
        _font!.DrawString(spriteBatch, entityLabel, new Vector2(x + 12, y), FontSize.Small, nodeColor);
        _font!.DrawString(spriteBatch, description, new Vector2(x + 120, y), FontSize.Small, MutedColor);
        y += lineHeight + 1;
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
}
