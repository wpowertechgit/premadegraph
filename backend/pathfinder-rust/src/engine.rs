mod graph;
mod search;

use self::graph::{
    global_view_snapshot, pathfinder_snapshot, player_focus_snapshot, population_snapshot,
    GraphState,
};
use self::search::{search_astar, search_bfs, search_bidirectional, search_dijkstra, SearchResult};
use crate::models::*;
use std::time::Instant;

fn invalid_response(
    request: &PathfinderRequest,
    warning: &str,
    snapshot: Option<GraphSnapshot>,
) -> PathfinderResponse {
    let response = PathfinderResponse {
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
    };

    response
}

pub fn run_search(graph: &GraphState, request: PathfinderRequest) -> PathfinderResponse {
    if !graph.node_map.contains_key(&request.source_player_id)
        || !graph.node_map.contains_key(&request.target_player_id)
    {
        return invalid_response(
            &request,
            "The selected player does not exist in the current Rust dataset.",
            None,
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
            graph_snapshot: pathfinder_snapshot(
                graph,
                &request.path_mode,
                &request.source_player_id,
                &request.target_player_id,
                &[request.source_player_id.clone()],
            ),
            warnings: vec![],
        };
    }

    let started_at = Instant::now();
    let result = if request.algorithm == "bfs" {
        search_bfs(graph, &request)
    } else if request.algorithm == "dijkstra" {
        search_dijkstra(graph, &request)
    } else if request.algorithm == "astar" {
        search_astar(graph, &request)
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
        warnings.push("No friend-only route is available in the current Rust graph.".to_string());
    }
    if request.path_mode == "battle-path" {
        warnings.push("Enemy edges are enabled in this run.".to_string());
    }
    if request.algorithm == "dijkstra" && request.weighted_mode {
        warnings.push(
            "Weighted Dijkstra treats stronger repeated connections as cheaper edges.".to_string(),
        );
    }
    if request.algorithm == "astar" {
        warnings.push("A* uses landmark and cluster lower bounds while preserving exact shortest-path results.".to_string());
    }

    let response = PathfinderResponse {
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
        graph_snapshot: pathfinder_snapshot(
            graph,
            &request.path_mode,
            &request.source_player_id,
            &request.target_player_id,
            &path_nodes,
        ),
        path: PathfinderPath {
            nodes: path_nodes,
            edges: path_edges,
        },
        trace,
        warnings,
    };

    eprintln!(
        "{} finished. status={}, path_length={}, nodes_visited={}, runtime_ms={:.2}",
        response.request.algorithm.to_uppercase(),
        response.status,
        response.summary.path_length,
        response.summary.nodes_visited,
        response.summary.runtime_ms,
    );

    response
}

pub fn compare_algorithms(graph: &GraphState, request: CompareRequest) -> CompareResponse {
    let mut rows = Vec::new();

    for algorithm in ["bfs", "dijkstra", "bidirectional", "astar"] {
        let social = run_search(
            graph,
            PathfinderRequest {
                source_player_id: request.source_player_id.clone(),
                target_player_id: request.target_player_id.clone(),
                algorithm: algorithm.to_string(),
                path_mode: "social-path".to_string(),
                weighted_mode: request.weighted_mode,
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
                weighted_mode: request.weighted_mode,
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
            } else if algorithm == "astar" {
                "A*".to_string()
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

    CompareResponse { rows }
}

pub fn options_response(graph: &GraphState) -> OptionsResponse {
    OptionsResponse {
        execution_mode: "rust-backend".to_string(),
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
        preview_snapshot: graph
            .dataset
            .nodes
            .first()
            .map(|node| player_focus_snapshot(graph, &node.id))
            .unwrap_or_else(|| population_snapshot(graph)),
        cluster_summaries: graph.cluster_summaries.clone(),
    }
}

pub fn global_view_response(graph: &GraphState) -> GlobalViewResponse {
    GlobalViewResponse {
        cluster_summaries: graph.cluster_summaries.clone(),
        snapshot: global_view_snapshot(graph),
    }
}

pub fn player_focus_response(graph: &GraphState, player_id: &str) -> Option<PlayerFocusResponse> {
    let player = graph.node_map.get(player_id)?;
    let cluster_id = graph.cluster_membership.get(player_id).cloned();
    let related_clusters = graph
        .cluster_summaries
        .iter()
        .filter(|cluster| cluster_id.as_deref() == Some(cluster.cluster_id.as_str()))
        .cloned()
        .collect();

    Some(PlayerFocusResponse {
        player: PlayerOption {
            id: player.id.clone(),
            label: player.label.clone(),
        },
        cluster_id,
        snapshot: player_focus_snapshot(graph, player_id),
        related_clusters,
    })
}

pub fn engine_spec_response() -> EngineSpecResponse {
    EngineSpecResponse {
        execution_mode: "rust-backend".to_string(),
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
                "Build real signed and population graph layers directly from raw match files and the player database.",
                "Persist Rust pathfinding clusters into SQLite alongside Python-generated population clusters.",
                "Keep Express as a thin orchestration shell while the Rust runtime owns graph construction and search."
            ],
            "go": [
                "Go remains a valid alternative if service ergonomics matter more than a native Rust core.",
                "The replay contract can stay unchanged."
            ]
        }),
    }
}

pub use self::graph::build_graph_state;
