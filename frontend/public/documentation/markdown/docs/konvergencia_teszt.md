  Futtatunk 20 különböző seedet flexset adatkészlettel, 5 run mindegyikből.
  Cél: statisztikailag alátámasztani hogy a flexset konvergens Warband/Combat
  győztest produkál, nem csak seed=42 és seed=7777-nél.

  SETUP (backend kell futnia localhost:3001-en):
    npm run dev

  BUILD (ha még nem release):
    cd backend\genetic-neurosim\backend
    cargo build --release

  FUTTATÁSOK — 20 seed × 5 run, egyenként:
    $seeds = @(1, 13, 99, 256, 1000, 3141, 5678, 9999, 31337, 77777, 67, 8876, 5982, 14, 1589, 6767, 10000, 83, 156894, 42)
    foreach ($seed in $seeds) {
        .\run-batch.ps1 -Runs 5 -Seed $seed -DatasetId flexset
    }

  AMIT FIGYELSZ:
  - Minden futtatásnál: TribeId, PolityBehavior, A_combat, aggression, migration
  - Ha 8-10/10 seednél Warband/Combat → statisztikailag erős claim
  - Ha mix → az is érdekes adat, megmagyarázható

  UTÁN: az eredménytáblát rakd be egy markdownba a neurosim dokumentacio közé C:\Users\karol\OneDrive\Dokumentumok\Dolgozat\premadegraph\docs\neurosim
  egy chi-square megjegyzéssel vagy csak a raw eloszlással. 