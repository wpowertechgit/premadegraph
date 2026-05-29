using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Rendering;

namespace TribalNeuroSim.Client.UI;

/// <summary>One active war or border conflict to display in the WarDisputePanel.</summary>
public sealed record WarDisplayEntry(
    string AttackerLabel,
    string DefenderLabel,
    string ScaleLabel,
    ulong StartTick,
    ulong CurrentTick,
    Vector2? AttackerWorldPos,
    Vector2? DefenderWorldPos);

/// <summary>
/// Popup overlay listing active wars and dispute tile counts.
/// War rows are clickable — caller uses <see cref="ClickedWarIndex"/> to focus the camera.
/// </summary>
public sealed class WarDisputePanel
{
    public  const int PanelWidthConst = 430;
    private const int PanelWidth  = PanelWidthConst;
    private const int PanelMargin = 12;
    private const int RowHeight   = 40;

    private static readonly Color PanelColor    = new(10,  12,  16,  245);
    private static readonly Color BorderColor   = new(255, 255, 255, 40);
    private static readonly Color AccentColor   = new(103, 188, 255, 230);
    private static readonly Color TextColor     = new(228, 235, 224, 245);
    private static readonly Color MutedColor    = new(138, 150, 144, 210);
    private static readonly Color SectionBg     = new(30,  45,  65,  210);
    private static readonly Color WarFullColor  = new(230, 80,  80,  230);
    private static readonly Color WarBorderCol  = new(250, 195, 92,  240);
    private static readonly Color RowHoverColor = new(255, 255, 255, 20);
    private static readonly Color CloseBtnColor = new(200, 80,  80,  200);

    private Texture2D?   _pixel;
    private FontRenderer? _font;
    private GraphicsDevice? _gd;

    public Rectangle LastBounds { get; private set; } = Rectangle.Empty;

    private Rectangle         _closeBtnRect = Rectangle.Empty;
    private readonly List<Rectangle> _warRowRects = new();

    /// <summary>Index of the last-clicked war row, or -1. Call <see cref="ConsumeWarClick"/> after use.</summary>
    public int ClickedWarIndex { get; private set; } = -1;

    public void ConsumeWarClick() => ClickedWarIndex = -1;

    /// <returns>True when the close button was clicked (caller should hide the panel).</returns>
    public bool HandleMouseClick(int mx, int my)
    {
        if (_closeBtnRect != Rectangle.Empty && _closeBtnRect.Contains(mx, my))
            return true;

        for (var i = 0; i < _warRowRects.Count; i++)
        {
            if (_warRowRects[i].Contains(mx, my))
            {
                ClickedWarIndex = i;
                return false;
            }
        }
        return false;
    }

    public void Draw(
        SpriteBatch spriteBatch,
        IReadOnlyList<WarDisplayEntry> wars,
        int disputedTileCount,
        FontRenderer fontRenderer,
        Point origin,
        int mouseX,
        int mouseY)
    {
        ArgumentNullException.ThrowIfNull(spriteBatch);
        EnsureResources(spriteBatch.GraphicsDevice, fontRenderer);

        var lh = _font!.LineHeight(FontSize.Body);
        var sh = _font.LineHeight(FontSize.Small);
        var hh = _font.LineHeight(FontSize.Header);

        var warRows = Math.Max(1, wars.Count);
        var panelHeight =
            PanelMargin
            + hh + 6
            + sh + 8
            + warRows * RowHeight
            + 4
            + sh + 8
            + lh + 8
            + PanelMargin;

        var panel = new Rectangle(origin.X, origin.Y, PanelWidth, panelHeight);
        LastBounds = panel;
        _warRowRects.Clear();

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawOutline(spriteBatch, panel, BorderColor, 1);
        FillRect(spriteBatch, new Rectangle(panel.X, panel.Y, 4, panel.Height), WarFullColor with { A = 180 });

        var x = panel.X + PanelMargin + 4;
        var y = panel.Y + PanelMargin;

        // ── Title row ──────────────────────────────────────────────────
        _font.DrawString(spriteBatch, "WARS & DISPUTES", new Vector2(x, y), FontSize.Header, AccentColor);
        _closeBtnRect = new Rectangle(panel.Right - PanelMargin - 22, y, 22, hh);
        FillRect(spriteBatch, _closeBtnRect, CloseBtnColor with { A = 160 });
        DrawOutline(spriteBatch, _closeBtnRect, BorderColor, 1);
        _font.DrawString(spriteBatch, "X", new Vector2(_closeBtnRect.X + 7, y), FontSize.Body, TextColor);
        y += hh + 6;

        // ── Wars section ───────────────────────────────────────────────
        var warHeader = wars.Count > 0 ? $"ACTIVE WARS  ({wars.Count})" : "ACTIVE WARS  (none)";
        DrawSectionHeader(spriteBatch, panel.X + 4, y, PanelWidth - 8, sh, warHeader);
        y += sh + 8;

        if (wars.Count == 0)
        {
            _font.DrawString(spriteBatch, "no active wars", new Vector2(x + 4, y + 10), FontSize.Body, MutedColor);
            y += RowHeight;
        }
        else
        {
            foreach (var war in wars)
            {
                var rowRect = new Rectangle(panel.X + 4, y - 2, PanelWidth - 8, RowHeight);
                _warRowRects.Add(rowRect);

                var isHovered = rowRect.Contains(mouseX, mouseY);
                if (isHovered)
                    FillRect(spriteBatch, rowRect, RowHoverColor);
                FillRect(spriteBatch, new Rectangle(panel.X + 4, y - 2, PanelWidth - 8, 1),
                    new Color(255, 255, 255, 12));

                // Attacker ──► Defender
                var vsLine = $"{war.AttackerLabel}  ──►  {war.DefenderLabel}";
                _font.DrawString(spriteBatch, vsLine, new Vector2(x, y + 2), FontSize.Body, TextColor);

                // Scale tag + duration
                var scaleColor = war.ScaleLabel == "FULL SCALE" ? WarFullColor : WarBorderCol;
                _font.DrawString(spriteBatch, war.ScaleLabel, new Vector2(x, y + lh + 4), FontSize.Small, scaleColor);

                var elapsed   = war.CurrentTick >= war.StartTick ? war.CurrentTick - war.StartTick : 0;
                var durStr    = $"started t{war.StartTick}  (+{elapsed}t)";
                _font.DrawString(spriteBatch, durStr, new Vector2(x + 106, y + lh + 4), FontSize.Small, MutedColor);

                // Focus hint
                var hintColor = isHovered ? AccentColor : MutedColor with { A = 90 };
                _font.DrawString(spriteBatch, "▶ focus", new Vector2(panel.Right - PanelMargin - 54, y + lh + 4), FontSize.Small, hintColor);

                y += RowHeight;
            }
        }

        // ── Disputes section ───────────────────────────────────────────
        y += 4;
        DrawSectionHeader(spriteBatch, panel.X + 4, y, PanelWidth - 8, sh, "DISPUTED TILES");
        y += sh + 8;

        var dispColor = disputedTileCount > 0 ? WarBorderCol : MutedColor;
        var dispStr   = disputedTileCount > 0
            ? $"{disputedTileCount} tiles contested  (food yield ×0.60 in contested zone)"
            : "no tiles currently disputed";
        _font.DrawString(spriteBatch, dispStr, new Vector2(x, y + 2), FontSize.Body, dispColor);

        spriteBatch.End();
    }

    private void EnsureResources(GraphicsDevice gd, FontRenderer fontRenderer)
    {
        if (_pixel is not null && _font is not null && ReferenceEquals(_gd, gd)) return;
        _pixel?.Dispose();
        _gd = gd;
        _pixel = new Texture2D(gd, 1, 1);
        _pixel.SetData(new[] { Color.White });
        _font = fontRenderer;
    }

    private void DrawSectionHeader(SpriteBatch sb, int x, int y, int w, int sh, string label)
    {
        FillRect(sb, new Rectangle(x, y, w, sh + 2), SectionBg);
        _font!.DrawString(sb, label, new Vector2(x + 4, y + 1), FontSize.Small, AccentColor);
    }

    private void FillRect(SpriteBatch sb, Rectangle rect, Color color)
    {
        if (rect.Width <= 0 || rect.Height <= 0) return;
        sb.Draw(_pixel, rect, color);
    }

    private void DrawOutline(SpriteBatch sb, Rectangle rect, Color color, int t)
    {
        FillRect(sb, new Rectangle(rect.Left,      rect.Top,        rect.Width,  t));
        FillRect(sb, new Rectangle(rect.Left,      rect.Bottom - t, rect.Width,  t));
        FillRect(sb, new Rectangle(rect.Left,      rect.Top,        t,           rect.Height));
        FillRect(sb, new Rectangle(rect.Right - t, rect.Top,        t,           rect.Height));

        void FillRect(SpriteBatch s, Rectangle r) => s.Draw(_pixel, r, color);
    }
}
