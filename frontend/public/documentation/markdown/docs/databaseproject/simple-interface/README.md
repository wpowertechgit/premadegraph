# ASP.NET Core adatbázis-böngésző

Ez a mappa a database project ASP.NET Core adatbázis-böngészőjét tartalmazza. A felület a backendben ténylegesen használt SQLite adatbázisokból generált helyi projektadatbázist olvassa.

## Importálás

```bash
dotnet run -- import
```

Ez a kézi import parancs létrehozza az adott datasethez tartozó `Data/premadegraph_project_<dataset>.db` fájlt. Normál indításkor az alkalmazás automatikusan lefuttatja ugyanezt az importot az aktuális datasetre, ezért a böngésző friss backend-adatokkal nyílik meg.

Konkrét dataset kézi importja:

```bash
dotnet run -- import flexset
```

Az import forrásai:

- `../../../backend/players.db`
- `../../../backend/pathfinder_replays.db`
- `../../../playersrefined.db`

## Futtatás

```bash
dotnet run --urls http://127.0.0.1:5088
```

Megnyitás böngészőben:

```text
http://127.0.0.1:5088
```

Docker Compose alatt a böngésző külön szolgáltatásként indul, és a fő backend proxyn keresztül is elérhető:

```text
http://localhost:3001/db-explorer/
```

## Felület

Az alkalmazás kezdőoldala a teljes adatbázis-böngésző:

- `/` - adatbázis-böngésző;
- `/database` - ugyanaz a böngésző közvetlen útvonalként;
- `/database/value` - egy kiválasztott nagy mező, például `run_json`, teljes tartalma külön oldalon.

A fejlécben lévő dataset választóval egyszerre egy adatforrás böngészhető, például `default`, `flexset` vagy `soloq`. A kiválasztott dataset külön generált SQLite adatbázist kap, ezért a datasetek nem keverednek egymással.

## Adatbázis böngésző

Az adatbázis-böngésző a generált SQLite projektadatbázis összes tábláját böngészhetővé teszi:

- `players`
- `clusters`
- `cluster_members`
- `pathfinder_replays`
- `pathfinder_replay_runs`

A böngésző szerveroldali lapozást használ, ezért egyszerre csak az aktuális oldal sorait tölti be. Támogatott funkciók:

- globális keresés;
- oszloponkénti szűrés;
- oszlop szerinti rendezés;
- növekvő/csökkenő rendezési irány;
- 25, 50 vagy 100 sor oldalanként;
- oszlopmagyarázó információs jelvények;
- nagyméretű JSON mezők rövid előnézete;
- teljes JSON mezők külön, kattintásra betöltött oldala.

Az alkalmazás PostgreSQL szerver nélkül is futtatható, mert a beadandóhoz saját SQLite projektadatbázist generál a meglévő backend adatokból.
