using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Rendering;

namespace TribalNeuroSim.Client.UI;

public sealed class EscMenu : IDisposable
{
    private static readonly Color OverlayColor = new(0, 0, 0, 140);
    private static readonly Color PanelColor = new(12, 14, 16, 220);
    private static readonly Color BorderColor = new(255, 255, 255, 40);
    private static readonly Color AccentColor = new(103, 188, 255, 230);
    private static readonly Color TextColor = new(228, 235, 224, 240);
    private static readonly Color MutedColor = new(142, 154, 148, 180);
    private static readonly Color HoverColor = new(255, 255, 255, 20);
    private static readonly Color DangerColor = new(245, 82, 82, 230);

    private const int PanelWidth = 280;
    private const int PanelPadding = 18;
    private const int ButtonHeight = 34;
    private const int ButtonGap = 6;

    private Texture2D? _pixel;
    private FontRenderer? _font;
    private GraphicsDevice? _graphicsDevice;

    public bool IsOpen { get; private set; }
    public bool VerboseLogsEnabled { get; private set; }

    // Returns true if the game should exit
    public bool ExitRequested { get; private set; }

    public void Toggle() => IsOpen = !IsOpen;
    public void Close() => IsOpen = false;

    public void HandleMouseClick(int mouseX, int mouseY)
    {
        if (!IsOpen || _lastButtons is null) return;

        foreach (var (rect, action) in _lastButtons)
        {
            if (rect.Contains(mouseX, mouseY))
            {
                action();
                return;
            }
        }
    }

    private List<(Rectangle Rect, Action Action)>? _lastButtons;

    public void Draw(SpriteBatch spriteBatch, int mouseX, int mouseY)
    {
        if (!IsOpen) return;

        EnsureResources(spriteBatch.GraphicsDevice);
        var gd = spriteBatch.GraphicsDevice;
        var vp = gd.Viewport;

        _lastButtons = new List<(Rectangle, Action)>();

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        // Full-screen dim overlay
        spriteBatch.Draw(_pixel!, new Rectangle(0, 0, vp.Width, vp.Height), OverlayColor);

        var lineH = _font!.LineHeight(FontSize.Body);
        var headerH = _font.LineHeight(FontSize.Header);

        // Calculate panel height: title + spacer + 3 buttons + padding
        var panelH = PanelPadding * 2
            + headerH + 8
            + 3 * ButtonHeight + 2 * ButtonGap
            + 30; // key hint row

        var panelX = (vp.Width - PanelWidth) / 2;
        var panelY = (vp.Height - panelH) / 2;
        var panel = new Rectangle(panelX, panelY, PanelWidth, panelH);

        FillRect(spriteBatch, panel, PanelColor);
        DrawOutline(spriteBatch, panel, BorderColor, 1);
        FillRect(spriteBatch, new Rectangle(panel.X, panel.Y, 4, panel.Height), AccentColor);

        var cx = panel.X + PanelPadding + 4;
        var cy = panel.Y + PanelPadding;

        _font.DrawString(spriteBatch, "TRIBAL NEUROSIM v3", new Vector2(cx, cy), FontSize.Header, AccentColor);
        cy += headerH + 8;

        // Buttons
        DrawButton(spriteBatch, cx, cy, "Resume", TextColor, mouseX, mouseY, () => IsOpen = false);
        cy += ButtonHeight + ButtonGap;

        var verbLabel = VerboseLogsEnabled ? "Verbose Logs: ON" : "Verbose Logs: OFF";
        var verbColor = VerboseLogsEnabled ? new Color(92, 220, 132, 230) : MutedColor;
        DrawButton(spriteBatch, cx, cy, verbLabel, verbColor, mouseX, mouseY, () => VerboseLogsEnabled = !VerboseLogsEnabled);
        cy += ButtonHeight + ButtonGap;

        DrawButton(spriteBatch, cx, cy, "Exit", DangerColor, mouseX, mouseY, () => ExitRequested = true);
        cy += ButtonHeight + 12;

        _font.DrawString(spriteBatch, "ESC to resume  ·  click to select", new Vector2(cx, cy), FontSize.Small, MutedColor);

        spriteBatch.End();
    }

    private void DrawButton(
        SpriteBatch sb, int x, int y,
        string label, Color labelColor,
        int mouseX, int mouseY,
        Action onPress)
    {
        var rect = new Rectangle(x, y, PanelWidth - PanelPadding * 2, ButtonHeight);
        var hovered = rect.Contains(mouseX, mouseY);

        if (hovered)
            FillRect(sb, rect, HoverColor);

        DrawOutline(sb, rect, BorderColor, 1);
        var textY = y + (ButtonHeight - _font!.LineHeight(FontSize.Body)) / 2;
        _font.DrawString(sb, label, new Vector2(x + 10, textY), FontSize.Body, labelColor);

        _lastButtons!.Add((rect, onPress));
    }

    private void FillRect(SpriteBatch sb, Rectangle rect, Color color)
        => sb.Draw(_pixel!, rect, color);

    private void DrawOutline(SpriteBatch sb, Rectangle rect, Color color, int t)
    {
        FillRect(sb, new Rectangle(rect.Left, rect.Top, rect.Width, t), color);
        FillRect(sb, new Rectangle(rect.Left, rect.Bottom - t, rect.Width, t), color);
        FillRect(sb, new Rectangle(rect.Left, rect.Top, t, rect.Height), color);
        FillRect(sb, new Rectangle(rect.Right - t, rect.Top, t, rect.Height), color);
    }

    private void EnsureResources(GraphicsDevice gd)
    {
        if (_pixel is not null && _font is not null && ReferenceEquals(_graphicsDevice, gd)) return;
        _pixel?.Dispose();
        _font?.Dispose();
        _graphicsDevice = gd;
        _pixel = new Texture2D(gd, 1, 1);
        _pixel.SetData(new[] { Color.White });
        _font = new FontRenderer(gd, FontRole.Debug);
    }

    public void Dispose()
    {
        _pixel?.Dispose();
        _pixel = null;
        _font?.Dispose();
        _font = null;
        _graphicsDevice = null;
    }
}
