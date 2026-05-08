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
        var biomeByCoordinate = simulation.Tiles.ToDictionary(tile => (tile.X, tile.Y), tile => tile.Biome);

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
                Biome: tile.Biome,
                TerrainSeed: simulation.Seed,
                MapWidth: simulation.Width,
                MapHeight: simulation.Height,
                ReliefNeighborMask: ReliefNeighborMask(tile.X, tile.Y, simulation.Width, simulation.Height, biomeByCoordinate));
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
                Name: tribe.Name,
                Position: TileCenter(home.X, home.Y),
                Radius: radius,
                Color: TribeVisuals.ColorForTribe(tribe.Id),
                Population: tribe.Population,
                HasCamp: true,
                CampPosition: TileCenter(home.X, home.Y),
                TerritoryRadius: 0f,
                Tier: tribe.Tier,
                MainCampTileId: tribe.MainCampTileId,
                Biome: home.Biome,
                Artifacts: tribe.Artifacts,
                ConstituentCount: tribe.ConstituentCount);
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
                Biome: biome,
                TerrainSeed: 0,
                MapWidth: mapWidth,
                MapHeight: mapHeight,
                ReliefNeighborMask: 0);
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
                Name: $"Tribe {tribe.Id}",
                Position: TileCenter(homeX, homeY),
                Radius: radius,
                Color: TribeVisuals.ColorForTribe((int)tribe.Id),
                Population: (int)tribe.Population,
                HasCamp: true,
                CampPosition: TileCenter(homeX, homeY),
                TerritoryRadius: 0f,
                Tier: (PolityTier)tribe.PolityTier,
                MainCampTileId: tribe.MainCampTile,
                Biome: biome,
                Artifacts: tribe.Artifacts,
                ConstituentCount: (int)tribe.ConstituentCount);
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

    private static int ReliefNeighborMask(
        int x,
        int y,
        int width,
        int height,
        Dictionary<(int X, int Y), BiomeId> biomeByCoordinate)
    {
        var mask = 0;
        var neighbors = y % 2 == 0
            ? new (int X, int Y)[]
            {
                (x, y - 1),
                (x + 1, y),
                (x, y + 1),
                (x - 1, y + 1),
                (x - 1, y),
                (x - 1, y - 1),
            }
            : new (int X, int Y)[]
            {
                (x + 1, y - 1),
                (x + 1, y),
                (x + 1, y + 1),
                (x, y + 1),
                (x - 1, y),
                (x, y - 1),
            };

        for (var side = 0; side < neighbors.Length; side++)
        {
            var neighbor = neighbors[side];
            if (neighbor.X >= 0 && neighbor.X < width && neighbor.Y >= 0 && neighbor.Y < height
                && biomeByCoordinate.TryGetValue(neighbor, out var neighborBiome))
            {
                mask |= ReliefClass(neighborBiome) << (side * 2);
            }
        }

        return mask;
    }

    private static int ReliefClass(BiomeId biome)
    {
        return biome switch
        {
            BiomeId.Hills => 1,
            BiomeId.Mountains => 2,
            _ => 0,
        };
    }

}
