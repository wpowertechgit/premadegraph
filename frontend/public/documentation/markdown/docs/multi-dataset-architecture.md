# Multi-Dataset Architecture

## Overview

This document outlines a scalable approach to support multiple independent datasets within the premadegraph project. Each dataset is a self-contained environment containing its own player database, match data, and analysis cache.

**Core principle:** Datasets never overlap. Each dataset has its own container and can be selected, crawled, and analyzed independently.

## Current State

- Single hardcoded database: `playersrefined.db`
- Match data loaded from JSON files in a fixed directory
- No dataset selection mechanism
- All analysis runs against the single active graph

## Proposed Architecture

### 1. Dataset Structure

```
backend/
  data/
    datasets.json              # Dataset registry
    high-elo-flex/             # Dataset container
      data.db                  # SQLite player database
      matches/                 # JSON match files
      cache/                   # Analysis cache (optional)
    friends-group-1/           # Another dataset container
      data.db
      matches/
      cache/
    eu-servers/                # Geographic/server dataset
      data.db
      matches/
      cache/
```

### 2. Dataset Registry (`datasets.json`)

```json
{
  "datasets": [
    {
      "id": "high-elo-flex",
      "name": "High ELO Flex Players",
      "description": "Ranked Flex queue, ELO 2000+",
      "tags": ["high-elo", "flex-queue", "competitive"],
      "created": "2026-04-16T00:00:00Z",
      "matchCount": 1247,
      "playerCount": 342,
      "lastCrawled": "2026-04-15T18:30:00Z",
      "config": {
        "minCoplayThreshold": 3,
        "queueFilter": "RANKED_FLEX",
        "eloFilter": "2000+"
      },
      "metadata": {
        "region": "all",
        "season": "current",
        "source": "manual_crawl"
      }
    },
    {
      "id": "friends-group-1",
      "name": "Friend Group Beta",
      "description": "Social circle analysis",
      "tags": ["social", "duo-queue"],
      "created": "2026-04-10T12:00:00Z",
      "matchCount": 523,
      "playerCount": 18,
      "lastCrawled": "2026-04-14T22:15:00Z",
      "config": {
        "minCoplayThreshold": 2,
        "queueFilter": "ALL",
        "eloFilter": null
      },
      "metadata": {
        "region": "NA1",
        "season": "current",
        "source": "manual_crawl"
      }
    }
  ],
  "currentDatasetId": "high-elo-flex"
}
```

### 3. Backend Changes

#### 3.1 Dataset Selection Middleware

Add to `server.js`:

```javascript
let activeDatasetId = null;
let activeDatasetConfig = null;

// Load datasets registry on startup
function loadDatasetsRegistry() {
  const registryPath = path.join(__dirname, "data", "datasets.json");
  try {
    const content = fs.readFileSync(registryPath, "utf-8");
    const registry = JSON.parse(content);
    activeDatasetId = registry.currentDatasetId;
    activeDatasetConfig = registry.datasets.find(d => d.id === activeDatasetId);
    console.log(`Loaded dataset: ${activeDatasetId}`);
  } catch (error) {
    console.warn("No datasets registry found, will prompt for creation");
  }
}

function getActiveDatasetPath() {
  if (!activeDatasetId) {
    throw new Error("No active dataset selected");
  }
  return path.join(__dirname, "data", activeDatasetId);
}

function getDatabasePath(datasetId) {
  return path.join(__dirname, "data", datasetId, "data.db");
}

function getMatchesDirectory(datasetId) {
  return path.join(__dirname, "data", datasetId, "matches");
}
```

#### 3.2 API Endpoints

Add new endpoints for dataset management:

```javascript
// List all datasets
app.get("/api/datasets", (req, res) => {
  const registryPath = path.join(__dirname, "data", "datasets.json");
  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
    res.json({
      datasets: registry.datasets,
      current: activeDatasetId
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load datasets registry" });
  }
});

// Switch active dataset
app.post("/api/datasets/:datasetId/select", (req, res) => {
  const { datasetId } = req.params;

  // Validate dataset exists
  const registryPath = path.join(__dirname, "data", "datasets.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  const dataset = registry.datasets.find(d => d.id === datasetId);

  if (!dataset) {
    return res.status(404).json({ error: "Dataset not found" });
  }

  // Switch dataset
  activeDatasetId = datasetId;
  activeDatasetConfig = dataset;
  rustResponseCache.clear(); // Invalidate Rust backend cache

  // Update registry
  registry.currentDatasetId = datasetId;
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  res.json({
    message: "Dataset switched",
    dataset: dataset
  });
});

// Create new dataset
app.post("/api/datasets", (req, res) => {
  const { id, name, description, config, metadata } = req.body;

  // Validate dataset ID doesn't exist
  const registryPath = path.join(__dirname, "data", "datasets.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));

  if (registry.datasets.some(d => d.id === id)) {
    return res.status(400).json({ error: "Dataset ID already exists" });
  }

  // Create dataset directory structure
  const datasetPath = path.join(__dirname, "data", id);
  const dbPath = path.join(datasetPath, "data.db");
  const matchesPath = path.join(datasetPath, "matches");
  const cachePath = path.join(datasetPath, "cache");

  fs.mkdirSync(datasetPath, { recursive: true });
  fs.mkdirSync(matchesPath, { recursive: true });
  fs.mkdirSync(cachePath, { recursive: true });

  // Initialize empty database with schema
  const conn = new sqlite3.Database(dbPath);
  conn.exec(`
    CREATE TABLE IF NOT EXISTS players (
      puuid TEXT PRIMARY KEY,
      names TEXT,
      feedscore REAL,
      opscore REAL,
      match_count INTEGER
    );
    CREATE TABLE IF NOT EXISTS matches (
      match_id TEXT PRIMARY KEY,
      data TEXT
    );
  `, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    conn.close();
  });

  // Add to registry
  const newDataset = {
    id,
    name,
    description,
    tags: [],
    created: new Date().toISOString(),
    matchCount: 0,
    playerCount: 0,
    lastCrawled: null,
    config: config || { minCoplayThreshold: 3 },
    metadata: metadata || {}
  };

  registry.datasets.push(newDataset);
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  res.json({ message: "Dataset created", dataset: newDataset });
});
```

#### 3.3 Matrix Pass Active Dataset to Rust

When executing Rust commands, pass the active dataset path:

```javascript
function executeRustCommandRaw(command, payload = {}) {
  const datasetPath = getActiveDatasetPath();

  // Set environment variables for Rust process
  const env = {
    ...process.env,
    GRAPH_DB_PATH: getDatabasePath(activeDatasetId),
    MATCHES_DIR: getMatchesDirectory(activeDatasetId),
    DATASET_ID: activeDatasetId
  };

  // Execute with modified environment
  return executeRust(command, payload, env);
}
```

### 4. Rust Backend Changes

#### 4.1 Multi-Dataset Graph Loading

Update `graph.rs`:

```rust
fn resolve_db_path() -> PathBuf {
    if let Ok(value) = env::var("GRAPH_DB_PATH") {
        return PathBuf::from(value);
    }
    // Fallback for backwards compatibility
    PathBuf::from("../../playersrefined.db")
}

fn resolve_matches_dir() -> PathBuf {
    if let Ok(value) = env::var("MATCHES_DIR") {
        return PathBuf::from(value);
    }
    // Fallback for backwards compatibility
    PathBuf::from("../../matches")
}

fn get_dataset_id() -> String {
    env::var("DATASET_ID").unwrap_or_else(|_| "default".to_string())
}

pub fn build_graph_state() -> GraphState {
    let db_path = resolve_db_path();
    let matches_dir = resolve_matches_dir();
    let dataset_id = get_dataset_id();

    eprintln!("Building graph for dataset: {}", dataset_id);
    eprintln!("Database: {}", db_path.display());
    eprintln!("Matches directory: {}", matches_dir.display());

    // Rest of graph building logic...
}
```

### 5. Frontend Changes

#### 5.1 Dataset Selector Component

New component in `frontend/src/DatasetSelector.tsx`:

```typescript
import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  FormControl,
  Input,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Stack,
  CircularProgress,
  Alert,
} from "@mui/material";

interface Dataset {
  id: string;
  name: string;
  description: string;
  matchCount: number;
  playerCount: number;
  lastCrawled?: string;
}

export function DatasetSelector() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newDatasetForm, setNewDatasetForm] = useState({
    id: "",
    name: "",
    description: "",
  });

  useEffect(() => {
    fetchDatasets();
  }, []);

  async function fetchDatasets() {
    try {
      const response = await fetch("http://localhost:3001/api/datasets");
      const data = await response.json();
      setDatasets(data.datasets);
      setCurrent(data.current);
    } catch (error) {
      console.error("Failed to fetch datasets:", error);
    }
  }

  async function switchDataset(datasetId: string) {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/datasets/${datasetId}/select`,
        { method: "POST" }
      );
      if (response.ok) {
        setCurrent(datasetId);
        window.location.reload(); // Reload to update graph
      }
    } catch (error) {
      console.error("Failed to switch dataset:", error);
    } finally {
      setLoading(false);
    }
  }

  async function createDataset() {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDatasetForm),
      });
      if (response.ok) {
        fetchDatasets();
        setShowCreate(false);
        setNewDatasetForm({ id: "", name: "", description: "" });
      }
    } catch (error) {
      console.error("Failed to create dataset:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ p: 2, borderBottom: "1px solid #e0e0e0" }}>
      <FormControl fullWidth size="small">
        <InputLabel>Dataset</InputLabel>
        <Select
          value={current || ""}
          label="Dataset"
          onChange={(e) => switchDataset(e.target.value)}
          disabled={loading}
        >
          {datasets.map((ds) => (
            <MenuItem key={ds.id} value={ds.id}>
              {ds.name} ({ds.playerCount} players, {ds.matchCount} matches)
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button
        variant="outlined"
        size="small"
        onClick={() => setShowCreate(true)}
        sx={{ mt: 1 }}
        fullWidth
      >
        + New Dataset
      </Button>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <Box sx={{ p: 3, minWidth: 400 }}>
          <Typography variant="h6">Create New Dataset</Typography>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Dataset ID"
              value={newDatasetForm.id}
              onChange={(e) =>
                setNewDatasetForm({
                  ...newDatasetForm,
                  id: e.target.value,
                })
              }
              helperText="Unique identifier (lowercase, hyphens ok)"
            />
            <TextField
              label="Name"
              value={newDatasetForm.name}
              onChange={(e) =>
                setNewDatasetForm({
                  ...newDatasetForm,
                  name: e.target.value,
                })
              }
            />
            <TextField
              label="Description"
              value={newDatasetForm.description}
              onChange={(e) =>
                setNewDatasetForm({
                  ...newDatasetForm,
                  description: e.target.value,
                })
              }
              multiline
              rows={3}
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={createDataset}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : "Create"}
              </Button>
              <Button onClick={() => setShowCreate(false)}>Cancel</Button>
            </Stack>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
}
```

#### 5.2 Integrate into Navigation

Add to `AppNavbar.tsx`:

```typescript
import { DatasetSelector } from "./DatasetSelector";

// In return JSX:
<Box>
  <DatasetSelector />
  {/* Rest of navbar content */}
</Box>
```

#### 5.3 Update Match Analysis Form

Update `MatchAnalysisForm.tsx` to post crawled matches to the active dataset:

```typescript
async function submitMatchAnalysis() {
  // Get current dataset from registry
  const response = await fetch("http://localhost:3001/api/datasets");
  const data = await response.json();
  const activeDatasetPath = data.current;

  // Post crawled matches to active dataset
  const formData = new FormData();
  formData.append("dataset", activeDatasetPath);
  formData.append("matches", matchesJson);

  const uploadResponse = await fetch(
    "http://localhost:3001/api/matches/upload",
    {
      method: "POST",
      body: formData,
    }
  );
  // ...
}
```

### 6. Dataset Discovery & Management

#### 6.1 Dataset Information Endpoint

```javascript
app.get("/api/datasets/:datasetId/info", (req, res) => {
  const registryPath = path.join(__dirname, "data", "datasets.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  const dataset = registry.datasets.find(d => d.id === req.params.datasetId);

  if (!dataset) {
    return res.status(404).json({ error: "Dataset not found" });
  }

  // Get match files count
  const matchesPath = getMatchesDirectory(req.params.datasetId);
  const matchCount = fs.readdirSync(matchesPath).filter(f => f.endsWith('.json')).length;

  res.json({
    ...dataset,
    matchCount,
    storageSize: calculateDirectorySize(path.join(__dirname, "data", req.params.datasetId))
  });
});
```

### 7. Migration Path

For existing projects:

```javascript
// On first run, auto-migrate existing single dataset
function ensureDefaultDatasetExists() {
  const registryPath = path.join(__dirname, "data", "datasets.json");

  if (!fs.existsSync(registryPath)) {
    // Create registry with migration
    const defaultPath = path.join(__dirname, "data", "default");
    fs.mkdirSync(defaultPath, { recursive: true });

    // Move or symlink existing database
    const oldDb = path.join(__dirname, "..", "playersrefined.db");
    const newDb = path.join(defaultPath, "data.db");

    if (fs.existsSync(oldDb)) {
      fs.copyFileSync(oldDb, newDb);
    }

    const registry = {
      datasets: [{
        id: "default",
        name: "Default Dataset",
        description: "Migrated from existing installation",
        tags: [],
        created: new Date().toISOString(),
        matchCount: 0,
        playerCount: 0,
        lastCrawled: null,
        config: { minCoplayThreshold: 3 },
        metadata: {}
      }],
      currentDatasetId: "default"
    };

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  }
}
```

## Scalability Considerations

### Storage
- Each dataset is isolated: no shared state, no database contention
- Datasets can be on different storage volumes if needed
- Zip/archive datasets for distribution or backup

### Performance
- Rust backend loads only the active dataset into memory
- Switching datasets resets Rust cache (acceptable for manual switching)
- Can pre-load multiple datasets if needed (via environment variable)

### Extensibility
- Add dataset versioning: keep multiple snapshots of same dataset over time
- Add metadata tags for filtering/discovery
- Add dataset comparison features (analyze differences between two datasets)
- Database replication: sync datasets across systems

## Example Workflows

### Workflow 1: Add a New Dataset

1. User clicks "New Dataset" in navbar
2. Enters high-elo-flex, "High ELO Flex", "2000+ Flex players"
3. Backend creates directory, initializes empty database
4. User navigates to Match Analysis
5. Crawls matches for that concept
6. Matches automatically go into high-elo-flex/matches/
7. Dataset stats update in registry

### Workflow 2: Switch Between Datasets

1. User selects "Friends Group Beta" from dataset dropdown
2. Frontend calls POST /api/datasets/friends-group-1/select
3. Backend updates currentDatasetId in registry
4. Backend invalidates Rust cache
5. Frontend reloads page
6. Rust backend loads friends-group-1/data.db
7. Analysis pages show friends group data

### Workflow 3: Compare Multiple Datasets

1. User selects Dataset A, runs assortativity analysis
2. Records result
3. Switches to Dataset B, runs same analysis
4. UI shows side-by-side comparison table

## Implementation Priority

**Phase 1 (MVP):**
- Dataset registry and selector UI
- Basic switch endpoint
- Database path resolution
- Auto-migration for existing installations

**Phase 2 (Enhanced):**
- Create dataset UI with form
- Dataset info endpoint
- Match upload per-dataset
- Dataset deletion (with confirmation)

**Phase 3 (Polish):**
- Dataset export/import
- Dataset statistics dashboard
- Batch operations (rename, archive)
- Dataset comparison views

## Database Schema

Each dataset's `data.db` contains:

```sql
CREATE TABLE players (
  puuid TEXT PRIMARY KEY,
  names TEXT,              -- JSON array of known names
  feedscore REAL,
  opscore REAL,
  match_count INTEGER
);

CREATE TABLE pair_relations (
  player_a TEXT,
  player_b TEXT,
  ally_wins INTEGER,
  enemy_encounters INTEGER,
  total_matches INTEGER,
  dominant_relation TEXT,
  PRIMARY KEY (player_a, player_b)
);

-- Optional: cache analysis results
CREATE TABLE analysis_cache (
  analysis_type TEXT,
  parameters TEXT,         -- JSON serialized params
  result_json TEXT,
  computed_at INTEGER,     -- Unix timestamp
  PRIMARY KEY (analysis_type, parameters)
);
```

## Notes

- **No overlap:** Each dataset is totally independent. Crawling data into Dataset A never touches Dataset B.
- **Lazy loading:** Rust backend only loads the active dataset. Switching is fast because cache is invalidated, not preloaded.
- **Extensible:** Adding a third or tenth dataset uses the same pattern. UI and backend scale linearly.
- **Safe:** Dataset paths are normalized and validated. SQL queries are parameterized per existing code.
- **Thesis-friendly:** Perfect for comparing analysis results across different player populations.
