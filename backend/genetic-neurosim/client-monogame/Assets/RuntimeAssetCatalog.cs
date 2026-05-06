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
    public const string GrassMedium = "terrain/rocky-terrain";
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

    // ── Terrain 3D models (ModularTerrainCollection) ──
    public const string TerrainHillyGrass = "terrain/hilly-grass";
    public const string TerrainMountain1 = "terrain/mountain-1";
    public const string TerrainMountain2 = "terrain/mountain-2";
    public const string TerrainMountain3 = "terrain/mountain-3";
    public const string TerrainMountain4 = "terrain/mountain-4";
    public const string TerrainBeachSand = "terrain/beach-sand";
    public const string TerrainBeachSandRaised = "terrain/beach-sand-raised";
    public const string TerrainCaveFloor = "terrain/cave-floor";
    public const string TerrainCaveFloorRaised = "terrain/cave-floor-raised";
    public const string TerrainCliffWaterfallTop = "terrain/cliff-waterfall-top";
    public const string TerrainCliffWaterfallMid = "terrain/cliff-waterfall-mid";
    public const string TerrainCliffWaterfallBase = "terrain/cliff-waterfall-base";
    public const string TerrainEscarpmentBase = "terrain/escarpment-base";
    public const string TerrainEscarpmentTop = "terrain/escarpment-top";
    public const string TerrainHillyWaterFlat = "terrain/hilly-water-flat";
    public const string TerrainHillyWaterSlope = "terrain/hilly-water-slope";
    public const string TerrainDirtCorner = "terrain/dirt-corner";
    public const string TerrainDirtStraight = "terrain/dirt-straight";

    public static IReadOnlyList<RuntimeAssetDefinition> Terrain { get; } =
    [
        new(GrassMedium, "Materials/Terrain/rocky_terrain_02_diff_1k.png"),
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

    public static IReadOnlyList<RuntimeAssetDefinition> TerrainModels { get; } =
    [
        new(TerrainHillyGrass, "Models/Biomes/ModularTerrainCollection/Hilly_Terrain_Grass_Floor.obj"),
        new(TerrainMountain1, "Models/Biomes/ModularTerrainCollection/Mountain_1.obj"),
        new(TerrainMountain2, "Models/Biomes/ModularTerrainCollection/Mountain_2.obj"),
        new(TerrainMountain3, "Models/Biomes/ModularTerrainCollection/Mountain_3.obj"),
        new(TerrainMountain4, "Models/Biomes/ModularTerrainCollection/Mountain_4.obj"),
        new(TerrainBeachSand, "Models/Biomes/ModularTerrainCollection/Beach_Terrain_Sand_Floor.obj"),
        new(TerrainBeachSandRaised, "Models/Biomes/ModularTerrainCollection/Beach_Terrain_Sand_Floor_Raised.obj"),
        new(TerrainCaveFloor, "Models/Biomes/ModularTerrainCollection/Cave_Terrain_Floor_Normal.obj"),
        new(TerrainCaveFloorRaised, "Models/Biomes/ModularTerrainCollection/Cave_Terrain_Floor_Raised.obj"),
        new(TerrainCliffWaterfallTop, "Models/Biomes/ModularTerrainCollection/Cliff_Terrain_Waterfall_Top.obj"),
        new(TerrainCliffWaterfallMid, "Models/Biomes/ModularTerrainCollection/Cliff_Terrain_Waterfall_Mid.obj"),
        new(TerrainCliffWaterfallBase, "Models/Biomes/ModularTerrainCollection/Cliff_Terrain_Waterfall_Base_Flat.obj"),
        new(TerrainEscarpmentBase, "Models/Biomes/ModularTerrainCollection/Escarpment_Terrain_Hill_Base.obj"),
        new(TerrainEscarpmentTop, "Models/Biomes/ModularTerrainCollection/Escarpment_Terrain_Hill_Top.obj"),
        new(TerrainHillyWaterFlat, "Models/Biomes/ModularTerrainCollection/Hilly_Terrain_Water_Flat.obj"),
        new(TerrainHillyWaterSlope, "Models/Biomes/ModularTerrainCollection/Hilly_Terrain_Water_Slope.obj"),
        new(TerrainDirtCorner, "Models/Biomes/ModularTerrainCollection/Shared_Terrain_Dirt_Gathered_Corner.obj"),
        new(TerrainDirtStraight, "Models/Biomes/ModularTerrainCollection/Shared_Terrain_Dirt_Gathered_Straight.obj"),
    ];

    // ── Settlement 3D models (Polity Tier Visuals) ──
    public const string SettlementTribalGreen = "settlement/tribal_green";
    public const string SettlementTribalDesert = "settlement/tribal_desert";
    public const string SettlementTribalWinter = "settlement/tribal_winter";
    public const string SettlementCityGreen = "settlement/city_green";
    public const string SettlementDuchyGreen = "settlement/duchy_green";
    public const string SettlementKingdomGreen = "settlement/kingdom_green";
    public const string SettlementEmpireGreen = "settlement/empire_green";

    public static IReadOnlyList<RuntimeAssetDefinition> SettlementModels { get; } =
    [
        new(SettlementTribalGreen, "Models/Settlements/Tribal_Green/tribal_green.fbx"),
        new(SettlementTribalDesert, "Models/Settlements/Tribal_Desert/tribal_desert.fbx"),
        new(SettlementTribalWinter, "Models/Settlements/Tribal_Winter/tribal_winter.fbx"),
        new(SettlementCityGreen, "Models/Settlements/City_Green/city_green.fbx"),
        new(SettlementDuchyGreen, "Models/Settlements/Duchy_Green/duchy_green.fbx"),
        new(SettlementKingdomGreen, "Models/Settlements/Kingdom_Green/kingdom_green.fbx"),
        new(SettlementEmpireGreen, "Models/Settlements/Empire_Green/empire_green.fbx"),
    ];

    // ── Insignia: faction icon emblems (44 icons, 512x512 black-bg white-symbol) ──
    public const string InsigniaTribePolity = "insignia/tribe_polity";
    public const string InsigniaCityPolity = "insignia/city_polity";
    public const string InsigniaDuchyPolity = "insignia/duchy_polity";
    public const string InsigniaKingdomPolity = "insignia/kingdom_polity";
    public const string InsigniaEmpirePolity = "insignia/empire_polity";
    public const string InsigniaRibbon = "insignia/ribbon";

    public const string InsigniaTribeBanner = "insignia/tribe_banner";
    public const string InsigniaCityBanner = "insignia/city_banner";
    public const string InsigniaDuchyBanner = "insignia/duchy_banner";
    public const string InsigniaKingdomBanner = "insignia/kingdom_banner";
    public const string InsigniaEmpireBanner = "insignia/empire_banner";

    public static IReadOnlyList<RuntimeAssetDefinition> InsigniaIcons { get; } =
    [
        new("icons/anarchy", "Image/icons/anarchy.png"),
        new("icons/brazil-flag", "Image/icons/brazil-flag.png"),
        new("icons/brutal-helm", "Image/icons/brutal-helm.png"),
        new("icons/carnyx", "Image/icons/carnyx.png"),
        new("icons/cloud-ring", "Image/icons/cloud-ring.png"),
        new("icons/croissant", "Image/icons/croissant.png"),
        new("icons/cross-mark", "Image/icons/cross-mark.png"),
        new("icons/cross-shield", "Image/icons/cross-shield.png"),
        new("icons/crossbow", "Image/icons/crossbow.png"),
        new("icons/cruiser", "Image/icons/cruiser.png"),
        new("icons/curly-wing", "Image/icons/curly-wing.png"),
        new("icons/curvy-knife", "Image/icons/curvy-knife.png"),
        new("icons/death-juice", "Image/icons/death-juice.png"),
        new("icons/dervish-swords", "Image/icons/dervish-swords.png"),
        new("icons/dread", "Image/icons/dread.png"),
        new("icons/eclipse-flare", "Image/icons/eclipse-flare.png"),
        new("icons/eclipse", "Image/icons/eclipse.png"),
        new("icons/energy-arrow", "Image/icons/energy-arrow.png"),
        new("icons/flame", "Image/icons/flame.png"),
        new("icons/halberd-shuriken", "Image/icons/halberd-shuriken.png"),
        new("icons/hammer-sickle", "Image/icons/hammer-sickle.png"),
        new("icons/imprisoned", "Image/icons/imprisoned.png"),
        new("icons/locked-fortress", "Image/icons/locked-fortress.png"),
        new("icons/magic-gate", "Image/icons/magic-gate.png"),
        new("icons/magic-lamp", "Image/icons/magic-lamp.png"),
        new("icons/medusa-head", "Image/icons/medusa-head.png"),
        new("icons/mighty-force", "Image/icons/mighty-force.png"),
        new("icons/moebius-star", "Image/icons/moebius-star.png"),
        new("icons/moebius-triangle", "Image/icons/moebius-triangle.png"),
        new("icons/octogonal-eye", "Image/icons/octogonal-eye.png"),
        new("icons/oppidum", "Image/icons/oppidum.png"),
        new("icons/orange", "Image/icons/orange.png"),
        new("icons/polar-star", "Image/icons/polar-star.png"),
        new("icons/prism", "Image/icons/prism.png"),
        new("icons/queen-crown", "Image/icons/queen-crown.png"),
        new("icons/ram", "Image/icons/ram.png"),
        new("icons/revolt", "Image/icons/revolt.png"),
        new("icons/sharp-shuriken", "Image/icons/sharp-shuriken.png"),
        new("icons/slumbering-sanctuary", "Image/icons/slumbering-sanctuary.png"),
        new("icons/swordman", "Image/icons/swordman.png"),
        new("icons/union-jack", "Image/icons/union-jack.png"),
        new("icons/usa-flag", "Image/icons/usa-flag.png"),
        new("icons/zebra-shield", "Image/icons/zebra-shield.png"),
        new("icons/zeus-sword", "Image/icons/zeus-sword.png"),
    ];

    public static IReadOnlyList<RuntimeAssetDefinition> InsigniaFrames { get; } =
    [
        new(InsigniaTribePolity, "Image/polity/tribe_polity.png"),
        new(InsigniaCityPolity, "Image/polity/city_polity.png"),
        new(InsigniaDuchyPolity, "Image/polity/duchy_polity.png"),
        new(InsigniaKingdomPolity, "Image/polity/kingdom_polity.png"),
        new(InsigniaEmpirePolity, "Image/polity/empire_polity.png"),
        new(InsigniaTribeBanner, "Image/polity/tribe_banner.png"),
        new(InsigniaCityBanner, "Image/polity/city_banner.png"),
        new(InsigniaDuchyBanner, "Image/polity/duchy_banner.png"),
        new(InsigniaKingdomBanner, "Image/polity/kingdom_banner.png"),
        new(InsigniaEmpireBanner, "Image/polity/empire_banner.png"),
    ];

    public static IReadOnlyList<RuntimeAssetDefinition> InsigniaRibbons { get; } =
    [
        new(InsigniaRibbon, "Image/location-ribbon-banner.png"),
    ];

    public static IReadOnlyDictionary<string, RuntimeAssetDefinition> AssetsByKey { get; } =
        Terrain
            .Concat(Vegetation)
            .Concat(Concept)
            .Concat(TerrainModels)
            .Concat(SettlementModels)
            .Concat(InsigniaIcons)
            .Concat(InsigniaFrames)
            .Concat(InsigniaRibbons)
            .ToDictionary(asset => asset.Key, StringComparer.OrdinalIgnoreCase);
}

public sealed record RuntimeAssetDefinition(string Key, string RelativePath);
