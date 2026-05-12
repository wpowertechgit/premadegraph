using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Protocol;
using TribalNeuroSim.Client.Rendering;

namespace TribalNeuroSim.Client.UI;

public sealed class SelectionPanel
{
    public const int PanelWidth = 340;
    public const int PanelMargin = 12;
    private const int ViewportMargin = 12;

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
    public Rectangle LastBounds { get; private set; } = Rectangle.Empty;

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
        var selectedTile = simulation.SelectedTileId >= 0 && simulation.SelectedTileId < simulation.Tiles.Count
            ? simulation.Tiles[simulation.SelectedTileId]
            : null;

        if (selected is null && selectedTile is null)
        {
            DrawEmptyState(spriteBatch, origin);
            return;
        }

        var lineHeight = _font.LineHeight(FontSize.Body);
        var smallHeight = _font.LineHeight(FontSize.Small);
        var headerHeight = _font.LineHeight(FontSize.Header);

        var panel = ResolvePanelBounds(
            spriteBatch.GraphicsDevice.Viewport,
            lineHeight,
            smallHeight,
            headerHeight,
            hasSelection: selected is not null,
            preferredOrigin: origin);
        var dynamicHeight = MeasureDynamicHeight(simulation, selected, selectedTile, lineHeight, smallHeight, headerHeight);
        var clampedY = Math.Clamp(panel.Y, ViewportMargin,
            Math.Max(ViewportMargin, spriteBatch.GraphicsDevice.Viewport.Height - dynamicHeight - ViewportMargin));
        panel = new Rectangle(panel.X, clampedY, panel.Width, dynamicHeight);
        LastBounds = panel;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawRectOutline(spriteBatch, panel, PanelBorderColor, 1);

        var x = panel.X + PanelMargin;
        var y = panel.Y + PanelMargin;

        if (selected is not null)
        {
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

            _font.DrawString(spriteBatch, "Population", new Vector2(x, y), FontSize.Body, MutedColor);
            _font.DrawStringAligned(spriteBatch, selected.Population.ToString(),
                new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right, TextColor);
            y += lineHeight;

            var popMax = 250;
            var popRatio = MathHelper.Clamp(selected.Population / (float)popMax, 0f, 1f);
            var barY = y - 2;
            FillRect(spriteBatch, new Rectangle(x, barY, PanelWidth - PanelMargin * 2, 5), new Color(255, 255, 255, 20));
            FillRect(spriteBatch, new Rectangle(x, barY, (int)((PanelWidth - PanelMargin * 2) * popRatio), 5), GoodColor);

            y += 4;

            _font.DrawString(spriteBatch, "Food", new Vector2(x, y), FontSize.Body, MutedColor);
            var foodColor = selected.FoodStores > 10 ? AccentColor : WarningColor;
            _font.DrawStringAligned(spriteBatch, $"{selected.FoodStores:F0}",
                new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right, foodColor);
            y += lineHeight;

            _font.DrawString(spriteBatch, "Territory", new Vector2(x, y), FontSize.Body, MutedColor);
            _font.DrawStringAligned(spriteBatch, $"{selected.Territory.Count} tiles",
                new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right, TextColor);
            y += lineHeight;

            var disputeCount = simulation.Tiles.Count(t =>
                t.IsDisputed && t.Controls.Any(c => c.TribeId == selected.Id));
            _font.DrawString(spriteBatch, "Disputes", new Vector2(x, y), FontSize.Body, MutedColor);
            _font.DrawStringAligned(spriteBatch, disputeCount > 0 ? $"{disputeCount} (-40%)" : "none",
                new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right,
                disputeCount > 0 ? WarningColor : MutedColor);
            y += lineHeight + 4;

            FillRect(spriteBatch, new Rectangle(x, y, PanelWidth - PanelMargin * 2, 1), new Color(255, 255, 255, 20));
            y += 6;

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
            y += lineHeight + 4;

            DrawSectionDivider(spriteBatch, x, ref y);
            _font.DrawString(spriteBatch, "Polity", new Vector2(x, y), FontSize.Small, MutedColor);
            y += lineHeight;

            var dominant = TribeVisuals.DominantStat(selected.Artifacts);
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Behavior", TribeVisuals.RoleLabel(selected.Artifacts), TextColor);
            y += lineHeight;
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Focus", dominant, AccentColor);
            y += lineHeight;

            if (selected.MemberTribes.Count > 1)
            {
                var memberLines = selected.MemberTribes
                    .OrderByDescending(member => member.IsLeader)
                    .ThenBy(member => member.TribeId)
                    .Take(4)
                    .ToArray();

                foreach (var member in memberLines)
                {
                    var label = member.IsLeader ? "Leader" : "Subordinate";
                    DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin,
                        label, $"{member.TribeName} - {member.Role}", member.IsLeader ? GoodColor : TextColor);
                    y += lineHeight;
                }
            }
            else
            {
                DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Members", "Independent tribe", MutedColor);
                y += lineHeight;
            }
        }

        if (selectedTile is not null)
        {
            DrawSectionDivider(spriteBatch, x, ref y);
            _font.DrawString(spriteBatch, "Tile", new Vector2(x, y), FontSize.Small, MutedColor);
            y += lineHeight;

            var ownerClaim = selectedTile.Controls
                .OrderByDescending(control => control.ControlShare)
                .FirstOrDefault();
            var ownerName = ownerClaim is null
                ? "Neutral"
                : simulation.Tribes.FirstOrDefault(t => t.Id == ownerClaim.TribeId)?.Name ?? $"Tribe {ownerClaim.TribeId}";
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Biome", selectedTile.Biome.ToString(), TextColor);
            y += lineHeight;
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Food", $"{selectedTile.Food:0}/{selectedTile.MaxFood:0}", AccentColor);
            y += lineHeight;
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Control", ownerName, TextColor);
            y += lineHeight;
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Dispute",
                selectedTile.IsDisputed ? $"{selectedTile.Controls.Count} claimants" : "none",
                selectedTile.IsDisputed ? WarningColor : MutedColor);
        }

        spriteBatch.End();
    }

    /// Network-mode overload: renders selection panel from V1 frame data instead of PlayableSimulation.
    public void DrawNetwork(
        SpriteBatch spriteBatch,
        TribeFrameV1Record? tribe,
        RenderableTile? selectedTile,
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

        if (tribe is null && selectedTile is null)
        {
            DrawEmptyState(spriteBatch, origin);
            return;
        }

        var lineHeight = _font.LineHeight(FontSize.Body);
        var smallHeight = _font.LineHeight(FontSize.Small);
        var headerHeight = _font.LineHeight(FontSize.Header);

        var dynamicHeight = PanelMargin * 2;
        if (tribe is not null)
        {
            dynamicHeight += headerHeight + 6
                + lineHeight       // population
                + 4                // bar
                + lineHeight       // food
                + lineHeight       // territory
                + 1 + 6            // separator
                + smallHeight + 4  // artifacts header
                + lineHeight * 5   // artifact rows
                + 1 + 6 + smallHeight + 2 + lineHeight * 2  // polity section
                // E2: brain / fitness / migration
                + 1 + 6 + smallHeight + 2 + lineHeight * 3  // status section
                + 1 + 6 + smallHeight + 2 + lineHeight * 7; // neural outputs
        }
        if (selectedTile is not null)
        {
            dynamicHeight += 1 + 6 + smallHeight + 2 + lineHeight * 3;
        }

        var panel = ResolvePanelBounds(
            spriteBatch.GraphicsDevice.Viewport,
            lineHeight, smallHeight, headerHeight,
            hasSelection: tribe is not null,
            preferredOrigin: origin);
        panel = new Rectangle(panel.X, panel.Y, panel.Width, dynamicHeight);
        LastBounds = panel;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawRectOutline(spriteBatch, panel, PanelBorderColor, 1);

        var x = panel.X + PanelMargin;
        var y = panel.Y + PanelMargin;

        if (tribe is not null)
        {
            var tierLabel = PlayableRenderAdapter.RustPolityTierToPolityTier(tribe.PolityTier).ToString().ToUpperInvariant();
            var tierWidth = (int)_font.Measure(tierLabel, FontSize.Small).X + 10;
            _font.DrawString(spriteBatch, $"Tribe {tribe.Id}", new Vector2(x, y), FontSize.Header, TextColor);
            FillRect(spriteBatch, new Rectangle(panel.Right - PanelMargin - tierWidth - 4, y + 1, tierWidth, smallHeight), new Color(TierColor, 50));
            DrawRectOutline(spriteBatch, new Rectangle(panel.Right - PanelMargin - tierWidth - 4, y + 1, tierWidth, smallHeight), TierColor, 1);
            _font.DrawStringAligned(spriteBatch, tierLabel, new Vector2(panel.Right - PanelMargin - 5, y + 2), FontSize.Small, TextAlign.Right, TierColor);
            y += headerHeight + 6;

            _font.DrawString(spriteBatch, "Population", new Vector2(x, y), FontSize.Body, MutedColor);
            _font.DrawStringAligned(spriteBatch, tribe.Population.ToString(), new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right, TextColor);
            y += lineHeight;

            var popRatio = MathHelper.Clamp(tribe.Population / 500f, 0f, 1f);
            FillRect(spriteBatch, new Rectangle(x, y - 2, PanelWidth - PanelMargin * 2, 5), new Color(255, 255, 255, 20));
            FillRect(spriteBatch, new Rectangle(x, y - 2, (int)((PanelWidth - PanelMargin * 2) * popRatio), 5), GoodColor);
            y += 4;

            _font.DrawString(spriteBatch, "Food", new Vector2(x, y), FontSize.Body, MutedColor);
            var foodColor = tribe.FoodStores > 10 ? AccentColor : WarningColor;
            _font.DrawStringAligned(spriteBatch, $"{tribe.FoodStores:F0}", new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right, foodColor);
            y += lineHeight;

            _font.DrawString(spriteBatch, "Territory", new Vector2(x, y), FontSize.Body, MutedColor);
            _font.DrawStringAligned(spriteBatch, $"{tribe.TerritoryCount} tiles", new Vector2(panel.Right - PanelMargin, y), FontSize.Body, TextAlign.Right, TextColor);
            y += lineHeight;

            DrawSectionDivider(spriteBatch, x, ref y);
            _font.DrawString(spriteBatch, "Artifacts", new Vector2(x, y), FontSize.Small, MutedColor);
            y += lineHeight;
            DrawArtifactRow(spriteBatch, x, y, lineHeight, panel.Right - PanelMargin, "Combat", tribe.Artifacts.Combat);
            y += lineHeight;
            DrawArtifactRow(spriteBatch, x, y, lineHeight, panel.Right - PanelMargin, "Resource", tribe.Artifacts.Resource);
            y += lineHeight;
            DrawArtifactRow(spriteBatch, x, y, lineHeight, panel.Right - PanelMargin, "Map Obj", tribe.Artifacts.MapObjective);
            y += lineHeight;
            DrawArtifactRow(spriteBatch, x, y, lineHeight, panel.Right - PanelMargin, "Risk", tribe.Artifacts.Risk);
            y += lineHeight;
            DrawArtifactRow(spriteBatch, x, y, lineHeight, panel.Right - PanelMargin, "Team", tribe.Artifacts.Team);
            y += lineHeight;

            DrawSectionDivider(spriteBatch, x, ref y);
            _font.DrawString(spriteBatch, "Polity", new Vector2(x, y), FontSize.Small, MutedColor);
            y += lineHeight;
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Behavior", TribeVisuals.RoleLabel(tribe.Artifacts), TextColor);
            y += lineHeight;
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Focus", TribeVisuals.DominantStat(tribe.Artifacts), AccentColor);
            y += lineHeight;

            // E2: brain / migration / fitness status
            DrawSectionDivider(spriteBatch, x, ref y);
            _font.DrawString(spriteBatch, "Status", new Vector2(x, y), FontSize.Small, MutedColor);
            y += lineHeight;
            var fitnessColor = tribe.FitnessScore >= 0.6f ? GoodColor : tribe.FitnessScore >= 0.3f ? AccentColor : WarningColor;
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Fitness", $"{tribe.FitnessScore:F3}", fitnessColor);
            y += lineHeight;
            var migrationLabel = tribe.IsMigrating ? $"→ tile {tribe.MigrationTargetTile}" : "settled";
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Migration", migrationLabel, tribe.IsMigrating ? WarningColor : MutedColor);
            y += lineHeight;
            var allyLabel = tribe.HasAlly ? $"tribe {tribe.AllyTribeId}" : "none";
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Ally", allyLabel, tribe.HasAlly ? GoodColor : MutedColor);
            y += lineHeight;

            // E2: neural outputs (7 drives)
            DrawSectionDivider(spriteBatch, x, ref y);
            _font.DrawString(spriteBatch, "Neural Drives", new Vector2(x, y), FontSize.Small, MutedColor);
            y += lineHeight;
            string[] driveLabels = ["Aggression", "Resource", "Goal", "Migration", "Raid", "Isolation", "Expansion"];
            for (var i = 0; i < Math.Min(tribe.NeuralOutputs.Length, driveLabels.Length); i++)
            {
                DrawNeuralBar(spriteBatch, x, y, panel.Right - PanelMargin, driveLabels[i], tribe.NeuralOutputs[i]);
                y += lineHeight;
            }
        }

        if (selectedTile is not null)
        {
            DrawSectionDivider(spriteBatch, x, ref y);
            _font.DrawString(spriteBatch, "Tile", new Vector2(x, y), FontSize.Small, MutedColor);
            y += lineHeight;
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Biome", selectedTile.Value.Biome.ToString(), TextColor);
            y += lineHeight;
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Food", $"{selectedTile.Value.FoodAmount:F0}/{selectedTile.Value.MaxFoodAmount:F0}", AccentColor);
            y += lineHeight;
            DrawCompactRow(spriteBatch, x, y, panel.Right - PanelMargin, "Dispute", selectedTile.Value.IsDisputed ? "contested" : "none",
                selectedTile.Value.IsDisputed ? WarningColor : MutedColor);
            y += lineHeight;
        }

        spriteBatch.End();
    }

    private void DrawEmptyState(SpriteBatch spriteBatch, Point origin)
    {
        var lineHeight = _font!.LineHeight(FontSize.Body);
        var panel = ResolvePanelBounds(
            spriteBatch.GraphicsDevice.Viewport,
            lineHeight,
            _font.LineHeight(FontSize.Small),
            _font.LineHeight(FontSize.Header),
            hasSelection: false,
            preferredOrigin: origin);
        LastBounds = panel;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawRectOutline(spriteBatch, panel, PanelBorderColor, 1);

        _font.DrawString(spriteBatch, "No tribe selected",
            new Vector2(panel.X + PanelMargin, panel.Y + PanelMargin + 3),
            FontSize.Body, MutedColor);
        _font.DrawString(spriteBatch, "Click a tribe to inspect",
            new Vector2(panel.X + PanelMargin, panel.Y + PanelMargin + 3 + lineHeight),
            FontSize.Small, MutedColor);

        spriteBatch.End();
    }

    public static int MeasurePanelHeight(int lineHeight, int smallHeight, int headerHeight, bool hasSelection)
    {
        if (!hasSelection)
            return PanelMargin * 2 + lineHeight + smallHeight + 10;

        return PanelMargin * 2
             + headerHeight + 6
             + lineHeight       // population label/value
             + 4                // population bar
             + lineHeight       // food
             + lineHeight       // territory
             + lineHeight + 4   // disputes
             + 1 + 6            // separator
             + smallHeight + 4  // artifacts label
             + lineHeight * 5   // artifact rows
             + 4;
    }

    private static int MeasureDynamicHeight(
        PlayableSimulation simulation,
        PlayableTribe? selected,
        PlayableTile? selectedTile,
        int lineHeight,
        int smallHeight,
        int headerHeight)
    {
        var height = MeasurePanelHeight(lineHeight, smallHeight, headerHeight, selected is not null);

        if (selected is not null)
        {
            height += 1 + 6 + smallHeight + 2; // section divider + title
            height += lineHeight * 2; // behavior + focus
            height += lineHeight * Math.Clamp(selected.MemberTribes.Count > 1 ? Math.Min(selected.MemberTribes.Count, 4) : 1, 1, 4);
        }

        if (selectedTile is not null)
        {
            height += 1 + 6 + smallHeight + 2;
            height += lineHeight * 4;
        }

        return height;
    }

    public static Rectangle ResolvePanelBounds(
        Viewport viewport,
        int lineHeight,
        int smallHeight,
        int headerHeight,
        bool hasSelection,
        Point? preferredOrigin = null)
    {
        var height = MeasurePanelHeight(lineHeight, smallHeight, headerHeight, hasSelection);
        var origin = preferredOrigin ?? new Point(viewport.Width - PanelWidth - ViewportMargin, ViewportMargin);
        var x = Math.Clamp(origin.X, ViewportMargin, Math.Max(ViewportMargin, viewport.Width - PanelWidth - ViewportMargin));
        var y = Math.Clamp(origin.Y, ViewportMargin, Math.Max(ViewportMargin, viewport.Height - height - ViewportMargin));
        return new Rectangle(x, y, PanelWidth, height);
    }

    private void DrawNeuralBar(SpriteBatch spriteBatch, int x, int y, int rightEdge,
        string label, float value)
    {
        _font!.DrawString(spriteBatch, label, new Vector2(x + 8, y), FontSize.Small, MutedColor);
        var barWidth = 90;
        var barX = rightEdge - barWidth - 36;
        var clamped = MathHelper.Clamp(value, 0f, 1f);
        FillRect(spriteBatch, new Rectangle(barX, y + 4, barWidth, 4), new Color(255, 255, 255, 18));
        var barColor = value >= 0.7f ? WarningColor : value >= 0.4f ? AccentColor : GoodColor;
        FillRect(spriteBatch, new Rectangle(barX, y + 4, (int)(barWidth * clamped), 4), barColor);
        _font.DrawStringAligned(spriteBatch, $"{value:F2}",
            new Vector2(rightEdge, y), FontSize.Small, TextAlign.Right, TextColor);
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

    private void DrawCompactRow(SpriteBatch spriteBatch, int x, int y, int rightEdge, string label, string value, Color valueColor)
    {
        _font!.DrawString(spriteBatch, label, new Vector2(x, y), FontSize.Small, MutedColor);
        _font.DrawStringAligned(spriteBatch, value, new Vector2(rightEdge, y), FontSize.Small, TextAlign.Right, valueColor);
    }

    private void DrawSectionDivider(SpriteBatch spriteBatch, int x, ref int y)
    {
        FillRect(spriteBatch, new Rectangle(x, y, PanelWidth - PanelMargin * 2, 1), new Color(255, 255, 255, 20));
        y += 6;
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
