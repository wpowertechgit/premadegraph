using Microsoft.Xna.Framework;
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

    /// <summary>
    /// Biome visual profiles. PropAssetKeys MUST reference models that exist as .gltf/.glb
    /// under Content/. Only StylizedNatureMegaKit and KenneySurvivalKit models are verified.
    /// </summary>
    public static IReadOnlyList<BiomeVisualProfile> BiomeProfiles { get; } =
    [
        new(
            BiomeId.Unknown,
            "Unknown",
            "Materials/Terrain/fallback",
            ["Models/Vegetation/StylizedNatureMegaKit/Rock_Medium_1"],
            0.3f,
            "#3b3b3b",
            new Color(105, 105, 105)), // neutral grey
        new(
            BiomeId.Plains,
            "Plains",
            "Materials/Terrain/rocky_terrain_02_diff_1k",
            [
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Common_Short",
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Common_Tall",
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Wispy_Short",
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Wispy_Tall",
                "Models/Vegetation/StylizedNatureMegaKit/Bush_Common",
            ],
            1.0f,
            "#7d9a4e",
            new Color(118, 116, 106)), // warm neutral
        new(
            BiomeId.DenseForest,
            "Dense Forest",
            "Materials/Terrain/forrest_ground_01_diff_1k",
            [
                "Models/Vegetation/StylizedNatureMegaKit/CommonTree_1",
                "Models/Vegetation/StylizedNatureMegaKit/CommonTree_2",
                "Models/Vegetation/StylizedNatureMegaKit/Fern_1",
                "Models/Vegetation/StylizedNatureMegaKit/Bush_Common",
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Common_Short",
            ],
            1.2f,
            "#31583a",
            new Color(95, 110, 90)), // green canopy shade
        new(
            BiomeId.SparseWoodland,
            "Sparse Woodland",
            "Materials/Terrain/forrest_ground_01_diff_1k",
            [
                "Models/Vegetation/StylizedNatureMegaKit/CommonTree_3",
                "Models/Vegetation/StylizedNatureMegaKit/Bush_Common_Flowers",
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Wispy_Tall",
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Common_Short",
            ],
            0.9f,
            "#5f7f45",
            new Color(108, 118, 100)), // lighter woodland
        new(
            BiomeId.Hills,
            "Hills",
            "Materials/Terrain/gray_rocks_diff_1k",
            [
                "Models/Vegetation/StylizedNatureMegaKit/Rock_Medium_1",
                "Models/Vegetation/StylizedNatureMegaKit/Rock_Medium_2",
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Wispy_Short",
                "Models/Vegetation/StylizedNatureMegaKit/Bush_Common",
            ],
            0.7f,
            "#6f7552",
            new Color(112, 108, 102)), // rocky warm
        new(
            BiomeId.Mountains,
            "Mountains",
            "Materials/Terrain/stone_wall_diff_1k",
            [
                "Models/Vegetation/StylizedNatureMegaKit/Rock_Medium_1",
                "Models/Vegetation/StylizedNatureMegaKit/Rock_Medium_2",
                "Models/Vegetation/StylizedNatureMegaKit/Rock_Medium_3",
            ],
            0.5f,
            "#73716a",
            new Color(108, 108, 112)), // cool grey
        new(
            BiomeId.Marsh,
            "Marsh",
            "Materials/Terrain/brown_mud_diff_1k",
            [
                "Models/Vegetation/StylizedNatureMegaKit/DeadTree_1",
                "Models/Vegetation/StylizedNatureMegaKit/DeadTree_2",
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Wispy_Short",
                "Models/Vegetation/StylizedNatureMegaKit/Plant_1",
            ],
            0.8f,
            "#536b4f",
            new Color(100, 108, 105)), // murky green
        new(
            BiomeId.Riverland,
            "Riverland",
            "Materials/Terrain/coast_sand_01_diff_1k",
            [
                "Models/Structures/KenneyRetroFantasyKit/dock-side",
                "Models/Vegetation/StylizedNatureMegaKit/Plant_7",
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Common_Short",
            ],
            0.5f,
            "#6f8f78",
            new Color(102, 112, 118)), // watery blue
        new(
            BiomeId.DrySteppe,
            "Dry Steppe",
            "Materials/Terrain/dirt_diff_1k",
            [
                "Models/Vegetation/StylizedNatureMegaKit/Rock_Medium_1",
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Wispy_Short",
                "Models/Vegetation/StylizedNatureMegaKit/Bush_Common",
            ],
            0.6f,
            "#9a7a43",
            new Color(118, 108, 98)), // warm dry
        new(
            BiomeId.FertileValley,
            "Fertile Valley",
            "Materials/Terrain/rocky_terrain_02_diff_1k",
            [
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Common_Tall",
                "Models/Vegetation/StylizedNatureMegaKit/Grass_Wispy_Tall",
                "Models/Vegetation/StylizedNatureMegaKit/Bush_Common_Flowers",
                "Models/Structures/KenneySurvivalKit/resource-planks",
            ],
            1.1f,
            "#80a35a",
            new Color(118, 122, 108)), // lush green
        new(
            BiomeId.Cold,
            "Cold",
            "Materials/Terrain/snow_01_diff_1k",
            [
                "Models/Vegetation/StylizedNatureMegaKit/Pine_1",
                "Models/Vegetation/StylizedNatureMegaKit/Pine_2",
                "Models/Vegetation/StylizedNatureMegaKit/Pine_3",
                "Models/Vegetation/StylizedNatureMegaKit/Rock_Medium_3",
            ],
            0.6f,
            "#b5c2bd",
            new Color(112, 118, 125)), // icy blue-tinted
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

    // ── Prop Visual Profiles (V0: 2-3 families per biome) ──

    public static IReadOnlyList<PropVisualProfile> PropProfiles { get; } =
    [
        // Grass family
        new("prop/grass-common-short", PropFamily.GrassPatch,
            "Models/Vegetation/StylizedNatureMegaKit/Grass_Common_Short", null, 0.10f, 0.25f, true, false, 0f, 700f),
        new("prop/grass-common-tall", PropFamily.GrassPatch,
            "Models/Vegetation/StylizedNatureMegaKit/Grass_Common_Tall", null, 0.12f, 0.25f, true, false, 0f, 700f),
        new("prop/grass-wispy-short", PropFamily.GrassPatch,
            "Models/Vegetation/StylizedNatureMegaKit/Grass_Wispy_Short", null, 0.09f, 0.25f, true, false, 0f, 700f),
        new("prop/grass-wispy-tall", PropFamily.GrassPatch,
            "Models/Vegetation/StylizedNatureMegaKit/Grass_Wispy_Tall", null, 0.11f, 0.25f, true, false, 0f, 700f),

        // Tree family
        new("prop/common-tree-1", PropFamily.Tree,
            "Models/Vegetation/StylizedNatureMegaKit/CommonTree_1", null, 0.16f, 0.20f, false, true, 0f, 2000f),
        new("prop/common-tree-2", PropFamily.Tree,
            "Models/Vegetation/StylizedNatureMegaKit/CommonTree_2", null, 0.16f, 0.20f, false, true, 0f, 2000f),
        new("prop/common-tree-3", PropFamily.Tree,
            "Models/Vegetation/StylizedNatureMegaKit/CommonTree_3", null, 0.15f, 0.20f, false, true, 0f, 2000f),
        new("prop/pine-1", PropFamily.Tree,
            "Models/Vegetation/StylizedNatureMegaKit/Pine_1", null, 0.16f, 0.18f, false, true, 0f, 2000f),
        new("prop/pine-2", PropFamily.Tree,
            "Models/Vegetation/StylizedNatureMegaKit/Pine_2", null, 0.16f, 0.18f, false, true, 0f, 2000f),
        new("prop/pine-3", PropFamily.Tree,
            "Models/Vegetation/StylizedNatureMegaKit/Pine_3", null, 0.15f, 0.18f, false, true, 0f, 2000f),

        // Dead wood family
        new("prop/dead-tree-1", PropFamily.DeadWood,
            "Models/Vegetation/StylizedNatureMegaKit/DeadTree_1", null, 0.14f, 0.15f, false, false, 0f, 1500f),
        new("prop/dead-tree-2", PropFamily.DeadWood,
            "Models/Vegetation/StylizedNatureMegaKit/DeadTree_2", null, 0.14f, 0.15f, false, false, 0f, 1500f),

        // Bush family
        new("prop/bush-common", PropFamily.Bush,
            "Models/Vegetation/StylizedNatureMegaKit/Bush_Common", null, 0.12f, 0.25f, true, false, 0f, 1000f),
        new("prop/bush-flowers", PropFamily.Bush,
            "Models/Vegetation/StylizedNatureMegaKit/Bush_Common_Flowers", null, 0.12f, 0.25f, true, false, 0f, 1000f),

        // Rock family
        new("prop/rock-medium-1", PropFamily.Rock,
            "Models/Vegetation/StylizedNatureMegaKit/Rock_Medium_1", null, 0.10f, 0.20f, false, false, 0f, 2000f),
        new("prop/rock-medium-2", PropFamily.Rock,
            "Models/Vegetation/StylizedNatureMegaKit/Rock_Medium_2", null, 0.10f, 0.20f, false, false, 0f, 2000f),
        new("prop/rock-medium-3", PropFamily.Rock,
            "Models/Vegetation/StylizedNatureMegaKit/Rock_Medium_3", null, 0.09f, 0.20f, false, false, 0f, 2000f),

        // Reed / marsh plant family
        new("prop/plant-1", PropFamily.Reed,
            "Models/Vegetation/StylizedNatureMegaKit/Plant_1", null, 0.10f, 0.20f, true, false, 0f, 800f),
        new("prop/plant-7", PropFamily.Reed,
            "Models/Vegetation/StylizedNatureMegaKit/Plant_7", null, 0.10f, 0.20f, true, false, 0f, 800f),

        // Flower family
        new("prop/fern-1", PropFamily.Flower,
            "Models/Vegetation/StylizedNatureMegaKit/Fern_1", null, 0.08f, 0.20f, true, false, 0f, 600f),
    ];

    // ── Biome Prop Rules (V0: per-biome per-family density and placement constraints) ──

    public static IReadOnlyList<BiomePropRule> BiomePropRules { get; } =
    [
        // Plains — grass, low shrubs, occasional rocks
        new(BiomeId.Plains, PropFamily.GrassPatch, 1.0f, 6, 12, 1f, 11f, 5f, 0f,
            ["prop/grass-common-short", "prop/grass-common-tall", "prop/grass-wispy-short", "prop/grass-wispy-tall"]),
        new(BiomeId.Plains, PropFamily.Bush, 0.5f, 1, 4, 2f, 10f, 4f, 0f,
            ["prop/bush-common", "prop/bush-flowers"]),
        new(BiomeId.Plains, PropFamily.Rock, 0.2f, 0, 3, 3f, 11f, 5f, 0f,
            ["prop/rock-medium-1", "prop/rock-medium-2", "prop/rock-medium-3"]),

        // FertileValley — dense grass, bushes, flowers
        new(BiomeId.FertileValley, PropFamily.GrassPatch, 1.1f, 6, 12, 1f, 11f, 5f, 0f,
            ["prop/grass-common-tall", "prop/grass-wispy-tall", "prop/grass-common-short", "prop/grass-wispy-short"]),
        new(BiomeId.FertileValley, PropFamily.Bush, 0.6f, 2, 4, 2f, 10f, 4f, 0f,
            ["prop/bush-flowers", "prop/bush-common"]),
        new(BiomeId.FertileValley, PropFamily.Flower, 0.3f, 1, 3, 2f, 9f, 4f, 0f,
            ["prop/fern-1"]),

        // DenseForest — tree clusters, bushes, fallen logs
        new(BiomeId.DenseForest, PropFamily.Tree, 1.2f, 5, 12, 2f, 11f, 6f, 0f,
            ["prop/common-tree-1", "prop/common-tree-2"]),
        new(BiomeId.DenseForest, PropFamily.Bush, 0.7f, 1, 4, 2f, 10f, 5f, 0f,
            ["prop/bush-common", "prop/bush-flowers"]),
        new(BiomeId.DenseForest, PropFamily.Log, 0.3f, 0, 2, 3f, 10f, 5f, 0f,
            ["prop/dead-tree-1"]), // dead tree serves as fallen log visual

        // SparseWoodland — fewer trees, more bushes
        new(BiomeId.SparseWoodland, PropFamily.Tree, 0.7f, 2, 6, 2f, 11f, 5f, 0f,
            ["prop/common-tree-3", "prop/common-tree-1"]),
        new(BiomeId.SparseWoodland, PropFamily.Bush, 0.7f, 1, 3, 2f, 10f, 4f, 0f,
            ["prop/bush-common", "prop/bush-flowers"]),
        new(BiomeId.SparseWoodland, PropFamily.Log, 0.2f, 0, 2, 3f, 10f, 5f, 0f,
            ["prop/dead-tree-1"]),

        // Hills — small rock clusters, sparse shrubs, dry grass
        new(BiomeId.Hills, PropFamily.Rock, 1.0f, 4, 9, 2f, 11f, 4f, 0.05f,
            ["prop/rock-medium-1", "prop/rock-medium-2", "prop/rock-medium-3"]),
        new(BiomeId.Hills, PropFamily.GrassPatch, 0.3f, 0, 2, 2f, 10f, 4f, 0f,
            ["prop/grass-wispy-short"]),
        new(BiomeId.Hills, PropFamily.Bush, 0.2f, 0, 1, 3f, 10f, 4f, 0f,
            ["prop/bush-common"]),

        // Mountains — sparse rocks only, no vegetation
        new(BiomeId.Mountains, PropFamily.Rock, 1.25f, 6, 12, 2f, 11f, 4f, 0.08f,
            ["prop/rock-medium-3", "prop/rock-medium-1", "prop/rock-medium-2"]),

        // Marsh — reeds, dead trees, no dry rocks
        new(BiomeId.Marsh, PropFamily.DeadWood, 0.6f, 1, 3, 2f, 10f, 5f, 0f,
            ["prop/dead-tree-1", "prop/dead-tree-2"]),
        new(BiomeId.Marsh, PropFamily.Reed, 0.7f, 1, 4, 1f, 11f, 4f, 0f,
            ["prop/plant-1", "prop/plant-7"]),

        // Riverland — reeds, plants only; no trees, no dry rocks
        new(BiomeId.Riverland, PropFamily.Reed, 0.4f, 1, 3, 2f, 10f, 4f, 0f,
            ["prop/plant-7", "prop/plant-1"]),

        // DrySteppe — sparse rocks, dry grass
        new(BiomeId.DrySteppe, PropFamily.Rock, 0.72f, 3, 7, 2f, 11f, 4f, 0f,
            ["prop/rock-medium-1", "prop/rock-medium-2", "prop/rock-medium-3"]),
        new(BiomeId.DrySteppe, PropFamily.GrassPatch, 0.3f, 1, 3, 2f, 10f, 4f, 0f,
            ["prop/grass-wispy-short"]),
        new(BiomeId.DrySteppe, PropFamily.Bush, 0.2f, 0, 1, 3f, 10f, 4f, 0f,
            ["prop/bush-common"]),

        // Cold — conifers, snow rocks, low grass
        new(BiomeId.Cold, PropFamily.Tree, 0.5f, 1, 5, 2f, 11f, 5f, 0f,
            ["prop/pine-1", "prop/pine-2", "prop/pine-3"]),
        new(BiomeId.Cold, PropFamily.Rock, 0.3f, 0, 2, 3f, 10f, 4f, 0.03f,
            ["prop/rock-medium-3", "prop/rock-medium-1"]),

        // Unknown — minimal
        new(BiomeId.Unknown, PropFamily.Rock, 0.2f, 0, 1, 2f, 10f, 4f, 0f,
            ["prop/rock-medium-1"]),
    ];
}
