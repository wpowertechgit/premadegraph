using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Protocol;
using TribalNeuroSim.Client.Rendering;

namespace TribalNeuroSim.Client.Input;

public sealed record SelectionResult(int TileId, int TribeId);

public sealed class SelectionSystem
{
    private readonly float _tileSize;

    public SelectionSystem(float tileSize = 28f)
    {
        _tileSize = tileSize;
    }

    public SelectionResult? Pick(
        Vector2 screenPosition,
        Viewport viewport,
        IsometricCamera camera,
        PlayableSimulation simulation,
        PlayableRenderAdapter adapter)
    {
        var worldPos = camera.ScreenToWorld2D(screenPosition, viewport);
        var approx = WorldToHex(worldPos);

        // Check candidate tile and its neighbors for precise point-in-hex
        Span<int> candidates = stackalloc int[7];
        var count = 0;
        candidates[count++] = ToTileId(approx.X, approx.Y, simulation.Width, simulation.Height);

        foreach (var (nx, ny) in HexNeighbors(approx.X, approx.Y))
        {
            if (count >= candidates.Length) break;
            candidates[count++] = ToTileId(nx, ny, simulation.Width, simulation.Height);
        }

        var bestDistance = float.MaxValue;
        var bestTileId = -1;

        for (var i = 0; i < count; i++)
        {
            var tileId = candidates[i];
            if (tileId < 0 || tileId >= simulation.Tiles.Count) continue;

            var tile = simulation.Tiles[tileId];
            var center = adapter.TileCenter(tile.X, tile.Y);
            var dist = Vector2.Distance(worldPos, center);

            if (dist < bestDistance && IsPointInHex(worldPos, center, _tileSize))
            {
                bestDistance = dist;
                bestTileId = tileId;
            }
        }

        if (bestTileId < 0) return null;

        var tribe = simulation.Tribes.FirstOrDefault(t =>
            t.IsAlive && t.Territory.Contains(bestTileId));
        var tribeId = tribe?.Id ?? -1;

        return new SelectionResult(bestTileId, tribeId);
    }

    /// Network-mode overload: picks from a flat RenderableTile/RenderableTribe list.
    public SelectionResult? Pick(
        Vector2 screenPosition,
        Viewport viewport,
        IsometricCamera camera,
        int mapWidth,
        int mapHeight,
        IReadOnlyList<RenderableTile> tiles,
        IReadOnlyList<RenderableTribe> tribes)
    {
        var worldPos = camera.ScreenToWorld2D(screenPosition, viewport);
        var approx = WorldToHex(worldPos);

        Span<int> candidates = stackalloc int[7];
        var count = 0;
        candidates[count++] = ToTileId(approx.X, approx.Y, mapWidth, mapHeight);
        foreach (var (nx, ny) in HexNeighbors(approx.X, approx.Y))
        {
            if (count >= candidates.Length) break;
            candidates[count++] = ToTileId(nx, ny, mapWidth, mapHeight);
        }

        var bestDistance = float.MaxValue;
        var bestTileId = -1;

        for (var i = 0; i < count; i++)
        {
            var tileId = candidates[i];
            if (tileId < 0 || tileId >= tiles.Count) continue;

            var tile = tiles[tileId];
            var dist = Vector2.Distance(worldPos, tile.Center);
            if (dist < bestDistance && IsPointInHex(worldPos, tile.Center, _tileSize))
            {
                bestDistance = dist;
                bestTileId = tileId;
            }
        }

        if (bestTileId < 0) return null;

        // Find tribe by tile ownership (OwnerTribeId on the rendered tile), falling
        // back to MainCampTileId for untracked tiles.
        var ownerTribeId = tiles[bestTileId].OwnerTribeId;
        if (ownerTribeId < 0)
        {
            foreach (var t in tribes)
            {
                if (t.MainCampTileId == bestTileId)
                {
                    ownerTribeId = t.Id;
                    break;
                }
            }
        }
        return new SelectionResult(bestTileId, ownerTribeId);
    }

    private static (int X, int Y) WorldToHex(Vector2 worldPos)
    {
        // Note: the default tile size for hex math; callers should use matching tileSize
        var size = 28f;

        var hexWidth = MathF.Sqrt(3f) * size;
        var hexHeight = 1.5f * size;

        var row = (int)MathF.Round(worldPos.Y / hexHeight);
        var rowOffset = row % 2 == 0 ? 0f : hexWidth * 0.5f;
        var col = (int)MathF.Round((worldPos.X - rowOffset) / hexWidth);

        return (col, row);
    }

    private static bool IsPointInHex(Vector2 point, Vector2 center, float size)
    {
        // Convert to hex-local space (pointy-top, flat sides left/right)
        var dx = MathF.Abs(point.X - center.X);
        var dy = MathF.Abs(point.Y - center.Y);

        var halfWidth = MathF.Sqrt(3f) * 0.5f * size;
        var halfHeight = size;

        if (dx > halfWidth || dy > halfHeight)
            return false;

        // Check diagonal corners of the hex
        return dy * halfWidth + dx * halfHeight * 0.5f <= halfWidth * halfHeight;
    }

    private static int ToTileId(int x, int y, int width, int height)
    {
        if (x < 0 || x >= width || y < 0 || y >= height) return -1;
        return y * width + x;
    }

    private static IEnumerable<(int X, int Y)> HexNeighbors(int x, int y)
    {
        if (y % 2 == 0)
        {
            yield return (x - 1, y - 1);
            yield return (x, y - 1);
            yield return (x - 1, y + 1);
            yield return (x, y + 1);
        }
        else
        {
            yield return (x, y - 1);
            yield return (x + 1, y - 1);
            yield return (x, y + 1);
            yield return (x + 1, y + 1);
        }

        yield return (x - 1, y);
        yield return (x + 1, y);
    }
}
