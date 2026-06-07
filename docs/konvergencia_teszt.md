  Futtatunk 10 különböző seedet flexset adatkészlettel, 3 run mindegyikből.
  Cél: statisztikailag alátámasztani hogy a flexset konvergens Warband/Combat
  győztest produkál, nem csak seed=42 és seed=7777-nél.

  SETUP (backend kell futnia localhost:3001-en):
    npm run dev

  BUILD (ha még nem release):
    cd backend\genetic-neurosim\backend
    cargo build --release

  FUTTATÁSOK — 10 seed × 3 run, egyenként:
    $seeds = @(1, 13, 99, 256, 1000, 3141, 5678, 9999, 31337, 77777)
    foreach ($seed in $seeds) {
        .\run-batch.ps1 -Runs 3 -Seed $seed -DatasetId flexset
    }

  AMIT FIGYELSZ:
  - Minden futtatásnál: TribeId, PolityBehavior, A_combat, aggression, migration
  - Ha 8-10/10 seednél Warband/Combat → statisztikailag erős claim
  - Ha mix → az is érdekes adat, megmagyarázható

  UTÁN: az eredménytáblát rakd be a thesis validáció fejezetébe
  egy chi-square megjegyzéssel vagy csak a raw eloszlással.
  Ez a 1.5 pont visszaszerzésének az útja.