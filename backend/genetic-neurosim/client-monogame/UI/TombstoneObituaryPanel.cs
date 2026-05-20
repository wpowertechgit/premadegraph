using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Net;
using TribalNeuroSim.Client.Protocol;
using TribalNeuroSim.Client.Rendering;

namespace TribalNeuroSim.Client.UI;

public sealed class TombstoneObituaryPanel
{
    private const int PanelWidth = 380;
    private const int PanelMargin = 14;

    private static readonly Color PanelColor     = new(10, 12, 16, 255);
    private static readonly Color BorderColor     = new(255, 255, 255, 40);
    private static readonly Color AccentColor     = new(103, 188, 255, 230);
    private static readonly Color TextColor       = new(228, 235, 224, 245);
    private static readonly Color MutedColor      = new(138, 150, 144, 210);
    private static readonly Color SectionColor    = new(255, 255, 255, 14);
    private static readonly Color DeathColor      = new(220, 100, 100, 230);
    private static readonly Color MergerColor     = new(120, 210, 120, 220);
    private static readonly Color WarColor        = new(250, 195, 92, 240);
    private static readonly Color BarBgColor      = new(255, 255, 255, 18);
    private static readonly Color BarFgColor      = new(103, 188, 255, 180);
    private static readonly Color BarDeltaPos     = new(100, 220, 130, 200);
    private static readonly Color BarDeltaNeg     = new(220, 100, 100, 200);
    private static readonly Color CloseBtnColor   = new(200, 80, 80, 200);

    private Texture2D? _pixel;
    private FontRenderer? _font;
    private GraphicsDevice? _gd;

    public Rectangle LastBounds { get; private set; } = Rectangle.Empty;
    private Rectangle _closeBtnRect = Rectangle.Empty;

    public bool HandleMouseClick(int mx, int my)
    {
        if (_closeBtnRect != Rectangle.Empty && _closeBtnRect.Contains(mx, my))
            return true; // signals caller to close
        return false;
    }

    public void Draw(
        SpriteBatch spriteBatch,
        PlayableTribeTombstone tombstone,
        string tribeName,
        string? absorbedByName,
        FontRenderer fontRenderer,
        Point origin)
    {
        ArgumentNullException.ThrowIfNull(spriteBatch);

        if (_font is null || !ReferenceEquals(_gd, spriteBatch.GraphicsDevice))
        {
            _pixel?.Dispose();
            _gd = spriteBatch.GraphicsDevice;
            _pixel = new Texture2D(_gd, 1, 1);
            _pixel.SetData(new[] { Color.White });
            _font = fontRenderer;
        }

        var lh = _font.LineHeight(FontSize.Body);
        var sh = _font.LineHeight(FontSize.Small);
        var hh = _font.LineHeight(FontSize.Header);

        // Measure total height
        var panelHeight =
            PanelMargin                   // top
            + hh + 4                      // title row
            + lh + 2                      // fate row
            + lh + 2                      // died at tick
            + (tombstone.Reason == PlayableExtinctionReason.Combat ? lh + 2 : 0)  // war cause
            + (absorbedByName != null ? lh + 2 : 0)                               // absorbed by
            + 6 + sh + 6                  // artifacts header
            + 5 * (sh + 3)               // 5 initial artifact bars
            + 6 + sh + 6                  // artifacts at death header
            + 5 * (sh + 3)               // 5 final artifact bars
            + 6 + sh + 6                  // stats header
            + lh + 2                      // neural drive
            + lh + 2                      // polity tier
            + lh + 2                      // max population
            + lh + 2                      // max tiles
            + PanelMargin;               // bottom

        var panel = new Rectangle(origin.X, origin.Y, PanelWidth, panelHeight);
        LastBounds = panel;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        // Background
        FillRect(spriteBatch, panel, PanelColor);
        DrawOutline(spriteBatch, panel, BorderColor, 1);

        // Left accent strip
        var accentColor = tombstone.Reason switch
        {
            PlayableExtinctionReason.Combat  => DeathColor,
            PlayableExtinctionReason.Merger  => MergerColor,
            _                                => WarColor,
        };
        FillRect(spriteBatch, new Rectangle(panel.X, panel.Y, 4, panel.Height), accentColor with { A = 200 });

        var x = panel.X + PanelMargin + 4;
        var y = panel.Y + PanelMargin;
        var contentW = PanelWidth - PanelMargin * 2 - 4;

        // Title + close button
        _font.DrawString(spriteBatch, "OBITUARY", new Vector2(x, y), FontSize.Header, AccentColor);
        _font.DrawString(spriteBatch, tribeName, new Vector2(x + 90, y), FontSize.Header, TextColor);

        _closeBtnRect = new Rectangle(panel.Right - PanelMargin - 22, y, 22, hh);
        FillRect(spriteBatch, _closeBtnRect, CloseBtnColor with { A = 160 });
        DrawOutline(spriteBatch, _closeBtnRect, BorderColor, 1);
        _font.DrawString(spriteBatch, "X", new Vector2(_closeBtnRect.X + 7, y), FontSize.Body, TextColor);
        y += hh + 4;

        // Fate
        var (fateLabel, fateColor) = tombstone.Reason switch
        {
            PlayableExtinctionReason.Combat  => ("CONQUERED (absorbed)", DeathColor),
            PlayableExtinctionReason.Merger  => ("MERGED (alliance)", MergerColor),
            PlayableExtinctionReason.Starvation => ("STARVED (food collapse)", WarColor),
            _                                => ("UNKNOWN", MutedColor),
        };
        DrawLabelValue(spriteBatch, x, y, lh, "FATE", fateLabel, fateColor);
        y += lh + 2;

        DrawLabelValue(spriteBatch, x, y, lh, "DIED AT TICK", tombstone.Tick.ToString(), MutedColor);
        y += lh + 2;

        if (tombstone.Reason == PlayableExtinctionReason.Combat)
        {
            var warLabel = tombstone.WarCause switch
            {
                PlayableWarCause.HighAggression   => "High Aggression Drive",
                PlayableWarCause.SurvivalPressure => "Survival Event (food shortage)",
                PlayableWarCause.OpportunityWar   => "Opportunity War (territory pressure)",
                _                                 => "Unknown",
            };
            DrawLabelValue(spriteBatch, x, y, lh, "WAR CAUSE", warLabel, WarColor);
            y += lh + 2;
        }

        if (absorbedByName != null)
        {
            DrawLabelValue(spriteBatch, x, y, lh,
                tombstone.Reason == PlayableExtinctionReason.Merger ? "MERGED INTO" : "ABSORBED BY",
                absorbedByName, MutedColor);
            y += lh + 2;
        }

        // Initial artifacts section
        y += 6;
        DrawSectionHeader(spriteBatch, x, y, contentW, sh, "INITIAL ARTIFACTS");
        y += sh + 6;
        DrawArtifactBars(spriteBatch, x, y, contentW, sh, tombstone.InitialArtifacts, null);
        y += 5 * (sh + 3);

        // Artifacts at death section
        y += 6;
        DrawSectionHeader(spriteBatch, x, y, contentW, sh, "ARTIFACTS AT DEATH");
        y += sh + 6;
        DrawArtifactBars(spriteBatch, x, y, contentW, sh, tombstone.ArtifactsAtDeath, tombstone.InitialArtifacts);
        y += 5 * (sh + 3);

        // Stats section
        y += 6;
        DrawSectionHeader(spriteBatch, x, y, contentW, sh, "LIFETIME STATS");
        y += sh + 6;

        var topDrive = TopDriveLabel(tombstone.ArtifactsAtDeath);
        DrawLabelValue(spriteBatch, x, y, lh, "NEURAL DRIVE", topDrive, AccentColor);
        y += lh + 2;

        DrawLabelValue(spriteBatch, x, y, lh, "POLITY TIER", tombstone.PolityTierReached.ToString().ToUpperInvariant(), AccentColor);
        y += lh + 2;

        DrawLabelValue(spriteBatch, x, y, lh, "MAX POPULATION", tombstone.MaxPopulationReached.ToString("N0"), TextColor);
        y += lh + 2;

        DrawLabelValue(spriteBatch, x, y, lh, "MAX TILES", tombstone.MaxTilesReached.ToString(), TextColor);
        y += lh + 2;

        spriteBatch.End();
    }

    public void DrawNetwork(
        SpriteBatch spriteBatch,
        TombstoneFounderDto record,
        FontRenderer fontRenderer,
        Point origin)
    {
        ArgumentNullException.ThrowIfNull(spriteBatch);

        if (_font is null || !ReferenceEquals(_gd, spriteBatch.GraphicsDevice))
        {
            _pixel?.Dispose();
            _gd = spriteBatch.GraphicsDevice;
            _pixel = new Texture2D(_gd, 1, 1);
            _pixel.SetData(new[] { Color.White });
            _font = fontRenderer;
        }

        var lh = _font.LineHeight(FontSize.Body);
        var sh = _font.LineHeight(FontSize.Small);
        var hh = _font.LineHeight(FontSize.Header);
        var founderCount = record.FounderPuuids.Count;
        var hasArtifacts = record.FinalArtifacts is not null;

        var cause = record.Cause ?? string.Empty;

        // Parse cause string for conqueror/absorber tribe ID
        string? byTribeId = null;
        if (cause.StartsWith("conquered-by-") || cause.StartsWith("absorbed-by-"))
            byTribeId = cause[(cause.LastIndexOf('-') + 1)..];

        // Fate label derived from cause string
        var (fateLabel, fateColor, accentColor) = cause switch
        {
            var c when c.StartsWith("conquered") => ("CONQUERED (absorbed)", DeathColor,  DeathColor),
            var c when c.StartsWith("absorbed")  => ("MERGED (alliance)",    MergerColor, MergerColor),
            "starved"                             => ("STARVED (food collapse)", WarColor, WarColor),
            "imploded"                            => ("IMPLODED",             WarColor,    WarColor),
            _                                    => ("UNKNOWN",               MutedColor,  AccentColor),
        };

        var panelHeight =
            PanelMargin
            + hh + 4                          // title
            + lh + 2                          // fate
            + (byTribeId != null ? lh + 2 : 0) // by tribe
            + lh + 2                          // died at tick
            + lh + 2                          // cluster
            + lh + 2                          // generation
            + lh + 2                          // pop at death / max pop
            + lh + 2                          // tiles at death
            + lh + 2                          // polity tier
            + (hasArtifacts ? 6 + sh + 6 + 5 * (sh + 3) : 0)  // artifact section
            + 6 + sh + 6                      // founders section header
            + Math.Max(1, founderCount) * (lh + sh + 5)  // name + puuid per founder
            + PanelMargin;

        var panel = new Rectangle(origin.X, origin.Y, PanelWidth, panelHeight);
        LastBounds = panel;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawOutline(spriteBatch, panel, BorderColor, 1);
        FillRect(spriteBatch, new Rectangle(panel.X, panel.Y, 4, panel.Height), accentColor with { A = 200 });

        var x = panel.X + PanelMargin + 4;
        var y = panel.Y + PanelMargin;
        var contentW = PanelWidth - PanelMargin * 2 - 4;

        _font.DrawString(spriteBatch, "OBITUARY", new Vector2(x, y), FontSize.Header, AccentColor);
        _font.DrawString(spriteBatch, $"Tribe {record.TribeId}", new Vector2(x + 90, y), FontSize.Header, TextColor);

        _closeBtnRect = new Rectangle(panel.Right - PanelMargin - 22, y, 22, hh);
        FillRect(spriteBatch, _closeBtnRect, CloseBtnColor with { A = 160 });
        DrawOutline(spriteBatch, _closeBtnRect, BorderColor, 1);
        _font.DrawString(spriteBatch, "X", new Vector2(_closeBtnRect.X + 7, y), FontSize.Body, TextColor);
        y += hh + 4;

        DrawLabelValue(spriteBatch, x, y, lh, "FATE", fateLabel, fateColor);
        y += lh + 2;

        if (byTribeId != null)
        {
            var byLabel = cause.StartsWith("absorbed") ? "MERGED INTO" : "ABSORBED BY";
            DrawLabelValue(spriteBatch, x, y, lh, byLabel, $"Tribe {byTribeId}", MutedColor);
            y += lh + 2;
        }

        DrawLabelValue(spriteBatch, x, y, lh, "DIED AT TICK", record.TickDied.ToString(), MutedColor);
        y += lh + 2;

        DrawLabelValue(spriteBatch, x, y, lh, "CLUSTER", record.ClusterId, AccentColor);
        y += lh + 2;

        DrawLabelValue(spriteBatch, x, y, lh, "GENERATION", record.GenerationDied.ToString(), TextColor);
        y += lh + 2;

        var popStr = cause.StartsWith("conquered") || cause.StartsWith("absorbed")
            ? $"transferred (max: {record.MaxPopulation:N0})"
            : $"{record.PopulationAtDeath:N0} / {record.MaxPopulation:N0}";
        DrawLabelValue(spriteBatch, x, y, lh, "POP AT DEATH", popStr, TextColor);
        y += lh + 2;

        DrawLabelValue(spriteBatch, x, y, lh, "TILES AT DEATH", record.TerritoryAtDeath.ToString(), TextColor);
        y += lh + 2;

        DrawLabelValue(spriteBatch, x, y, lh, "POLITY TIER", (record.PolityTierReached ?? "UNKNOWN").ToUpperInvariant(), AccentColor);
        y += lh + 2;

        if (hasArtifacts)
        {
            y += 6;
            DrawSectionHeader(spriteBatch, x, y, contentW, sh, "NEURAL ARTIFACTS AT DEATH");
            y += sh + 6;

            var art = record.FinalArtifacts!;
            var av = new ArtifactVector(art.Combat, art.Risk, art.Resource, art.MapObjective, art.Team);
            DrawArtifactBars(spriteBatch, x, y, contentW, sh, av, null);
            y += 5 * (sh + 3);
        }

        y += 6;
        DrawSectionHeader(spriteBatch, x, y, contentW, sh, "FOUNDERS");
        y += sh + 6;

        if (founderCount == 0)
        {
            _font.DrawString(spriteBatch, "no founders linked", new Vector2(x, y), FontSize.Small, MutedColor);
        }
        else
        {
            for (var i = 0; i < founderCount; i++)
            {
                var puuid = record.FounderPuuids[i];
                var rawName = record.FounderNames is { Count: > 0 } fn && i < fn.Count ? fn[i] : null;
                // treat as unnamed if null, empty, or identical to the puuid (no DB entry)
                var isUnnamed = string.IsNullOrEmpty(rawName) || rawName == puuid;
                var name = isUnnamed ? "—" : rawName!;
                var puuidDisplay = puuid.Length > 34 ? puuid[..34] : puuid;

                _font.DrawString(spriteBatch, name, new Vector2(x, y), FontSize.Body, TextColor);
                y += lh;
                _font.DrawString(spriteBatch, puuidDisplay, new Vector2(x + 4, y), FontSize.Small, MutedColor);
                y += sh + 5;
            }
        }

        spriteBatch.End();
    }

    private void DrawSectionHeader(SpriteBatch sb, int x, int y, int w, int sh, string label)
    {
        FillRect(sb, new Rectangle(x, y, w, sh + 2), SectionColor);
        _font!.DrawString(sb, label, new Vector2(x + 4, y + 1), FontSize.Small, AccentColor);
    }

    private void DrawLabelValue(SpriteBatch sb, int x, int y, int lh, string label, string value, Color valueColor)
    {
        _font!.DrawString(sb, label, new Vector2(x, y), FontSize.Body, MutedColor);
        _font!.DrawString(sb, value, new Vector2(x + 150, y), FontSize.Body, valueColor);
    }

    private void DrawArtifactBars(SpriteBatch sb, int x, int y, int contentW, int sh, ArtifactVector current, ArtifactVector? baseline)
    {
        var artifacts = new (string Label, float Value, float? BaseValue)[]
        {
            ("COMBAT",    current.Combat,       baseline?.Combat),
            ("RESOURCE",  current.Resource,     baseline?.Resource),
            ("EXPANSION", current.MapObjective, baseline?.MapObjective),
            ("RISK",      current.Risk,         baseline?.Risk),
            ("ALLIANCE",  current.Team,         baseline?.Team),
        };

        var labelW = 72;
        var barX    = x + labelW;
        var barW    = contentW - labelW - 60;
        var valX    = barX + barW + 6;

        foreach (var (label, value, baseValue) in artifacts)
        {
            _font!.DrawString(sb, label, new Vector2(x, y + 1), FontSize.Small, MutedColor);

            // Background bar
            FillRect(sb, new Rectangle(barX, y + 2, barW, sh - 4), BarBgColor);
            // Fill bar
            var fillW = (int)(barW * Math.Clamp(value, 0f, 1f));
            FillRect(sb, new Rectangle(barX, y + 2, fillW, sh - 4), BarFgColor);

            // Value text
            var valStr = $"{value:0.00}";
            _font!.DrawString(sb, valStr, new Vector2(valX, y), FontSize.Small, TextColor);

            // Delta vs baseline
            if (baseValue.HasValue)
            {
                var delta = value - baseValue.Value;
                if (MathF.Abs(delta) >= 0.005f)
                {
                    var deltaStr = delta > 0 ? $"+{delta:0.00}" : $"{delta:0.00}";
                    var deltaColor = delta > 0 ? BarDeltaPos : BarDeltaNeg;
                    _font!.DrawString(sb, deltaStr, new Vector2(valX + 38, y), FontSize.Small, deltaColor);
                }
            }

            y += sh + 3;
        }
    }

    private static string TopDriveLabel(ArtifactVector a)
    {
        var drives = new (string Label, float Value)[]
        {
            ("Combat (Aggression)", a.Combat),
            ("Resource (Economy)",  a.Resource),
            ("Expansion (Goals)",   a.MapObjective),
            ("Risk (Boldness)",     a.Risk),
            ("Alliance (Team)",     a.Team),
        };
        return drives.MaxBy(d => d.Value).Label;
    }

    private void FillRect(SpriteBatch sb, Rectangle rect, Color color)
    {
        if (rect.Width <= 0 || rect.Height <= 0) return;
        sb.Draw(_pixel, rect, color);
    }

    private void DrawOutline(SpriteBatch sb, Rectangle rect, Color color, int t)
    {
        FillRect(sb, new Rectangle(rect.Left, rect.Top, rect.Width, t), color);
        FillRect(sb, new Rectangle(rect.Left, rect.Bottom - t, rect.Width, t), color);
        FillRect(sb, new Rectangle(rect.Left, rect.Top, t, rect.Height), color);
        FillRect(sb, new Rectangle(rect.Right - t, rect.Top, t, rect.Height), color);
    }
}
