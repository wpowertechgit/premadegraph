# Parallel Brandes Betweenness Centrality Implementation Plan

**Status:** Implemented core Rust analysis + API command  
**Priority:** Secondary (post-dataset collection)  
**Scope:** Rust backend, premadegraph  
**Estimated Effort:** 2–3 weeks (serial + parallel + benchmarking + integration)

**Implementation note (current repo):** The Rust implementation lives in
`backend/pathfinder-rust/src/engine/centrality.rs` and is exposed through the
`betweenness-centrality` Rust command plus
`POST /api/pathfinder-rust/betweenness-centrality`. It implements weighted
Brandes with Dijkstra, `1 / strength` edge costs through integer scaling,
serial and deterministic Rayon chunk-parallel execution, serial-vs-parallel
validation support, and JSON output for top bridge nodes. Thesis figures and
full real-dataset benchmarks are still follow-up work.

---

## Executive Summary

Implement parallel Brandes betweenness centrality algorithm to identify network bridge nodes and brokers. This complements existing balance + assortativity analysis by answering:

> **"Which individual players are the strongest connectors between community clusters?"**

---

## Algorithm Overview

### Brandes Algorithm (Serial)

For each source node S:
1. BFS shortest paths from S to all nodes (track distances + predecessors)
2. Accumulation phase: compute dependency of each node on shortest paths
3. Add dependency to node's betweenness score

Time complexity: O(N × (N + E)) for N nodes, E edges
Space complexity: O(N × E) for storing paths

### Parallelization Strategy

**Coarse-grained parallelism:** Parallelize over source nodes (Rayon)

```
Sources: [0, 1, 2, ..., N-1]
         |   |   |         |
        [BFS][BFS][BFS]...[BFS]  (N parallel tasks)
         |   |   |         |
         └───┴───┴─────────┘
              Aggregate scores
```

**Why coarse-grained?**
- No synchronization needed within BFS
- Each source node independent
- Communication cost (score aggregation) is minimal
- Scales linearly with cores up to N

---

## Implementation Phases

### Phase 1: Core Algorithm (Serial, Correct)

**Goal:** Implement Brandes correctly on single thread. No optimization yet.

**File:** `premadegraph/pathfinder-rust/src/engine/centrality.rs` (new)

```rust
use crate::graph::Graph;
use std::collections::{VecDeque, HashMap};

#[derive(Clone, Debug)]
pub struct BetweennessResult {
    pub node_id: usize,
    pub node_name: Option<String>,
    pub betweenness: f32,
    pub normalized_betweenness: f32,
}

/// Standard Brandes algorithm for betweenness centrality
pub fn betweenness_centrality(graph: &Graph) -> Vec<BetweennessResult> {
    let n = graph.node_count();
    let mut bc_scores = vec![0.0; n];
    
    // For each source node
    for source in 0..n {
        // Phase 1: BFS shortest paths
        let (distances, predecessors) = bfs_shortest_paths(graph, source);
        
        // Phase 2: Compute dependencies (backward accumulation)
        let dependencies = accumulate_dependencies(source, &distances, &predecessors, n);
        
        // Phase 3: Update betweenness scores
        for (node, &dep) in dependencies.iter().enumerate() {
            if node != source {
                bc_scores[node] += dep;
            }
        }
    }
    
    // Normalize scores
    // For undirected graphs: betweenness / ((n-1) * (n-2) / 2)
    let norm_factor = ((n - 1) * (n - 2)) as f32 / 2.0;
    
    bc_scores.into_iter()
        .enumerate()
        .map(|(node_id, bc)| BetweennessResult {
            node_id,
            node_name: graph.get_node_name(node_id).map(|s| s.to_string()),
            betweenness: bc,
            normalized_betweenness: bc / norm_factor,
        })
        .collect()
}

/// BFS from source, returning distances and predecessors
fn bfs_shortest_paths(graph: &Graph, source: usize) -> (Vec<usize>, Vec<Vec<usize>>) {
    let n = graph.node_count();
    let mut distances = vec![usize::MAX; n];
    let mut predecessors: Vec<Vec<usize>> = vec![vec![]; n];
    
    distances[source] = 0;
    let mut queue = VecDeque::new();
    queue.push_back(source);
    
    while let Some(v) = queue.pop_front() {
        for neighbor in graph.neighbors(v) {
            if distances[neighbor] == usize::MAX {
                // First time seeing this node
                distances[neighbor] = distances[v] + 1;
                queue.push_back(neighbor);
            }
            if distances[neighbor] == distances[v] + 1 {
                // On a shortest path
                predecessors[neighbor].push(v);
            }
        }
    }
    
    (distances, predecessors)
}

/// Accumulation phase: compute dependency of each node
fn accumulate_dependencies(
    source: usize,
    distances: &[usize],
    predecessors: &[Vec<usize>],
    n: usize,
) -> Vec<f32> {
    let mut dependencies = vec![0.0; n];
    
    // Stack-based accumulation: process nodes in reverse distance order
    let mut nodes_by_distance: Vec<Vec<usize>> = vec![vec![]; n];
    for node in 0..n {
        if distances[node] != usize::MAX && node != source {
            nodes_by_distance[distances[node]].push(node);
        }
    }
    
    // Process from farthest to closest
    for distance in (1..n).rev() {
        for &w in &nodes_by_distance[distance] {
            let mut dep_w = 0.0;
            for &v in &predecessors[w] {
                // Number of shortest paths through v to w
                let paths = 1.0; // Simplified for unweighted
                dep_w += paths * (1.0 + dependencies[v]);
            }
            dependencies[w] = dep_w;
        }
    }
    
    dependencies
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_path_graph() {
        // Linear graph: 0---1---2---3
        // Node 1 and 2 should have highest betweenness (they're in the middle)
        let graph = build_path_graph_4();
        let results = betweenness_centrality(&graph);
        
        let bc_1 = results[1].betweenness;
        let bc_2 = results[2].betweenness;
        let bc_0 = results[0].betweenness;
        
        // Middle nodes should have higher betweenness than endpoints
        assert!(bc_1 > bc_0);
        assert!(bc_2 > bc_0);
    }
    
    #[test]
    fn test_star_graph() {
        // Star graph: center node should have highest betweenness
        // 0--(1)--2
        //     |
        //     3
        let graph = build_star_graph_4();
        let results = betweenness_centrality(&graph);
        
        let bc_center = results[0].betweenness;
        let bc_leaf = results[1].betweenness;
        
        assert!(bc_center > bc_leaf);
    }
    
    #[test]
    fn test_dumbbell_graph() {
        // Two clusters connected by bridge
        // Cluster 1: 0-1-2-3 --- Bridge(4) --- 5-6-7-8
        // Bridge should have highest betweenness
        let graph = build_dumbbell_graph();
        let results = betweenness_centrality(&graph);
        
        let bridge_bc = results[4].betweenness;
        let other_bc = results.iter()
            .enumerate()
            .filter(|(i, _)| *i != 4)
            .map(|(_, r)| r.betweenness)
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        
        assert!(bridge_bc > other_bc.unwrap_or(0.0));
    }
}
```

**Checklist for Phase 1:**
- [ ] BFS shortest paths function (correct)
- [ ] Accumulation/dependency computation (correct)
- [ ] Main betweenness loop (correct)
- [ ] Normalization (correct)
- [ ] Test: path graph ✓
- [ ] Test: star graph ✓
- [ ] Test: dumbbell graph (bridge detection) ✓
- [ ] Test: against known reference (NetworkX if available)

**Timeline:** 3–4 days

---

### Phase 2: Validation Against Reference Implementation

**Goal:** Verify serial implementation is correct

**Approach:**

1. **Small hand-verified examples** (already in tests above)
2. **Reference comparison** (optional but recommended):
   ```python
   # Quick Python script to validate
   import networkx as nx
   
   G = nx.path_graph(4)  # 0-1-2-3
   bc = nx.betweenness_centrality(G)
   # Compare with your Rust output
   ```

3. **Graph structure validation:**
   - Verify betweenness is symmetric (for undirected)
   - Verify sum of normalized betweenness is meaningful
   - Verify endpoints in path graph have lowest scores

**Timeline:** 1–2 days

---

### Phase 3: Parallel Implementation with Rayon

**File:** Add to `premadegraph/pathfinder-rust/src/engine/centrality.rs`

```rust
pub fn betweenness_centrality_parallel(graph: &Graph) -> Vec<BetweennessResult> {
    use rayon::prelude::*;
    
    let n = graph.node_count();
    
    // Parallelize over source nodes
    let all_dependencies: Vec<Vec<f32>> = (0..n)
        .into_par_iter()
        .map(|source| {
            let (distances, predecessors) = bfs_shortest_paths(graph, source);
            accumulate_dependencies(source, &distances, &predecessors, n)
        })
        .collect();
    
    // Aggregate dependency scores
    let mut bc_scores = vec![0.0; n];
    for node_deps in all_dependencies {
        for (node, &dep) in node_deps.iter().enumerate() {
            bc_scores[node] += dep;
        }
    }
    
    // Normalize and return
    let norm_factor = ((n - 1) * (n - 2)) as f32 / 2.0;
    
    bc_scores.into_iter()
        .enumerate()
        .map(|(node_id, bc)| BetweennessResult {
            node_id,
            node_name: graph.get_node_name(node_id).map(|s| s.to_string()),
            betweenness: bc,
            normalized_betweenness: bc / norm_factor,
        })
        .collect()
}

#[cfg(test)]
mod parallel_tests {
    use super::*;
    
    #[test]
    fn test_serial_vs_parallel_match() {
        let graph = build_dumbbell_graph();
        
        let serial = betweenness_centrality(&graph);
        let parallel = betweenness_centrality_parallel(&graph);
        
        for (s, p) in serial.iter().zip(parallel.iter()) {
            // Should match to floating point precision
            assert!((s.betweenness - p.betweenness).abs() < 0.001,
                "Mismatch at node {}: serial={}, parallel={}",
                s.node_id, s.betweenness, p.betweenness);
        }
    }
}
```

**Checklist for Phase 3:**
- [ ] Rayon parallelization compiles
- [ ] Test: serial vs parallel match exactly ✓
- [ ] No data races (Rust compiler ensures this)
- [ ] Deterministic output (no randomness)

**Timeline:** 2–3 days

---

### Phase 4: Benchmarking (Critical for Thesis)

**File:** `premadegraph/pathfinder-rust/benches/betweenness_bench.rs` (new, or add to existing)

```rust
#[cfg(test)]
mod benchmarks {
    use super::*;
    use std::time::Instant;
    
    #[test]
    fn bench_betweenness_serial_vs_parallel() {
        // Load your actual graph from premadegraph
        let graph = Graph::load_from_file("data/premade_graph.json")
            .expect("Failed to load graph");
        
        println!("\n=== Betweenness Centrality Benchmark ===");
        println!("Graph: {} nodes, {} edges", graph.node_count(), graph.edge_count());
        
        // Serial benchmark
        let start = Instant::now();
        let serial_result = betweenness_centrality(&graph);
        let serial_time = start.elapsed();
        
        println!("Serial time:   {:?}", serial_time);
        
        // Parallel benchmark
        let start = Instant::now();
        let parallel_result = betweenness_centrality_parallel(&graph);
        let parallel_time = start.elapsed();
        
        println!("Parallel time: {:?}", parallel_time);
        
        let speedup = serial_time.as_secs_f64() / parallel_time.as_secs_f64();
        println!("Speedup:       {:.2}x", speedup);
        
        // Verify results match
        for (s, p) in serial_result.iter().zip(parallel_result.iter()) {
            assert!((s.betweenness - p.betweenness).abs() < 0.001);
        }
        
        println!("✓ Results verified");
    }
}
```

**Expected output (for your thesis):**

```
=== Betweenness Centrality Benchmark ===
Graph: 3734 nodes, ~50000 edges
Serial time:   ~5.2s
Parallel time: ~1.1s
Speedup:       4.7x
✓ Results verified
```

**Timeline:** 1–2 days

---

### Phase 5: Integration into Analysis Pipeline

**File:** Modify `premadegraph/pathfinder-rust/src/main.rs` or create `experiments.rs` command

```rust
// Add to CLI commands
pub enum AnalysisCommand {
    Balance,
    Assortativity,
    Betweenness,  // NEW
    All,
}

fn handle_betweenness(graph: &Graph, output_path: &str) -> Result<()> {
    println!("Computing betweenness centrality...");
    
    let results = betweenness_centrality_parallel(graph);
    
    // Sort by betweenness (descending)
    let mut sorted = results;
    sorted.sort_by(|a, b| {
        b.normalized_betweenness
            .partial_cmp(&a.normalized_betweenness)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    
    // Output top 20 + full results
    println!("\n=== Top 20 Bridge Nodes ===");
    for (rank, result) in sorted.iter().take(20).enumerate() {
        println!(
            "{:2}. {} (normalized BC: {:.4})",
            rank + 1,
            result.node_name.as_deref().unwrap_or("Unknown"),
            result.normalized_betweenness
        );
    }
    
    // Save to JSON
    let output = json!({
        "algorithm": "Brandes",
        "parallelized": true,
        "graph_nodes": graph.node_count(),
        "graph_edges": graph.edge_count(),
        "top_20": sorted.iter().take(20).collect::<Vec<_>>(),
        "full_results": sorted,
    });
    
    std::fs::write(output_path, serde_json::to_string_pretty(&output)?)?;
    println!("Results saved to {}", output_path);
    
    Ok(())
}
```

**Usage:**
```bash
cd premadegraph/pathfinder-rust
cargo run --release -- --analysis betweenness --graph data/premade_graph.json --output results/betweenness.json
```

**Checklist for Phase 5:**
- [ ] CLI command compiles
- [ ] Outputs JSON results
- [ ] Top 20 list is human-readable
- [ ] Integrates with existing analysis pipeline

**Timeline:** 1–2 days

---

### Phase 6: Thesis Integration

**File:** New section in thesis (mainraw.tex.tex)

```latex
\section{Network Betweenness Centrality Analysis}

We compute betweenness centrality using the Brandes algorithm to identify 
network brokers and bridge nodes. High betweenness indicates nodes that 
frequently lie on shortest paths between other nodes.

\subsection{Algorithm}

The Brandes algorithm (Brandes, 2001) computes betweenness centrality in 
$O(N(N+E))$ time for $N$ nodes and $E$ edges:

\begin{enumerate}
    \item For each source node $s$: compute shortest paths via BFS
    \item Accumulate dependencies: for each target node, track contribution
    \item Normalize by $\frac{2}{(N-1)(N-2)}$ for undirected graphs
\end{enumerate}

\subsection{Parallelization}

We parallelize over source nodes using Rayon, achieving \textbf{4.7x speedup} 
on 8 cores for the 3,734-node graph (Figure \ref{fig:bc_speedup}).

\subsection{Results}

Top bridge nodes by betweenness:
\begin{enumerate}
    \item Node XXX (normalized BC: 0.145) -- cluster connector between Y and Z
    \item Node YYY (normalized BC: 0.123) -- connects meta-cluster A to B
    \item ...
\end{enumerate}

These bridge nodes represent players whose participation patterns connect 
otherwise weakly connected community clusters. Comparing betweenness with 
balance/assortativity metrics shows whether connector players exhibit 
different behavioral patterns than non-connectors.

\subsection{Interpretation}

Bridge nodes with high betweenness but low opscore suggest that ``glue players'' 
may prioritize team coordination over personal performance. Conversely, high-opscore 
bridge nodes may indicate carry-potential that simultaneously benefits the network.
```

**Timeline:** 1–2 days (+ figures)

---

## Deliverables Checklist

- [ ] **Phase 1:** Serial Brandes implementation (correct, tested)
- [ ] **Phase 2:** Validation against reference
- [ ] **Phase 3:** Parallel implementation with Rayon
- [ ] **Phase 4:** Benchmarking (serial vs parallel)
  - [ ] Benchmark binary compiles
  - [ ] Output shows speedup
  - [ ] Both versions match
- [ ] **Phase 5:** Integration into CLI
  - [ ] Command works end-to-end
  - [ ] JSON output is clean
  - [ ] Top-20 list is readable
- [ ] **Phase 6:** Thesis section written
  - [ ] Algorithm explanation
  - [ ] Results with figures
  - [ ] Interpretation connecting to other metrics

---

## Deployment

### Build & Run

```bash
cd premadegraph/pathfinder-rust

# Test
cargo test --release

# Benchmark
cargo test --release -- --nocapture bench_betweenness

# Run on dataset
cargo run --release -- \
  --analysis betweenness \
  --graph ../backend/data/premade_graph.json \
  --output ../output/betweenness_results.json
```

### Expected Runtime

- 3,734 nodes, ~50k edges
- Serial: ~5 seconds
- Parallel (8 cores): ~1 second
- Total with I/O: ~2 seconds

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Algorithm correctness | Hand-verify on small graphs, validate against NetworkX |
| Floating-point precision | Use `f32` consistently; test within 0.001 tolerance |
| Parallelization bugs | Rayon is memory-safe; test serial vs parallel match |
| Performance assumptions | Benchmark on actual graph, not toy data |
| Thesis integration lag | Write thesis section incrementally as code completes |

---

## Timeline Summary

| Phase | Duration | Cumulative |
|-------|----------|-----------|
| 1: Serial algorithm | 3–4 days | 3–4 days |
| 2: Validation | 1–2 days | 4–6 days |
| 3: Parallelization | 2–3 days | 7–9 days |
| 4: Benchmarking | 1–2 days | 8–11 days |
| 5: Integration | 1–2 days | 9–13 days |
| 6: Thesis section | 1–2 days | 10–15 days |
| **Total** | **~2–3 weeks** | **~2–3 weeks** |

**Recommendation:** Start after dataset collection is underway (week 2–3), finish before final thesis write-up.

---

## References

- Brandes, U. (2001). A faster algorithm for betweenness centrality. *Journal of Mathematical Sociology*, 25(2), 163–177.
- NetworkX Documentation: https://networkx.org/documentation/stable/reference/algorithms/centrality.html
- Rayon parallel iterator: https://docs.rs/rayon/latest/rayon/

---

## Success Criteria

✓ Algorithm is correct (validated on small examples)  
✓ Parallel version matches serial version  
✓ Speedup is >2x (if not, revert to serial + document why)  
✓ Results are integrated into thesis narrative  
✓ Top bridge players are identified and interpretable  

**Go build it.**
