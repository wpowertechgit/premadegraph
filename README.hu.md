# <img src="frontend/public/mushroom-icon-256.png" alt="Premade Graph logo" width="42" align="left"> Premade Graph

<br />

[English](README.md) | [Magyar](README.hu.md)

![Thesis](https://img.shields.io/badge/fókusz-kutatási%20%2B%20rendszer%20szakdolgozat-1f6feb?style=flat-square)
![Frontend](https://img.shields.io/badge/ui-React%20%2B%20Vite-0f766e?style=flat-square)
![Backend](https://img.shields.io/badge/backend-Node%20%2B%20Rust-7c3aed?style=flat-square)
![Analytics](https://img.shields.io/badge/elemzés-asszortativitás%20%2F%20Brandes%20centralitás-c2410c?style=flat-square)
![License](https://img.shields.io/badge/licenc-MIT-111827?style=flat-square)

A **Premade Graph** egy League of Legends szakdolgozati projekt, amely meccstörténeti adatokat gyűjt, ismétlődő játékos-együttelőfordulásokból gráfot épít, majd a kapott hálózatokat Node/Express API-n, Rust gráfanalitikai runtime-on és React/Vite frontenden keresztül elemzi.

A jelenlegi szakdolgozati scope szándékosan szűkebb és jobban védhető:

- a `flexset` és `soloq` adatkészletek bővítése és dokumentálása
- a `flexset` értelmezése asszociatív core-periphery játékosgráfként
- Flex Queue és SoloQ összehasonlítása túlzó társas állítások nélkül
- `opscore` és `feedscore` asszortativitás mérése a gráféleken
- súlyozott Brandes-féle betweenness centrality számítása Rustban, Rayon párhuzamosítással
- Genetic NeuroSim v2 megtartása jövőbeli irányként, validált gráf- és játékosprofilokból seedelve

A Signed Balance / Structural Balance továbbra is létezik diagnosztikai kódként, de nyugdíjazva van a szakdolgozat-facing terméknarratívából. Lásd: [Signed Balance Methodological Retirement](docs/signed-balance-methodological-retirement.md).

## Aktuális UI

A frontend egyszerű gráfnézőből kutatási cockpit lett: dataset vezérlés, pathfinding replay, Graph V2 exportok, bizonyíték-dokumentáció és Rust-alapú analitikai oldalak egy felületben.

![Flexset associative graph](docs/assets/demo_shots/flexset_associative_graph.png)

![Assortativity readout](docs/assets/demo_shots/f-assortavity-socialpath-readout.png)

![Brandes centrality result](docs/assets/demo_shots/brandes-result.png)

![Pathfinder replay panel](docs/assets/demo_shots/pathfinder-replay-panel.png)

![Full 3D graph sphere](docs/assets/demo_shots/birds-eye-current-state.png)

## Mit Csinál A Rendszer?

| Terület | Jelenlegi szerep |
| --- | --- |
| Adatgyűjtés | Riot API meccsgyűjtés dataset-specifikus Apex Flex Queue és Master SoloQ presetekkel |
| Játékospontozás | szerepkörérzékeny `opscore` / `feedscore` jellegű metrikák node-attribútumként |
| Gráfépítés | ismétlődő együtt-előfordulások vetítése ally/enemy kapcsolati evidenciává és Graph V2 artifactokká |
| Asszortativitás | numerikus, Pearson-jellegű élmenti korreláció `opscore` és `feedscore` értékekre |
| Brandes centrality | súlyozott node betweenness centrality `1 / strength` élköltséggel, soros és párhuzamos móddal |
| Pathfinder Lab | BFS, Dijkstra, kétirányú keresés, egzakt A*, replay és algoritmus-összehasonlítás |
| Dokumentációs panel | szinkronizált Obsidian-jellegű dokumentáció, szakdolgozat PDF előnézet és fejezetenkénti evidenciajegyzetek |

## Bizonyíték-Térkép

A repository most már explicit bizonyítéktérképet tartalmaz a szakdolgozati védéshez:

- [Chapter Evidence Map](docs/chapter-evidence-map.md): minden szakdolgozati fejezetet összeköt a támogató markdown jegyzetekkel, kódrészletekkel, diagramokkal, datasetekkel és bibliográfiai kulcsokkal.
- [Document Map](docs/DOCUMENT_MAP.md): agent-olvasható index a dokumentációs vaulthoz.
- `docs/evidence/`: fejezetenként egy evidenciajegyzet.
- A frontend Documentation oldal ezeket a fejezet-evidencia jegyzeteket elsőrangú dokumentációként jeleníti meg.

A cél egyszerű: a szakdolgozati állítások mögött legyen konkrét forrás és implementációs bizonyíték.

## Architektúrai Gyorskép

```text
frontend/ React + Vite UI
    |
    | HTTP JSON
    v
backend/server.js Express API shell
    |
    | SQLite, collector orchestration, Rust process bridge
    v
backend/pathfinder-rust Rust runtime
    |
    | GraphState, search, Graph V2, assortativity, centrality
    v
datasets / SQLite / generated graph artifacts
```

| Réteg | Felelősség |
| --- | --- |
| Python scriptek | meccsgyűjtés, legacy gráfépítés, dúsítási segédfolyamatok |
| SQLite | játékosmetaadatok, score-ok, klaszterek, replay-perzisztencia, dataset-lokális adatbázisok |
| Node/Express | API shell, dataset registry, runtime kulcsok, collector életciklus, Rust bridge |
| Rust | kanonikus futásidejű gráfprojekció, útkeresés, Graph V2 exportok, analitika |
| React/Vite | dataset kontrollok, gráffelfedezés, analitikai oldalak, pathfinder replay, dokumentációolvasó |

## Gyors Indítás

### Lokális fejlesztés

A repository gyökeréből:

```bash
npm install
npm run dev
```

Ez elindítja:

- frontend: `http://localhost:5173`
- backend: `http://localhost:3001`

### Docker

```bash
docker compose up --build
```

A Docker a backendet, frontendet és az adatbázis-böngésző szolgáltatást indítja. A frontend a becsomagolt dokumentációs manifestet használja, ha a repo-gyökér `docs/` mappája nincs bemountolva a frontend konténerbe.

## Fő Workflow-k

### 1. Meccsadatok Gyűjtése

A collector presetek itt vannak: [backend/collector_configs](backend/collector_configs)

- [apex-flex-collector.json](backend/collector_configs/apex-flex-collector.json)
- [master-soloq-eune-collector.json](backend/collector_configs/master-soloq-eune-collector.json)

Futtatás a `backend/` mappából:

```bash
python match_collector.py
```

### 2. Játékosok Normalizálása

```bash
cd backend
node add_new_players.js
node normalize_players_by_puuid.js
```

### 3. Rust Analitikák Futtatása

A `backend/pathfinder-rust/` mappából:

```bash
cargo run -- options
```

Asszortativitás:

```bash
echo '{"minEdgeSupport":1,"includeClusterBreakdown":true}' | cargo run -- assortativity
```

Betweenness centrality:

```bash
echo '{"pathMode":"battle-path","weightedMode":true,"parallel":true,"runSerialBaseline":true}' | cargo run -- betweenness-centrality
```

Útkeresés:

```bash
echo '{"sourcePlayerId":"...","targetPlayerId":"...","algorithm":"astar","pathMode":"social-path","weightedMode":true,"options":{"includeTrace":false,"maxSteps":5000}}' | cargo run -- run
```

Backend route-ok:

```text
POST /api/pathfinder-rust/assortativity
POST /api/pathfinder-rust/assortativity-significance
POST /api/pathfinder-rust/betweenness-centrality
POST /api/pathfinder-rust/run
POST /api/pathfinder-rust/compare
```

A signed-balance route-ok továbbra is léteznek diagnosztikai újrafuttatáshoz, de nem szabad fő empirikus eredményként bemutatni őket, hacsak a scope nincs explicit újranyitva.

## Repository-Térkép

### Gyökér

- [AGENTS.md](AGENTS.md): aktív scope és jövőbeli munka szabályai
- [CLAUDE.md](CLAUDE.md): strukturális térkép Claude/Codex sessionökhöz
- [README.md](README.md): angol README
- [docker-compose.yml](docker-compose.yml): backend/frontend/adatbázis-böngésző szolgáltatások
- [playersrefined.db](playersrefined.db): gyökérszintű finomított játékosadatbázis
- [docs/](docs): szakdolgozati jegyzetek, evidenciajegyzetek, diagramok és PDF-források

### Backend

- [backend/server.js](backend/server.js): Express API, dataset registry, collector/runtime orchestráció
- [backend/match_collector.py](backend/match_collector.py): Riot API collector
- [backend/scoring_config.js](backend/scoring_config.js): scoring konfiguráció
- [backend/cluster_persistence.py](backend/cluster_persistence.py): klaszterperzisztencia segéd
- [backend/pathfinder/rustBridge.js](backend/pathfinder/rustBridge.js): Node-to-Rust process bridge
- [backend/pathfinder-rust](backend/pathfinder-rust): Rust gráf-runtime és analitikai crate

### Rust Runtime

- [engine/graph.rs](backend/pathfinder-rust/src/engine/graph.rs): `GraphState` építés és kapcsolatprojekció
- [engine/search.rs](backend/pathfinder-rust/src/engine/search.rs): BFS, Dijkstra, kétirányú keresés, egzakt A*
- [engine/assortativity.rs](backend/pathfinder-rust/src/engine/assortativity.rs): numerikus gráfasszortativitás
- [engine/centrality.rs](backend/pathfinder-rust/src/engine/centrality.rs): súlyozott Brandes betweenness centrality
- [engine/graph_v2.rs](backend/pathfinder-rust/src/engine/graph_v2.rs): Graph V2 exportok
- [engine/birdseye.rs](backend/pathfinder-rust/src/engine/birdseye.rs): 3D gráf artifact exportok
- [engine/signed_balance.rs](backend/pathfinder-rust/src/engine/signed_balance.rs): nyugdíjazott signed-balance diagnosztika

### Frontend

- [frontend/src/App.tsx](frontend/src/App.tsx): route tree és shell
- [frontend/src/GraphSpherePage.tsx](frontend/src/GraphSpherePage.tsx): 3D globális gráfgömb
- [frontend/src/PathfinderLabPage.tsx](frontend/src/PathfinderLabPage.tsx): pathfinding lab és replay felület
- [frontend/src/AssortativityPage.tsx](frontend/src/AssortativityPage.tsx): teljesítménymetrika-asszortativitási UI
- [frontend/src/BetweennessCentralityPage.tsx](frontend/src/BetweennessCentralityPage.tsx): Brandes centrality UI
- [frontend/src/DocumentationPage.tsx](frontend/src/DocumentationPage.tsx): szinkronizált markdown/PDF evidenciaolvasó

## Képernyőképek

### Dataset Gráfok

![Flexset associative graph clusters](docs/assets/demo_shots/flexset_associative_graph_clusters.png)

![SoloQ associative graph](docs/assets/demo_shots/soloq_associative_graph.png)

### Asszortativitás

![Flexset assortativity controls](docs/assets/demo_shots/assortavity-controls.png)

![Flexset battle-path assortativity](docs/assets/demo_shots/f-assortavity-battle-path-opfeedscore.png)

![SoloQ layman takeaways](docs/assets/demo_shots/sq-assortavity-layman-takeaways.png)

### Betweenness Centrality

![Brandes configuration](docs/assets/demo_shots/brandes-config.png)

![Graph broker highlighted in yellow](docs/assets/demo_shots/graph-brandes-brokerinyellow.png)

### Pathfinder

![A* weighted test run](docs/assets/demo_shots/pathfinder-astar-weighted-testrun.png)

![Replay overlay](docs/assets/demo_shots/pathfinder_replay_overlay.png)

## Dokumentáció

Ajánlott kezdőpontok:

- [Chapter Evidence Map](docs/chapter-evidence-map.md)
- [Document Map](docs/DOCUMENT_MAP.md)
- [Project Feasibility Review And Additions](docs/project-feasibility-review-and-additions.md)
- [Flexset Associative Graph Interpretation](docs/flexset-associative-graph-interpretation.md)
- [SoloQ Associative Graph Interpretation](docs/soloq-associative-graph-interpretation.md)
- [Assortativity Analysis](docs/assortativity-analysis.md)
- [Parallel Brandes Implementation Plan](docs/parallel-brandes-implementation-plan.md)
- [Graph V2 Claude Analysis Report](docs/graph-v2-claude-analysis-report.md)
- [Signed Balance Methodological Retirement](docs/signed-balance-methodological-retirement.md)

## Jelenlegi Nem-Célok

- Contraction Hierarchies
- időbeli játékosstabilitás / temporal consistency elemzés
- community cohesion vs performance dashboardok
- enemy élek kezelése megbízható negatív társas kötésként
- Signed Balance bemutatása fő empirikus eredményként
- adatvezérelt `opscore`-újratanítás az evidenciapipeline érése előtt
- teljesítményállítás benchmark nélkül
- olyan oksági társas vagy pszichológiai állítások, amelyeket az adat nem támaszt alá

## Licenc

Ez a repository az [MIT License](LICENSE) licenc alatt érhető el.

