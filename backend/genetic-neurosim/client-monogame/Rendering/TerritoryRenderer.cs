using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace TribalNeuroSim.Client.Rendering;

public sealed class TerritoryRenderer : IDisposable
{
    private Texture2D? _pixel;
    private GraphicsDevice? _graphicsDevice;

    public void Initialize(GraphicsDevice graphicsDevice)
    {
        if (_pixel is not null && ReferenceEquals(_graphicsDevice, graphicsDevice))
            return;

        _pixel?.Dispose();
        _graphicsDevice = graphicsDevice;
        _pixel = new Texture2D(graphicsDevice, 1, 1);
        _pixel.SetData(new[] { Color.White });
    }

    public void DrawBorders(
        SpriteBatch spriteBatch,
        IReadOnlyList<RenderableTile> tiles,
        int gridWidth,
        int gridHeight,
        IsometricCamera camera,
        Viewport viewport,
        float cameraDistance = 400f)
    {
        if (_pixel is null || tiles.Count == 0)
            return;

        var tileLookup = new Dictionary<(int X, int Y), RenderableTile>();
        foreach (var tile in tiles)
            tileLookup[(tile.X, tile.Y)] = tile;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        foreach (var tile in tiles)
        {
            if (tile.OwnerTribeId < 0)
                continue;

            var borderColor = TribeColor(tile.OwnerTribeId);
            var neighbors = GetNeighborEdges(tile);

            foreach (var neighborEdge in neighbors)
            {
                if (tileLookup.TryGetValue((neighborEdge.NeighborX, neighborEdge.NeighborY), out var neighbor) &&
                    neighbor.OwnerTribeId == tile.OwnerTribeId)
                    continue;

                DrawBorderEdge(spriteBatch, tile, neighborEdge.StartCornerIndex, neighborEdge.EndCornerIndex, borderColor, camera, viewport, cameraDistance);
            }
        }

        spriteBatch.End();
    }

    public void DrawDisputedZones(
        SpriteBatch spriteBatch,
        IReadOnlyList<RenderableTile> tiles,
        IsometricCamera camera,
        Viewport viewport,
        float cameraDistance = 400f)
    {
        if (_pixel is null || tiles.Count == 0)
            return;

        spriteBatch.Begin(
            sortMode: SpriteSortMode.Deferred,
            blendState: BlendState.AlphaBlend,
            samplerState: SamplerState.LinearClamp);

        foreach (var tile in tiles)
        {
            if (!tile.IsDisputed)
                continue;

            DrawCrosshatch(spriteBatch, tile, camera, viewport, cameraDistance);
            DrawPenaltyIcon(spriteBatch, tile, camera, viewport, cameraDistance);
        }

        spriteBatch.End();
    }

    public void Dispose()
    {
        _pixel?.Dispose();
        _pixel = null;
        _graphicsDevice = null;
    }

    // ── Zoom-aware scaling ──

    private static (float coreWidth, float glowWidth, float alphaScale) ZoomBorderParams(float cameraDistance)
    {
        return cameraDistance switch
        {
            < 200f => (2.8f, 4.2f, 1.0f),
            < 500f => (1.8f, 2.6f, 1.0f),
            _      => (1.0f, 1.5f, 0.70f),
        };
    }

    private static float ZoomLineAlpha(byte baseAlpha, float cameraDistance)
    {
        var scale = cameraDistance switch
        {
            < 200f => 1.0f,
            < 500f => 0.70f,
            _      => 0.45f,
        };
        return MathF.Min(1f, baseAlpha / 255f * scale);
    }

    // ── Border edge rendering ──

    private void DrawBorderEdge(
        SpriteBatch spriteBatch,
        RenderableTile tile,
        int startCornerIndex,
        int endCornerIndex,
        Color color,
        IsometricCamera camera,
        Viewport viewport,
        float cameraDistance = 400f)
    {
        var corners = HexCorners(tile.Center, tile.Size * 0.995f);
        var start = corners[startCornerIndex];
        var end = corners[endCornerIndex];

        var screenStart = camera.HexToScreen(start, viewport);
        var screenEnd = camera.HexToScreen(end, viewport);

        var screenLength = Vector2.Distance(screenStart, screenEnd);
        if (screenLength < 3f)
            return;

        var (coreWidth, glowWidth, alphaScale) = ZoomBorderParams(cameraDistance);
        var coreAlpha = (int)(210 * alphaScale);
        var glowAlpha = (int)(80 * alphaScale);

        DrawLine(spriteBatch, screenStart, screenEnd, new Color(color, coreAlpha), coreWidth);
        DrawLine(spriteBatch, screenStart, screenEnd, new Color(color, glowAlpha), glowWidth);
    }

    // ── Crosshatch rendering ──

    private void DrawCrosshatch(
        SpriteBatch spriteBatch,
        RenderableTile tile,
        IsometricCamera camera,
        Viewport viewport,
        float cameraDistance = 400f)
    {
        var contestingIds = tile.ContestingTribeIds;
        if (contestingIds is null || contestingIds.Length < 2)
            return;

        var colors = contestingIds.Select(TribeColor).ToArray();
        var hexCenter = tile.Center;
        var hexRadius = tile.Size * 0.995f; // match border edge radius, no gap
        var hexCorners = HexCorners(hexCenter, hexRadius);

        // Draw diagonal lines across the hex bounding area
        var bounds = GetHexBounds(hexCorners);
        var spacing = tile.Size * 0.38f;

        // Direction 1 (top-left to bottom-right): color of first contestant
        var alphaA = (int)(255 * ZoomLineAlpha(140, cameraDistance));
        var colorA = new Color(colors[0], alphaA);
        DrawDiagonalLines(spriteBatch, bounds, hexCenter, hexRadius, hexCorners,
            new Vector2(1f, 1f), spacing, colorA, camera, viewport, cameraDistance);

        // Direction 2 (top-right to bottom-left): color of second contestant
        var alphaB = colors.Length > 1
            ? (int)(255 * ZoomLineAlpha(140, cameraDistance))
            : (int)(255 * ZoomLineAlpha(80, cameraDistance));
        var colorB = colors.Length > 1
            ? new Color(colors[1], alphaB)
            : new Color(colors[0], alphaB);
        DrawDiagonalLines(spriteBatch, bounds, hexCenter, hexRadius, hexCorners,
            new Vector2(-1f, 1f), spacing, colorB, camera, viewport, cameraDistance);

        // Third contestant: extra hatching
        if (colors.Length > 2)
        {
            var alphaC = (int)(255 * ZoomLineAlpha(110, cameraDistance));
            var colorC = new Color(colors[2], alphaC);
            DrawDiagonalLines(spriteBatch, bounds, hexCenter, hexRadius, hexCorners,
                new Vector2(0.5f, 1f), spacing * 1.3f, colorC, camera, viewport, cameraDistance);
        }
    }

    private void DrawDiagonalLines(
        SpriteBatch spriteBatch,
        (Vector2 Min, Vector2 Max) bounds,
        Vector2 hexCenter,
        float hexRadius,
        Vector2[] hexCorners,
        Vector2 direction,
        float spacing,
        Color color,
        IsometricCamera camera,
        Viewport viewport,
        float cameraDistance = 400f)
    {
        var diagonal = Vector2.Normalize(direction);
        var perpendicular = new Vector2(-diagonal.Y, diagonal.X);
        var extent = (bounds.Max - bounds.Min).Length() * 0.8f;

        var offsets = new List<float>();
        for (var d = -extent; d <= extent; d += spacing)
            offsets.Add(d);

        foreach (var offset in offsets)
        {
            var lineCenter = hexCenter + perpendicular * offset;
            var start = lineCenter - diagonal * extent;
            var end = lineCenter + diagonal * extent;

            // Clip line to hex bounds
            var clipped = ClipLineToConvexPoly(start, end, hexCorners);
            if (clipped is null)
                continue;

            var (s, e) = clipped.Value;
            var screenStart = camera.HexToScreen(s, viewport);
            var screenEnd = camera.HexToScreen(e, viewport);

            var screenLength = Vector2.Distance(screenStart, screenEnd);
            if (screenLength < 2f)
                continue;

            var hatchWidth = cameraDistance switch
            {
                < 200f => 1.5f,
                < 500f => 1.0f,
                _      => 0.7f,
            };
            DrawLine(spriteBatch, screenStart, screenEnd, color, hatchWidth);
        }
    }

    // ── Penalty icon ──

    private void DrawPenaltyIcon(
        SpriteBatch spriteBatch,
        RenderableTile tile,
        IsometricCamera camera,
        Viewport viewport,
        float cameraDistance = 400f)
    {
        var center = tile.Center;
        var screenCenter = camera.HexToScreen(center, viewport);
        var topPoint = camera.HexToScreen(center + new Vector2(0f, -tile.Size * 0.55f), viewport);
        var iconSize = Vector2.Distance(screenCenter, topPoint) * 0.55f;

        // Scale down penalty icon at far zoom to avoid dominating the map
        var zoomScale = cameraDistance switch
        {
            < 200f => 1.0f,
            < 500f => 0.75f,
            _      => 0.50f,
        };
        iconSize *= zoomScale;

        if (iconSize < 3f)
            return;

        // Warning diamond (rotated square) centered above the hex center
        var ic = screenCenter + new Vector2(0f, -iconSize * 1.15f);

        // Draw diamond: 4 corners
        var top = ic + new Vector2(0f, -iconSize);
        var right = ic + new Vector2(iconSize, 0f);
        var bottom = ic + new Vector2(0f, iconSize);
        var left = ic + new Vector2(-iconSize, 0f);

        var diamondAlpha = (int)(190 * zoomScale);
        var fillAlpha = (int)(170 * zoomScale);
        var minusAlpha = (int)(220 * zoomScale);

        // Fill
        DrawLine(spriteBatch, top, right, new Color(220, 70, 55, diamondAlpha), iconSize * 0.7f);
        DrawLine(spriteBatch, right, bottom, new Color(220, 70, 55, diamondAlpha), iconSize * 0.7f);
        DrawLine(spriteBatch, bottom, left, new Color(220, 70, 55, diamondAlpha), iconSize * 0.7f);
        DrawLine(spriteBatch, left, top, new Color(220, 70, 55, diamondAlpha), iconSize * 0.7f);

        // Filled center
        FillDiamond(spriteBatch, ic, iconSize * 0.65f, new Color(240, 85, 65, fillAlpha));

        // Minus sign (horizontal line through center)
        var minusLen = iconSize * 0.50f;
        DrawLine(spriteBatch,
            ic + new Vector2(-minusLen, 0f),
            ic + new Vector2(minusLen, 0f),
            new Color(255, 240, 220, minusAlpha), 2.2f * zoomScale);
    }

    // ── Drawing primitives ──

    private void DrawLine(SpriteBatch spriteBatch, Vector2 start, Vector2 end, Color color, float thickness)
    {
        var delta = end - start;
        var length = delta.Length();
        if (length <= 0.001f)
            return;

        var angle = MathF.Atan2(delta.Y, delta.X);
        spriteBatch.Draw(
            _pixel,
            start,
            null,
            color,
            angle,
            new Vector2(0f, 0.5f),
            new Vector2(length, Math.Max(1f, thickness)),
            SpriteEffects.None,
            0f);
    }

    private void FillDiamond(SpriteBatch spriteBatch, Vector2 center, float radius, Color color)
    {
        DrawLine(spriteBatch, center + new Vector2(0f, -radius), center + new Vector2(radius, 0f), color, radius * 0.7f);
        DrawLine(spriteBatch, center + new Vector2(radius, 0f), center + new Vector2(0f, radius), color, radius * 0.7f);
        DrawLine(spriteBatch, center + new Vector2(0f, radius), center + new Vector2(-radius, 0f), color, radius * 0.7f);
        DrawLine(spriteBatch, center + new Vector2(-radius, 0f), center + new Vector2(0f, -radius), color, radius * 0.7f);
    }

    // ── Geometry helpers ──

    private static Vector2[] HexCorners(Vector2 center, float radius)
    {
        var corners = new Vector2[6];
        for (var i = 0; i < corners.Length; i++)
        {
            var angle = MathHelper.ToRadians(-90f + i * 60f);
            corners[i] = center + new Vector2(MathF.Cos(angle), MathF.Sin(angle)) * radius;
        }
        return corners;
    }

    private static (Vector2 Min, Vector2 Max) GetHexBounds(Vector2[] corners)
    {
        var min = new Vector2(float.MaxValue);
        var max = new Vector2(float.MinValue);
        foreach (var c in corners)
        {
            min = Vector2.Min(min, c);
            max = Vector2.Max(max, c);
        }
        return (min, max);
    }

    private static (Vector2 Start, Vector2 End)? ClipLineToConvexPoly(
        Vector2 lineStart,
        Vector2 lineEnd,
        Vector2[] poly)
    {
        var tMin = 0f;
        var tMax = 1f;
        var lineDir = lineEnd - lineStart;
        var edgeCount = poly.Length;

        for (var i = 0; i < edgeCount; i++)
        {
            var edgeStart = poly[i];
            var edgeEnd = poly[(i + 1) % edgeCount];
            var edge = edgeEnd - edgeStart;
            var normal = new Vector2(-edge.Y, edge.X);

            var numerator = Vector2.Dot(normal, edgeStart - lineStart);
            var denominator = Vector2.Dot(normal, lineDir);

            if (MathF.Abs(denominator) < 1e-6f)
            {
                if (numerator < 0f)
                    return null;
                continue;
            }

            var t = numerator / denominator;
            if (denominator > 0f)
                tMin = MathF.Max(tMin, t);
            else
                tMax = MathF.Min(tMax, t);

            if (tMin > tMax)
                return null;
        }

        return (
            lineStart + lineDir * MathF.Max(0f, tMin),
            lineStart + lineDir * MathF.Min(1f, tMax));
    }

    private static BorderNeighborEdge[] GetNeighborEdges(RenderableTile tile)
    {
        var x = tile.X;
        var y = tile.Y;

        if (y % 2 == 0)
        {
            return
            [
                new(x, y - 1, 0, 1),
                new(x + 1, y, 1, 2),
                new(x, y + 1, 2, 3),
                new(x - 1, y + 1, 3, 4),
                new(x - 1, y, 4, 5),
                new(x - 1, y - 1, 5, 0),
            ];
        }

        return
        [
            new(x + 1, y - 1, 0, 1),
            new(x + 1, y, 1, 2),
            new(x + 1, y + 1, 2, 3),
            new(x, y + 1, 3, 4),
            new(x - 1, y, 4, 5),
            new(x, y - 1, 5, 0),
        ];
    }

    private static Color TribeColor(int id)
    {
        var hue = (id * 0.61803398875f) % 1f;
        return FromHsv(hue, 0.52f, 0.92f);
    }

    private static Color FromHsv(float h, float s, float v)
    {
        var i = (int)MathF.Floor(h * 6f);
        var f = h * 6f - i;
        var p = v * (1f - s);
        var q = v * (1f - f * s);
        var t = v * (1f - (1f - f) * s);

        var (r, g, b) = (i % 6) switch
        {
            0 => (v, t, p),
            1 => (q, v, p),
            2 => (p, v, t),
            3 => (p, q, v),
            4 => (t, p, v),
            _ => (v, p, q),
        };

        return new Color(r, g, b);
    }

    private readonly record struct BorderNeighborEdge(int NeighborX, int NeighborY, int StartCornerIndex, int EndCornerIndex);
}
