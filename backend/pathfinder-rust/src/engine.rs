use crate::models::*;
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap, HashSet, VecDeque};
use std::time::Instant;

#[derive(Debug, Clone)]
struct Neighbor {
    id: String,
    relation: String,
    weight: u32,
}

#[derive(Debug, Clone)]
struct PairRelation {
    ally_weight: u32,
    enemy_weight: u32,
    dominant_relation: String,
}

#[derive(Debug, Clone)]
struct SearchResult {
    found: bool,
    path_nodes: Vec<String>,
    path_edges: Vec<PathEdge>,
    visited_count: usize,
    edges_considered: usize,
    trace: Vec<TraceStep>,
}

#[derive(Debug, Clone)]
pub struct GraphState {
    node_map: HashMap<String, GraphNode>,
    adjacency: HashMap<String, Vec<Neighbor>>,
    pair_relations: HashMap<String, PairRelation>,
    dataset: PrototypeDataset,
}

#[derive(Clone, Eq, PartialEq)]
struct QueueState {
    cost: usize,
    id: String,
}

impl Ord for QueueState {
    fn cmp(&self, other: &Self) -> Ordering {
        other
            .cost
            .cmp(&self.cost)
            .then_with(|| self.id.cmp(&other.id))
    }
}

impl PartialOrd for QueueState {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

pub fn load_dataset() -> PrototypeDataset {
    serde_json::from_str(include_str!("../../pathfinder/prototypeData.json"))
        .expect("failed to parse prototypeData.json")
}

fn edge_key(from: &str, to: &str) -> String {
    if from <= to {
        format!("{}|{}", from, to)
    } else {
        format!("{}|{}", to, from)
    }
}

pub fn build_graph_state(dataset: PrototypeDataset) -> GraphState {
    let mut node_map = HashMap::new();
    let mut adjacency = HashMap::new();
    let mut pair_relations = HashMap::new();

    for node in &dataset.nodes {
        node_map.insert(node.id.clone(), node.clone());
        adjacency.insert(node.id.clone(), Vec::<Neighbor>::new());
    }

    for edge in &dataset.edges {
        adjacency
            .get_mut(&edge.from)
            .unwrap()
            .push(Neighbor { id: edge.to.clone(), relation: edge.relation.clone(), weight: edge.weight });
        adjacency
            .get_mut(&edge.to)
            .unwrap()
            .push(Neighbor { id: edge.from.clone(), relation: edge.relation.clone(), weight: edge.weight });

        let key = edge_key(&edge.from, &edge.to);
        let entry = pair_relations.entry(key).or_insert(PairRelation {
            ally_weight: 0,
            enemy_weight: 0,
            dominant_relation: edge.relation.clone(),
        });

        if edge.relation == "ally" {
            entry.ally_weight += edge.weight;
        } else {
            entry.enemy_weight += edge.weight;
        }

        entry.dominant_relation = if entry.ally_weight >= entry.enemy_weight {
            "ally".to_string()
        } else {
            "enemy".to_string()
        };
    }

    for neighbors in adjacency.values_mut() {
        neighbors.sort_by(|left, right| {
            right.weight.cmp(&left.weight).then_with(|| left.id.cmp(&right.id))
        });
    }

    GraphState {
        node_map,
        adjacency,
        pair_relations,
        dataset,
    }
}

fn create_trace_step(
    step: usize,
    phase: &str,
    active: Option<String>,
    frontier: Vec<String>,
    visited: &HashSet<String>,
    highlighted_edges: Vec<TraceHighlightedEdge>,
) -> TraceStep {
    let mut visited_ids: Vec<String> = visited.iter().cloned().collect();
    visited_ids.sort();

    TraceStep {
        step,
        phase: phase.to_string(),
        activeNodeId: active,
        frontierNodeIds: frontier,
        visitedNodeIds: visited_ids,
        highlightedEdges: highlighted_edges,
    }
}

fn allowed_neighbors(graph: &GraphState, node_id: &str, path_mode: &str) -> Vec<Neighbor> {
    graph
        .adjacency
        .get(node_id)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|neighbor| path_mode == "battle-path" || neighbor.relation == "ally")
        .collect()
}

fn relation_for_path(graph: &GraphState, from: &str, to: &str, path_mode: &str) -> String {
    if path_mode == "social-path" {
        return "ally".to_string();
    }

    graph
        .pair_relations
        .get(&edge_key(from, to))
        .map(|relation| relation.dominant_relation.clone())
        .unwrap_or_else(|| "ally".to_string())
}

fn build_path(
    graph: &GraphState,
    parents: &HashMap<String, Option<String>>,
    target_id: &str,
    path_mode: &str,
) -> (Vec<String>, Vec<PathEdge>) {
    let mut path_nodes = Vec::new();
    let mut current = Some(target_id.to_string());

    while let Some(node_id) = current {
        path_nodes.push(node_id.clone());
        current = parents.get(&node_id).cloned().unwrap_or(None);
    }

    path_nodes.reverse();

    let mut path_edges = Vec::new();
    for index in 0..path_nodes.len().saturating_sub(1) {
        let from = path_nodes[index].clone();
        let to = path_nodes[index + 1].clone();
        path_edges.push(PathEdge {
            from: from.clone(),
            to: to.clone(),
            relation: relation_for_path(graph, &from, &to, path_mode),
        });
    }

    (path_nodes, path_edges)
}

fn search_bfs(graph: &GraphState, request: &PathfinderRequest) -> SearchResult {
    let mut queue = VecDeque::from([request.sourcePlayerId.clone()]);
    let mut visited = HashSet::from([request.sourcePlayerId.clone()]);
    let mut parents = HashMap::from([(request.sourcePlayerId.clone(), None)]);
    let mut trace = Vec::new();
    let mut step = 1usize;
    let mut edges_considered = 0usize;
    let mut found = false;

    while let Some(current) = queue.pop_front() {
        if step > request.options.maxSteps {
            break;
        }

        trace.push(create_trace_step(
            step,
            "expand",
            Some(current.clone()),
            queue.iter().cloned().collect(),
            &visited,
            vec![],
        ));
        step += 1;

        for neighbor in allowed_neighbors(graph, &current, &request.pathMode) {
            if step > request.options.maxSteps {
                break;
            }

            edges_considered += 1;
            let is_new = !visited.contains(&neighbor.id);
            if is_new {
                visited.insert(neighbor.id.clone());
                parents.insert(neighbor.id.clone(), Some(current.clone()));
                queue.push_back(neighbor.id.clone());
            }

            trace.push(create_trace_step(
                step,
                "discover",
                Some(current.clone()),
                queue.iter().cloned().collect(),
                &visited,
                vec![TraceHighlightedEdge {
                    from: current.clone(),
                    to: neighbor.id.clone(),
                    relation: neighbor.relation.clone(),
                    state: if is_new { "exploring".to_string() } else { "seen".to_string() },
                }],
            ));
            step += 1;

            if is_new && neighbor.id == request.targetPlayerId {
                found = true;
                queue.clear();
                break;
            }
        }
    }

    if !found {
        trace.push(create_trace_step(step, "complete", None, vec![], &visited, vec![]));
        return SearchResult {
            found: false,
            path_nodes: vec![],
            path_edges: vec![],
            visited_count: visited.len(),
            edges_considered,
            trace,
        };
    }

    let (path_nodes, path_edges) =
        build_path(graph, &parents, &request.targetPlayerId, &request.pathMode);

    trace.push(create_trace_step(
        step,
        "resolve",
        Some(request.targetPlayerId.clone()),
        vec![],
        &visited,
        path_edges
            .iter()
            .map(|edge| TraceHighlightedEdge {
                from: edge.from.clone(),
                to: edge.to.clone(),
                relation: edge.relation.clone(),
                state: "resolved".to_string(),
            })
            .collect(),
    ));

    SearchResult {
        found: true,
        path_nodes,
        path_edges,
        visited_count: visited.len(),
        edges_considered,
        trace,
    }
}

fn search_dijkstra(graph: &GraphState, request: &PathfinderRequest) -> SearchResult {
    let mut heap = BinaryHeap::from([QueueState {
        cost: 0,
        id: request.sourcePlayerId.clone(),
    }]);
    let mut distances = HashMap::from([(request.sourcePlayerId.clone(), 0usize)]);
    let mut parents = HashMap::from([(request.sourcePlayerId.clone(), None)]);
    let mut visited = HashSet::new();
    let mut trace = Vec::new();
    let mut step = 1usize;
    let mut edges_considered = 0usize;
    let mut found = false;

    while let Some(current) = heap.pop() {
        if step > request.options.maxSteps {
            break;
        }

        if visited.contains(&current.id) {
            continue;
        }

        visited.insert(current.id.clone());

        let mut frontier: Vec<String> = heap.iter().map(|item| item.id.clone()).collect();
        frontier.sort();
        trace.push(create_trace_step(
            step,
            "expand",
            Some(current.id.clone()),
            frontier,
            &visited,
            vec![],
        ));
        step += 1;

        if current.id == request.targetPlayerId {
            found = true;
            break;
        }

        for neighbor in allowed_neighbors(graph, &current.id, &request.pathMode) {
            if step > request.options.maxSteps {
                break;
            }

            edges_considered += 1;
            let next_cost = current.cost + 1;
            let known = distances.get(&neighbor.id).copied();
            let improved = known.is_none() || next_cost < known.unwrap();

            if improved {
                distances.insert(neighbor.id.clone(), next_cost);
                parents.insert(neighbor.id.clone(), Some(current.id.clone()));
                heap.push(QueueState {
                    cost: next_cost,
                    id: neighbor.id.clone(),
                });
            }

            let mut frontier_after: Vec<String> = heap.iter().map(|item| item.id.clone()).collect();
            frontier_after.sort();
            trace.push(create_trace_step(
                step,
                "discover",
                Some(current.id.clone()),
                frontier_after,
                &visited,
                vec![TraceHighlightedEdge {
                    from: current.id.clone(),
                    to: neighbor.id.clone(),
                    relation: neighbor.relation.clone(),
                    state: if improved { "exploring".to_string() } else { "seen".to_string() },
                }],
            ));
            step += 1;
        }
    }

    if !found {
        trace.push(create_trace_step(step, "complete", None, vec![], &visited, vec![]));
        return SearchResult {
            found: false,
            path_nodes: vec![],
            path_edges: vec![],
            visited_count: visited.len(),
            edges_considered,
            trace,
        };
    }

    let (path_nodes, path_edges) =
        build_path(graph, &parents, &request.targetPlayerId, &request.pathMode);

    trace.push(create_trace_step(
        step,
        "resolve",
        Some(request.targetPlayerId.clone()),
        vec![],
        &visited,
        path_edges
            .iter()
            .map(|edge| TraceHighlightedEdge {
                from: edge.from.clone(),
                to: edge.to.clone(),
                relation: edge.relation.clone(),
                state: "resolved".to_string(),
            })
            .collect(),
    ));

    SearchResult {
        found: true,
        path_nodes,
        path_edges,
        visited_count: visited.len(),
        edges_considered,
        trace,
    }
}

#[allow(clippy::too_many_arguments)]
fn expand_frontier(
    graph: &GraphState,
    request: &PathfinderRequest,
    queue: &mut VecDeque<String>,
    own_visited: &mut HashSet<String>,
    other_visited: &HashSet<String>,
    own_parents: &mut HashMap<String, Option<String>>,
    frontier_snapshot: Vec<String>,
    trace: &mut Vec<TraceStep>,
    step: &mut usize,
    edges_considered: &mut usize,
    meeting_node: &mut Option<String>,
) {
    let current = if let Some(current) = queue.pop_front() {
        current
    } else {
        return;
    };

    let combined_visited: HashSet<String> = own_visited.union(other_visited).cloned().collect();
    trace.push(create_trace_step(
        *step,
        "expand",
        Some(current.clone()),
        frontier_snapshot.clone(),
        &combined_visited,
        vec![],
    ));
    *step += 1;

    for neighbor in allowed_neighbors(graph, &current, &request.pathMode) {
        if *step > request.options.maxSteps {
            break;
        }

        *edges_considered += 1;
        let is_new = !own_visited.contains(&neighbor.id);

        if is_new {
            own_visited.insert(neighbor.id.clone());
            own_parents.insert(neighbor.id.clone(), Some(current.clone()));
            queue.push_back(neighbor.id.clone());
        }

        let combined_now: HashSet<String> = own_visited.union(other_visited).cloned().collect();
        trace.push(create_trace_step(
            *step,
            "discover",
            Some(current.clone()),
            frontier_snapshot.clone(),
            &combined_now,
            vec![TraceHighlightedEdge {
                from: current.clone(),
                to: neighbor.id.clone(),
                relation: neighbor.relation.clone(),
                state: if is_new { "exploring".to_string() } else { "seen".to_string() },
            }],
        ));
        *step += 1;

        if other_visited.contains(&neighbor.id) {
            *meeting_node = Some(neighbor.id.clone());
            return;
        }
    }
}

fn search_bidirectional(graph: &GraphState, request: &PathfinderRequest) -> SearchResult {
    let mut source_queue = VecDeque::from([request.sourcePlayerId.clone()]);
    let mut target_queue = VecDeque::from([request.targetPlayerId.clone()]);
    let mut source_visited = HashSet::from([request.sourcePlayerId.clone()]);
    let mut target_visited = HashSet::from([request.targetPlayerId.clone()]);
    let mut source_parents = HashMap::from([(request.sourcePlayerId.clone(), None)]);
    let mut target_parents = HashMap::from([(request.targetPlayerId.clone(), None)]);
    let mut trace = Vec::new();
    let mut step = 1usize;
    let mut edges_considered = 0usize;
    let mut meeting_node = None;

    while !source_queue.is_empty()
        && !target_queue.is_empty()
        && meeting_node.is_none()
        && step <= request.options.maxSteps
    {
        let source_frontier_snapshot: Vec<String> = source_queue
            .iter()
            .cloned()
            .chain(target_queue.iter().cloned())
            .collect();
        expand_frontier(
            graph,
            request,
            &mut source_queue,
            &mut source_visited,
            &target_visited,
            &mut source_parents,
            source_frontier_snapshot,
            &mut trace,
            &mut step,
            &mut edges_considered,
            &mut meeting_node,
        );

        if meeting_node.is_some() {
            break;
        }

        let target_frontier_snapshot: Vec<String> = source_queue
            .iter()
            .cloned()
            .chain(target_queue.iter().cloned())
            .collect();
        expand_frontier(
            graph,
            request,
            &mut target_queue,
            &mut target_visited,
            &source_visited,
            &mut target_parents,
            target_frontier_snapshot,
            &mut trace,
            &mut step,
            &mut edges_considered,
            &mut meeting_node,
        );
    }

    let combined_visited: HashSet<String> = source_visited.union(&target_visited).cloned().collect();

    if meeting_node.is_none() {
        trace.push(create_trace_step(step, "complete", None, vec![], &combined_visited, vec![]));
        return SearchResult {
            found: false,
            path_nodes: vec![],
            path_edges: vec![],
            visited_count: combined_visited.len(),
            edges_considered,
            trace,
        };
    }

    let meet = meeting_node.unwrap();
    let mut left_nodes = Vec::new();
    let mut current_left = Some(meet.clone());
    while let Some(node_id) = current_left {
        left_nodes.push(node_id.clone());
        current_left = source_parents.get(&node_id).cloned().unwrap_or(None);
    }
    left_nodes.reverse();

    let mut right_nodes = Vec::new();
    let mut current_right = target_parents.get(&meet).cloned().unwrap_or(None);
    while let Some(node_id) = current_right {
        right_nodes.push(node_id.clone());
        current_right = target_parents.get(&node_id).cloned().unwrap_or(None);
    }

    let path_nodes: Vec<String> = left_nodes.into_iter().chain(right_nodes.into_iter()).collect();
    let mut path_edges = Vec::new();
    for index in 0..path_nodes.len().saturating_sub(1) {
        let from = path_nodes[index].clone();
        let to = path_nodes[index + 1].clone();
        path_edges.push(PathEdge {
            from: from.clone(),
            to: to.clone(),
            relation: relation_for_path(graph, &from, &to, &request.pathMode),
        });
    }

    trace.push(create_trace_step(
        step,
        "resolve",
        Some(meet),
        vec![],
        &combined_visited,
        path_edges
            .iter()
            .map(|edge| TraceHighlightedEdge {
                from: edge.from.clone(),
                to: edge.to.clone(),
                relation: edge.relation.clone(),
                state: "resolved".to_string(),
            })
            .collect(),
    ));

    SearchResult {
        found: true,
        path_nodes,
        path_edges,
        visited_count: combined_visited.len(),
        edges_considered,
        trace,
    }
}

fn graph_snapshot(graph: &GraphState, path_mode: &str, source_id: &str, target_id: &str) -> GraphSnapshot {
    let edges: Vec<GraphEdge> = graph
        .dataset
        .edges
        .iter()
        .filter(|edge| path_mode == "battle-path" || edge.relation == "ally")
        .cloned()
        .collect();

    let mut visible = HashSet::from([source_id.to_string(), target_id.to_string()]);
    for edge in &edges {
        visible.insert(edge.from.clone());
        visible.insert(edge.to.clone());
    }

    let nodes = graph
        .dataset
        .nodes
        .iter()
        .filter(|node| visible.contains(&node.id))
        .cloned()
        .collect();

    GraphSnapshot { nodes, edges }
}

fn invalid_response(request: &PathfinderRequest, warning: &str, snapshot: Option<GraphSnapshot>) -> PathfinderResponse {
    PathfinderResponse {
        request: RequestEcho {
            sourcePlayerId: request.sourcePlayerId.clone(),
            targetPlayerId: request.targetPlayerId.clone(),
            algorithm: request.algorithm.clone(),
            pathMode: request.pathMode.clone(),
            weightedMode: request.weightedMode,
        },
        status: "invalid_input".to_string(),
        summary: PathfinderSummary {
            pathLength: 0,
            nodesVisited: 0,
            edgesConsidered: 0,
            runtimeMs: 0.0,
            backendRuntimeMs: 0.0,
            traceStepCount: 0,
        },
        path: PathfinderPath {
            nodes: vec![],
            edges: vec![],
        },
        trace: vec![],
        graphSnapshot: snapshot.unwrap_or(GraphSnapshot { nodes: vec![], edges: vec![] }),
        warnings: vec![warning.to_string()],
    }
}

pub fn run_search(graph: &GraphState, request: PathfinderRequest) -> PathfinderResponse {
    if !graph.node_map.contains_key(&request.sourcePlayerId)
        || !graph.node_map.contains_key(&request.targetPlayerId)
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
                &request.pathMode,
                &request.sourcePlayerId,
                &request.targetPlayerId,
            )),
        );
    }

    if request.sourcePlayerId == request.targetPlayerId {
        return PathfinderResponse {
            request: RequestEcho {
                sourcePlayerId: request.sourcePlayerId.clone(),
                targetPlayerId: request.targetPlayerId.clone(),
                algorithm: request.algorithm.clone(),
                pathMode: request.pathMode.clone(),
                weightedMode: request.weightedMode,
            },
            status: "same_source_target".to_string(),
            summary: PathfinderSummary {
                pathLength: 0,
                nodesVisited: 1,
                edgesConsidered: 0,
                runtimeMs: 0.0,
                backendRuntimeMs: 0.0,
                traceStepCount: 0,
            },
            path: PathfinderPath {
                nodes: vec![request.sourcePlayerId.clone()],
                edges: vec![],
            },
            trace: vec![],
            graphSnapshot: graph_snapshot(
                graph,
                &request.pathMode,
                &request.sourcePlayerId,
                &request.targetPlayerId,
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
    let trace = if request.options.includeTrace {
        trace
    } else {
        Vec::new()
    };

    let mut warnings = Vec::new();
    if !found && request.pathMode == "social-path" {
        warnings.push("No friend-only route is available in the Rust prototype graph.".to_string());
    }
    if request.pathMode == "battle-path" {
        warnings.push("Enemy edges are enabled in this Rust prototype run.".to_string());
    }

    PathfinderResponse {
        request: RequestEcho {
            sourcePlayerId: request.sourcePlayerId.clone(),
            targetPlayerId: request.targetPlayerId.clone(),
            algorithm: request.algorithm.clone(),
            pathMode: request.pathMode.clone(),
            weightedMode: request.weightedMode,
        },
        status: if found { "found".to_string() } else { "not_found".to_string() },
        summary: PathfinderSummary {
            pathLength: path_nodes.len().saturating_sub(1),
            nodesVisited: visited_count,
            edgesConsidered: edges_considered,
            runtimeMs: runtime_ms,
            backendRuntimeMs: runtime_ms,
            traceStepCount: trace.len(),
        },
        path: PathfinderPath {
            nodes: path_nodes,
            edges: path_edges,
        },
        trace,
        graphSnapshot: graph_snapshot(
            graph,
            &request.pathMode,
            &request.sourcePlayerId,
            &request.targetPlayerId,
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
                sourcePlayerId: request.sourcePlayerId.clone(),
                targetPlayerId: request.targetPlayerId.clone(),
                algorithm: algorithm.to_string(),
                pathMode: "social-path".to_string(),
                weightedMode: false,
                options: PathfinderOptions {
                    includeTrace: false,
                    maxSteps: 5000,
                },
            },
        );

        let battle = run_search(
            graph,
            PathfinderRequest {
                sourcePlayerId: request.sourcePlayerId.clone(),
                targetPlayerId: request.targetPlayerId.clone(),
                algorithm: algorithm.to_string(),
                pathMode: "battle-path".to_string(),
                weightedMode: false,
                options: PathfinderOptions {
                    includeTrace: false,
                    maxSteps: 5000,
                },
            },
        );

        let active = if request.pathMode == "battle-path" { &battle } else { &social };
        let relative_note = if battle.status == "found" && social.status != "found" {
            "enemy edges create connectivity".to_string()
        } else if battle.status == "found" && social.status == "found" {
            if battle.summary.pathLength < social.summary.pathLength {
                "shorter with enemy edges".to_string()
            } else if battle.summary.pathLength == social.summary.pathLength {
                "no gain from enemy edges".to_string()
            } else {
                "battle-path mirrors social-path here".to_string()
            }
        } else if request.pathMode == "battle-path" {
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
            supportedNow: true,
            pathFound: Some(active.status == "found" || active.status == "same_source_target"),
            pathLength: Some(active.summary.pathLength),
            nodesVisited: Some(active.summary.nodesVisited),
            runtimeMs: Some(active.summary.runtimeMs),
            relativeNote: relative_note,
        });
    }

    rows.push(ComparisonRow {
        algorithm: "astar".to_string(),
        label: "A*".to_string(),
        supportedNow: false,
        pathFound: None,
        pathLength: None,
        nodesVisited: None,
        runtimeMs: None,
        relativeNote: "planned, pending heuristic".to_string(),
    });

    CompareResponse { rows }
}

pub fn options_response(graph: &GraphState) -> OptionsResponse {
    OptionsResponse {
        executionMode: "rust-backend-prototype".to_string(),
        players: graph
            .dataset
            .nodes
            .iter()
            .map(|node| PlayerOption {
                id: node.id.clone(),
                label: node.label.clone(),
            })
            .collect(),
        datasetSummary: DatasetSummary {
            players: graph.dataset.nodes.len(),
            relationships: graph.dataset.edges.len(),
            allyRelationships: graph.dataset.edges.iter().filter(|edge| edge.relation == "ally").count(),
            enemyRelationships: graph.dataset.edges.iter().filter(|edge| edge.relation == "enemy").count(),
        },
        supportedAlgorithms: vec![
            "bfs".to_string(),
            "dijkstra".to_string(),
            "bidirectional".to_string(),
            "astar".to_string(),
        ],
        previewSnapshot: graph_snapshot(graph, "battle-path", "a", "x"),
    }
}

pub fn engine_spec_response() -> EngineSpecResponse {
    EngineSpecResponse {
        executionMode: "rust-backend-prototype".to_string(),
        requestContract: serde_json::json!({
            "sourcePlayerId": "string",
            "targetPlayerId": "string",
            "algorithm": ["bfs", "dijkstra", "bidirectional", "astar"],
            "pathMode": ["social-path", "battle-path"],
            "weightedMode": "boolean",
            "options": { "includeTrace": "boolean", "maxSteps": "number" }
        }),
        responseContract: serde_json::json!({
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
        signedGraphModel: serde_json::json!({
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
        integrationPath: serde_json::json!({
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
