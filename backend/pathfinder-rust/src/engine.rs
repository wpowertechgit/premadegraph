mod graph;
mod search;

use self::graph::{graph_snapshot, GraphState};
use self::search::{search_bfs, search_bidirectional, search_dijkstra, SearchResult};
use crate::models::*;
use std::time::Instant;

fn invalid_response(
    request: &PathfinderRequest,
    warning: &str,
    snapshot: Option<GraphSnapshot>,
) -> PathfinderResponse {
    PathfinderResponse {
        request: RequestEcho {
            source_player_id: request.source_player_id.clone(),
            target_player_id: request.target_player_id.clone(),
            algorithm: request.algorithm.clone(),
            path_mode: request.path_mode.clone(),
            weighted_mode: request.weighted_mode,
        },
        status: "invalid_input".to_string(),
        summary: PathfinderSummary {
            path_length: 0,
            nodes_visited: 0,
            edges_considered: 0,
            runtime_ms: 0.0,
            backend_runtime_ms: 0.0,
            trace_step_count: 0,
        },
        path: PathfinderPath {
            nodes: vec![],
            edges: vec![],
        },
        trace: vec![],
        graph_snapshot: snapshot.unwrap_or(GraphSnapshot {
            nodes: vec![],
            edges: vec![],
        }),
        warnings: vec![warning.to_string()],
    }
}

pub fn run_search(graph: &GraphState, request: PathfinderRequest) -> PathfinderResponse {
    if !graph.node_map.contains_key(&request.source_player_id)
        || !graph.node_map.contains_key(&request.target_player_id)
    {
        return invalid_response(
            &request,
            "The selected player does not exist in the Rust prototype dataset.",
            None,
        );
    }

    if request.algorithm == "astar" {
        return invalid_response(
            &request,
            "A* remains planned until a valid heuristic is chosen.",
            Some(graph_snapshot(
                graph,
                &request.path_mode,
                &request.source_player_id,
                &request.target_player_id,
            )),
        );
    }

    if request.source_player_id == request.target_player_id {
        return PathfinderResponse {
            request: RequestEcho {
                source_player_id: request.source_player_id.clone(),
                target_player_id: request.target_player_id.clone(),
                algorithm: request.algorithm.clone(),
                path_mode: request.path_mode.clone(),
                weighted_mode: request.weighted_mode,
            },
            status: "same_source_target".to_string(),
            summary: PathfinderSummary {
                path_length: 0,
                nodes_visited: 1,
                edges_considered: 0,
                runtime_ms: 0.0,
                backend_runtime_ms: 0.0,
                trace_step_count: 0,
            },
            path: PathfinderPath {
                nodes: vec![request.source_player_id.clone()],
                edges: vec![],
            },
            trace: vec![],
            graph_snapshot: graph_snapshot(
                graph,
                &request.path_mode,
                &request.source_player_id,
                &request.target_player_id,
            ),
            warnings: vec![],
        };
    }

    let started_at = Instant::now();
    let result = if request.algorithm == "bfs" {
        search_bfs(graph, &request)
    } else if request.algorithm == "dijkstra" {
        search_dijkstra(graph, &request)
    } else {
        search_bidirectional(graph, &request)
    };
    let runtime_ms = started_at.elapsed().as_secs_f64() * 1000.0;

    let SearchResult {
        found,
        path_nodes,
        path_edges,
        visited_count,
        edges_considered,
        trace,
    } = result;
    let trace = if request.options.include_trace {
        trace
    } else {
        Vec::new()
    };

    let mut warnings = Vec::new();
    if !found && request.path_mode == "social-path" {
        warnings.push("No friend-only route is available in the Rust prototype graph.".to_string());
    }
    if request.path_mode == "battle-path" {
        warnings.push("Enemy edges are enabled in this Rust prototype run.".to_string());
    }

    PathfinderResponse {
        request: RequestEcho {
            source_player_id: request.source_player_id.clone(),
            target_player_id: request.target_player_id.clone(),
            algorithm: request.algorithm.clone(),
            path_mode: request.path_mode.clone(),
            weighted_mode: request.weighted_mode,
        },
        status: if found {
            "found".to_string()
        } else {
            "not_found".to_string()
        },
        summary: PathfinderSummary {
            path_length: path_nodes.len().saturating_sub(1),
            nodes_visited: visited_count,
            edges_considered,
            runtime_ms,
            backend_runtime_ms: runtime_ms,
            trace_step_count: trace.len(),
        },
        path: PathfinderPath {
            nodes: path_nodes,
            edges: path_edges,
        },
        trace,
        graph_snapshot: graph_snapshot(
            graph,
            &request.path_mode,
            &request.source_player_id,
            &request.target_player_id,
        ),
        warnings,
    }
}

pub fn compare_algorithms(graph: &GraphState, request: CompareRequest) -> CompareResponse {
    let mut rows = Vec::new();

    for algorithm in ["bfs", "dijkstra", "bidirectional"] {
        let social = run_search(
            graph,
            PathfinderRequest {
                source_player_id: request.source_player_id.clone(),
                target_player_id: request.target_player_id.clone(),
                algorithm: algorithm.to_string(),
                path_mode: "social-path".to_string(),
                weighted_mode: false,
                options: PathfinderOptions {
                    include_trace: false,
                    max_steps: 5000,
                },
            },
        );

        let battle = run_search(
            graph,
            PathfinderRequest {
                source_player_id: request.source_player_id.clone(),
                target_player_id: request.target_player_id.clone(),
                algorithm: algorithm.to_string(),
                path_mode: "battle-path".to_string(),
                weighted_mode: false,
                options: PathfinderOptions {
                    include_trace: false,
                    max_steps: 5000,
                },
            },
        );

        let active = if request.path_mode == "battle-path" {
            &battle
        } else {
            &social
        };
        let relative_note = if battle.status == "found" && social.status != "found" {
            "enemy edges create connectivity".to_string()
        } else if battle.status == "found" && social.status == "found" {
            if battle.summary.path_length < social.summary.path_length {
                "shorter with enemy edges".to_string()
            } else if battle.summary.path_length == social.summary.path_length {
                "no gain from enemy edges".to_string()
            } else {
                "battle-path mirrors social-path here".to_string()
            }
        } else if request.path_mode == "battle-path" {
            "battle-path mirrors social-path here".to_string()
        } else {
            "social-only route is the current baseline".to_string()
        };

        rows.push(ComparisonRow {
            algorithm: algorithm.to_string(),
            label: if algorithm == "bfs" {
                "BFS".to_string()
            } else if algorithm == "dijkstra" {
                "Dijkstra".to_string()
            } else {
                "Bidirectional".to_string()
            },
            supported_now: true,
            path_found: Some(active.status == "found" || active.status == "same_source_target"),
            path_length: Some(active.summary.path_length),
            nodes_visited: Some(active.summary.nodes_visited),
            runtime_ms: Some(active.summary.runtime_ms),
            relative_note,
        });
    }

    rows.push(ComparisonRow {
        algorithm: "astar".to_string(),
        label: "A*".to_string(),
        supported_now: false,
        path_found: None,
        path_length: None,
        nodes_visited: None,
        runtime_ms: None,
        relative_note: "planned, pending heuristic".to_string(),
    });

    CompareResponse { rows }
}

pub fn options_response(graph: &GraphState) -> OptionsResponse {
    OptionsResponse {
        execution_mode: "rust-backend-prototype".to_string(),
        players: graph
            .dataset
            .nodes
            .iter()
            .map(|node| PlayerOption {
                id: node.id.clone(),
                label: node.label.clone(),
            })
            .collect(),
        dataset_summary: DatasetSummary {
            players: graph.dataset.nodes.len(),
            relationships: graph.dataset.edges.len(),
            ally_relationships: graph
                .dataset
                .edges
                .iter()
                .filter(|edge| edge.relation == "ally")
                .count(),
            enemy_relationships: graph
                .dataset
                .edges
                .iter()
                .filter(|edge| edge.relation == "enemy")
                .count(),
        },
        supported_algorithms: vec![
            "bfs".to_string(),
            "dijkstra".to_string(),
            "bidirectional".to_string(),
            "astar".to_string(),
        ],
        preview_snapshot: graph_snapshot(graph, "battle-path", "a", "x"),
    }
}

pub fn engine_spec_response() -> EngineSpecResponse {
    EngineSpecResponse {
        execution_mode: "rust-backend-prototype".to_string(),
        request_contract: serde_json::json!({
            "sourcePlayerId": "string",
            "targetPlayerId": "string",
            "algorithm": ["bfs", "dijkstra", "bidirectional", "astar"],
            "pathMode": ["social-path", "battle-path"],
            "weightedMode": "boolean",
            "options": { "includeTrace": "boolean", "maxSteps": "number" }
        }),
        response_contract: serde_json::json!({
            "request": "echo of the search query without options",
            "status": ["found", "not_found", "same_source_target", "invalid_input"],
            "summary": {
                "pathLength": "number",
                "nodesVisited": "number",
                "edgesConsidered": "number",
                "runtimeMs": "number",
                "backendRuntimeMs": "number",
                "traceStepCount": "number"
            },
            "path": { "nodes": "string[]", "edges": "{ from, to, relation }[]" },
            "trace": "{ step, phase, activeNodeId, frontierNodeIds, visitedNodeIds, highlightedEdges }[]",
            "graphSnapshot": "{ nodes, edges }",
            "warnings": "string[]"
        }),
        signed_graph_model: serde_json::json!({
            "nodeStore": "HashMap<playerId, PlayerNode>",
            "adjacency": "HashMap<playerId, Vec<Neighbor>>",
            "pairRelation": {
                "allyWeight": "u32",
                "enemyWeight": "u32",
                "dominantRelation": "ally | enemy"
            },
            "queryRules": {
                "social-path": "allyWeight > 0",
                "battle-path": "allyWeight > 0 || enemyWeight > 0"
            }
        }),
        integration_path: serde_json::json!({
            "rust": [
                "Move the search core from the Node prototype into this Rust crate.",
                "Load offline-exported signed graph snapshots instead of the handcrafted demo dataset.",
                "Keep Express as a thin orchestration shell or replace it with a dedicated Rust service later."
            ],
            "go": [
                "Go remains a valid alternative if service ergonomics matter more than a native Rust core.",
                "The replay contract can stay unchanged."
            ]
        }),
    }
}

pub use self::graph::{build_graph_state, load_dataset};
