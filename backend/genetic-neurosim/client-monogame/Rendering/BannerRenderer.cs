using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Assets;
using TribalNeuroSim.Client.Domain;

namespace TribalNeuroSim.Client.Rendering;

/// <summary>
/// Renders faction banners above tribe capitals at mid-to-far zoom.
/// Each banner: faction-tinted emblem → polity frame → ribbon with name text.
/// Green-screen coordinate parsing detects emblem placement zones on polity frames.
/// </summary>
public sealed class BannerRenderer : IDisposable
{
    private GraphicsDevice? _graphicsDevice;
    private RuntimeAssetLoader? _assetLoader;
    private FontRenderer? _fontRenderer;

    // Cleaned polity frames (green → transparent)
    private readonly Dictionary<string, Texture2D> _cleanedFrames = new(StringComparer.OrdinalIgnoreCase);

    // Green-screen center + radius per frame key
    private readonly Dictionary<string, GreenScreenData> _greenScreenData = new(StringComparer.OrdinalIgnoreCase);

    // Tinted emblem cache: "iconKey|RRGGBB" → Texture2D
    private readonly Dictionary<string, Texture2D> _tintedEmblems = new(StringComparer.OrdinalIgnoreCase);

    private Texture2D? _ribbon;
    private bool _isLoaded;

    // Screen-space banner targets. Keep these intentionally small: banners are
    // strategic map markers, not full-size UI panels.
    private const float BannerWidth = 132f;
    private const float BannerHeight = 132f;
    private const float RibbonWidth = 132f;
    private const float RibbonHeight = 28f;
    private const float MinDistanceForBanners = 0f;
    private const float MinBannerScale = 0.48f;
    private const float MaxBannerScale = 1.06f;
    private const float BannerDistanceScale = 360f;
    private const float TextureLoadScale = 0.5f; // 512px polity frames become 256px runtime textures
    private const float ScreenLiftPixels = 54f;
    private const float MinRibbonWidth = 92f;
    private const float MinRibbonHeight = 22f;

    public void Initialize(GraphicsDevice graphicsDevice, RuntimeAssetLoader assetLoader, FontRenderer? fontRenderer = null)
    {
        _graphicsDevice = graphicsDevice;
        _assetLoader = assetLoader;
        _fontRenderer = fontRenderer;
        LoadAllFrames();
        LoadRibbon();
        _isLoaded = true;
    }

    public void DrawBanners(
        SpriteBatch spriteBatch,
        IReadOnlyList<RenderableTribe> tribes,
        IsometricCamera camera,
        Viewport viewport,
        AssetRegistry assetRegistry)
    {
        if (!_isLoaded || _graphicsDevice is null)
            return;

        if (camera.Distance < MinDistanceForBanners)
            return;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        foreach (var tribe in tribes)
        {
            var screenPos = camera.HexToScreen(tribe.Position, viewport) - new Vector2(0f, ScreenLiftPixels);
            var cullMargin = MathF.Max(BannerWidth * MaxBannerScale, MinRibbonWidth) + ScreenLiftPixels;
            if (screenPos.X < -cullMargin || screenPos.X > viewport.Width + cullMargin ||
                screenPos.Y < -cullMargin || screenPos.Y > viewport.Height + cullMargin)
                continue;

            var insignia = assetRegistry.ResolveInsignia(tribe.Id, tribe.Tier, tribe.Artifacts);

            var bannerScale = MathHelper.Clamp(BannerDistanceScale / camera.Distance, MinBannerScale, MaxBannerScale);
            DrawSingleBanner(spriteBatch, screenPos, insignia, tribe, bannerScale);
        }

        spriteBatch.End();
    }

    private void DrawSingleBanner(
        SpriteBatch spriteBatch,
        Vector2 screenPos,
        FactionInsigniaProfile insignia,
        RenderableTribe tribe,
        float scale)
    {
        var frameWidth = BannerWidth * scale;
        var frameHeight = BannerHeight * scale;

        var frameTopLeft = screenPos - new Vector2(frameWidth * 0.5f, frameHeight * 0.85f);
        var frameDrawScale = Vector2.One;
        if (_cleanedFrames.TryGetValue(insignia.PolityFrameKey, out var frame))
        {
            frameDrawScale = new Vector2(
                frameWidth / Math.Max(frame.Width, 1),
                frameHeight / Math.Max(frame.Height, 1));
        }

        // 1. Base layer: tinted emblem centered in frame
        var emblemTex = GetOrCreateTintedEmblem(insignia.IconKey, insignia.PrimaryColor);
        if (emblemTex is not null && _greenScreenData.TryGetValue(insignia.PolityFrameKey, out var gs))
        {
            var emblemSize = Math.Min(gs.Radius * 2f * frameDrawScale.X, frameWidth * 0.62f);
            var emblemCenter = frameTopLeft + new Vector2(gs.Center.X * frameDrawScale.X, gs.Center.Y * frameDrawScale.Y);
            var emblemTopLeft = emblemCenter - new Vector2(emblemSize * 0.5f, emblemSize * 0.5f);

            spriteBatch.Draw(emblemTex, emblemTopLeft, null, Color.White, 0f, Vector2.Zero,
                emblemSize / Math.Max(emblemTex.Width, 1), SpriteEffects.None, 0f);
        }

        // 2. Middle layer: cleaned polity frame
        if (frame is not null)
        {
            spriteBatch.Draw(frame, frameTopLeft, null, Color.White, 0f, Vector2.Zero,
                frameDrawScale,
                SpriteEffects.None, 0f);
        }

        // 3. Top layer: ribbon + text below frame
        if (_ribbon is not null)
        {
            var ribbonW = MathF.Max(RibbonWidth * scale, MinRibbonWidth);
            var ribbonH = MathF.Max(RibbonHeight * scale, MinRibbonHeight);
            var ribbonTopLeft = new Vector2(
                frameTopLeft.X + (frameWidth - ribbonW) * 0.5f,
                frameTopLeft.Y + frameHeight - 2f);
            spriteBatch.Draw(_ribbon, ribbonTopLeft, null, insignia.PrimaryColor, 0f, Vector2.Zero,
                new Vector2(ribbonW / Math.Max(_ribbon.Width, 1), ribbonH / Math.Max(_ribbon.Height, 1)),
                SpriteEffects.None, 0f);

            if (_fontRenderer is not null)
            {
                var text = tribe.Name.ToUpperInvariant();
                var maxChars = scale >= 0.72f ? 18 : scale >= 0.58f ? 14 : 10;
                if (text.Length > maxChars)
                    text = text[..maxChars];

                var textSize = scale >= 0.74f ? FontSize.Body : FontSize.Small;
                var textCenter = new Vector2(
                    ribbonTopLeft.X + ribbonW * 0.5f,
                    ribbonTopLeft.Y + MathF.Max(1f, (ribbonH - _fontRenderer.LineHeight(textSize)) * 0.45f));
                var textShadow = textCenter + new Vector2(1f, 1f);
                _fontRenderer.DrawStringAligned(spriteBatch, text, textShadow, textSize, TextAlign.Center, new Color(18, 18, 18, 220));
                _fontRenderer.DrawStringAligned(spriteBatch, text, textCenter, textSize, TextAlign.Center, new Color(245, 236, 215, 245));
            }
        }
    }

    private Texture2D? GetOrCreateTintedEmblem(string iconKey, Color tint)
    {
        var cacheKey = $"{iconKey}|{tint.R:X2}{tint.G:X2}{tint.B:X2}";
        if (_tintedEmblems.TryGetValue(cacheKey, out var cached))
            return cached;

        if (_assetLoader is null)
            return null;

        var iconTex = _assetLoader.LoadTexture(iconKey);
        if (iconTex is null)
            return null;

        var data = new Color[iconTex.Width * iconTex.Height];
        iconTex.GetData(data);

        for (var i = 0; i < data.Length; i++)
        {
            var pixel = data[i];
            var luminance = (pixel.R + pixel.G + pixel.B) / 3f / 255f;
            var tinted = new Color(
                (byte)(tint.R * luminance),
                (byte)(tint.G * luminance),
                (byte)(tint.B * luminance),
                pixel.A);
            data[i] = tinted;
        }

        var tintedTex = new Texture2D(_graphicsDevice!, iconTex.Width, iconTex.Height);
        tintedTex.SetData(data);
        _tintedEmblems[cacheKey] = tintedTex;
        return tintedTex;
    }

    private void LoadAllFrames()
    {
        if (_assetLoader is null || _graphicsDevice is null)
            return;

        var frameKeys = new[]
        {
            FactionInsigniaProfile.PolityFrameKeyForTier(PolityTier.Tribe),
            FactionInsigniaProfile.PolityFrameKeyForTier(PolityTier.City),
            FactionInsigniaProfile.PolityFrameKeyForTier(PolityTier.Duchy),
            FactionInsigniaProfile.PolityFrameKeyForTier(PolityTier.Kingdom),
            FactionInsigniaProfile.PolityFrameKeyForTier(PolityTier.Empire),
        };

        foreach (var key in frameKeys)
        {
            LoadAndCleanFrame(key);
        }
    }

    private void LoadAndCleanFrame(string frameKey)
    {
        if (_assetLoader is null || _graphicsDevice is null)
            return;

        var texture = _assetLoader.LoadTexture(frameKey);
        if (texture is null)
            return;

        var data = new Color[texture.Width * texture.Height];
        texture.GetData(data);

        var gs = ParseGreenScreen(data, texture.Width, texture.Height);
        _greenScreenData[frameKey] = gs;

        // Create a downscaled clean version for rendering
        var scaledW = (int)(texture.Width * TextureLoadScale);
        var scaledH = (int)(texture.Height * TextureLoadScale);
        var scaledData = new Color[scaledW * scaledH];

        for (var y = 0; y < scaledH; y++)
        {
            for (var x = 0; x < scaledW; x++)
            {
                var srcX = (int)(x / TextureLoadScale);
                var srcY = (int)(y / TextureLoadScale);
                var srcIdx = srcY * texture.Width + srcX;
                var pixel = data[srcIdx];

                // Replace green with transparent
                if (pixel.R == 0 && pixel.G == 255 && pixel.B == 0)
                    pixel = Color.Transparent;

                scaledData[y * scaledW + x] = pixel;
            }
        }

        var cleanTex = new Texture2D(_graphicsDevice, scaledW, scaledH);
        cleanTex.SetData(scaledData);
        _cleanedFrames[frameKey] = cleanTex;

        // Also compute green-screen center at scaled size
        _greenScreenData[frameKey] = new GreenScreenData(
            gs.Center * TextureLoadScale,
            gs.Radius * TextureLoadScale);
    }

    private static GreenScreenData ParseGreenScreen(Color[] data, int width, int height)
    {
        var greenPixels = new List<Point>();
        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var pixel = data[y * width + x];
                if (pixel.R == 0 && pixel.G == 255 && pixel.B == 0)
                    greenPixels.Add(new Point(x, y));
            }
        }

        if (greenPixels.Count == 0)
            return new GreenScreenData(new Vector2(width * 0.5f, height * 0.5f), Math.Min(width, height) * 0.4f);

        var sumX = 0f;
        var sumY = 0f;
        foreach (var p in greenPixels)
        {
            sumX += p.X;
            sumY += p.Y;
        }

        var center = new Vector2(sumX / greenPixels.Count, sumY / greenPixels.Count);

        var maxDistSq = 0f;
        foreach (var p in greenPixels)
        {
            var dx = p.X - center.X;
            var dy = p.Y - center.Y;
            maxDistSq = MathF.Max(maxDistSq, dx * dx + dy * dy);
        }

        return new GreenScreenData(center, MathF.Sqrt(maxDistSq));
    }

    private void LoadRibbon()
    {
        if (_assetLoader is null)
            return;

        _ribbon = _assetLoader.LoadTexture(RuntimeAssetCatalog.InsigniaRibbon);
    }

    public void Dispose()
    {
        foreach (var tex in _cleanedFrames.Values)
            tex.Dispose();
        _cleanedFrames.Clear();

        foreach (var tex in _tintedEmblems.Values)
            tex.Dispose();
        _tintedEmblems.Clear();

        _greenScreenData.Clear();
        _ribbon = null;
        _graphicsDevice = null;
        _assetLoader = null;
        _fontRenderer = null;
    }

    private readonly record struct GreenScreenData(Vector2 Center, float Radius);
}
