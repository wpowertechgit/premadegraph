# Tribal NeuroSim v3 Asset Plan

## Status

Proposed.

## Purpose

This document defines the visual asset plan for Tribal NeuroSim v3 as a separate concern from architecture and simulation mechanics.

It covers:

- what assets we need
- which assets should be 2D versus 3D
- where generative AI is appropriate
- where free models or handcrafted simple geometry are preferable
- the target visual direction
- prompt plans for generating the asset families

## Repo Asset Paths

Current MonoGame client root:

- `backend/genetic-neurosim/client-monogame/`

Code-only asset registry and visual-profile classes live here:

- `backend/genetic-neurosim/client-monogame/Assets/`

Raw downloaded and game-content asset files should live here:

- `backend/genetic-neurosim/client-monogame/Content/`

Current material subfolders:

- `backend/genetic-neurosim/client-monogame/Content/Materials/Terrain/`
- `backend/genetic-neurosim/client-monogame/Content/Materials/Vegetation/`

Rule:

- `.cs` files stay in `Assets/`
- downloaded `.png`, `.jpg`, `.glb`, `.fbx`, `.obj`, `.ttf`, `.otf` files go under `Content/`

Do not mix raw asset files into the code folder.

## Current Collected Assets

This section tracks what is already in the repo right now.

### Terrain materials already collected

Path:

- `backend/genetic-neurosim/client-monogame/Content/Materials/Terrain/`

Current sets:

- `dirt_*`
- `brown_mud_*`
- `coast_sand_01_*`
- `forrest_ground_01_*`
- `grass_medium_01_*`
- `gray_rocks_*`
- `snow_01_*`
- `stone_wall_*`

Practical meaning:

- Basket 1 is in good shape
- we already have dirt, mud, sand, forest floor, grass, rock, snow, and stone-support material coverage

### Vegetation-support textures already collected

Path:

- `backend/genetic-neurosim/client-monogame/Content/Materials/Vegetation/`

Current textures:

- `Bark_DeadTree*`
- `Bark_NormalTree*`
- `Bark_TwistedTree*`
- `Leaves*`
- `Leaf_Pine*`
- `Grass.png`
- `Flowers.png`
- `Mushrooms.png`
- `Rocks_Diffuse.png`
- `Rocks_Desert_Diffuse.png`
- `PathRocks_Diffuse.png`
- `bark_willow_02_*`

Practical meaning:

- we already have shared texture support for a first imported vegetation/model pack

### Stylized Nature MegaKit subset already imported

Model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Vegetation/StylizedNatureMegaKit/`

Current imported model subset:

- `CommonTree_1`
- `CommonTree_2`
- `CommonTree_3`
- `Pine_1`
- `Pine_2`
- `Pine_3`
- `DeadTree_1`
- `DeadTree_2`
- `Bush_Common`
- `Bush_Common_Flowers`
- `Fern_1`
- `Grass_Common_Short`
- `Grass_Common_Tall`
- `Grass_Wispy_Short`
- `Grass_Wispy_Tall`
- `Plant_1`
- `Plant_7`
- `Rock_Medium_1`
- `Rock_Medium_2`
- `Rock_Medium_3`

Format:

- `.gltf`
- `.bin`

Practical meaning:

- Basket 2 now has a very strong prototype-ready start
- we already have:
  - common trees
  - pines
  - dead trees
  - bushes
  - grass variants
  - ferns/plants
  - medium rocks

What is still not done:

- the assets still need runtime loading and rendering integration in MonoGame
- biome assignment rules still need to be decided
- we may still want a small dedicated marsh/reed set later

### Ultimate Nature Pack subset already imported

Model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Vegetation/UltimateNaturePack/`

Current imported biome-focused subset:

- `Temperate/`
  - `BirchTree_1.fbx`
  - `BirchTree_2.fbx`
  - `Willow_1.fbx`
  - `Willow_2.fbx`
  - `Bush_1.fbx`
  - `BushBerries_1.fbx`
  - `Rock_Moss_1.fbx`
  - `Rock_Moss_2.fbx`
  - `TreeStump_Moss.fbx`
  - `WoodLog_Moss.fbx`

- `Cold/`
  - `BirchTree_Snow_1.fbx`
  - `BirchTree_Dead_Snow_1.fbx`
  - `Bush_Snow_1.fbx`
  - `Rock_Snow_1.fbx`
  - `Rock_Snow_2.fbx`
  - `TreeStump_Snow.fbx`
  - `WoodLog_Snow.fbx`

- `Dry/`
  - `Cactus_1.fbx`
  - `Cactus_2.fbx`
  - `CactusFlower_1.fbx`
  - `PalmTree_1.fbx`

- `Marsh/`
  - `Lilypad.fbx`
  - `Willow_3.fbx`

Format:

- `.fbx`

Practical meaning:

- this pack complements the first one rather than replacing it
- it gives us stronger biome flavor for:
  - temperate woodland
  - cold/snow
  - dry steppe or desert-edge
  - marsh or wetland

Why this subset was chosen:

- it adds biome identity we did not already have
- it avoids copying the entire pack blindly
- it gives us a better spread of:
  - birch
  - willow
  - snow variants
  - cactus/palm dry-biome props
  - moss and snow rocks
  - stumps and logs

### Kenney Survival Kit subset already imported

Model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Structures/KenneySurvivalKit/`

Current imported subset:

- `barrel.glb`
- `box.glb`
- `bucket.glb`
- `campfire-pit.glb`
- `chest.glb`
- `fence.glb`
- `fence-doorway.glb`
- `fence-fortified.glb`
- `resource-planks.glb`
- `resource-stone.glb`
- `resource-stone-large.glb`
- `resource-wood.glb`
- `structure.glb`
- `structure-floor.glb`
- `structure-roof.glb`
- `tent.glb`
- `tent-canvas.glb`
- `tool-axe.glb`
- `tool-hoe.glb`
- `tool-pickaxe.glb`
- `tool-shovel.glb`
- `tree-log.glb`
- `tree-log-small.glb`
- `workbench.glb`

Format:

- `.glb`

Practical meaning:

- strong support for tribal camps, outposts, storage, resources, fences, tools, and survival props
- useful mainly for:
  - tribe tier dressing
  - economy/resource dressing
  - camp and migration support props

### Kenney Retro Fantasy Kit subset already imported

Model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Structures/KenneyRetroFantasyKit/`

Current imported subset:

- `detail-barrel.glb`
- `detail-crate.glb`
- `detail-crate-small.glb`
- `dock-corner.glb`
- `dock-side.glb`
- `fence.glb`
- `fence-top.glb`
- `fence-wood.glb`
- `ladder.glb`
- `pulley.glb`
- `pulley-crate.glb`
- `structure-pole.glb`
- `structure-poles.glb`
- `structure-wall.glb`
- `tower.glb`
- `tower-base.glb`
- `tower-top.glb`
- `wall-gate.glb`
- `wall-low.glb`

Format:

- `.glb`

Practical meaning:

- useful as modular low-poly structural pieces
- strongest use cases:
  - simple watchtower logic
  - wall/fence gate dressing
  - dock or river-edge structures
  - poles, ladders, crates, and rough fortification support

### Medieval Village Pack structure subset already imported

Structure path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Structures/MedievalVillagePack/`

Current imported subset:

- `Barrel.fbx`
- `Bench_1.fbx`
- `Bonfire_Lit.fbx`
- `Cart.fbx`
- `Crate.fbx`
- `Fence.fbx`
- `Hay.fbx`
- `Package_1.fbx`
- `Well.fbx`

Format:

- `.fbx`

Practical meaning:

- these are utility props only
- we are not using this pack as the primary visual identity
- good for:
  - village clutter
  - transport/storage props
  - wells, carts, and light settlement dressing

### Medieval Village Pack settlement references already imported

Reference path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Settlements/Reference/MedievalVillagePack/`

Current imported subset:

- `House_1.fbx`
- `House_3.fbx`
- `Sawmill.fbx`
- `Stable.fbx`

Format:

- `.fbx`

Practical meaning:

- these are placeholder structural references, not final art direction commitments
- they may help with:
  - settlement scale testing
  - village footprint testing
  - utility-building placement ideas

### LowPoly Environment Pack subset already imported

Biome-model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Biomes/LowPolyEnvironmentPack/`

Current imported biome subset:

- `Environment_1.fbx`
- `Mounting_1.fbx`
- `Mounting_2.fbx`
- `Mounting_3.fbx`
- `Terrain_1.fbx`
- `Terrain_2.fbx`

Vegetation/model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Vegetation/LowPolyEnvironmentPack/`

Current imported vegetation subset:

- `Tree_1.fbx`
- `Tree_2.fbx`
- `Tree_3.fbx`
- `Bush_1.fbx`
- `Bush_2.fbx`
- `Grass_1.fbx`
- `Grass_2.fbx`
- `Plant_1.fbx`
- `Plant_4.fbx`
- `Rock_1.fbx`
- `Rock_4.fbx`
- `Stone_1.fbx`
- `Log_1.fbx`
- `Log_2.fbx`

Format:

- `.fbx`

Practical meaning:

- this is a lightweight fallback environment set
- useful for:
  - simple mountain or terrain chunk references
  - extra low-poly fallback trees and bushes
  - simple logs, stones, and small prop fillers

Why this subset was chosen:

- it adds compact generic environment pieces
- it supports biome prototyping and fallback rendering
- it avoids copying the whole pack blindly

### Modular Terrain Collection subset already imported

Biome-model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Biomes/ModularTerrainCollection/`

Current imported biome subset:

- `Materials_Modular_Terrain.mtl`
- `Mountain_1.obj`
- `Mountain_2.obj`
- `Mountain_3.obj`
- `Mountain_4.obj`
- `Hilly_Terrain_Grass_Floor.obj`
- `Hilly_Terrain_Water_Flat.obj`
- `Hilly_Terrain_Water_Slope.obj`
- `Cliff_Terrain_Waterfall_Top.obj`
- `Cliff_Terrain_Waterfall_Mid.obj`
- `Cliff_Terrain_Waterfall_Base_Flat.obj`
- `Cliff_Terrain_Waterfall_Water_Top.obj`
- `Cliff_Terrain_Waterfall_Water_Mid.obj`
- `Beach_Terrain_Sand_Floor.obj`
- `Beach_Terrain_Sand_Floor_Raised.obj`
- `Cave_Terrain_Floor_Normal.obj`
- `Cave_Terrain_Floor_Raised.obj`
- `Escarpment_Terrain_Hill_Base.obj`
- `Escarpment_Terrain_Hill_Top.obj`
- `Shared_Terrain_Dirt_Gathered_Corner.obj`
- `Shared_Terrain_Dirt_Gathered_Straight.obj`

Structure/prop path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Structures/ModularTerrainCollection/`

Current imported prop subset:

- `Beach_Prop_Docks_Corner.obj`
- `Beach_Prop_Docks_Straight.obj`
- `Beach_Prop_Tree_Palm_1.obj`
- `Cave_Prop_Entrance_1.obj`
- `Cave_Prop_Minecart_1.obj`
- `Cave_Prop_Pick_Large.obj`
- `Cave_Prop_Stalagmite_Normal.obj`
- `Cliff_Prop_Bridge_Rope_End.obj`
- `Cliff_Prop_Bridge_Rope_Middle.obj`
- `Hilly_Prop_Camp_Campfire.obj`
- `Hilly_Prop_Camp_Lean_To.obj`
- `Hilly_Prop_Camp_Sitting_Log.obj`
- `Hilly_Prop_Camp_Wood_Pile.obj`
- `Hilly_Prop_Cattail_1.obj`
- `Hilly_Prop_Fence_Gate_1.obj`
- `Hilly_Prop_Fence_Post_1.obj`
- `Hilly_Prop_Grass_Clump_1.obj`
- `Hilly_Prop_Hollow_Trunk.obj`
- `Hilly_Prop_Mushroom_1.obj`
- `Hilly_Prop_Rock_1.obj`
- `Hilly_Prop_Ruins_Pillar_1.obj`
- `Hilly_Prop_Stump.obj`
- `Hilly_Prop_Tree_Oak_1.obj`
- `Hilly_Prop_Tree_Pine_1.obj`
- `Shared_Prop_Boulder_1.obj`
- `Shared_Prop_Boulder_2.obj`

Format:

- `.obj`
- `.mtl`

Practical meaning:

- this is our strongest modular biome-construction set so far
- especially useful for:
  - hills
  - cliffs
  - mountains
  - beaches
  - caves
  - simple camp props
  - fences
  - waterfall references

### Free Essential Animation CC0 reference set already imported

Animation path:

- `backend/genetic-neurosim/client-monogame/Content/Animations/Reference/FreeEssentialAnimationCC0/`

Current imported animation reference subset:

- `Idle.fbx`
- `Run.fbx`
- `Hit.fbx`
- `Death.fbx`
- `Attack.fbx`

Format:

- `.fbx`

Practical meaning:

- these are future-use reference animations
- not a current gameplay dependency
- useful later if we decide to animate population markers, combat stand-ins, or close-zoom entity proxies

### Free Sample structure subset already imported

Structure path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Structures/FreeSample/`

Current imported subset:

- `Medieval Town - Free Sample-3-Trolley.obj`
- `Medieval Town - Free Sample-3-Trolley.mtl`
- `Medieval Town - Free Sample-4-Rock.obj`
- `Medieval Town - Free Sample-4-Rock.mtl`
- `Medieval Town - Free Sample-8-Rack.obj`
- `Medieval Town - Free Sample-8-Rack.mtl`
- `Medieval Town - Free Sample-9-Logs.obj`
- `Medieval Town - Free Sample-9-Logs.mtl`

Format:

- `.obj`
- `.mtl`

Practical meaning:

- these are just a few extra utility props
- useful for:
  - trolley/cart-like clutter
  - rack/storage dressing
  - log pile variation
  - simple extra rock variation

### LowPoly Pixel RPG Assets subset already imported

Structure/model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Structures/LowPolyPixelRpgAssets/`

Current imported subset:

- `arch.fbx`
- `bench.fbx`
- `boxWooden.fbx`
- `bridgeWooden01.fbx`
- `bridgeWooden02.fbx`
- `bridgeWooden03.fbx`
- `bridgeWoodenRails.fbx`
- `chestA.fbx`
- `doorA.fbx`
- `doorB.fbx`
- `flagA.fbx`
- `ground01.fbx`
- `ground02.fbx`
- `ground03.fbx`
- `ladder.fbx`
- `pillar01.fbx`
- `pillar02.fbx`
- `Rock.fbx`
- `stool.fbx`
- `table.fbx`
- `tableLong.fbx`
- `torch.fbx`
- `trapdoorWooden.fbx`
- `wallEarth01.fbx`
- `wallEarth02.fbx`
- `wallSteps.fbx`
- `wallStone01.fbx`
- `wallStone03.fbx`
- `wallStonePlatform.fbx`
- `wallWindow.fbx`
- `water01.fbx`
- `woodenBarrel.fbx`

Material/texture path:

- `backend/genetic-neurosim/client-monogame/Content/Materials/Structures/LowPolyPixelRpgAssets/`

Current imported texture subset:

- `bridgeA.png`
- `groundA.png`
- `groundB.png`
- `groundC.png`
- `props_base_color.png`
- `wallEarthA.png`
- `wallEarthB.png`
- `wallStoneA.png`
- `wallStoneB.png`
- `wallStoneC.png`
- `waterA.png`

Formats:

- `.fbx`
- `.png`

Practical meaning:

- this is a support pack, not a primary visual identity pack
- useful for:
  - bridges
  - ladders
  - pillars
  - doors
  - walls
  - torches
  - small furniture/prop dressing

Why this subset was chosen:

- it adds generic low-poly structural building blocks
- it gives us extra bridge and wall variants
- it avoids dragging in the RPG character and item clutter that does not serve the current scope

### Soi Tavern subset already imported

Structure/model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Structures/SoiTavern/`

Material/texture path:

- `backend/genetic-neurosim/client-monogame/Content/Materials/Structures/SoiTavern/`

Current imported subset:

- `trn_AnimalRug.fbx`
- `trn_Barrel.fbx`
- `trn_Bench.fbx`
- `trn_Bowl.fbx`
- `trn_Cauldron.fbx`
- `trn_Firepit.fbx`
- `trn_FlourSack.fbx`
- `trn_Jug.fbx`
- `trn_Log.fbx`
- `trn_Plate.fbx`
- `trn_Rack.fbx`
- `trn_SmallStool.fbx`
- `trn_TableLong.fbx`
- `trn_TableRound.fbx`

Current imported textures:

- `trn_AnimalRug_Bear_AlbedoTransparency.png`
- `trn_AnimalRug_Cow_AlbedoTransparency.png`
- `trn_AnimalRug_Normal.png`
- `trn_AnimalRug_Wolf_AlbedoTransparency.png`
- `trn_Barrel_AlbedoTransparency.png`
- `trn_Barrel_Normal.png`
- `trn_Bench_AlbedoTransparency.png`
- `trn_Bench_Normal.png`
- `trn_Cauldron_AlbedoTransparency.png`
- `trn_Cauldron_Normal.png`
- `trn_Firepit_AlbedoTransparency.png`
- `trn_Firepit_Normal.png`
- `trn_Jug_AlbedoTransparency.png`
- `trn_Jug_Normal.png`
- `trn_Log_AlbedoTransparency.png`
- `trn_Log_Normal.png`
- `trn_Plates_AlbedoTransparency.png`
- `trn_Plates_Normal.png`
- `trn_Rack_AlbedoTransparency.png`
- `trn_Rack_Normal.png`
- `trn_SacksFlour_AlbedoTransparency.png`
- `trn_SacksFlour_Normal.png`
- `trn_SmallStool_AlbedoTransparency.png`
- `trn_SmallStool_Normal.png`
- `trn_TableLong_AlbedoTransparency.png`
- `trn_TableLong_Normal.png`
- `trn_TableRound_AlbedoTransparency.png`
- `trn_TableRound_Normal.png`

Formats:

- `.fbx`
- `.png`

Practical meaning:

- strong support for tribe and city interior/exterior dressing
- especially useful for:
  - fire pits
  - sacks and storage racks
  - benches, stools, and tables
  - bowls, plates, and jugs
  - animal-rug and camp-object dressing

### Free Medieval People subset already imported

Population/model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Population/FreeMedievalPeople/`

Population/texture path:

- `backend/genetic-neurosim/client-monogame/Content/Materials/Population/FreeMedievalPeople/`

Current imported subset:

- `city_dwellers_1.fbx`
- `city_dwellers_2.fbx`
- `peasant_1.fbx`
- `peasant_2.fbx`
- `peasant_3.fbx`
- `peasant_4.fbx`
- `peasant_5.fbx`
- `peasant_6.fbx`
- `people_texture_map.png`

Formats:

- `.fbx`
- `.png`

Practical meaning:

- these are population stand-ins, not final historical truth
- useful for:
  - early crowd marker experiments
  - simple grouped settlement inhabitants
  - testing population silhouettes in MonoGame

### Base Humanoid mesh already imported

Character/model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Characters/BaseHumanoid/`

Current imported subset:

- `Humanoid.fbx`

Format:

- `.fbx`

Practical meaning:

- this is a neutral humanoid base for future rigging, skinning, or custom tribal population work
- it is mainly a technical support asset, not a final art-direction asset

### Lowpoly Forest Pack dead-tree subset already imported

Vegetation/model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Vegetation/LowpolyForestPack/Dead/`

Vegetation/texture path:

- `backend/genetic-neurosim/client-monogame/Content/Materials/Vegetation/LowpolyForestPack/`

Current imported subset:

- `DeadOak1.fbx`
- `DeadOak2.fbx`
- `DeadSpruce1.fbx`
- `DeadSpruce2.fbx`
- `DeadOakTreeTrunk.png`
- `DeadSpruceTreeTrunk.png`

Formats:

- `.fbx`
- `.png`

Practical meaning:

- this gives us harsher dead-wood silhouettes for:
  - cold biomes
  - blighted zones
  - frontier or low-fertility map dressing

### Retro Nature Pack winter subset already imported

Vegetation/model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Vegetation/RetroNaturePack/Winter/`

Vegetation/texture path:

- `backend/genetic-neurosim/client-monogame/Content/Materials/Vegetation/RetroNaturePack/`

Current imported subset:

- `tree01_winter.fbx`
- `tree03_winter.fbx`
- `tree05_winter.fbx`
- `bush01_winter.fbx`
- `bush04_winter.fbx`
- `bush06_winter.fbx`
- `tree01_winter.png`
- `tree03_winter.png`
- `tree05_winter.png`
- `bush1_winter.png`
- `bush4_winter.png`
- `bush6_winter.png`

Formats:

- `.fbx`
- `.png`

Practical meaning:

- this strengthens the cold-biome lane with clean, readable winter vegetation
- useful for:
  - snow maps
  - frozen-border regions
  - cold settlement surroundings

### Modular Village subset already imported

Structure/model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Structures/ModularVillage/`

Terrain/model path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Terrain/ModularVillage/`

Current imported structure subset:

- `Canopy_Beam.obj`
- `Canopy_Beam_Short.obj`
- `Canopy_Corner.obj`
- `Canopy_Full.obj`
- `Canopy_Ramp_Corner.obj`
- `Canopy_Ramp_Full.obj`
- `Canopy_Ramp_Mid.obj`
- `Canopy_Side.obj`
- `Canopy_Sides_Opposite.obj`
- `Canopy_Top.obj`
- `Prop_Barrel_1.obj`
- `Prop_Barrel_1_Open.obj`
- `Prop_Barrel_2.obj`
- `Prop_Cart_1.obj`
- `Prop_Cart_1_Barrels.obj`
- `Prop_Cart_1_Hay.obj`
- `Prop_Crate_1.obj`
- `Prop_Crate_1_Open.obj`
- `Prop_Hay_1.obj`
- `Prop_Ladder_1.obj`
- `Prop_Well_1.obj`
- `Prop_Well_Dirt.obj`
- `Prop_Well_Grass.obj`
- `Prop_Well_Inside.obj`
- `Stone_Arch.obj`
- `Stone_Arch_Outer.obj`
- `Stone_Pillar.obj`
- `Stone_Pillar_Base.obj`
- `Stone_Steps.obj`
- `Stone_Steps_Side_1.obj`
- `Stone_Steps_Side_2.obj`
- `Stone_Wall_1.obj`
- `Stone_Wall_2.obj`
- `Stone_Wall_3.obj`
- `Stone_Wall_4.obj`
- `Stone_Wall_5.obj`
- `Stucco_Block.obj`
- `Stucco_Prop_Support_Angled_Large.obj`
- `Stucco_Prop_Support_Angled_Low.obj`
- `Stucco_Prop_Support_Angled_Small.obj`
- `Stucco_Prop_Support_Beam_1.obj`
- `Stucco_Prop_Support_Beam_2.obj`
- `Stucco_Prop_Support_Beam_3.obj`
- `Stucco_Prop_Support_Pillar_1.obj`
- `Stucco_Prop_Support_Pillar_2.obj`
- `Stucco_Prop_Support_Pillar_3.obj`
- `Wall_Prop_Door_Simple.obj`
- `Waterwheel_1.obj`
- `Waterwheel_Flume_Curved.obj`
- `Waterwheel_Flume_End.obj`
- `Waterwheel_Flume_Ramp.obj`
- `Waterwheel_Flume_Ramp_Supported.obj`
- `Waterwheel_Flume_Straight.obj`
- `Waterwheel_Flume_Support_Brace.obj`
- `Waterwheel_Flume_Support_Brace_Double.obj`
- `Waterwheel_Flume_Support_Pillar.obj`
- `Wood_Baseboard.obj`
- `Wood_Floor_Corner.obj`
- `Wood_Floor_Straight_1.obj`
- `Wood_Floor_Straight_2.obj`
- `Wood_Floor_Straight_3.obj`
- `Wood_Floor_Straight_4.obj`
- `Wood_Post_Large.obj`
- `Wood_Post_Small.obj`
- `Wood_Railing_Corner.obj`
- `Wood_Railing_Stairs.obj`
- `Wood_Railing_Straight.obj`
- `Wood_Rope_Corner.obj`
- `Wood_Rope_Stairs.obj`
- `Wood_Rope_Straight.obj`
- `Wood_Steps.obj`

Current imported terrain subset:

- `Dirt_Fading.obj`
- `Dirt_Fading_from_Gathered.obj`
- `Dirt_Gathered_Corner.obj`
- `Dirt_Gathered_Straight.obj`

Formats:

- `.obj`

Practical meaning:

- this is one of our best neutral construction kits for settlement assembly
- especially useful for:
  - wells, carts, hay, ladders, and barrels
  - canopy market/camp structures
  - stone supports and simple wall logic
  - wooden walkways, steps, and scaffold-like elements

### KayKit Medieval Hexagon neutral subset already imported

Neutral-structure path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Structures/KayKitMedievalHexagon/Neutral/`

Prop path:

- `backend/genetic-neurosim/client-monogame/Content/Models/Props/KayKitMedievalHexagon/`

Current imported neutral subset:

- `building_bridge_A.fbx`
- `building_bridge_B.fbx`
- `building_dirt.fbx`
- `building_grain.fbx`
- `building_scaffolding.fbx`
- `building_stage_A.fbx`
- `building_stage_B.fbx`
- `building_stage_C.fbx`
- `fence_stone_straight.fbx`
- `fence_stone_straight_gate.fbx`
- `fence_wood_straight.fbx`
- `fence_wood_straight_gate.fbx`
- `wall_corner_A_gate.fbx`
- `wall_corner_A_inside.fbx`
- `wall_corner_A_outside.fbx`
- `wall_corner_B_inside.fbx`
- `wall_corner_B_outside.fbx`
- `wall_straight.fbx`
- `wall_straight_gate.fbx`

Current imported prop subset:

- `barrel.fbx`
- `bucket_empty.fbx`
- `bucket_water.fbx`
- `crate_A_big.fbx`
- `crate_A_small.fbx`
- `crate_B_big.fbx`
- `crate_B_small.fbx`
- `crate_long_A.fbx`
- `crate_long_B.fbx`
- `crate_long_C.fbx`
- `crate_long_empty.fbx`
- `crate_open.fbx`
- `ladder.fbx`
- `pallet.fbx`
- `resource_lumber.fbx`
- `resource_stone.fbx`
- `sack.fbx`
- `tent.fbx`
- `weaponrack.fbx`
- `wheelbarrow.fbx`

Formats:

- `.fbx`

Practical meaning:

- this is a support pack, not a style-defining pack
- strongest use cases:
  - bridges
  - fences and simple wall segments
  - staging/scaffolding pieces
  - storage and resource props
  - tents and wheelbarrows for camp logistics

## Visual Direction

The target look should feel:

- tribal
- prehistoric to antiquity
- pre-Christian ancient-world inspired
- strategic
- sober rather than cartoonish
- readable from far zoom and rewarding at close zoom
- grounded in terrain and polity identity
- slightly reminiscent of grand strategy presentation, but with a much older civilizational atmosphere

Font direction:

- ancient or tribal-inspired display typography
- elegant but readable
- suitable for tribe names, region labels, lineage headings, and polity titles
- inspired more by antiquity, carved stone, ritual markings, oral-heritage visual language, and early civilization aesthetics than by late medieval court culture

Recommended font split:

- display font: ancient serif, inscriptional, or carved-stone inspired title font
- UI font: readable serif or humanist font with subtle historical flavor
- debug font: plain mono or simple sans for diagnostics

## Asset Philosophy

Use the simplest asset type that still sells the simulation.

Priority rules:

1. Use procedural/simple geometry where a handcrafted mesh is unnecessary.
2. Use generated textures or billboards for high-volume environmental dressing.
3. Use generated or curated 3D models for hero assets only.
4. Keep distant readability more important than close-up ornament.
5. Respect the memory budget and avoid bloated high-poly content.

## Asset Type Decisions

### 1. Terrain and biome foundation

Recommended approach:

- hex-based terrain rendered from tile data
- primarily material-driven and texture-driven
- not individual high-detail terrain meshes per tile

Use:

- procedural hex mesh base
- biome textures
- decal overlays for roads, fertility, disputed zones, and ownership

Do not start with:

- unique sculpted mesh for every biome tile

### 2. Trees and forests

Recommended approach:

- low-poly or mid-poly stylized natural assets
- GPU-friendly instancing where possible
- a mix of individual tree meshes and clustered forest cards

Use:

- 3D trees for near and mid zoom
- simplified forest massing or billboards for far zoom

### 3. Rivers

Recommended approach:

- spline or tile-edge-based river rendering
- shader/material approach first
- optional decorative banks later

Use:

- flowing material
- normal map and foam highlights only if performance allows

### 4. Tribe population visuals

Recommended approach:

- not full individual cinematic characters at first
- start with small clustered population markers or low-detail citizen groups
- use faction color and silhouette for identity
- visually communicate early human societies rather than organized feudal populations

Use:

- grouped population markers
- simple animated crowd clumps
- optional hero close-zoom village inhabitants later
- clothing and gear language based on hide, woven fabric, bone, wood, early bronze, leather, and simple ritual adornment depending on era band

### 5. Settlements and polity tiers

Recommended approach:

- each political level gets a distinct silhouette
- settlements must communicate progression clearly

Asset families:

- Tribe
- City
- Duchy
- Kingdom
- Empire

These should be 3D models or modular kits, because the silhouette progression matters a lot.

Important art-direction note:

Even when higher tiers emerge, the visual progression should move from tribal encampment to proto-urban antiquity and early historical statehood, not to castles, cathedrals, or feudal Europe.

### 6. Camps, outposts, and resource structures

Recommended approach:

- modular 3D kit pieces
- reused across biomes with texture/material variation

Asset families:

- tribal camp
- wooden outpost
- farm patch
- logging camp
- fortification
- granary
- watchtower

### 7. Frontlines and war visualization

Recommended approach:

- mostly effects and overlays, not expensive physical assets

Use:

- battle banners
- border glow or stroke
- contested tile shader
- marching arrows
- impact markers

### 8. Artifacts

Recommended approach:

- artifact icons first
- optional small 3D relic/pedestal visuals later

Artifact presentation families:

- A_combat
- A_resource
- A_map_objective
- A_risk
- A_team

### 9. UI ornaments

Recommended approach:

- parchment-metal-wood hybrid accents in moderation
- do not turn the interface into a heavy fantasy prop wall

Use:

- banners
- seals
- carved dividers
- map-frame corners

Prefer:

- bone, stone, wood, bronze, leather, clay, woven textile, and ritual-symbol motifs

Avoid:

- gothic cathedral motifs
- late-feudal heraldry overload
- ornate medieval court decoration as the primary style

## Asset Inventory

## Required core assets

### Environment

- biome tile textures:
  - plains
  - dense forest
  - sparse woodland
  - hills
  - mountains
  - marsh
  - riverbank
  - dry steppe
  - fertile valley
  - snow or cold biome if included

- terrain overlays:
  - disputed territory
  - owned territory
  - frontier edge
  - scorched or war-torn tile
  - fertility richness
  - migration target

- natural props:
  - tree set A
  - tree set B
  - dead tree set
  - rock clusters
  - bushes
  - reeds
  - river stones

### Biome-specific asset packs

- plains pack
- dense forest pack
- sparse woodland pack
- marsh pack
- mountain pack
- riverland pack
- fertile valley pack
- dry steppe pack
- cold biome pack if enabled

### Settlements and populations

- tribe main camp
- tribe outpost
- city center
- duchy center
- kingdom capital
- empire capital
- citizen cluster model
- militia cluster model
- caravan or migration column

### Structures

- farm
- lumber camp
- watchtower
- wall segment
- gate
- granary
- stockpile
- tribal shrine or standard
- ritual stones
- wooden totem or ancestral post

### War and diplomacy

- banner poles
- faction flags
- war marker
- alliance marker
- merge marker
- civil war marker

### Artifacts and icons

- five main artifact icons
- polity tier icons
- event icons:
  - starvation
  - migration
  - siege
  - merger
  - extinction
  - rebellion

### UI and typography

- display font
- readable body font
- debug font
- ancient or tribal frames
- button motifs
- panel background textures

## Nice-to-have assets

- animated birds
- smoke plumes
- campfire effects
- water wheel
- royal court setpiece
- lineage tree ornamental UI
- miniature citizen close-up models
- biome-variant settlement decorations
- biome-specific ritual props

## 2D Versus 3D Decision Table

### Must be 3D

- tribe main camp
- city center
- duchy center
- kingdom capital
- empire capital
- tree trunks and major forest assets
- watchtowers
- walls and gates
- migration columns if seen at close zoom

### Can begin as 2D icons or billboards

- artifact visuals
- most event markers
- faction badges
- war alerts
- merge alerts
- disputed-zone warnings
- far-distance forests
- small citizen masses at far zoom

### Best as shader/material/procedural systems

- rivers
- territory fills
- frontlines
- disputed territory
- fertility heat
- ownership borders

## Source Strategy

### Generative AI

Use for:

- concept sheets
- icon sets
- style exploration
- texture generation
- hero settlement model ideation
- heraldry exploration

### Free or open models

Use for:

- baseline vegetation kits
- rocks
- generic camp props
- placeholder structures during development

### Hand-built simple geometry

Use for:

- hex terrain base
- walls
- roads
- markers
- debug overlays
- primitive crowd representations

## Where To Get Or Generate Each Asset Family

This section is meant to make the plan executable.

General source ladder:

1. Use free libraries for placeholders and production-safe basics.
2. Use generative AI for concepting, variants, icons, and selected hero assets.
3. Clean up or retopo generated meshes before relying on them heavily.
4. Build simple geometry by hand when the asset is structural and repetitive.

### Terrain materials and biome textures

Best sources:

- `ambientCG` for free CC0 PBR ground, rock, mud, snow, wood, and fabric-style materials
- `Poly Haven` for free CC0 textures and some nature-oriented assets
- generative AI for concept sheets and custom texture direction before finalizing materials

Use this for:

- plains ground
- marsh mud
- steppe dirt
- stone
- timber
- leather-like panel textures
- riverbank material references

Recommended workflow:

1. Pull base PBR materials from `ambientCG` or `Poly Haven`.
2. Create a biome style board with generative image tools.
3. Adjust color grading and roughness so all biomes feel like one world.

### Trees, bushes, rocks, reeds, and nature props

Best sources:

- `Quaternius` for free low-poly/stylized nature kits and fast prototyping
- `Kenney` for simple placeholder 3D assets
- `BlenderKit` for free or paid Blender-ready nature assets
- `Fab` and Quixel/Megascans for higher-fidelity vegetation references or selected production assets
- generative 3D tools for custom hero props only

Use this for:

- tree packs
- grass clumps
- bushes
- rock clusters
- reeds
- dead trees

Recommended workflow:

1. Start with `Quaternius` or `Kenney` for prototype nature.
2. Upgrade biome packs with selected `BlenderKit` or `Fab` assets if needed.
3. Use instancing heavily and avoid large unique vegetation sets early.

### Rivers, water surfaces, and shoreline dressing

Best sources:

- hand-built shader/material system in MonoGame
- `ambientCG` and `Poly Haven` for water-adjacent textures and supporting materials
- generative AI for concept sheets only

Use this for:

- river surface treatment
- banks
- wet mud
- shoreline stones

Recommended workflow:

1. Build rivers as a rendering system, not as purchased meshes.
2. Source only supporting textures and props externally.

### Tribe population markers and citizen clusters

Best sources:

- generative AI for concept sheets and silhouette exploration
- `Meshy` for very early 3D blockout experiments
- `Quaternius` or `Kenney` for placeholder humanoid or stylized units
- hand-built simple grouped markers for the first runtime version

Use this for:

- citizen clumps
- militia clumps
- migration groups

Recommended workflow:

1. Start with primitive grouped markers or simplified crowd meshes.
2. Generate concept art first.
3. Only generate full 3D citizen models if close zoom actually needs them.

### Tribe, city, duchy, kingdom, empire settlement models

Best sources:

- generative AI for concept sheets and settlement progression ideation
- `Meshy` for rough model prototypes
- `Sketchfab` for free downloadable reference models and selected reusable structures
- `Fab` for paid modular settlement packs if needed
- hand-built modular kits for final controlled silhouettes

Use this for:

- tribe main camp
- outposts
- proto-city centers
- duchy hubs
- kingdom capitals
- empire capitals

Recommended workflow:

1. Generate concept sheets for all polity tiers first.
2. Build a shared modular kit around wood, stone, mud-brick, ritual props, and fortifications.
3. Avoid relying only on raw generated 3D for the main settlement hierarchy.

### Modular structures and economy props

Best sources:

- `Quaternius` for quick modular props
- `Kenney` for simple placeholder kits
- `Sketchfab` for selected standalone structures
- `Fab` for modular environment packs if you need denser production quality
- hand modeling for repeated gameplay-critical structures

Use this for:

- farms
- watchtowers
- granaries
- stockpiles
- palisades
- gates
- ritual stones
- shrines

Recommended workflow:

1. Prototype with free modular kits.
2. Replace only the most visible structures with custom or generated content.

### Artifact icons and event icons

Best sources:

- generative image tools for icon ideation and style exploration
- final icon cleanup in vector or paint workflow by hand
- `itch.io` and `OpenGameArt` only as reference or placeholder sources, not as the final visual identity unless the style matches extremely well

Use this for:

- artifact symbols
- starvation icon
- migration icon
- siege icon
- merger icon
- extinction icon
- rebellion icon

Recommended workflow:

1. Generate 20 to 40 rough icon candidates per family.
2. Normalize shape language, stroke weight, and palette manually.
3. Export final icon atlases for UI and world markers.

### Banners, insignia, seals, and polity markers

Best sources:

- generative image tools for motif exploration
- hand cleanup for clean reusable emblem shapes
- `OpenGameArt` and `itch.io` for placeholders only

Use this for:

- tribe standards
- kingdom markers
- seal motifs
- map labels and faction badges

Recommended workflow:

1. Generate motif families by culture/biome tone.
2. Reduce them into simplified reusable emblem systems.
3. Keep recoloring and procedural variation in mind.

### Fonts

Best sources:

- `Google Fonts` for safe, easy-to-ship readable fonts
- commercial font marketplaces only if you later want a more unique title treatment
- generative AI only for mood boards, not final usable fonts

Recommended first-pass font direction:

- display candidates: `Cinzel`, `Marcellus`, `Cormorant`
- body candidate: `Noto Serif`
- debug font: a plain monospace already available in the app stack

Recommended workflow:

1. Test 2 to 3 display fonts against all-caps polity names and mixed-case dossier text.
2. Choose readability over theatricality.
3. If needed later, commission or license a more unique title font.

### UI ornaments and panel textures

Best sources:

- generative image tools for moodboards and ornament sheets
- `ambientCG` for leather, stone, wood, bronze, and cloth material references
- hand cleanup for actual production panel pieces

Use this for:

- panel backgrounds
- carved dividers
- seal motifs
- ornament corners
- tab textures

Recommended workflow:

1. Generate interface ornament concepts.
2. Reduce them into a restrained reusable UI kit.
3. Avoid shipping raw AI collage-like outputs directly.

## Current Source Recommendations

These are good current starting points:

- `Poly Haven`: free CC0 textures, HDRIs, and models
- `ambientCG`: free CC0 PBR materials, HDRIs, terrains, and models
- `Kenney`: simple game-ready placeholders and prototyping assets
- `Quaternius`: strong free low-poly packs for nature, structures, and prototype worldbuilding
- `OpenGameArt`: mixed-quality but useful free placeholders and references
- `Sketchfab`: downloadable free models and references, but check license per asset carefully
- `Fab`: paid and free marketplace source for higher-fidelity packs, including nature and environment content
- `BlenderKit`: broad Blender-integrated source for free and paid models/materials
- `Meshy`: fast AI text-to-3D and image-to-3D prototyping for custom assets
- `Adobe Firefly`: strong concept-art and style-board generation for icons, UI, and art direction

## Source Notes By Quality Tier

### Best for fast placeholders

- `Kenney`
- `Quaternius`
- `OpenGameArt`

### Best for production-safe materials

- `ambientCG`
- `Poly Haven`

### Best for browsing many model options

- `Sketchfab`
- `Fab`
- `BlenderKit`

### Best for generating custom direction

- `Adobe Firefly`
- `Meshy`

### Best for final hero-asset ideation

- generative concept art first
- then custom modeling or cleanup
- optionally supported by `Sketchfab`, `Fab`, or `BlenderKit` references

## Useful Links

Core libraries and marketplaces:

- Poly Haven: https://polyhaven.com/
- ambientCG: https://ambientcg.com/
- Kenney Assets: https://kenney.nl/assets
- Quaternius: https://quaternius.com/
- OpenGameArt: https://opengameart.org/
- Sketchfab downloadable models: https://sketchfab.com/features/download
- Fab marketplace: https://www.fab.com/
- BlenderKit: https://www.blenderkit.com/

Generative tools:

- Meshy text-to-3D: https://www.meshy.ai/features/text-to-3d/
- Adobe Firefly: https://www.adobe.com/products/firefly/

Font references:

- Cinzel: https://fonts.google.com/specimen/Cinzel
- Marcellus: https://fonts.google.com/specimen/Marcellus
- Cormorant: https://fonts.google.com/specimen/Cormorant
- Noto Serif: https://fonts.google.com/noto/specimen/Noto+Serif

## Asset Shopping Carts

This is not a payment cart. This is a sanity-saving search basket.

The purpose is simple:

- each basket groups one asset family
- each basket tells you where to start looking first
- each basket tells you when to generate instead of browse

## What You Actually Download

Before the baskets, this is the most important rule:

Do not download random giant packs just because they exist.

For this project, the useful file types are:

### 3D model files

Preferred:

- `.glb`
- `.gltf`
- `.fbx`
- `.obj`
- `.blend` if you plan to inspect or edit in Blender

What they are for:

- settlements
- trees
- rocks
- props
- watchtowers
- migration markers

Best default choice:

- download `.glb` first if available
- download `.fbx` if `.glb` is not available
- download `.blend` only if you actually want to edit the asset in Blender

### Texture and material files

Preferred:

- `.png`
- `.jpg`
- `.jpeg`
- `.tga`
- PBR maps such as:
  - `BaseColor` or `Albedo`
  - `Normal`
  - `Roughness`
  - `Metallic`
  - `AmbientOcclusion`
  - `Height` or `Displacement`

What they are for:

- terrain materials
- biome surfaces
- wood, stone, mud, leather, cloth
- UI backgrounds

Best default choice:

- download `2K` textures first
- use `1K` if the asset is minor
- only grab `4K` if it is truly hero content

### Icons and UI graphics

Preferred:

- `.png`
- `.svg` if available and you plan to edit it

What they are for:

- artifacts
- event icons
- faction symbols
- UI ornaments

### What to avoid by default

- giant raw source packs you do not understand
- 8K textures
- huge multi-hundred-megabyte environment bundles
- files that only exist as cinematic renders instead of usable assets
- assets with unclear licenses

### Folder outcome you should aim for

Every basket should end with one of these:

- a small shortlist of candidate download links
- a set of downloaded source assets
- a note saying which file format won and why

You are not trying to “collect everything.”
You are trying to collect a controlled first-pass production basket.

Current repo target structure:

```text
backend/genetic-neurosim/client-monogame/
  Assets/
    AssetRegistry.cs
    BiomeVisualProfile.cs
    SettlementVisualProfile.cs
    IconRegistry.cs
  Content/
    Materials/
      Terrain/
      Vegetation/
```

## Basket 1: Terrain, Ground, Biome Materials

Start here first:

- ambientCG: https://ambientcg.com/
- Poly Haven: https://polyhaven.com/

What to look for:

- ground
- mud
- rock
- snow
- sand
- grass
- wood
- stone
- dirt

Use this basket for:

- plains
- fertile valley
- marsh ground
- mountain ground
- steppe ground
- riverbank material support

What to actually download:

- terrain material packs
- ground texture sets
- mud texture sets
- grass texture sets
- rock texture sets

File types you want:

- `.png` or `.jpg` texture maps
- PBR sets with:
  - BaseColor/Albedo
  - Normal
  - Roughness
  - AO if available

Target size:

- `1K` or `2K`

Skip for now:

- HDRIs
- 4K or 8K materials
- full scene packs

What a successful basket looks like:

- 1 plains ground set
- 1 marsh/mud set
- 1 stone/rock set
- 1 dry steppe ground set
- 1 riverbank support set

Repo destination path for Basket 1 downloads:

- `backend/genetic-neurosim/client-monogame/Content/Materials/Terrain/`

Current Basket 1 files already placed there include:

- `dirt_*`
- `brown_mud_*`
- `coast_sand_01_*`
- `forrest_ground_01_*`
- `grass_medium_01_*`
- `gray_rocks_*`
- `snow_01_*`
- `stone_wall_*`

Practical note:

If you are thinking “where do I begin for terrain?”
Start here, dumbass:

- https://ambientcg.com/
- https://polyhaven.com/

Do not start by generating 50 inconsistent terrain textures with AI unless you already know exactly what visual language you want.

## Basket 2: Trees, Forests, Bushes, Nature Props

Start here first:

- Quaternius: https://quaternius.com/
- Kenney Assets: https://kenney.nl/assets
- BlenderKit: https://www.blenderkit.com/
- Fab: https://www.fab.com/

What to look for:

- tree packs
- stylized nature
- forest assets
- rocks
- bushes
- reeds
- logs
- dead trees

Use this basket for:

- dense forest pack
- sparse woodland pack
- marsh vegetation
- mountain shrubs
- riverbank foliage

What to actually download:

- individual tree models
- small nature packs
- rock cluster models
- bush and reed models

File types you want:

- `.glb`
- `.fbx`
- `.obj`
- `.blend` only if you want to edit
- `.png` textures if they come separately

Target style:

- low-poly or mid-poly
- strategy readable
- instancing-friendly

Skip for now:

- huge cinematic forest bundles
- extremely dense scanned trees unless you know they will run well

What a successful basket looks like:

- 2 to 4 tree types for forest
- 1 dead-tree variant
- 2 rock cluster variants
- 2 bush/reed variants

Repo destination path for Basket 2 downloads:

- `backend/genetic-neurosim/client-monogame/Content/Materials/Vegetation/` for bark/vegetation-support textures
- later add something like `backend/genetic-neurosim/client-monogame/Content/Models/Vegetation/` for actual tree or bush models

Practical note:

If you need trees and forest clutter fast, start here, dumbass:

- https://quaternius.com/
- https://kenney.nl/assets

If the free prototype set looks too cheap, then upgrade selectively with:

- https://www.blenderkit.com/
- https://www.fab.com/

## Basket 3: Settlement Concepts And Tier Progression

Start here first:

- Adobe Firefly: https://www.adobe.com/products/firefly/
- Meshy: https://www.meshy.ai/features/text-to-3d/
- Sketchfab downloads: https://sketchfab.com/features/download
- Fab: https://www.fab.com/

What to look for or generate:

- tribal camp
- ancient settlement
- mud-brick structures
- ritual complex
- fortified proto-city
- early citadel

Use this basket for:

- tribe camp
- outpost
- city
- duchy
- kingdom
- empire

What to actually download or generate:

- concept images for each tier
- 3D blockout candidates
- reference models for ancient/tribal structures

File types you want:

- concept images as `.png`
- 3D candidates as `.glb`, `.fbx`, or `.obj`

What to avoid:

- late-medieval castles as your base language
- giant city scene downloads
- assets that only look good from one camera angle

What a successful basket looks like:

- 1 concept sheet for each polity tier
- 1 rough 3D candidate for tribe
- 1 rough 3D candidate for city
- 1 rough 3D candidate for duchy
- 1 rough 3D candidate for kingdom
- 1 rough 3D candidate or placeholder for empire

Repo destination path for Basket 3 outputs:

- concept sheets:
  - `backend/genetic-neurosim/client-monogame/Content/Concepts/Settlements/`
- 3D candidates:
  - `backend/genetic-neurosim/client-monogame/Content/Models/Settlements/`

Practical note:

If you’re doing the big silhouette ladder for polity tiers, start here, dumbass:

- concept first with Firefly
- rough 3D with Meshy
- references and reusable bits from Sketchfab or Fab

Direct links:

- https://www.adobe.com/products/firefly/
- https://www.meshy.ai/features/text-to-3d/
- https://sketchfab.com/features/download
- https://www.fab.com/

## Basket 4: Modular Structures And Economy Props

Start here first:

- Quaternius: https://quaternius.com/
- Kenney Assets: https://kenney.nl/assets
- Sketchfab downloads: https://sketchfab.com/features/download
- Fab: https://www.fab.com/

What to look for:

- watchtower
- palisade
- gate
- granary
- stockpile
- farm
- shrine
- wooden structures
- stone markers

Use this basket for:

- outposts
- farms
- walls
- storage
- ritual props

What to actually download:

- modular prop models
- small structure models
- fortification pieces

File types you want:

- `.glb`
- `.fbx`
- `.obj`
- texture maps in `.png` or `.jpg`

What a successful basket looks like:

- 1 watchtower
- 1 palisade or wall segment
- 1 gate
- 1 granary or storage building
- 1 shrine/totem/ritual stone set

Repo destination path for Basket 4 downloads:

- `backend/genetic-neurosim/client-monogame/Content/Models/Structures/`
- supporting structure textures can later go in:
  - `backend/genetic-neurosim/client-monogame/Content/Materials/Structures/`

Practical note:

If you need lots of repeated world props, start here, dumbass:

- free modular kits first
- then replace the most visible pieces later

## Basket 5: Population Markers, Citizen Clusters, Migration Columns

Start here first:

- Adobe Firefly: https://www.adobe.com/products/firefly/
- Meshy: https://www.meshy.ai/features/text-to-3d/
- Quaternius: https://quaternius.com/
- Kenney Assets: https://kenney.nl/assets

What to look for or generate:

- tribal civilians
- grouped units
- ancient migration groups
- pack animals
- simple militia forms

Use this basket for:

- citizen cluster marker
- militia cluster
- migration caravan

What to actually download or generate:

- concept sheets
- simple grouped unit models
- placeholder crowd markers

File types you want:

- `.png` concepts
- `.glb` or `.fbx` grouped marker models if you find good ones

What to avoid:

- full detailed character libraries right now
- dozens of unique humanoid models before we know the camera needs them

What a successful basket looks like:

- 1 citizen cluster concept
- 1 militia cluster concept
- 1 migration caravan concept
- optional 1 simple 3D grouped marker

Repo destination path for Basket 5 outputs:

- concepts:
  - `backend/genetic-neurosim/client-monogame/Content/Concepts/Population/`
- marker or grouped models:
  - `backend/genetic-neurosim/client-monogame/Content/Models/Population/`

Practical note:

If these are only visible from medium or far zoom, do not overbuild them.
Start here, dumbass:

- concept with Firefly
- placeholder with primitives or simple packs
- generate custom only if the camera really justifies it

## Basket 6: Biome-Specific Packs

Start here first:

- Firefly for mood boards: https://www.adobe.com/products/firefly/
- ambientCG for materials: https://ambientcg.com/
- Poly Haven for textures: https://polyhaven.com/
- Quaternius for reusable nature props: https://quaternius.com/
- Fab for upgrades: https://www.fab.com/

What to build basket-by-basket:

- plains pack
- dense forest pack
- marsh pack
- mountain pack
- riverland pack
- fertile valley pack
- dry steppe pack
- cold biome pack

What to actually download:

- small prop sets and materials per biome

File types you want:

- `.glb`, `.fbx`, `.obj` for props
- `.png` or `.jpg` for materials/textures

What a successful biome pack looks like:

- 1 ground material family
- 2 to 5 props specific to that biome
- 1 vegetation family
- 1 settlement adaptation note

Example:

- Marsh pack:
  - mud texture set
  - reeds
  - dead tree
  - stilt prop or wetland prop

- Mountain pack:
  - stone texture set
  - rock outcrop
  - stacked stone marker
  - cliff shrub

Repo destination path for Basket 6 outputs:

- biome materials:
  - `backend/genetic-neurosim/client-monogame/Content/Materials/Terrain/`
- biome prop models:
  - `backend/genetic-neurosim/client-monogame/Content/Models/Biomes/`
- biome concept sheets:
  - `backend/genetic-neurosim/client-monogame/Content/Concepts/Biomes/`

Practical note:

If you are stuck on “how do I make each biome feel different?”
Start here, dumbass:

- moodboard in Firefly
- materials from ambientCG and Poly Haven
- prototype props from Quaternius

## Basket 7: Icons, Artifacts, Events, Markers

Start here first:

- Adobe Firefly: https://www.adobe.com/products/firefly/
- OpenGameArt: https://opengameart.org/
- itch.io assets: https://itch.io/game-assets

What to make:

- artifact icons
- event icons
- war markers
- diplomacy markers
- dispute warnings
- faction badges

What to actually download:

- mostly nothing heavy
- reference sheets
- placeholder icon packs only if helpful

What to actually create:

- final icons as `.png`
- optional editable masters as `.svg`

What a successful basket looks like:

- 5 artifact icons
- 6 to 8 event icons
- 3 to 5 diplomacy/war markers

Repo destination path for Basket 7 outputs:

- `backend/genetic-neurosim/client-monogame/Content/UI/Icons/`

Practical note:

If you want a cohesive identity, use OpenGameArt and itch.io mostly for placeholders or reference.
Start here, dumbass:

- generate the icon language yourself
- then clean it up manually into a proper set

## Basket 8: Banners, Insignia, Seals

Start here first:

- Adobe Firefly: https://www.adobe.com/products/firefly/
- OpenGameArt: https://opengameart.org/

What to make:

- tribe standards
- polity seals
- insignia families
- map markers
- diplomacy emblems

What to actually download:

- reference sheets only
- optional placeholder emblem packs

What to actually create:

- final insignia as `.png`
- optional editable masters as `.svg`

What a successful basket looks like:

- 1 tribe insignia family
- 1 higher-polity insignia family
- 1 seal style
- 1 simple banner style

Repo destination path for Basket 8 outputs:

- `backend/genetic-neurosim/client-monogame/Content/UI/Insignia/`

Practical note:

If you want coherent faction identity, start here, dumbass:

- generate motifs
- simplify them
- keep recoloring and reuse in mind

## Basket 9: Fonts And UI Mood

Start here first:

- Cinzel: https://fonts.google.com/specimen/Cinzel
- Marcellus: https://fonts.google.com/specimen/Marcellus
- Cormorant: https://fonts.google.com/specimen/Cormorant
- Noto Serif: https://fonts.google.com/noto/specimen/Noto+Serif

Use this basket for:

- title font shortlist
- body font shortlist
- interface typography tests

What to actually download:

- font files from legitimate font sources

File types you want:

- `.ttf`
- `.otf`

What a successful basket looks like:

- 2 or 3 display font candidates
- 1 body font candidate
- 1 final shortlist note

Repo destination path for Basket 9 downloads:

- `backend/genetic-neurosim/client-monogame/Content/UI/Fonts/`

Practical note:

If you’re asking “what font do I test first?”
Start here, dumbass:

- Cinzel
- Marcellus
- Cormorant
- Noto Serif

Then test them on:

- tribe names
- polity titles
- region labels
- dossier text

## Basket 10: High-Fidelity Upgrade Pass

Start here first:

- Fab: https://www.fab.com/
- Sketchfab downloads: https://sketchfab.com/features/download
- BlenderKit: https://www.blenderkit.com/

Use this basket only for:

- selective upgrades
- hero structures
- better vegetation
- more polished props

What to actually download:

- only selected replacements for assets already proven necessary

File types you want:

- `.glb`
- `.fbx`
- `.obj`
- associated `.png` or `.jpg` textures

Rule:

Do not touch this basket until the prototype asset pass already works.

Repo destination path for Basket 10 upgrades:

- depends on the asset family being upgraded
- place upgraded files into the same `Content/` subfolder as the placeholder they replace

## Basket Output Template

For every basket, write the result in this shape:

```md
Basket:
Source:
Downloaded:
File types:
Why this one:
Rejected options:
Notes:
```

Example:

```md
Basket: Trees, Forests, Bushes, Nature Props
Source: Quaternius
Downloaded: Low poly tree pack, rock pack, bush pack
File types: .glb, .png
Why this one: Light, readable, easy to instance
Rejected options: High-poly scanned forest pack from Fab
Notes: Good enough for first biome pass
```

Practical note:

If the prototype already works and now you want it prettier, start here, dumbass.
Do not begin here.

## Biome-Specific Art Direction

Each biome should have its own environmental identity, settlement adaptation language, and prop family.

The point is not only visual variety. Biome-specific assets help the world feel inhabited by societies adapting to terrain constraints.

### Plains

Visual character:

- broad grassland
- open visibility
- wind-swept
- earth and yellow-green palette

Asset ideas:

- grass tufts
- low shrubs
- exposed dirt paths
- hide-and-wood camps
- grazing markers
- standing poles and standards visible at distance

### Dense forest

Visual character:

- enclosed
- heavy canopy
- darker soil
- mossy and root-rich

Asset ideas:

- thick tree clusters
- fallen logs
- root formations
- hunter camps
- carved totems
- smoke trails from hidden encampments

### Sparse woodland

Visual character:

- transitional biome
- scattered trees
- mixed open/covered ground

Asset ideas:

- mixed tree clumps
- brush patches
- partial clearings
- woodland outposts
- small ritual circles

### Marsh

Visual character:

- wet
- unstable
- reed-heavy
- muddy green-brown palette

Asset ideas:

- reeds
- pools
- peat mounds
- stilted huts
- plank walkways
- fishing structures
- dead trees

### Mountain

Visual character:

- harsh
- rocky
- elevated
- cold or dry depending on region

Asset ideas:

- crags
- scree
- cliff shrubs
- stone watch posts
- cave-like shelters
- signal fires
- stacked stone markers

### Riverland

Visual character:

- fertile but contested
- sediment-rich
- movement corridor

Asset ideas:

- riverbank reeds
- fishing docks
- ferry crossings
- wooden bridges
- floodplain farms
- riverside shrines

### Fertile valley

Visual character:

- prosperous
- greener
- denser settlement support

Asset ideas:

- cultivated fields
- irrigation hints
- grain storage
- larger proto-urban clusters
- ritual and market spaces

### Dry steppe

Visual character:

- wide horizon
- dusty
- sparse vegetation
- survivalist

Asset ideas:

- hardy shrubs
- dry grasses
- animal-bone markers
- wind-worn tents
- supply pits
- mobile camp structures

### Cold biome

Visual character:

- austere
- icy or frost-bitten
- low saturation

Asset ideas:

- conifer variants
- snow patches
- hides and timber shelters
- firewood stacks
- sledges
- stone-ring fire pits

## Technical Constraints

- keep hero assets modest-poly
- create LOD variants for settlements and forests
- prefer texture atlases where practical
- keep transparency-heavy assets under control
- favor instancing for trees, props, and markers
- keep settlement silhouettes strong from top-down and isometric views
- do not generate assets that are only beautiful from a cinematic front camera

## Prompting Rules For Generative AI

When generating assets:

- prioritize silhouette clarity
- request game-ready assets
- specify isometric or strategy-game readability
- specify clean background or turntable presentation when generating concepts
- avoid overly photoreal outputs if they will clash with strategy readability
- ask for variants in the same family for polity progression
- prefer one asset family per prompt batch

Avoid:

- vague “epic fantasy” prompts
- hyper-detailed concept art that cannot translate into game assets
- direct copying of another game’s proprietary art

## Prompt Pack

These prompts are starting points and should be iterated.

## 1. Tribe population marker / citizen cluster

Prompt:

`Create a game asset concept for a prehistoric to ancient tribal population cluster used in a grand-strategy simulation. Small grouped civilians, readable from isometric top-down view, earthy clothing, hides, woven fabric, rough tools, subdued palette, strong silhouette, practical not heroic, suitable for a strategy game map. Neutral background, game-ready concept sheet, front three-quarter and top-down readability emphasis.`

## 2. Tribe main camp

Prompt:

`Design a 3D game-ready tribal main camp for a prehistoric to antiquity strategy simulation. Wooden huts, hide tents, central fire, storage piles, defensive stakes, ritual stones or totems, primitive but organized, readable from high isometric camera, strong silhouette, realistic proportions, not cartoonish, biome-adaptable, concept art plus orthographic turnaround on plain background.`

## 3. Tribe outpost

Prompt:

`Create a small frontier outpost for a tribal polity in a prehistoric to ancient hex-based strategy game. Minimal wooden structure, lookout post, supply cache, light palisade hints, built for expansion and resource control, readable from distance, simple modular design, plain background, game asset concept.`

## 4. City center

Prompt:

`Create an ancient-world strategy game city center asset. Dense but readable proto-urban cluster, stone, mud-brick, timber, and early masonry construction, stronger infrastructure than a tribe, designed for isometric top-down readability, distinct silhouette progression from tribal camp, game-ready concept sheet, neutral background.`

## 5. Duchy center

Prompt:

`Design a duchy-level settlement hub for an ancient grand-strategy simulation. More fortified and administratively important than a city, chieftain or ruler hall, defensive walls, banners or ritual standards, structured streets, authority and regional control, readable from isometric camera, distinct silhouette, game-ready concept art with turnaround views.`

## 6. Kingdom capital

Prompt:

`Create a kingdom capital asset for an ancient strategy simulation. Large fortified seat of power, monumental hall, citadel, temple or ritual complex influence, layered walls, standards, strong skyline, readable from top-down isometric distance, serious and grounded, game-ready concept sheet on neutral background.`

## 7. Empire capital

Prompt:

`Design an empire capital for an ancient strategic simulation. Monumental but still practical, multi-ring fortification, dominant palace, citadel, temple complex, or imperial ceremonial core, clear silhouette visible from far zoom, strong hierarchy over kingdom capital, game-ready concept art with orthographic support and neutral background.`

## 8. Forest biome asset pack

Prompt:

`Generate a cohesive strategy-game forest asset pack for a prehistoric to ancient simulation: oak trees, pine trees, dead trees, bushes, logs, rock clusters, suitable for isometric map rendering, stylized-realistic balance, readable silhouettes, low-to-mid poly 3D game asset concepts, neutral background, consistent art direction.`

## 8B. Plains biome pack

Prompt:

`Create a biome-specific plains asset pack for a prehistoric to ancient strategy simulation: grass tufts, low shrubs, open dirt paths, grazing markers, hide-and-wood camp details, wind-swept props, readable from isometric top-down view, stylized-realistic balance, game-ready concept sheet on neutral background.`

## 8C. Marsh biome pack

Prompt:

`Create a biome-specific marsh asset pack for a prehistoric to ancient strategy simulation: reeds, muddy pools, dead trees, peat mounds, stilted huts, plank walkways, fishing structures, wet ground props, readable from isometric top-down view, grounded and serious, game-ready concept sheet on neutral background.`

## 8D. Mountain biome pack

Prompt:

`Create a biome-specific mountain asset pack for a prehistoric to ancient strategy simulation: rock outcrops, scree, cliff shrubs, stone watch posts, cave shelters, stacked stone markers, signal fires, rugged highland props, readable from isometric top-down view, game-ready concept sheet on neutral background.`

## 8E. Riverland biome pack

Prompt:

`Create a biome-specific riverland asset pack for a prehistoric to ancient strategy simulation: reed banks, fishing docks, ferry points, wooden bridges, riverside shrines, floodplain fields, sediment-rich riverbank props, readable from isometric top-down view, grounded realism, game-ready concept sheet on neutral background.`

## 8F. Fertile valley biome pack

Prompt:

`Create a biome-specific fertile valley asset pack for a prehistoric to ancient strategy simulation: cultivated fields, irrigation hints, grain stores, prosperous village props, gathering spaces, larger proto-urban details, readable from isometric top-down view, serious and grounded, game-ready concept sheet on neutral background.`

## 8G. Dry steppe biome pack

Prompt:

`Create a biome-specific dry steppe asset pack for a prehistoric to ancient strategy simulation: dry grass, hardy shrubs, wind-worn tents, animal-bone markers, mobile camp props, dusty pathways, sparse survivalist vegetation, readable from isometric top-down view, game-ready concept sheet on neutral background.`

## 8H. Cold biome pack

Prompt:

`Create a biome-specific cold-region asset pack for a prehistoric to ancient strategy simulation: conifers, snow patches, hide shelters, timber stacks, sledges, stone-ring fire pits, frost-bitten ground details, readable from isometric top-down view, austere and grounded, game-ready concept sheet on neutral background.`

## 9. Plains and fertile valley biome textures

Prompt:

`Create tileable biome texture concepts for a prehistoric to ancient strategy game: plains grassland, fertile valley, dry steppe, marsh edge, riverbank soil. Top-down or high-angle readability, not photobashed noise, clean material separation, game-ready texture sheet direction, natural but readable color palette.`

## 10. Rivers

Prompt:

`Design visual direction for rivers in a prehistoric to ancient isometric strategy game. Calm but readable water channels, shallow edges, sediment banks, strategic map clarity, suitable for shader and texture implementation, grounded realism, concept sheet showing narrow stream, medium river, and broad crossing.`

## 11. Far-view forest billboards

Prompt:

`Create far-distance forest billboard concepts for a prehistoric to ancient grand-strategy map. Tree masses readable from high zoom-out, soft but distinct silhouette blocks, cohesive with low-poly or stylized-realistic forest assets, optimized for performance, neutral background, game-ready asset direction.`

## 12. Artifact icon set

Prompt:

`Design a cohesive icon set for five strategy simulation artifacts: combat, resource tempo, map objective control, risk discipline, team enablement. Ancient tribal and antiquity symbolic influence, elegant but readable at small sizes, muted bone, bronze, clay, charcoal, and earth palette, clean vector-like silhouettes, game UI icon sheet on plain background.`

## 13. Event icon set

Prompt:

`Create an ancient strategy game event icon pack for starvation, migration, siege, merger, extinction, rebellion, and alliance. Clear symbolic silhouettes, high readability at small sizes, tribal, carved, and early symbolic influence, unified style, plain background, game-ready UI icon sheet.`

## 14. Banners and heraldry

Prompt:

`Generate a modular tribal and ancient insignia set for a strategy simulation: faction banners, standards, shields, carved seals, simple patterns, muted but distinctive palette, readable from distance, suitable for procedural recoloring and faction variation, game UI and world-marker use, neutral background.`

## 15. Medieval title font exploration

Prompt:

`Create a typography direction board for an ancient tribal grand-strategy game interface inspired by carved stone inscriptions, early ceremonial markings, and antiquity court aesthetics. Serious, readable, primal but refined, suitable for tribe names, kingdom names, and title headers. Do not copy any existing game's logo or proprietary lettering. Show display-font mood, body-font companion, UI application examples on leather, stone, parchment, and dark map panels.`

## 16. UI ornament pack

Prompt:

`Design a restrained tribal antiquity strategy UI ornament pack: panel corners, dividers, seal motifs, banner tabs, stone, leather, bone, bronze, clay, and woven accents, suitable for a serious grand-strategy interface, readable and not overly decorative, plain background, modular kit presentation.`

## 17. Watchtower and fortification pack

Prompt:

`Create a modular prehistoric to ancient fortification asset pack for a strategy game: watchtower, wall segment, gate, wooden palisade, earthwork and early stone defensive upgrade path, readable from isometric top-down view, strong silhouettes, game-ready concept presentation on neutral background.`

## 18. Migration caravan

Prompt:

`Design a migration caravan marker for a prehistoric to ancient tribal strategy simulation. People, sledges or carts, pack animals, supplies, movement and hardship, readable from distance, compact silhouette for isometric map view, serious grounded tone, game-ready asset concept on neutral background.`

## 19. War marker and frontline motif

Prompt:

`Create war visualization motifs for an ancient tribal grand-strategy simulation: battle standard, crossed weapons marker, contested-zone emblem, siege indicator, readable from far zoom, serious ritual and martial style, optimized for strategy-map clarity, game-ready icon and marker concept sheet.`

## 20. Biome master style sheet

Prompt:

`Create a cohesive art direction sheet for a prehistoric to ancient isometric world simulation with biomes including plains, forest, marsh, mountain, riverbank, fertile valley, and dry steppe. Show terrain palette, material language, vegetation style, settlement integration, and readability rules for strategy gameplay.`

## Implementation Sequence

1. Lock art direction sheet.
2. Choose fonts.
3. Build terrain and biome texture baseline.
4. Build tribe, city, duchy, kingdom, empire settlement progression set.
5. Build biome-specific environment packs.
6. Build trees, rocks, river visuals, and modular structures.
7. Build icon packs and heraldry.
8. Add nice-to-have atmospheric effects.

## Minimum Viable Art Pack

The first playable desktop version only truly needs:

- one display font and one readable body font
- basic biome textures
- at least two biome-specific prop packs
- one tree pack
- river visual treatment
- tribe camp model
- city model
- duchy model
- kingdom model
- simple empire placeholder
- basic citizen cluster marker
- five artifact icons
- six or seven event icons
- simple border and disputed-tile overlays

Everything else can be layered in after the first stable build.
