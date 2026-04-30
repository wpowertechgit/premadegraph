# 10. heti prezentációs vázlat

Célidő: 5-10 perc

## 1. dia - Téma

Premade Graph: League of Legends játékos-hálózati elemző adatbázis.

## 2. dia - Motiváció

Az esport meccselőzmények strukturált játékos-, csapat-, szerep-, teljesítmény- és kapcsolatadatokat tartalmaznak. Az adatbázis egyszerre támogat alkalmazásfunkciókat és kutatásorientált gráfelemzést.

## 3. dia - Szakirodalmi háttér

Röviden említhető a MOBA szakirodalom, a League of Legends teljesítménymetrikák, a játékosközpontú hálózatok, a strukturális egyensúly, az assortativitás és a Brandes-féle betweenness centrality.

## 4. dia - Adatbázismodell

Mutasd be az ER diagramot. Magyarázd el a játékosok, meccsek, csapatok, résztvevők, kapcsolatok, klaszterek, elemzési futások, pillanatképek és útkeresések szétválasztását.

## 5. dia - Relációs megvalósítás

Mutasd be a 10 táblás PostgreSQL sémát és a fő idegen kulcsokat. Emeld ki, hogy minden táblának legalább 5 attribútuma és legalább 10 mintaadata van.

## 6. dia - Lekérdezések és nézetek

Mutasd be a két nézetet és néhány reprezentatív lekérdezést:

- játékos teljesítmény összegzés;
- klaszterállapot;
- strukturális egyensúly és assortativitás eredménymezők;
- JSON elemzési paraméterek;
- rekurzív kapcsolatbejárás;
- útkeresési előzmények.

## 7. dia - Tárolt eljárások és triggerek

Példák:

- játékospontszám frissítése;
- útkeresési lekérdezés létrehozása;
- elemzési futás lezárása;
- játékos frissítési időbélyeg trigger;
- klasztertagsági darabszám trigger.

## 8. dia - Egyszerű felület

Mutasd be az ASP.NET Core felületet:

- adatbázis-böngésző kezdőoldal;
- datasetválasztó, például `default`, `flexset` vagy `soloq`;
- táblaváltás a generált projektadatbázis öt táblája között;
- keresés, oszloponkénti szűrés, rendezés és lapozott betöltés;
- oszlopmagyarázó információs jelvények;
- nagyméretű JSON mezők előnézete és külön megnyitható teljes nézete.

Emeld ki, hogy a felület a backend meglévő SQLite adatbázisaiból generált projektadatbázist használ.

## 9. dia - Eredmények

Összefoglalható, hogy az adatbázis játékosrangsorolást, klaszterprofilokat, aláírt kapcsolati bizonyítékokat, útkeresési előzményeket és reprodukálható elemzési futásokat támogat.

## 10. dia - Következtetés

Az adatbázis a Premade Graph projektet dokumentált elemző rendszerré alakítja. A beadandó teljes SQL csomagot, magyar LaTeX dokumentációt, diagramokat és valós backend-adatokra kötött ASP.NET Core adatbázis-böngészőt tartalmaz.
