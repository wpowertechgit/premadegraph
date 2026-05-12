using System.Collections.Concurrent;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Color = Microsoft.Xna.Framework.Color;
using Rectangle = Microsoft.Xna.Framework.Rectangle;

namespace TribalNeuroSim.Client.Rendering;

public enum FontRole
{
    /// <summary>Cinzel (headers) + Noto Serif (body/small) — polity names, panels, dossiers.</summary>
    Display,
    /// <summary>Trykker (or Consolas fallback) — debug HUD overlay.</summary>
    Debug,
}

public enum FontSize
{
    Body,
    Header,
    Small,
}

public enum TextAlign
{
    Left,
    Center,
    Right,
}

public sealed class FontRenderer : IDisposable
{
    private readonly ConcurrentDictionary<string, Texture2D> _cache = new();
    private readonly GraphicsDevice _graphicsDevice;
    private readonly Font _bodyFont;
    private readonly Font _headerFont;
    private readonly Font _smallFont;
    private readonly SolidBrush _textBrush;
    private readonly StringFormat _stringFormat;
    // Keep PrivateFontCollection alive — fonts reference their native data.
    // If GC collects the collection, GDI+ crashes with AccessViolationException.
    private readonly List<PrivateFontCollection> _fontCollections = [];

    // Ordered preference: modern Windows system sans-serifs, then monospace last resort.
    private static readonly string[] FallbackFamilies =
    [
        "Segoe UI Variable Display",
        "Segoe UI",
        "Calibri",
        "Arial",
        "Consolas",
    ];

    public FontRenderer(GraphicsDevice graphicsDevice, FontRole role = FontRole.Display)
    {
        _graphicsDevice = graphicsDevice;

        if (role == FontRole.Display)
        {
            var headerFamily = LoadFontFamily("Cinzel/static/Cinzel-Bold.ttf");
            var bodyFamily = LoadFontFamily("Noto_Serif/static/NotoSerif-Regular.ttf");

            _headerFont = CreateFont(headerFamily, 18f, System.Drawing.FontStyle.Bold);
            _bodyFont = CreateFont(bodyFamily, 16f, System.Drawing.FontStyle.Regular);
            _smallFont = CreateFont(bodyFamily, 13f, System.Drawing.FontStyle.Regular);
        }
        else // FontRole.Debug
        {
            var debugFamily = LoadFontFamily("Trykker/Trykker-Regular.ttf");

            _headerFont = CreateFont(debugFamily, 15f, System.Drawing.FontStyle.Bold);
            _bodyFont = CreateFont(debugFamily, 15f, System.Drawing.FontStyle.Regular);
            _smallFont = CreateFont(debugFamily, 12f, System.Drawing.FontStyle.Regular);
        }

        _textBrush = new SolidBrush(System.Drawing.Color.White);
        _stringFormat = new StringFormat
        {
            Alignment = StringAlignment.Near,
            LineAlignment = StringAlignment.Near,
            Trimming = StringTrimming.None,
            FormatFlags = StringFormatFlags.NoWrap | StringFormatFlags.MeasureTrailingSpaces,
        };
    }

    public Texture2D RenderText(string text, FontSize size, System.Drawing.Color? color = null)
    {
        var key = $"{(int)size}|{color?.ToArgb() ?? -1}|{text}";
        if (_cache.TryGetValue(key, out var cached))
            return cached;

        var font = size switch
        {
            FontSize.Header => _headerFont,
            FontSize.Small => _smallFont,
            _ => _bodyFont,
        };

        var brush = color is { } c ? new SolidBrush(c) : _textBrush;

        using var measureBitmap = new Bitmap(1, 1);
        using var measureGraphics = System.Drawing.Graphics.FromImage(measureBitmap);
        var measure = System.Drawing.Size.Ceiling(
            measureGraphics.MeasureString(text, font, int.MaxValue, _stringFormat));

        if (measure.Width <= 0 || measure.Height <= 0)
            measure = new System.Drawing.Size(1, 1);

        using var bitmap = new Bitmap(measure.Width, measure.Height);
        using var graphics = System.Drawing.Graphics.FromImage(bitmap);

        graphics.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
        graphics.SmoothingMode = SmoothingMode.HighQuality;
        graphics.Clear(System.Drawing.Color.Transparent);
        graphics.DrawString(text, font, brush, 0, 0, _stringFormat);

        var data = bitmap.LockBits(
            new System.Drawing.Rectangle(0, 0, bitmap.Width, bitmap.Height),
            System.Drawing.Imaging.ImageLockMode.ReadOnly,
            System.Drawing.Imaging.PixelFormat.Format32bppArgb);

        var pixels = new byte[data.Stride * data.Height];
        System.Runtime.InteropServices.Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
        bitmap.UnlockBits(data);

        var texture = new Texture2D(_graphicsDevice, bitmap.Width, bitmap.Height);
        var rgba = new Color[bitmap.Width * bitmap.Height];
        for (var i = 0; i < rgba.Length; i++)
        {
            var offset = i * 4;
            rgba[i] = new Color(pixels[offset + 2], pixels[offset + 1], pixels[offset + 0], pixels[offset + 3]);
        }

        texture.SetData(rgba);
        _cache[key] = texture;

        if (!ReferenceEquals(brush, _textBrush))
            brush.Dispose();

        return texture;
    }

    public Vector2 Measure(string text, FontSize size)
    {
        var tex = RenderText(text, size);
        return new Vector2(tex.Width, tex.Height);
    }

    public int LineHeight(FontSize size)
    {
        return size switch
        {
            FontSize.Header => (int)(_headerFont.Size + 4f),
            FontSize.Small => (int)(_smallFont.Size + 2f),
            _ => (int)(_bodyFont.Size + 3f),
        };
    }

    public void DrawString(
        SpriteBatch spriteBatch,
        string text,
        Vector2 position,
        FontSize size,
        Color? color = null)
    {
        var drawColor = color ?? new Color(228, 235, 224);
        var tex = RenderText(text, size, System.Drawing.Color.White);
        spriteBatch.Draw(tex, position, null, drawColor, 0f, Vector2.Zero, 1f, SpriteEffects.None, 0f);
    }

    public void DrawStringAligned(
        SpriteBatch spriteBatch,
        string text,
        Vector2 position,
        FontSize size,
        TextAlign align,
        Color? color = null)
    {
        var drawColor = color ?? new Color(228, 235, 224);
        var tex = RenderText(text, size, System.Drawing.Color.White);
        var offset = align switch
        {
            TextAlign.Right => new Vector2(tex.Width, 0),
            TextAlign.Center => new Vector2(tex.Width * 0.5f, 0),
            _ => Vector2.Zero,
        };
        spriteBatch.Draw(tex, position - offset, null, drawColor, 0f, Vector2.Zero, 1f, SpriteEffects.None, 0f);
    }

    public void ClearCache()
    {
        foreach (var tex in _cache.Values)
            tex.Dispose();
        _cache.Clear();
    }

    public void Dispose()
    {
        ClearCache();
        _bodyFont.Dispose();
        _headerFont.Dispose();
        _smallFont.Dispose();
        _textBrush.Dispose();
        _stringFormat.Dispose();
        foreach (var collection in _fontCollections)
            collection.Dispose();
        _fontCollections.Clear();
    }

    private FontFamily? LoadFontFamily(string relativePath)
    {
        try
        {
            var fontsDir = ResolveFontsRoot();
            if (fontsDir is null)
                return null;

            var fullPath = Path.Combine(fontsDir, relativePath.Replace('/', Path.DirectorySeparatorChar));
            if (!File.Exists(fullPath))
                return null;

            var collection = new PrivateFontCollection();
            collection.AddFontFile(fullPath);
            _fontCollections.Add(collection);
            return collection.Families.Length > 0 ? collection.Families[0] : null;
        }
        catch
        {
            return null;
        }
    }

    private static string? ResolveFontsRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, "Content", "UI", "Fonts");
            if (Directory.Exists(candidate))
                return candidate;

            current = current.Parent;
        }

        return null;
    }

    private static Font CreateFont(FontFamily? family, float size, System.Drawing.FontStyle style)
    {
        if (family is not null)
        {
            try { return new Font(family, size, style, GraphicsUnit.Pixel); }
            catch { }
        }

        foreach (var name in FallbackFamilies)
        {
            try { return new Font(name, size, style, GraphicsUnit.Pixel); }
            catch { }
        }

        return new Font(FontFamily.GenericSansSerif, size, style, GraphicsUnit.Pixel);
    }
}
