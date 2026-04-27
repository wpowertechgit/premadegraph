# Collector Configs

These JSON files are ready-to-run strategy configs for `backend/match_collector.py`.

Run from `backend/` so `.env` is discovered:

```powershell
python match_collector.py --config-file collector_configs/apex-flex-collector.json
python match_collector.py --config-file collector_configs/master-soloq-eune-collector.json
```

Both configs use `RIOT_API_KEY` from `backend/.env`. If `seedPlayers` is empty, the collector bootstraps seeds from Riot's league endpoints using the configured queue, tier, LP, and region constraints. Add explicit PUUIDs to `seedPlayers` when you want to lock the run to manually verified seeds.

