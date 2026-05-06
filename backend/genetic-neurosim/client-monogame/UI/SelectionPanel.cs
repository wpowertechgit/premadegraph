using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Rendering;

namespace TribalNeuroSim.Client.UI;

public sealed class SelectionPanel
{
    private const int PanelWidth = 280;
    private const int PanelMargin = 12;

    private static readonly Color PanelColor = new(12, 14, 17, 200);
    private static readonly Color PanelBorderColor = new(255, 255, 255, 40);
    private static readonly Color TextColor = new(228, 235, 224, 245);
    private static readonly Color MutedColor = new(138, 150, 144, 220);
    private static readonly Color AccentColor = new(103, 188, 255, 230);
    private static readonly Color GoodColor = new(92, 220, 132, 230);
    private static readonly Color WarningColor = new(250, 195, 92, 240);
    private static readonly Color TierColor = new(220, 188, 96, 240);

    private Texture2D? _pixel;
    private FontRenderer? _font;
    private GraphicsDevice? _graphicsDevice;

    public void Draw(
        SpriteBatch spriteBatch,
        PlayableSimulation simulation,
        FontRenderer fontRenderer,
        Point origin)
    {
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
            DrawEmptyState(spriteBatch, origin);
            return;
        }

        var lineHeight = _font.LineHeight(FontSize.Body);
        var smallHeight = _font.LineHeight(FontSize.Small);
        var headerHeight = _font.LineHeight(FontSize.Header);

        var panelHeight = PanelMargin * 2 + headerHeight + 6 + lineHeight * 7 + 6;
        var panel = new Rectangle(origin.X, origin.Y, PanelWidth, panelHeight);

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawRectOutline(spriteBatch, panel, PanelBorderColor, 1);

        var x = panel.X + PanelMargin;
        var y = panel.Y + PanelMargin;

        // Header: tribe name + tier badge
        _font.DrawString(spriteBatch, selected.Name, new Vector2(x, y), FontSize.Header, TextColor);
        var tierText = selected.Tier.ToString().ToUpperInvariant();
        var tierWidth = (int)_font.Measure(tierText, FontSize.Small).X + 10;
        FillRect(spriteBatch, new Rectangle(panel.Right - PanelMargin - tierWidth - 4, y + 1, tierWidth, smallHeight),
            new Color(TierColor, 50));
        DrawRectOutline(spriteBatch, new Rectangle(panel.Right - PanelMargin - tierWidth - 4, y + 1, tierWidth, smallHeight),
            TierColor, 1);
        _font.DrawStringAligned(spriteBatch, tierText,
            new Vector2(panel.Right - PanelMargin - 5, y + 2), FontSize.Small, TextAlign.Right, TierColor);

        y += headerHeight + 6;

        // Population with small bar
        _font.DrawString(spriteBatch, "Population", new Vector2(x, y), FontSize.Body, MutedColor);
        _font.DrawStringAligned(spriteBatch, selected.Population.ToString(),
            new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right, TextColor);
        y += lineHeight;

        // Population bar
        var popMax = 250;
        var popRatio = MathHelper.Clamp(selected.Population / (float)popMax, 0f, 1f);
        var barY = y - 2;
        FillRect(spriteBatch, new Rectangle(x, barY, PanelWidth - PanelMargin * 2, 5), new Color(255, 255, 255, 20));
        FillRect(spriteBatch, new Rectangle(x, barY, (int)((PanelWidth - PanelMargin * 2) * popRatio), 5), GoodColor);

        y += 4;

        // Food
        _font.DrawString(spriteBatch, "Food", new Vector2(x, y), FontSize.Body, MutedColor);
        var foodColor = selected.FoodStores > 10 ? AccentColor : WarningColor;
        _font.DrawStringAligned(spriteBatch, $"{selected.FoodStores:F0}",
            new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right, foodColor);
        y += lineHeight;

        // Territory
        var territoryCount = selected.Territory.Count;
        _font.DrawString(spriteBatch, "Territory", new Vector2(x, y), FontSize.Body, MutedColor);
        _font.DrawStringAligned(spriteBatch, $"{territoryCount} tiles",
            new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right, TextColor);
        y += lineHeight;

        // Disputes
        var disputeCount = simulation.Tiles.Count(t =>
            t.IsDisputed && t.Controls.Any(c => c.TribeId == selected.Id));
        _font.DrawString(spriteBatch, "Disputes", new Vector2(x, y), FontSize.Body, MutedColor);
        _font.DrawStringAligned(spriteBatch, disputeCount > 0 ? $"{disputeCount} (-40%)" : "none",
            new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right,
            disputeCount > 0 ? WarningColor : MutedColor);
        y += lineHeight + 4;

        // Separator
        FillRect(spriteBatch, new Rectangle(x, y, PanelWidth - PanelMargin * 2, 1), new Color(255, 255, 255, 20));
        y += 6;

        // Artifacts
        _font.DrawString(spriteBatch, "Artifacts", new Vector2(x, y), FontSize.Small, MutedColor);
        y += lineHeight;

        DrawArtifactRow(spriteBatch, x, y, lineHeight, panel.Right - PanelMargin, "Combat", selected.Artifacts.Combat);
        y += lineHeight;
        DrawArtifactRow(spriteBatch, x, y, lineHeight, panel.Right - PanelMargin, "Resource", selected.Artifacts.Resource);
        y += lineHeight;
        DrawArtifactRow(spriteBatch, x, y, lineHeight, panel.Right - PanelMargin, "Map Obj", selected.Artifacts.MapObjective);
        y += lineHeight;
        DrawArtifactRow(spriteBatch, x, y, lineHeight, panel.Right - PanelMargin, "Risk", selected.Artifacts.Risk);
        y += lineHeight;
        DrawArtifactRow(spriteBatch, x, y, lineHeight, panel.Right - PanelMargin, "Team", selected.Artifacts.Team);

        spriteBatch.End();
    }

    private void DrawEmptyState(SpriteBatch spriteBatch, Point origin)
    {
        var lineHeight = _font!.LineHeight(FontSize.Body);
        var panel = new Rectangle(origin.X, origin.Y, PanelWidth, PanelMargin * 2 + lineHeight + 6);

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawRectOutline(spriteBatch, panel, PanelBorderColor, 1);

        _font.DrawString(spriteBatch, "No tribe selected",
            new Vector2(origin.X + PanelMargin, origin.Y + PanelMargin + 3),
            FontSize.Body, MutedColor);
        _font.DrawString(spriteBatch, "Click a tribe to inspect",
            new Vector2(origin.X + PanelMargin, origin.Y + PanelMargin + 3 + lineHeight),
            FontSize.Small, MutedColor);

        spriteBatch.End();
    }

    private void DrawArtifactRow(SpriteBatch spriteBatch, int x, int y, int lineHeight, int rightEdge,
        string label, float value)
    {
        _font!.DrawString(spriteBatch, label, new Vector2(x + 8, y), FontSize.Small, MutedColor);

        var barWidth = 120;
        var barX = rightEdge - barWidth - 40;
        FillRect(spriteBatch, new Rectangle(barX, y + 4, barWidth, 4), new Color(255, 255, 255, 18));
        FillRect(spriteBatch, new Rectangle(barX, y + 4, (int)(barWidth * MathHelper.Clamp(value, 0f, 1f)), 4), AccentColor);

        _font.DrawStringAligned(spriteBatch, $"{value:F2}",
            new Vector2(rightEdge, y), FontSize.Small, TextAlign.Right, TextColor);
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
