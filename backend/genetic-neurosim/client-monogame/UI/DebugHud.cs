using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

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
    string? LastError)
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
    private const int GlyphWidth = 3;
    private const int GlyphHeight = 5;
    private const int GlyphSpacing = 1;
    private const int GlyphScale = 2;
    private const int RowHeight = 14;
    private const int PanelWidth = 330;

    private static readonly Color PanelColor = new(10, 12, 14, 184);
    private static readonly Color PanelBorderColor = new(255, 255, 255, 34);
    private static readonly Color TextColor = new(228, 235, 224, 230);
    private static readonly Color MutedTextColor = new(142, 154, 148, 220);
    private static readonly Color AccentColor = new(103, 188, 255, 220);
    private static readonly Color GoodColor = new(92, 220, 132, 220);
    private static readonly Color WarningColor = new(250, 195, 92, 230);
    private static readonly Color ErrorColor = new(245, 82, 82, 230);
    private static readonly Color BarBackColor = new(255, 255, 255, 28);

    private Texture2D? _pixel;
    private GraphicsDevice? _graphicsDevice;

    public void Draw(SpriteBatch spriteBatch, DebugHudState state)
    {
        Draw(spriteBatch, state, new Point(12, 12));
    }

    public void Draw(SpriteBatch spriteBatch, DebugHudState state, Point origin)
    {
        ArgumentNullException.ThrowIfNull(spriteBatch);
        ArgumentNullException.ThrowIfNull(state);

        EnsurePixel(spriteBatch.GraphicsDevice);

        var hasError = !string.IsNullOrWhiteSpace(state.LastError);
        var panelHeight = hasError ? 170 : 148;
        var panel = new Rectangle(origin.X, origin.Y, PanelWidth, panelHeight);

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.PointClamp);

        FillRect(spriteBatch, panel, PanelColor);
        DrawRectOutline(spriteBatch, panel, PanelBorderColor, 1);
        DrawStatusStrip(spriteBatch, panel, state);

        var x = panel.X + 10;
        var y = panel.Y + 10;
        DrawText(spriteBatch, "TRIBAL NEUROSIM V3", new Point(x, y), AccentColor);

        y += RowHeight + 2;
        DrawKeyValue(spriteBatch, x, y, "MODE", NormalizeMode(state), state.Paused ? WarningColor : TextColor);

        y += RowHeight;
        DrawKeyValue(spriteBatch, x, y, "TICK", ClampText(state.Tick.ToString(), 12), TextColor);
        DrawKeyValue(spriteBatch, x + 164, y, "TPS", Math.Max(0, state.TicksPerSecond).ToString(), TextColor);

        y += RowHeight;
        DrawKeyValue(spriteBatch, x, y, "TRIBES", Math.Max(0, state.LivingTribes).ToString(), TextColor);
        DrawKeyValue(spriteBatch, x + 164, y, "DISPUTES", Math.Max(0, state.DisputedTiles).ToString(), state.DisputedTiles > 0 ? WarningColor : TextColor);

        y += RowHeight + 2;
        DrawSelection(spriteBatch, state, x, y);

        y += RowHeight + 22;
        DrawConnectionAndControls(spriteBatch, state, x, y);

        if (hasError)
        {
            y += RowHeight + 4;
            FillRect(spriteBatch, new Rectangle(x - 2, y - 3, PanelWidth - 18, RowHeight + 6), new Color(90, 20, 20, 150));
            DrawText(spriteBatch, "ERR", new Point(x, y), ErrorColor);
            DrawText(spriteBatch, ClampText(state.LastError ?? string.Empty, 32), new Point(x + 32, y), TextColor);
        }

        spriteBatch.End();
    }

    public void Dispose()
    {
        _pixel?.Dispose();
        _pixel = null;
        _graphicsDevice = null;
    }

    private void EnsurePixel(GraphicsDevice graphicsDevice)
    {
        if (_pixel is not null && ReferenceEquals(_graphicsDevice, graphicsDevice))
        {
            return;
        }

        _pixel?.Dispose();
        _graphicsDevice = graphicsDevice;
        _pixel = new Texture2D(graphicsDevice, 1, 1);
        _pixel.SetData(new[] { Color.White });
    }

    private void DrawStatusStrip(SpriteBatch spriteBatch, Rectangle panel, DebugHudState state)
    {
        var strip = new Rectangle(panel.X, panel.Y, 4, panel.Height);
        var color = state.LastError is { Length: > 0 }
            ? ErrorColor
            : state.Paused
                ? WarningColor
                : state.IsConnected
                    ? GoodColor
                    : AccentColor;

        FillRect(spriteBatch, strip, color);
    }

    private void DrawKeyValue(SpriteBatch spriteBatch, int x, int y, string key, string value, Color valueColor)
    {
        DrawText(spriteBatch, key, new Point(x, y), MutedTextColor);
        DrawText(spriteBatch, value, new Point(x + 68, y), valueColor);
    }

    private void DrawSelection(SpriteBatch spriteBatch, DebugHudState state, int x, int y)
    {
        var selectedName = string.IsNullOrWhiteSpace(state.SelectedName)
            ? "NONE"
            : ClampText(state.SelectedName, 16);

        DrawKeyValue(spriteBatch, x, y, "SELECT", selectedName, TextColor);

        y += RowHeight;
        DrawText(spriteBatch, "POP", new Point(x, y), MutedTextColor);
        DrawNumberBar(spriteBatch, x + 34, y + 1, state.SelectedPopulation, 200, GoodColor);

        DrawText(spriteBatch, "FOOD", new Point(x + 164, y), MutedTextColor);
        DrawNumberBar(spriteBatch, x + 208, y + 1, (int)MathF.Round(Math.Max(0f, state.SelectedFood)), 500, AccentColor);
    }

    private void DrawConnectionAndControls(SpriteBatch spriteBatch, DebugHudState state, int x, int y)
    {
        DrawIndicator(spriteBatch, new Rectangle(x, y + 1, 8, 8), state.IsConnected ? GoodColor : WarningColor);
        DrawText(spriteBatch, state.IsConnected ? "NODE" : "LOCAL", new Point(x + 14, y), TextColor);

        DrawIndicator(spriteBatch, new Rectangle(x + 78, y + 1, 8, 8), state.Paused ? WarningColor : GoodColor);
        DrawText(spriteBatch, state.Paused ? "PAUSED" : "RUN", new Point(x + 92, y), TextColor);

        DrawText(spriteBatch, "SPACE N R TAB +/-", new Point(x + 170, y), MutedTextColor);
    }

    private void DrawNumberBar(SpriteBatch spriteBatch, int x, int y, int value, int softMax, Color fillColor)
    {
        var safeValue = Math.Max(0, value);
        var ratio = MathHelper.Clamp(softMax <= 0 ? 0f : safeValue / (float)softMax, 0f, 1f);
        var width = 72;
        var filled = (int)MathF.Round(width * ratio);

        FillRect(spriteBatch, new Rectangle(x, y + 1, width, 7), BarBackColor);
        if (filled > 0)
        {
            FillRect(spriteBatch, new Rectangle(x, y + 1, filled, 7), fillColor);
        }

        DrawRectOutline(spriteBatch, new Rectangle(x, y + 1, width, 7), PanelBorderColor, 1);
        DrawText(spriteBatch, ClampText(safeValue.ToString(), 5), new Point(x + width + 8, y), TextColor);
    }

    private void DrawIndicator(SpriteBatch spriteBatch, Rectangle rect, Color color)
    {
        FillRect(spriteBatch, rect, color);
        DrawRectOutline(spriteBatch, rect, new Color(0, 0, 0, 120), 1);
    }

    private void DrawText(SpriteBatch spriteBatch, string text, Point origin, Color color)
    {
        var x = origin.X;
        var upper = Sanitize(text);

        foreach (var character in upper)
        {
            if (character == ' ')
            {
                x += (GlyphWidth + GlyphSpacing) * GlyphScale;
                continue;
            }

            DrawGlyph(spriteBatch, character, new Point(x, origin.Y), color);
            x += (GlyphWidth + GlyphSpacing) * GlyphScale;
        }
    }

    private void DrawGlyph(SpriteBatch spriteBatch, char character, Point origin, Color color)
    {
        var pattern = GetGlyph(character);
        for (var row = 0; row < GlyphHeight; row++)
        {
            for (var column = 0; column < GlyphWidth; column++)
            {
                if (pattern[row][column] != '1')
                {
                    continue;
                }

                FillRect(
                    spriteBatch,
                    new Rectangle(
                        origin.X + column * GlyphScale,
                        origin.Y + row * GlyphScale,
                        GlyphScale,
                        GlyphScale),
                    color);
            }
        }
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

    private static string NormalizeMode(DebugHudState state)
    {
        if (state.Paused)
        {
            return "PAUSED";
        }

        return string.IsNullOrWhiteSpace(state.ModeText)
            ? "RUN"
            : ClampText(state.ModeText, 18);
    }

    private static string ClampText(string text, int maxLength)
    {
        if (string.IsNullOrEmpty(text) || maxLength <= 0)
        {
            return string.Empty;
        }

        return text.Length <= maxLength ? text : text[..maxLength];
    }

    private static string Sanitize(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return string.Empty;
        }

        Span<char> buffer = stackalloc char[Math.Min(text.Length, 64)];
        var count = 0;

        foreach (var raw in text)
        {
            if (count >= buffer.Length)
            {
                break;
            }

            var character = char.ToUpperInvariant(raw);
            buffer[count++] = IsSupported(character) ? character : ' ';
        }

        return new string(buffer[..count]);
    }

    private static bool IsSupported(char character)
    {
        return character is >= 'A' and <= 'Z'
            || character is >= '0' and <= '9'
            || character is ' ' or '-' or ':' or '/' or '.' or '+';
    }

    private static string[] GetGlyph(char character)
    {
        return character switch
        {
            'A' => new[] { "010", "101", "111", "101", "101" },
            'B' => new[] { "110", "101", "110", "101", "110" },
            'C' => new[] { "011", "100", "100", "100", "011" },
            'D' => new[] { "110", "101", "101", "101", "110" },
            'E' => new[] { "111", "100", "110", "100", "111" },
            'F' => new[] { "111", "100", "110", "100", "100" },
            'G' => new[] { "011", "100", "101", "101", "011" },
            'H' => new[] { "101", "101", "111", "101", "101" },
            'I' => new[] { "111", "010", "010", "010", "111" },
            'J' => new[] { "001", "001", "001", "101", "010" },
            'K' => new[] { "101", "101", "110", "101", "101" },
            'L' => new[] { "100", "100", "100", "100", "111" },
            'M' => new[] { "101", "111", "111", "101", "101" },
            'N' => new[] { "101", "111", "111", "111", "101" },
            'O' => new[] { "010", "101", "101", "101", "010" },
            'P' => new[] { "110", "101", "110", "100", "100" },
            'Q' => new[] { "010", "101", "101", "111", "011" },
            'R' => new[] { "110", "101", "110", "101", "101" },
            'S' => new[] { "011", "100", "010", "001", "110" },
            'T' => new[] { "111", "010", "010", "010", "010" },
            'U' => new[] { "101", "101", "101", "101", "111" },
            'V' => new[] { "101", "101", "101", "101", "010" },
            'W' => new[] { "101", "101", "111", "111", "101" },
            'X' => new[] { "101", "101", "010", "101", "101" },
            'Y' => new[] { "101", "101", "010", "010", "010" },
            'Z' => new[] { "111", "001", "010", "100", "111" },
            '0' => new[] { "111", "101", "101", "101", "111" },
            '1' => new[] { "010", "110", "010", "010", "111" },
            '2' => new[] { "111", "001", "111", "100", "111" },
            '3' => new[] { "111", "001", "111", "001", "111" },
            '4' => new[] { "101", "101", "111", "001", "001" },
            '5' => new[] { "111", "100", "111", "001", "111" },
            '6' => new[] { "111", "100", "111", "101", "111" },
            '7' => new[] { "111", "001", "010", "010", "010" },
            '8' => new[] { "111", "101", "111", "101", "111" },
            '9' => new[] { "111", "101", "111", "001", "111" },
            '-' => new[] { "000", "000", "111", "000", "000" },
            ':' => new[] { "000", "010", "000", "010", "000" },
            '/' => new[] { "001", "001", "010", "100", "100" },
            '.' => new[] { "000", "000", "000", "000", "010" },
            '+' => new[] { "000", "010", "111", "010", "000" },
            _ => new[] { "111", "001", "010", "000", "010" },
        };
    }
}
