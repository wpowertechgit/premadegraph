# ⚠️ IMPORTANT ⚠️  
## Steps for Matchdata Crawling

## Architecture Docs
- [Unified Cluster Persistence And Exact A*](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/docs/unified-cluster-persistence-and-astar.md)

## License
This repository is licensed under the MIT License. See [LICENSE](c:/Users/karol/OneDrive/Dokumentumok/Dolgozat/premadegraph/LICENSE).

---

### ✅ Step 0 — Start the Dev Server

```bash
npm run dev
```
### 🔍 Step 1 — Match Collecting
python match_collector.py

## 🔧 Arguments:
API_KEY=<YOUR API KEY> — Note: This changes every 24 hours.

REQUESTS_PER_SECOND = 15 — Use 15 out of the 20 allowed per second to stay safe.

REQUESTS_PER_2MIN = 90 — Use 90 out of 100 per 2 minutes for safety.

DELAY_BETWEEN_REQUESTS = 1.0 / REQUESTS_PER_SECOND
## 🎯 Fetch Settings:
Deep exploration: Increase MATCHES_PER_PLAYER

Wide area exploration: Increase MAX_ITERATIONS
```bash
python match_collector.py
```

MATCHES_PER_PLAYER = 25     # Number of matches to fetch per player
MAX_ITERATIONS = 6          # Number of players to process
QUEUE_TYPE = ""             # 400 (ARAM), 440 (SoloQ), 420 (Flex), 430 (Normal Draft), "" for all
## ⚙️ Riot API Rate Limits:
20 requests every 1 second

100 requests every 2 minutes

### 👥 Step 2 — Add and Normalize Players

Process crawled data and normalize players using:

```bash
node add_new_players.js
node normalize_players_by_puuid.js
```
These scripts run through all JSON files in the matchdata folder.

### 📈 Step 3 — Generate the Graph
```bash
python fast_graph_test.py --connected-only --min-weight 2
```
## Arguments:
--connected-only — Only show connected nodes (exclude standalone players).

--min-weight <number> — Minimum number of times two players must have played together to appear as a connection.
Example:
```bash
python fast_graph_test.py --connected-only --min-weight 2
```
### 🌎 Step 5(optional) - Predict the countries

In this step we can predict where each cluster originates from by sending the clustered data , that we received when we generated the graph

The fetch_clusters parses the puuid and last name data in a new JSON
The assign_country program uses an OpenRouter API endpoint that tries to predict the region of the members, by their username.
🔧 Batching
Clusters are processed in batches (e.g. 3 at a time) to reduce API load.

🧶 Prompt Construction
A natural-language prompt is constructed for the LLM:

It includes example output format
Lists cluster names in the batch

🤖 Response Handling
The AI may return unwanted verbose explanations.

To ensure clean data, we implemented a robust JSON extractor
⚙ Database Update
For each identified country, the program updates player records in the local SQLite DB


### 🔐 .env Configuration
```
RIOT_API_KEY=riot-developer-api-key-here
DB_PATH=path/to/your/database.db
OPENROUTER_API_KEY=your-api-key-here
```
### 📝 NOTE: YOU CAN GET A TEMPORAL 24 HOUR API-KEY ON RIOT'S OFFICIAL DEVELOPER PORTAL
https://developer.riotgames.com

```bash
python fetch_clusters.py
python assign_countries.py
```
# Happy Crawling!
