# Adatbázis projekt dokumentációs csomag

Téma: Premade Graph - League of Legends játékos-hálózati elemző adatbázis

Ez a mappa a jelenlegi Premade Graph szakdolgozati projekt alapján készült adatbázis tantárgyi beadandót tartalmazza.

## Fájlok

- `documentation.tex` - magyar nyelvű LaTeX dokumentáció, Times New Roman 12 pt beállítással.
- `documentation.pdf` - Tectonic-kal generált PDF.
- `references.bib` - szakirodalmi hivatkozások gyűjteménye.
- `week_plan.md` - heti bontású megfelelőségi térkép a kiírás alapján.
- `schema.sql` - PostgreSQL séma 10 táblával, táblánként legalább 5 attribútummal.
- `sample_data.sql` - mintaadatok, legalább 10 sor táblánként.
- `views_queries.sql` - 2 nézet és 20 különböző lekérdezés.
- `procedures_triggers.sql` - 5 tárolt eljárás, rekurzív függvény és 2 trigger.
- `er_diagram.puml` - PlantUML ER diagramforrás.
- `er_diagram.png` - PlantUML-ből renderelt ER diagram, amelyet a LaTeX dokumentáció is beilleszt.
- `er_diagram.mmd` - Mermaid ER diagramforrás.
- `relational_diagram.mmd` - Mermaid relációs diagram.
- `premadegraph_database.drawio` - draw.io diagramforrás.
- `simple-interface/` - ASP.NET Core adatbázis-böngésző, amely a backend valódi SQLite adatbázisaiból generált projektadatbázist olvassa.

## SQL futtatás

Az SQL szkriptek PostgreSQL-hez készültek:

```bash
psql -d premadegraph_db -f schema.sql
psql -d premadegraph_db -f sample_data.sql
psql -d premadegraph_db -f views_queries.sql
psql -d premadegraph_db -f procedures_triggers.sql
```

## Dokumentáció fordítása

```bash
tectonic documentation.tex
```

Az ER diagram újrarenderelése PlantUML-lel:

```bash
java -Djava.awt.headless=true -jar ../../tools/plantuml.jar -tpng er_diagram.puml
```

## ASP.NET adatbázis-böngésző futtatása

Indításkor az alkalmazás automatikusan legenerálja a saját SQLite adatbázisát a backendben ténylegesen használt adatbázisokból:

```bash
cd simple-interface
dotnet run --urls http://127.0.0.1:5088
```

Források:

- `../../../backend/players.db`
- `../../../backend/pathfinder_replays.db`
- `../../../playersrefined.db`

A kézi, csak importáló mód továbbra is elérhető:

```bash
dotnet run -- import
```

Megnyitás böngészőben: `http://127.0.0.1:5088`.

Az alkalmazás kezdőoldala az adatbázis-böngésző. Támogat keresést, oszloponkénti szűrést, rendezést, szerveroldali lapozást és oszlopmagyarázó súgókat. A nagy JSON mezők a táblanézetben csak előnézetként jelennek meg; a teljes mezőérték külön oldalon nyitható meg.

A böngésző a backend `data/datasets.json` regisztere alapján datasetválasztót is ad. Egyszerre egy dataset aktív, és minden dataset külön `Data/premadegraph_project_<dataset>.db` fájlba importálódik.

Docker Compose indításkor a böngésző a fő backend felől is elérhető: `http://localhost:3001/db-explorer/`.

PostgreSQL azért lett kiválasztva a tantárgyi változathoz, mert a feladat tárolt eljárásokat, triggereket, JSON lekérdezéseket, rekurzív logikát és output paramétereket is kér. A tényleges alkalmazás jelenleg SQLite-ot használ, de a fogalmi modell azonos.
