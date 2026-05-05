namespace TribalNeuroSim.Client.Assets;

public static class RuntimeAssetCatalog
{
    public const string GroundA = "terrain/ground-a";
    public const string GroundB = "terrain/ground-b";
    public const string GroundC = "terrain/ground-c";
    public const string WaterA = "terrain/water-a";
    public const string BridgeA = "terrain/bridge-a";
    public const string WallStoneA = "terrain/wall-stone-a";
    public const string WallEarthA = "terrain/wall-earth-a";
    public const string GrassMedium = "terrain/grass-medium";
    public const string ForestGround = "terrain/forest-ground";
    public const string BrownMud = "terrain/brown-mud";
    public const string Dirt = "terrain/dirt";
    public const string CoastSand = "terrain/coast-sand";
    public const string Snow = "terrain/snow";
    public const string GrayRocks = "terrain/gray-rocks";
    public const string StoneWall = "terrain/stone-wall";

    public const string BushWinter = "vegetation/bush-winter";
    public const string TreeWinter = "vegetation/tree-winter";

    public const string TribeConcept = "concept/tribe";

    public static IReadOnlyList<RuntimeAssetDefinition> Terrain { get; } =
    [
        new(GrassMedium, "Materials/Terrain/grass_medium_01_diff_1k.png"),
        new(ForestGround, "Materials/Terrain/forrest_ground_01_diff_1k.png"),
        new(BrownMud, "Materials/Terrain/brown_mud_diff_1k.png"),
        new(Dirt, "Materials/Terrain/dirt_diff_1k.png"),
        new(CoastSand, "Materials/Terrain/coast_sand_01_diff_1k.png"),
        new(Snow, "Materials/Terrain/snow_01_diff_1k.png"),
        new(GrayRocks, "Materials/Terrain/gray_rocks_diff_1k.png"),
        new(StoneWall, "Materials/Terrain/stone_wall_diff_1k.png"),
    ];

    public static IReadOnlyList<RuntimeAssetDefinition> Vegetation { get; } =
    [
        new(BushWinter, "Materials/Vegetation/RetroNaturePack/bush1_winter.png"),
        new(TreeWinter, "Materials/Vegetation/RetroNaturePack/tree01_winter.png"),
    ];

    public static IReadOnlyList<RuntimeAssetDefinition> Concept { get; } =
    [
        new(TribeConcept, "ConceptArts/Tribe.jpg"),
    ];

    public static IReadOnlyDictionary<string, RuntimeAssetDefinition> AssetsByKey { get; } =
        Terrain
            .Concat(Vegetation)
            .Concat(Concept)
            .ToDictionary(asset => asset.Key, StringComparer.OrdinalIgnoreCase);
}

public sealed record RuntimeAssetDefinition(string Key, string RelativePath);
