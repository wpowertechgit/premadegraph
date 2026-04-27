# Adatbázis projekt heti terv és megfelelőségi hivatkozások

Ez a fájl azt mutatja meg, hogy a kiírás egyes pontjai hol vannak megvalósítva a `docs/databaseproject` mappában.

Fontos megkülönböztetés: a tantárgyi követelményekhez készült teljes adatbázismodell PostgreSQL alapú, 10 táblával. Ez található a `schema.sql`, `sample_data.sql`, `views_queries.sql` és `procedures_triggers.sql` fájlokban. Az egyszerű ASP.NET Core felület ezzel párhuzamosan a valódi backend adatbázisokból generált, kisebb SQLite projektadatbázist olvassa, amely 5 ténylegesen használt táblát tartalmaz: `players`, `clusters`, `cluster_members`, `pathfinder_replays`, `pathfinder_replay_runs`.

## Rövid megfelelőségi összegzés

| Követelmény | Állapot | Megvalósítás |
| --- | --- | --- |
| Magyar dokumentáció | Kész | `documentation.tex`, `documentation.pdf` |
| Minimum 6 oldal | Kész | `documentation.pdf` |
| Times New Roman 12 | Kész | `documentation.tex` preambulum: `12pt`, `\setmainfont{Times New Roman}` |
| LaTeX dokumentáció | Kész | `documentation.tex`, Tectonic-kal fordítva |
| Bevezetés | Kész | `documentation.tex`, `\section{Bevezetés}` |
| Legalább 5 tudományos hivatkozás | Kész | `references.bib`, valamint `documentation.tex` hivatkozási szakasz |
| ER modell | Kész | `er_diagram.puml`, `er_diagram.png`, `er_diagram.mmd` |
| Relációs diagram | Kész | `relational_diagram.mmd`, `premadegraph_database.drawio` |
| 10 tábla, min. 5 attribútum | Kész a PostgreSQL beadandóban | `schema.sql` |
| Min. 10 sor táblánként | Kész a mintaadatokban | `sample_data.sql` |
| Legalább 2 nézet | Kész | `views_queries.sql`: `v_player_performance_summary`, `v_cluster_health` |
| 20 különböző lekérdezés | Kész | `views_queries.sql`, számozott 1-20 lekérdezés |
| JSON, aggregáció, JOIN, allekérdezés, EXCEPT/MINUS-jelleg | Kész | `views_queries.sql` |
| Min. 5 tárolt eljárás | Kész | `procedures_triggers.sql` |
| Min. 2 trigger | Kész | `procedures_triggers.sql` |
| Rekurzív logika | Kész | `views_queries.sql` rekurzív CTE, `procedures_triggers.sql` rekurzív függvény |
| Output paraméteres eljárás | Kész | `sp_get_player_summary`, `sp_finish_analysis_run` |
| Paraméterezett eljárások | Kész | `procedures_triggers.sql` eljárásai |
| Egyszerű felület | Kész | `simple-interface/` ASP.NET Core |
| Felület lekérdezéseket használ | Kész | `simple-interface/Program.cs`, adatbázis-böngésző SQL lekérdezései |
| Adatbázis böngésző kereséssel/szűréssel/lapozással | Kész | `simple-interface/Program.cs`, `/database` route |
| Prezentációs vázlat | Kész | `presentation_outline.md` |

## 2. hét - Bevezetés és szakirodalmi kutatás

Kiírás:

- bevezetés írása;
- bibliográfiai kutatás;
- legalább 5 Google Scholarból kereshető tudományos cikk használata.

Megvalósítás:

- `documentation.tex`: `\section{Bevezetés}`;
- `documentation.tex`: `\section{Szakirodalmi kutatás}`;
- `references.bib`: tudományos hivatkozások gyűjteménye;
- `documentation.tex`: `\section{Hivatkozások}`.

A szakirodalmi rész MOBA kutatásra, esport teljesítményelemzésre, hálózatos játékoselemzésre, időbeli csapatstruktúrákra és játékosmetrikákra hivatkozik. Ez teljesíti az elvárt bevezető és bibliográfiai részt.

## 3. hét - ER modell és relációs diagram

Kiírás:

- Entity-Relationship modell létrehozása;
- relációs diagram létrehozása;
- diagramkészítő szoftver használata, például draw.io.

Megvalósítás:

- `er_diagram.puml`: PlantUML ER diagram a ténylegesen generált projekt SQLite adatbázishoz;
- `er_diagram.png`: a PlantUML-ből renderelt ábra, amelyet a LaTeX dokumentáció beilleszt;
- `er_diagram.mmd`: Mermaid ER diagram a bővebb PostgreSQL beadandó modellhez;
- `relational_diagram.mmd`: relációs diagram;
- `premadegraph_database.drawio`: draw.io forrás;
- `documentation.tex`: `\section{Rendszerarchitektúra és részletes terv}`, `\subsection{Egyed-kapcsolat modell}`, `\subsection{Relációs táblák}`.

Megjegyzés: az ábrák két nézetet fednek le. A PlantUML ábra a valódi UI által olvasott SQLite projektadatbázist mutatja. A PostgreSQL szkriptekben szereplő bővebb modell a tantárgyi követelmények 10 táblás modellje.

## 4. hét - Diagramok finomítása és módosítások megbeszélése

Kiírás:

- a beküldött diagramok finomítása;
- lehetséges módosítások megbeszélése.

Megvalósítás:

- `er_diagram.puml`: finomított PlantUML ER diagram a projekt SQLite adatbázishoz;
- `er_diagram.png`: frissen renderelt ábra a dokumentációhoz;
- `relational_diagram.mmd`: relációs diagram;
- `premadegraph_database.drawio`: draw.io diagramforrás;
- `documentation.tex`: architektúra és diagrammagyarázat;
- `README.md`: diagramfájlok és újrarenderelési parancs dokumentálása.

A módosítás lényege: a dokumentációban szereplő 1. ábra már nem kézzel rajzolt LaTeX dobozdiagram, hanem PlantUML-ből generált ER ábra. Ez javítja a diagram pontosságát és reprodukálhatóságát.

## 5. hét - Táblák létrehozása és feltöltése

Kiírás:

- legfeljebb 2 fős csoportnál 10 tábla;
- táblánként minimum 5 attribútum;
- táblánként minimum 10 sor.

Megvalósítás a PostgreSQL beadandóban:

- `schema.sql`: 10 tábla létrehozása;
- `sample_data.sql`: mintaadatok feltöltése.

A 10 tábla:

1. `players`
2. `matches`
3. `teams`
4. `match_participants`
5. `player_relationships`
6. `clusters`
7. `cluster_members`
8. `analysis_runs`
9. `performance_snapshots`
10. `path_queries`

A táblák mind legalább 5 attribútumot tartalmaznak. A mintaadat-szkript minden táblához legalább 10 rekordot biztosít, részben explicit `VALUES`, részben `generate_series`/`SELECT` alapú feltöltéssel.

Fontos: a `simple-interface/Data/premadegraph_project_<dataset>.db` SQLite adatbázis nem a teljes 10 táblás tantárgyi séma, hanem a backendből generált, UI-hoz használt valós projektadatbázis. Ennek 5 táblája van, datasetenként külön fájlban, és ezt a különbséget a dokumentáció és az ER ábra is jelöli.

## 6. hét - Nézetek, lekérdezések és egyszerű felület

Kiírás:

- táblák feltöltése;
- legalább 2 fontos nézet;
- 15 vagy 20 különböző lekérdezés csoportmérettől függően;
- nem elég csak táblaneveket cserélni;
- legyenek összetettebb lekérdezések: `SELECT`, `JOIN`, allekérdezés, JSON, aggregáció, MINUS/EXCEPT jelleg;
- egyszerű felhasználói felület, például ASP.NET;
- a felület használja a létrehozott lekérdezéseket.

Megvalósítás:

- `views_queries.sql`: 2 nézet;
- `views_queries.sql`: 20 számozott, különböző lekérdezés;
- `simple-interface/`: ASP.NET Core adatbázis-böngésző;
- `simple-interface/Program.cs`: automatikus import normál indításkor és `dotnet run -- import` kézi import mód;
- `simple-interface/Program.cs`: `/`, `/database`, `/database/value` route-ok;
- `simple-interface/Program.cs`: datasetválasztó a backend `data/datasets.json` regisztere alapján;
- `simple-interface/Program.cs`: SQLite adatlekérdezések a valós backendből generált projektadatbázisból;
- `simple-interface/README.md`: importálás, futtatás, böngésző használata.

Nézetek:

- `v_player_performance_summary`;
- `v_cluster_health`.

Lekérdezéstípusok a `views_queries.sql` fájlban:

- JOIN: 1., 9., 14., 20. lekérdezés;
- allekérdezés: 2., 10., 15. lekérdezés;
- aggregáció és `HAVING`: 3., 8., 16. lekérdezés;
- JSON mezők és JSON tömbök: 4., 5., 18. lekérdezés;
- EXCEPT, azaz MINUS-jellegű halmazkülönbség: 6. lekérdezés;
- ablakfüggvény: 7. lekérdezés;
- rekurzív CTE: 11. lekérdezés;
- CASE alapú minősítés: 17. lekérdezés;
- dátum szerinti csoportosítás: 19. lekérdezés.

Az ASP.NET felület a generált SQLite adatbázisból olvas. A kezdőoldal szerveroldali lapozással, kereséssel, rendezéssel és oszloponkénti szűréssel böngészi a projektadatbázis tábláit. A nagyméretű JSON mezők táblanézetben rövid előnézetként jelennek meg, a teljes érték pedig külön oldalon tölthető be.

## 7. hét - Tárolt eljárások és triggerek

Kiírás:

- minimum 5 tárolt eljárás;
- minimum 2 trigger;
- rekurzív, nested, output paraméteres és paraméterezett eljárás/logika;
- példák hozása.

Megvalósítás:

- `procedures_triggers.sql`: függvények, tárolt eljárások, triggerek és hívási példák.

Eljárások:

- `sp_get_player_summary`: output paramétereket használó, paraméterezett eljárás;
- `sp_refresh_player_scores`: paraméterezett pontszámfrissítés;
- `sp_refresh_player_and_snapshot`: egymásba ágyazott hívást használ, mert meghívja a pontszámfrissítő eljárást;
- `sp_create_path_query`: paraméterezett útkeresési rekord létrehozása JSON útvonallal;
- `sp_finish_analysis_run`: output JSON összegzést ad vissza.

Kapcsolódó függvények és triggerek:

- `fn_relationship_reach_count`: rekurzív gráfbejárás;
- `fn_touch_updated_at`: frissítési időbélyeg kezelése;
- `fn_sync_cluster_member_count`: klaszterméret szinkronizálása;
- `trg_players_touch_updated_at`: trigger játékosfrissítéshez;
- `trg_cluster_member_count_insert`: trigger klasztertagság után.

## 9. hét - Dokumentáció véglegesítése

Kiírás:

- minimum 6 oldal;
- Times New Roman 12;
- LaTeX pluszpont;
- bevezetés;
- szakirodalmi kutatás;
- funkcionális és nem funkcionális követelmények;
- rendszerarchitektúra és diagramok;
- eredmények;
- összegzés/következtetések;
- hivatkozások.

Megvalósítás:

- `documentation.tex`: teljes magyar nyelvű dokumentáció;
- `documentation.pdf`: Tectonic-kal generált PDF;
- `documentation.tex`: `\section{Bevezetés}`;
- `documentation.tex`: `\section{Szakirodalmi kutatás}`;
- `documentation.tex`: `\section{Rendszerkövetelmények}`;
- `documentation.tex`: `\subsection{Funkcionális követelmények}`;
- `documentation.tex`: `\subsection{Nem funkcionális követelmények}`;
- `documentation.tex`: `\section{Rendszerarchitektúra és részletes terv}`;
- `documentation.tex`: `\section{Egyszerű felhasználói felület}`;
- `documentation.tex`: `\section{Eredmények}`;
- `documentation.tex`: `\section{Összegzés}`;
- `documentation.tex`: `\section{Hivatkozások}`.

Fordítás:

```bash
cd docs/databaseproject
tectonic documentation.tex
```

## 10. hét - Prezentáció

Kiírás:

- javasolt 5-10 perces PowerPoint prezentáció;
- alternatívaként a dokumentáció is elfogadható.

Megvalósítás:

- `presentation_outline.md`: 10 diás, 5-10 perces prezentációs vázlat;
- a vázlat tartalmazza a témát, motivációt, szakirodalmi hátteret, adatbázismodellt, lekérdezéseket, tárolt eljárásokat, triggereket, egyszerű felületet és következtetéseket;
- `documentation.pdf`: végleges dokumentációként is leadható.
