using Microsoft.Xna.Framework;
using TribalNeuroSim.Client.Assets;
using TribalNeuroSim.Client.Domain;
using TribalNeuroSim.Client.Models;
using TribalNeuroSim.Client.Protocol;

namespace TribalNeuroSim.Client.Rendering;

public sealed class PlayableRenderAdapter
{
    private readonly float _tileSize;

    public float TileSize => _tileSize;

    public PlayableRenderAdapter(float tileSize = 28f)
    {
        _tileSize = tileSize;
    }

    public IEnumerable<RenderableTile> BuildTiles(PlayableSimulation simulation)
    {
        foreach (var tile in simulation.Tiles)
        {
            var hasCamp = simulation.Tribes.Any(tribe => tribe.MainCampTileId == tile.Id && tribe.IsAlive);
            var ownerId = tile.Controls
                .OrderByDescending(control => control.ControlShare)
                .Select(control => control.TribeId)
                .FirstOrDefault(-1);

            var contestingIds = tile.Controls.Count > 1
                ? tile.Controls.Select(c => c.TribeId).ToArray()
                : null;

            yield return new RenderableTile(
                TileId: checked((ushort)tile.Id),
                Center: TileCenter(tile.X, tile.Y),
                Size: _tileSize,
                BaseColor: BiomeColor(tile.Biome),
                TextureKey: TextureKey(tile.Biome),
                ModelKey: null,
                FoodAmount: 0f,
                MaxFoodAmount: tile.MaxFood,
                IsDisputed: tile.IsDisputed,
                OwnerTribeId: ownerId,
                HasCamp: hasCamp,
                X: tile.X,
                Y: tile.Y,
                VisualElevation: PlayableWorldGenerator.VisualElevation(simulation.Seed, simulation.Width, simulation.Height, tile.X, tile.Y, tile.Biome),
                ContestingTribeIds: contestingIds,
                Biome: tile.Biome);
        }
    }

    public IEnumerable<RenderableTribe> BuildTribes(PlayableSimulation simulation)
    {
        foreach (var tribe in simulation.Tribes.Where(tribe => tribe.IsAlive))
        {
            var home = simulation.Tiles[tribe.MainCampTileId];
            var radius = MathHelper.Clamp(5f + tribe.Population * 0.035f, 7f, 18f);

            yield return new RenderableTribe(
                Id: tribe.Id,
                Position: TileCenter(home.X, home.Y),
                Radius: radius,
                Color: TribeColor(tribe.Id),
                Population: tribe.Population,
                HasCamp: true,
                CampPosition: TileCenter(home.X, home.Y),
                TerritoryRadius: 0f,
                Tier: tribe.Tier,
                MainCampTileId: tribe.MainCampTileId,
                Biome: home.Biome);
        }
    }

    // ── Network mode: build renderables from SimulationViewModel (FrameV1 data) ──

    public IEnumerable<RenderableTile> BuildTiles(SimulationViewModel viewModel, int mapWidth, int mapHeight)
    {
        foreach (var (tileId, tile) in viewModel.TileData)
        {
            var x = tileId % mapWidth;
            var y = tileId / mapWidth;
            var biome = (BiomeId)tile.BiomeId;

            yield return new RenderableTile(
                TileId: tileId,
                Center: TileCenter(x, y),
                Size: _tileSize,
                BaseColor: BiomeColor(biome),
                TextureKey: TextureKey(biome),
                ModelKey: null,
                FoodAmount: tile.FoodAmount,
                MaxFoodAmount: 100f,
                IsDisputed: tile.IsDisputed,
                OwnerTribeId: -1,
                HasCamp: false,
                X: x,
                Y: y,
                VisualElevation: 0f,
                ContestingTribeIds: null,
                Biome: biome);
        }
    }

    public IEnumerable<RenderableTribe> BuildTribes(SimulationViewModel viewModel, int mapWidth)
    {
        foreach (var (_, tribe) in viewModel.V1Tribes)
        {
            if (!tribe.IsAlive)
                continue;

            var homeX = tribe.MainCampTile % mapWidth;
            var homeY = tribe.MainCampTile / mapWidth;
            var biome = viewModel.TileData.TryGetValue(tribe.MainCampTile, out var tileData)
                ? (BiomeId)tileData.BiomeId
                : (BiomeId?)null;
            var radius = MathHelper.Clamp(5f + tribe.Population * 0.035f, 7f, 18f);

            yield return new RenderableTribe(
                Id: (int)tribe.Id,
                Position: TileCenter(homeX, homeY),
                Radius: radius,
                Color: TribeColor((int)tribe.Id),
                Population: (int)tribe.Population,
                HasCamp: true,
                CampPosition: TileCenter(homeX, homeY),
                TerritoryRadius: 0f,
                Tier: (PolityTier)tribe.PolityTier,
                MainCampTileId: tribe.MainCampTile,
                Biome: biome);
        }
    }

    public Vector2 TileCenter(int x, int y)
    {
        var horizontalSpacing = MathF.Sqrt(3f) * _tileSize;
        var rowOffset = y % 2 == 0 ? 0f : horizontalSpacing * 0.5f;
        return new Vector2(
            x * horizontalSpacing + rowOffset,
            y * _tileSize * 1.5f);
    }

    private static Color BiomeColor(BiomeId biome)
    {
        return biome switch
        {
            BiomeId.Plains => new Color(118, 151, 76),
            BiomeId.DenseForest => new Color(31, 62, 42),
            BiomeId.SparseWoodland => new Color(64, 91, 55),
            BiomeId.Hills => new Color(98, 96, 69),
            BiomeId.Mountains => new Color(82, 82, 78),
            BiomeId.Marsh => new Color(45, 75, 66),
            BiomeId.Riverland => new Color(45, 89, 105),
            BiomeId.DrySteppe => new Color(116, 87, 47),
            BiomeId.FertileValley => new Color(82, 130, 65),
            BiomeId.Cold => new Color(132, 150, 150),
            _ => new Color(44, 44, 42),
        };
    }

    private static string TextureKey(BiomeId biome)
    {
        return biome switch
        {
            BiomeId.Riverland => RuntimeAssetCatalog.CoastSand,
            BiomeId.Marsh => RuntimeAssetCatalog.BrownMud,
            BiomeId.Mountains => RuntimeAssetCatalog.GrayRocks,
            BiomeId.Hills => RuntimeAssetCatalog.StoneWall,
            BiomeId.DrySteppe => RuntimeAssetCatalog.Dirt,
            BiomeId.Cold => RuntimeAssetCatalog.Snow,
            BiomeId.DenseForest or BiomeId.SparseWoodland => RuntimeAssetCatalog.ForestGround,
            BiomeId.FertileValley or BiomeId.Plains => RuntimeAssetCatalog.GrassMedium,
            _ => RuntimeAssetCatalog.GrassMedium,
        };
    }

    private static Color TribeColor(int id)
    {
        var hue = (id * 0.61803398875f) % 1f;
        return FromHsv(hue, 0.58f, 0.94f);
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
}
