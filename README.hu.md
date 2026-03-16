# Premade Graph

[English](README.md) | [Magyar](README.hu.md)

A `premadegraph` egy szakdolgozati projekt, amely League of Legends meccsadatokból játékoskapcsolati gráfok építésére, elemzésére és vizualizálására szolgál.

A repository a következő részeket egyesíti:

- meccsgyűjtés és játékos-normalizálás
- Python-alapú gráfgenerálás és klaszterezés
- Node/Express backend
- React/Vite frontend
- Rust útkereső motor valódi gráfkereséshez

## Áttekintés

A projekt az ismétlődő játékos-együttelőfordulásokat gráffá alakítja, és ezt két kapcsolódó célra használja:

- populációelemzés és klasztervizualizáció
- útkeresés játékosok között interaktív frontend visszajátszással

A jelenlegi rendszer támogatja:

- szűrt gráfgenerálást `min_weight >= 2` feltétellel
- SQLite-alapú klaszterperzisztenciát
- Rust-alapú BFS, Dijkstra, kétirányú keresés és egzakt A*
- globális gráfnézetet, játékosfókuszt és útvonal-orientált futásidejű nézeteket

## Repository Felépítése

### Gyökér

- `package.json`: közös fejlesztői belépési pont a frontendhez és backendhez
- `docker-compose.yml`: konténerizált frontend/backend futtatás
- `playersrefined.db`: dúsított SQLite adatbázis, amit a gráfgenerálás és a Rust runtime használ
- `docs/`: technikai dokumentáció

### Backend

- `backend/server.js`: Express API-réteg
- `backend/build_graph.py`: gráfépítő connected-component jellegű klaszterezéssel
- `backend/new_build_graph.py`: újabb, modularitás/community-alapú gráfépítő
- `backend/cluster_persistence.py`: közös SQLite klaszter-perzisztencia segédmodul
- `backend/match_collector.py`: Riot API crawler
- `backend/add_new_players.js`: nyers játékos-beolvasás
- `backend/normalize_players_by_puuid.js`: játékos-normalizálás
- `backend/pathfinder/`: Node-os útkereső implementáció és Rust bridge
- `backend/pathfinder-rust/`: Rust gráf-runtime és keresőmotor
- `backend/data/`: nyers meccs JSON fájlok
- `backend/clusters/`: exportált klaszter JSON fájlok
- `backend/output/`: generált HTML gráfkimenet

### Frontend

- `frontend/`: React + Vite alkalmazás
- `frontend/src/PathfinderLabPage.tsx`: fő pathfinder nézet
- `frontend/src/PathfinderGraphOverlay.tsx`: teljes képernyős gráffelfedező overlay

## Gráf- És Klasztermodell

A projekt most már elsőrangú adatbázis-entitásként tárolja a klasztereket.

Két klasztercsalád él egymás mellett:

- `python_population`
  - a Python gráf pipeline állítja elő
  - populációelemzéshez és országkövetkeztetéshez használjuk
- `rust_pathfinding`
  - a Rust runtime állítja elő
  - szűrt futásidejű gráfstruktúrához, játékosfókuszhoz és A* heurisztikákhoz használjuk

Mindkettő SQLite-ba perzisztálódik az alábbi táblákon keresztül:

- `clusters`
- `cluster_members`

A gyenge, egyszeri zajkapcsolatokat a rendszer alapértelmezetten kiszűri ismétlődő kapcsolati küszöbökkel, jelenleg elsősorban `weight >= 2` körül.

## Pathfinder Modell

A jelenlegi útkereső támogatja:

- `social-path`
  - csak szövetséges kapcsolatokon való bejárás
- `battle-path`
  - bejárás szövetséges és ellenséges kapcsolatokon keresztül is

A súlyozott mód azt jelenti, hogy az erősebb, ismétlődő kapcsolatok olcsóbb bejárási költséget kapnak.

A gyakorlatban:

- súlyozás nélkül minden érvényes él egyformának számít
- súlyozott módban az erősebb ismétlődő kapcsolatok előnyt kapnak

A Rust A* a következőket használja:

- landmark-alapú alsó korlátok
- klaszterugrás-alapú alsó korlátok
- layout-távolságot csak döntetlenfeloldásra

## Gyors Indítás

### Lokális Fejlesztés

A repository gyökeréből:

```bash
npm install
npm run dev
```

Ez elindítja:

- a frontendet a `http://localhost:5173` címen
- a backendet a `http://localhost:3001` címen

### Docker

Ha a Docker Desktop fut:

```bash
docker compose up --build
```

Ez együtt indítja a frontend és backend konténereket.

## Fő Folyamatok

### 1. Meccsadatok Gyűjtése

Futtasd a `backend/` könyvtárból:

```bash
python match_collector.py
```

Fontosabb script-szintű beállítások:

- `MATCHES_PER_PLAYER`
- `MAX_ITERATIONS`
- `QUEUE_TYPE`
- Riot API pacing / rate limit beállítások

### 2. Játékosok Hozzáadása És Normalizálása

Futtasd a `backend/` könyvtárból:

```bash
node add_new_players.js
node normalize_players_by_puuid.js
```

### 3. A Szűrt Gráf Generálása

Futtasd a `backend/` könyvtárból:

```bash
python new_build_graph.py --connected-only --min-weight 2
```

Ez a következőket végzi el:

- felépíti az együttelőfordulási gráfot valódi meccsekből
- dúsítja a csomópontokat a `playersrefined.db` alapján
- közösségeket detektál
- JSON artifactokat ír a `backend/clusters/` mappába
- perzisztálja a `python_population` klasztereket SQLite-ba
- legenerálja a `backend/output/premade_network.html` fájlt

### 4. Országbecslési Pipeline

Opcionális scriptek a `backend/` könyvtárban:

```bash
python fetch_clusters.py
python assign_countries.py
```

Ezek a klaszterexportok és játékosnevek alapján regionális eredetet becsülnek, majd frissítik a játékosrekordokat SQLite-ban.

### 5. Rust Pathfinder Runtime

Futtasd a `backend/pathfinder-rust/` könyvtárból:

```bash
cargo run -- options
```

Keresés futtatásához:

```bash
echo '{"sourcePlayerId":"...","targetPlayerId":"...","algorithm":"astar","pathMode":"social-path","weightedMode":true,"options":{"includeTrace":false,"maxSteps":5000}}' | cargo run -- run
```

## Környezeti Változók

Hasznos változók a projektben:

- `RIOT_API_KEY`
- `GRAPH_DB_PATH`
- `DB_PATH`
- `OPENROUTER_API_KEY`
- `PATHFINDER_MATCH_DIR`
- `PATHFINDER_RUST_BIN`

## Dokumentáció

- [Rust Backend Prototype Notes](docs/pathfinder-backend-prototype.md)
- [Unified Cluster Persistence And Exact A*](docs/unified-cluster-persistence-and-astar.md)

## Licenc

Ez a repository az [MIT License](LICENSE) licenc alatt érhető el.
