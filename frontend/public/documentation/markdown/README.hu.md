# <img src="frontend/public/mushroom-icon-256.png" alt="Premade Graph logo" width="42" align="left"> Premade Graph

<br />

[English](README.md) | [Magyar](README.hu.md)

![Thesis](https://img.shields.io/badge/fókusz-szakdolgozat-1f6feb?style=flat-square)
![Frontend](https://img.shields.io/badge/ui-React%20%2B%20Vite-0f766e?style=flat-square)
![Backend](https://img.shields.io/badge/backend-Node%20%2B%20Rust-7c3aed?style=flat-square)
![Analytics](https://img.shields.io/badge/elemzés-signed%20graph%20%2F%20pathfinding-c2410c?style=flat-square)
![License](https://img.shields.io/badge/licenc-MIT-111827?style=flat-square)

A **Premade Graph** egy League of Legends játékoshálózati szakdolgozati projekt, amely meccstörténetet gyűjt, ismétlődő együttjátszásból gráfot épít, előjeles kapcsolatokat elemez, és ezt egy látványos interaktív frontendben teszi felfedezhetővé.

A repository egyesíti:

- a meccsgyűjtést és játékos-normalizálást
- a Python-alapú gráfgenerálást és klaszterezést
- az SQLite-alapú klaszterperzisztenciát
- a Node/Express API réteget
- a Rust runtime-ot egzakt útkereséshez és gráfanalitikához
- a React/Vite frontendet az interaktív bemutatóhoz

## Miért Érdekes Ez A Projekt

Ez a repository nem csak egy statikus hálózatnéző. Inkább egy kutatási és rendszerszintű játszótér, amely egy szokatlan adathalmazra épül: egy **előjeles szociális gráfra**, ahol az ismétlődő szövetséges és ellenséges kapcsolatok is elemezhetők.

A jelenlegi projektirány ezekre helyezi a hangsúlyt:

- értelmezhető gráfanalitika
- reprodukálható Rust oldali számítás
- szakdolgozatban jól védhető kísérletek
- erős vizuális demoérték

## Friss UI- És Analitikai Bővítmények

A jelenlegi build már egy jóval gazdagabb 3D-s megjelenítést és elemzési folyamatot tartalmaz:

- egy előre kiszámolt **teljes 3D gráfgömböt** a nagy hálózati nézethez
- egy **megvilágított, gázóriás-szerű gömbhéjat**, hogy távolról is jól olvasható legyen
- **háttérbeli csillagmezőt** a jobb térérzethez
- **sűrűbb klasztermegjelenítést** finom külső burkokkal
- **zoomfüggő élmegjelenítést**, hogy közelről jobban látszódjanak a valódi meccskapcsolatok
- egy **összecsukható információs kártyát**, amely info ikon mögé rejthető
- Rust-alapú **signed structural-balance** elemzést
- klasztereket is figyelembe vevő BFS, Dijkstra, kétirányú keresés és egzakt A* nézeteket

## Frontend Élmény

| Felület | Mire való |
| --- | --- |
| `Pathfinder Lab` | interaktív legrövidebbútvonal-felfedezés visszajátszással és algoritmus-összehasonlítással |
| `Full 3D Graph Sphere` | a teljes elnevezett játékosháló madártávlati bejárása |
| `Signed Balance` | struktúraegyensúly-kísérlet a szövetséges/ellenséges kapcsolatokon |
| játékosfókusz / globális gráfnézetek | a Rust motor futásidejű gráfnézetének vizsgálata |

## Architektúrai Gyorskép

| Réteg | Felelősség |
| --- | --- |
| Python pipeline | meccsalapú gráfépítés, klaszterezés, export workflow-k |
| SQLite | klaszterek és dúsított játékosmetaadatok közös tárolása |
| Node/Express backend | API shell, orchesztráció, frontend végpontok |
| Rust runtime | egzakt útkeresés, futásidejű gráfnézetek, signed-balance elemzés |
| React/Vite frontend | grafikus UI, kontrollok, overlay-ek, 3D felfedezés |

<details open>
<summary><strong>Gyors Indítás</strong></summary>

### Lokális fejlesztés

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

</details>

<details>
<summary><strong>Fő Workflow-k</strong></summary>

### 1. Meccsadatok gyűjtése

Futtasd a `backend/` mappából:

```bash
python match_collector.py
```

Fontosabb script-szintű kapcsolók:

- `MATCHES_PER_PLAYER`
- `MAX_ITERATIONS`
- `QUEUE_TYPE`
- Riot API pacing / rate-limit beállítások

### 2. Játékosok hozzáadása és normalizálása

Futtasd a `backend/` mappából:

```bash
node add_new_players.js
node normalize_players_by_puuid.js
```

### 3. A szűrt gráf generálása

Futtasd a `backend/` mappából:

```bash
python new_build_graph.py --connected-only --min-weight 2
```

Ez a következőket végzi el:

- felépíti az együttelőfordulási gráfot valódi meccsekből
- dúsítja a játékosokat a `playersrefined.db` alapján
- közösségeket detektál
- JSON artifactokat ír a `backend/clusters/` mappába
- perzisztálja a `python_population` klasztereket SQLite-ba
- legenerálja a `backend/output/premade_network.html` fájlt

### 4. Országbecslési pipeline

Opcionális scriptek a `backend/` mappában:

```bash
python fetch_clusters.py
python assign_countries.py
```

### 5. Rust runtime parancsok

Futtasd a `backend/pathfinder-rust/` mappából:

```bash
cargo run -- options
```

Példa keresés futtatására:

```bash
echo '{"sourcePlayerId":"...","targetPlayerId":"...","algorithm":"astar","pathMode":"social-path","weightedMode":true,"options":{"includeTrace":false,"maxSteps":5000}}' | cargo run -- run
```

Signed structural-balance elemzés:

```bash
echo '{"minEdgeSupport":2,"tiePolicy":"exclude","maxTopNodes":10,"includeClusterSummaries":true}' | cargo run -- signed-balance
```

Backend végpont:

```text
POST /api/pathfinder-rust/signed-balance
```

</details>

<details>
<summary><strong>Repository-térkép</strong></summary>

### Gyökér

- `package.json`: közös fejlesztői belépési pont
- `docker-compose.yml`: frontend/backend konténeres futtatás
- `playersrefined.db`: dúsított SQLite adatbázis
- `docs/`: technikai jegyzetek és architektúraleírások

### Backend

- `backend/server.js`: Express API shell
- `backend/build_graph.py`: eredeti gráfépítő
- `backend/new_build_graph.py`: modularitás/community-alapú gráfépítő
- `backend/cluster_persistence.py`: közös klaszterperzisztencia-segéd
- `backend/match_collector.py`: Riot crawler
- `backend/add_new_players.js`: nyers játékos-beolvasás
- `backend/normalize_players_by_puuid.js`: játékos-normalizálás
- `backend/pathfinder/`: Node-os pathfinder és Rust bridge
- `backend/pathfinder-rust/`: Rust gráf-runtime és analitika
- `backend/data/`: nyers meccs JSON fájlok
- `backend/clusters/`: exportált klaszter JSON fájlok
- `backend/output/`: generált HTML/graf artifactok

### Frontend

- `frontend/`: React + Vite alkalmazás
- `frontend/src/PathfinderLabPage.tsx`: a pathfinder felület
- `frontend/src/GraphSpherePage.tsx`: a teljes 3D gráfgömb
- `frontend/src/SignedBalancePage.tsx`: a signed-balance UI

</details>

## Gráf- És Klasztermodell

A projekt a klasztereket elsőrangú adatbázis-entitásokként tárolja.

Két klasztercsalád él egymás mellett:

- `python_population`
  - a Python pipeline generálja
  - populációelemzéshez és országkövetkeztetéshez használjuk
- `rust_pathfinding`
  - a Rust runtime generálja
  - futásidejű gráfstruktúrához, játékosfókuszhoz és heurisztikai támogatáshoz használjuk

Perzisztencia táblák:

- `clusters`
- `cluster_members`

A gyenge, egyszeri zajkapcsolatokat a rendszer ismétlődő kapcsolati küszöbökkel szűri, jelenleg elsősorban `weight >= 2` körül.

## Pathfinder Modell

Támogatott path módok:

- `social-path`
  - csak szövetséges kapcsolatokon való bejárás
- `battle-path`
  - bejárás szövetséges és ellenséges kapcsolatokon keresztül is

A súlyozott mód azt jelenti, hogy az erősebb, ismétlődő kapcsolatok olcsóbb bejárási költséget kapnak.

A Rust A* jelenleg ezeket használja:

- landmark-alapú alsó korlátok
- klaszterugrás-alapú alsó korlátok
- layout-távolságot csak döntetlenfeloldásra

## Környezeti Változók

Hasznos változók a projektben:

- `RIOT_API_KEY`
- `GRAPH_DB_PATH`
- `DB_PATH`
- `OPENROUTER_API_KEY`
- `PATHFINDER_MATCH_DIR`
- `PATHFINDER_RUST_BIN`

## Dokumentáció

A dokumentációs készlet szándékosan kereszt-hivatkozott formában épül fel, hogy később minimális átrendezéssel LaTeX-fejezetekké lehessen emelni.

- a frontend narratívához érdemes a [New GUI Overview](docs/new-gui-overview.md) fájllal kezdeni
- a mozgásrendszer külön alfejezetéhez a [Route Transition Overlay](docs/route-transition-overlay.md) használható
- a globális 3D vizualizációhoz a [Bird's-Eye 3D Sphere](docs/birdseye-3d-sphere.md) adja a megfelelő hátteret
- az előjeles hálózati kísérlethez a [Signed Balance Theory And Implementation](docs/signed-balance-theory.md) a fő hivatkozási pont
- a szintetikus teszt- és demoadatkészletekhez a [Mock Datasets And Chaos Design](docs/mock-datasets-and-chaos-design.md) használható
- a tárolási és runtime architektúrához a [Unified Cluster Persistence And Exact A*](docs/unified-cluster-persistence-and-astar.md) illeszkedik
- a backend evolúciójához és migrációs kontextushoz a [Pathfinder Backend Prototype Notes](docs/pathfinder-backend-prototype.md) ad történeti hátteret

- [New GUI Overview](docs/new-gui-overview.md)
- [Route Transition Overlay](docs/route-transition-overlay.md)
- [Bird's-Eye 3D Sphere](docs/birdseye-3d-sphere.md)
- [Signed Balance Theory And Implementation](docs/signed-balance-theory.md)
- [Mock Datasets And Chaos Design](docs/mock-datasets-and-chaos-design.md)
- [Rust Backend Prototype Notes](docs/pathfinder-backend-prototype.md)
- [Unified Cluster Persistence And Exact A*](docs/unified-cluster-persistence-and-astar.md)

## Licenc

Ez a repository az [MIT License](LICENSE) licenc alatt érhető el.

## Következtetések

A repository jelenlegi állapotában leginkább egy kutatási és rendszerszintű hibrid projektként értelmezhető:

- a Rust runtime viszi a komoly algoritmikus munkát
- a frontend ezt koherens interaktív bemutatóvá alakítja
- a signed és mock elemzési rétegek segítenek az eredmények magyarázhatóságában, validálásában és későbbi szakdolgozati beemelésében
