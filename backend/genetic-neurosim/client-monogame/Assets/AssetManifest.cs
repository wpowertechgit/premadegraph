using TribalNeuroSim.Client.Domain;

namespace TribalNeuroSim.Client.Assets;

public static class AssetManifest
{
    public static IReadOnlyList<(string Key, string AssetKey)> IconBindings { get; } =
    [
        ("artifact/combat", "UI/Icons/Artifacts/combat"),
        ("artifact/resource", "UI/Icons/Artifacts/resource"),
        ("artifact/map-objective", "UI/Icons/Artifacts/map-objective"),
        ("artifact/risk", "UI/Icons/Artifacts/risk"),
        ("artifact/team", "UI/Icons/Artifacts/team"),
        ("event/starvation", "UI/Icons/Events/starvation"),
        ("event/migration", "UI/Icons/Events/migration"),
        ("event/war", "UI/Icons/Events/war"),
        ("event/merger", "UI/Icons/Events/merger"),
        ("event/extinction", "UI/Icons/Events/extinction"),
        ("event/rebellion", "UI/Icons/Events/rebellion"),
        ("event/alliance", "UI/Icons/Events/alliance"),
    ];

    public static IReadOnlyList<BiomeVisualProfile> BiomeProfiles { get; } =
    [
        new(
            BiomeId.Unknown,
            "Unknown",
            "Materials/Terrain/fallback",
            ["Models/Vegetation/LowPolyEnvironmentPack/Rock_1"],
            "#3b3b3b"),
        new(
            BiomeId.Plains,
            "Plains",
            "Materials/Terrain/grass_medium_01_diff_1k",
            [
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Common_Short",
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Common_Tall",
                "Models/Vegetation/LowPolyEnvironmentPack/Bush_1",
                "Models/Structures/KenneySurvivalKit/tent",
            ],
            "#7d9a4e"),
        new(
            BiomeId.DenseForest,
            "Dense Forest",
            "Materials/Terrain/forrest_ground_01_diff_1k",
            [
                "Models/Vegetation/StylizedNatureMegaKit/CommonTree_1",
                "Models/Vegetation/StylizedNatureMegaKit/CommonTree_2",
                "Models/Vegetation/UltimateNaturePack/Temperate/BirchTree_1",
                "Models/Vegetation/StylizedNatureMegaKit/Fern_1",
            ],
            "#31583a"),
        new(
            BiomeId.SparseWoodland,
            "Sparse Woodland",
            "Materials/Terrain/forrest_ground_01_diff_1k",
            [
                "Models/Vegetation/StylizedNatureMegaKit/CommonTree_3",
                "Models/Vegetation/UltimateNaturePack/Temperate/Bush_1",
                "Models/Vegetation/UltimateNaturePack/Temperate/WoodLog_Moss",
                "Models/Vegetation/LowPolyEnvironmentPack/Grass_1",
            ],
            "#5f7f45"),
        new(
            BiomeId.Hills,
            "Hills",
            "Materials/Terrain/gray_rocks_diff_1k",
            [
                "Models/Biomes/ModularTerrainCollection/Hilly_Terrain_Grass_Floor",
                "Models/Structures/ModularTerrainCollection/Hilly_Prop_Rock_1",
                "Models/Structures/ModularTerrainCollection/Hilly_Prop_Grass_Clump_1",
                "Models/Structures/ModularTerrainCollection/Hilly_Prop_Camp_Campfire",
            ],
            "#6f7552"),
        new(
            BiomeId.Mountains,
            "Mountains",
            "Materials/Terrain/stone_wall_diff_1k",
            [
                "Models/Biomes/ModularTerrainCollection/Mountain_1",
                "Models/Biomes/ModularTerrainCollection/Mountain_2",
                "Models/Structures/ModularTerrainCollection/Shared_Prop_Boulder_1",
                "Models/Structures/ModularTerrainCollection/Cliff_Prop_Bridge_Rope_End",
            ],
            "#73716a"),
        new(
            BiomeId.Marsh,
            "Marsh",
            "Materials/Terrain/brown_mud_diff_1k",
            [
                "Models/Vegetation/UltimateNaturePack/Marsh/Lilypad",
                "Models/Vegetation/UltimateNaturePack/Marsh/Willow_3",
                "Models/Vegetation/StylizedNatureMegaKit/DeadTree_1",
                "Models/Structures/ModularTerrainCollection/Hilly_Prop_Cattail_1",
            ],
            "#536b4f"),
        new(
            BiomeId.Riverland,
            "Riverland",
            "Materials/Terrain/coast_sand_01_diff_1k",
            [
                "Models/Structures/ModularTerrainCollection/Beach_Prop_Docks_Straight",
                "Models/Structures/ModularTerrainCollection/Beach_Prop_Docks_Corner",
                "Models/Structures/LowPolyPixelRpgAssets/bridgeWooden01",
                "Models/Structures/KenneyRetroFantasyKit/dock-side",
            ],
            "#6f8f78"),
        new(
            BiomeId.DrySteppe,
            "Dry Steppe",
            "Materials/Terrain/dirt_diff_1k",
            [
                "Models/Vegetation/UltimateNaturePack/Dry/Cactus_1",
                "Models/Vegetation/UltimateNaturePack/Dry/Cactus_2",
                "Models/Vegetation/UltimateNaturePack/Dry/PalmTree_1",
                "Models/Vegetation/StylizedNatureMegaKit/Rock_Medium_1",
            ],
            "#9a7a43"),
        new(
            BiomeId.FertileValley,
            "Fertile Valley",
            "Materials/Terrain/grass_medium_01_diff_1k",
            [
                "Models/Structures/MedievalVillagePack/Hay",
                "Models/Structures/MedievalVillagePack/Well",
                "Models/Structures/KenneySurvivalKit/resource-planks",
                "Models/Structures/ModularVillage/Prop_Well_1",
            ],
            "#80a35a"),
        new(
            BiomeId.Cold,
            "Cold",
            "Materials/Terrain/snow_01_diff_1k",
            [
                "Models/Vegetation/UltimateNaturePack/Cold/BirchTree_Snow_1",
                "Models/Vegetation/UltimateNaturePack/Cold/Bush_Snow_1",
                "Models/Vegetation/RetroNaturePack/Winter/tree01_winter",
                "Models/Vegetation/LowpolyForestPack/Dead/DeadSpruce1",
            ],
            "#b5c2bd"),
    ];

    public static IReadOnlyList<SettlementVisualProfile> SettlementProfiles { get; } =
    [
        // Tribal — 3 biome variants
        new(PolityTier.Tribe, null,              RuntimeAssetCatalog.SettlementTribalGreen,   "UI/Insignia/tribe",   "LOD/settlements/tribe"),
        new(PolityTier.Tribe, BiomeId.Plains,     RuntimeAssetCatalog.SettlementTribalGreen,   "UI/Insignia/tribe",   "LOD/settlements/tribe"),
        new(PolityTier.Tribe, BiomeId.DrySteppe,  RuntimeAssetCatalog.SettlementTribalDesert,  "UI/Insignia/tribe",   "LOD/settlements/tribe"),
        new(PolityTier.Tribe, BiomeId.Cold,       RuntimeAssetCatalog.SettlementTribalWinter,  "UI/Insignia/tribe",   "LOD/settlements/tribe"),
        // City
        new(PolityTier.City,  null,               RuntimeAssetCatalog.SettlementCityGreen,     "UI/Insignia/city",    "LOD/settlements/city"),
        // Duchy
        new(PolityTier.Duchy, null,               RuntimeAssetCatalog.SettlementDuchyGreen,    "UI/Insignia/duchy",   "LOD/settlements/duchy"),
        // Kingdom
        new(PolityTier.Kingdom,null,              RuntimeAssetCatalog.SettlementKingdomGreen,   "UI/Insignia/kingdom", "LOD/settlements/kingdom"),
        // Empire
        new(PolityTier.Empire,null,               RuntimeAssetCatalog.SettlementEmpireGreen,   "UI/Insignia/empire",  "LOD/settlements/empire"),
    ];
}
