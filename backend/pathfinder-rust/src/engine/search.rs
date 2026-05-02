use super::graph::{
    build_path, heuristic_lower_bound, neighbors_for, relation_for_path, tie_break_distance,
    GraphState, ModeKey,
};
use crate::models::*;
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap, HashSet, VecDeque};

const MAX_TRACE_STEPS_RESPONSE: usize = 500;
const MAX_TRACE_FRONTIER_IDS: usize = 40;
const MAX_TRACE_VISITED_IDS: usize = 60;

#[derive(Debug, Clone)]
pub(super) struct SearchResult {
    pub(super) found: bool,
    pub(super) path_nodes: Vec<String>,
    pub(super) path_edges: Vec<PathEdge>,
    pub(super) visited_count: usize,
    pub(super) visited_nodes: Vec<String>,
    pub(super) edges_considered: usize,
    pub(super) trace: Vec<TraceStep>,
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
            .then_with(|| other.id.cmp(&self.id))
    }
}

impl PartialOrd for QueueState {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

fn truncate_ids(mut ids: Vec<String>, limit: usize) -> Vec<String> {
    if ids.len() > limit {
        ids.truncate(limit);
    }
    ids
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
        active_node_id: active,
        frontier_node_ids: truncate_ids(frontier, MAX_TRACE_FRONTIER_IDS),
        visited_node_ids: truncate_ids(visited_ids, MAX_TRACE_VISITED_IDS),
        highlighted_edges,
    }
}

fn push_trace_step(
    trace: &mut Vec<TraceStep>,
    step: usize,
    phase: &str,
    active: Option<String>,
    frontier: Vec<String>,
    visited: &HashSet<String>,
    highlighted_edges: Vec<TraceHighlightedEdge>,
) {
    if trace.len() >= MAX_TRACE_STEPS_RESPONSE && phase != "resolve" && phase != "complete" {
        return;
    }

    trace.push(create_trace_step(
        step,
        phase,
        active,
        frontier,
        visited,
        highlighted_edges,
    ));
}

fn should_record_trace(include_trace: bool, trace: &[TraceStep], phase: &str) -> bool {
    include_trace
        && (trace.len() < MAX_TRACE_STEPS_RESPONSE || phase == "resolve" || phase == "complete")
}

fn union_visited(left: &HashSet<String>, right: &HashSet<String>) -> HashSet<String> {
    left.union(right).cloned().collect()
}

#[derive(Clone, Eq, PartialEq)]
struct AStarState {
    total_cost: usize,
    path_cost: usize,
    heuristic_cost: usize,
    tie_break: usize,
    id: String,
}

impl Ord for AStarState {
    fn cmp(&self, other: &Self) -> Ordering {
        other
            .total_cost
            .cmp(&self.total_cost)
            .then_with(|| other.heuristic_cost.cmp(&self.heuristic_cost))
            .then_with(|| other.tie_break.cmp(&self.tie_break))
            .then_with(|| other.id.cmp(&self.id))
    }
}

impl PartialOrd for AStarState {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

const WEIGHT_COST_SCALE: usize = 1_000_000;

fn traversal_cost(request: &PathfinderRequest, neighbor: &super::graph::Neighbor) -> usize {
    if !request.weighted_mode {
        return WEIGHT_COST_SCALE;
    }
    let weight = neighbor.weight_for_mode(&request.path_mode) as usize;
    let safe = weight.max(1);
    (WEIGHT_COST_SCALE + safe - 1) / safe
}

pub(super) fn search_bfs(graph: &GraphState, request: &PathfinderRequest) -> SearchResult {
    let mut queue = VecDeque::from([request.source_player_id.clone()]);
    let mut visited = HashSet::from([request.source_player_id.clone()]);
    let mut parents = HashMap::from([(request.source_player_id.clone(), None)]);
    let mut trace = Vec::new();
    let mut trace_step = 1usize;
    let mut expansions = 0usize;
    let mut edges_considered = 0usize;
    let mut found = false;

    while let Some(current) = queue.pop_front() {
        if expansions >= request.options.max_steps {
            break;
        }
        expansions += 1;

        if should_record_trace(request.options.include_trace, &trace, "expand") {
            push_trace_step(
                &mut trace,
                trace_step,
                "expand",
                Some(current.clone()),
                queue.iter().cloned().collect(),
                &visited,
                vec![],
            );
            trace_step += 1;
        }

        for neighbor in neighbors_for(graph, &current) {
            if !neighbor.is_allowed(&request.path_mode) {
                continue;
            }
            edges_considered += 1;
            let is_new = !visited.contains(&neighbor.id);
            if is_new {
                visited.insert(neighbor.id.clone());
                parents.insert(neighbor.id.clone(), Some(current.clone()));
                queue.push_back(neighbor.id.clone());
            }

            if should_record_trace(request.options.include_trace, &trace, "discover") {
                push_trace_step(
                    &mut trace,
                    trace_step,
                    "discover",
                    Some(current.clone()),
                    queue.iter().cloned().collect(),
                    &visited,
                    vec![TraceHighlightedEdge {
                        from: current.clone(),
                        to: neighbor.id.clone(),
                        relation: neighbor.relation_for_mode(&request.path_mode),
                        state: if is_new {
                            "exploring".to_string()
                        } else {
                            "seen".to_string()
                        },
                    }],
                );
                trace_step += 1;
            }

            if is_new && neighbor.id == request.target_player_id {
                found = true;
                queue.clear();
                break;
            }
        }
    }

    if !found {
        if should_record_trace(request.options.include_trace, &trace, "complete") {
            push_trace_step(
                &mut trace,
                trace_step,
                "complete",
                None,
                vec![],
                &visited,
                vec![],
            );
        }
        return SearchResult {
            found: false,
            path_nodes: vec![],
            path_edges: vec![],
            visited_count: visited.len(),
            visited_nodes: sorted_ids(&visited),
            edges_considered,
            trace,
        };
    }

    let (path_nodes, path_edges) = build_path(
        graph,
        &parents,
        &request.target_player_id,
        &request.path_mode,
    );

    if should_record_trace(request.options.include_trace, &trace, "resolve") {
        push_trace_step(
            &mut trace,
            trace_step,
            "resolve",
            Some(request.target_player_id.clone()),
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
        );
    }

    SearchResult {
        found: true,
        path_nodes,
        path_edges,
        visited_count: visited.len(),
        visited_nodes: sorted_ids(&visited),
        edges_considered,
        trace,
    }
}

pub(super) fn search_dijkstra(graph: &GraphState, request: &PathfinderRequest) -> SearchResult {
    let mut heap = BinaryHeap::from([QueueState {
        cost: 0,
        id: request.source_player_id.clone(),
    }]);
    let mut distances = HashMap::from([(request.source_player_id.clone(), 0usize)]);
    let mut parents = HashMap::from([(request.source_player_id.clone(), None)]);
    let mut visited = HashSet::new();
    let mut trace = Vec::new();
    let mut trace_step = 1usize;
    let mut expansions = 0usize;
    let mut edges_considered = 0usize;
    let mut found = false;

    while let Some(current) = heap.pop() {
        if expansions >= request.options.max_steps {
            break;
        }

        if visited.contains(&current.id) {
            continue;
        }
        if current.cost > distances.get(&current.id).copied().unwrap_or(usize::MAX) {
            continue;
        }

        visited.insert(current.id.clone());
        expansions += 1;

        if should_record_trace(request.options.include_trace, &trace, "expand") {
            let mut frontier: Vec<String> = heap.iter().map(|item| item.id.clone()).collect();
            frontier.sort();
            push_trace_step(
                &mut trace,
                trace_step,
                "expand",
                Some(current.id.clone()),
                frontier,
                &visited,
                vec![],
            );
            trace_step += 1;
        }

        if current.id == request.target_player_id {
            found = true;
            break;
        }

        for neighbor in neighbors_for(graph, &current.id) {
            if !neighbor.is_allowed(&request.path_mode) {
                continue;
            }
            edges_considered += 1;
            let next_cost = current.cost + traversal_cost(request, &neighbor);
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

            if should_record_trace(request.options.include_trace, &trace, "discover") {
                let mut frontier_after: Vec<String> =
                    heap.iter().map(|item| item.id.clone()).collect();
                frontier_after.sort();
                push_trace_step(
                    &mut trace,
                    trace_step,
                    "discover",
                    Some(current.id.clone()),
                    frontier_after,
                    &visited,
                    vec![TraceHighlightedEdge {
                        from: current.id.clone(),
                        to: neighbor.id.clone(),
                        relation: neighbor.relation_for_mode(&request.path_mode),
                        state: if improved {
                            "exploring".to_string()
                        } else {
                            "seen".to_string()
                        },
                    }],
                );
                trace_step += 1;
            }
        }
    }

    if !found {
        if should_record_trace(request.options.include_trace, &trace, "complete") {
            push_trace_step(
                &mut trace,
                trace_step,
                "complete",
                None,
                vec![],
                &visited,
                vec![],
            );
        }
        return SearchResult {
            found: false,
            path_nodes: vec![],
            path_edges: vec![],
            visited_count: visited.len(),
            visited_nodes: sorted_ids(&visited),
            edges_considered,
            trace,
        };
    }

    let (path_nodes, path_edges) = build_path(
        graph,
        &parents,
        &request.target_player_id,
        &request.path_mode,
    );

    if should_record_trace(request.options.include_trace, &trace, "resolve") {
        push_trace_step(
            &mut trace,
            trace_step,
            "resolve",
            Some(request.target_player_id.clone()),
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
        );
    }

    SearchResult {
        found: true,
        path_nodes,
        path_edges,
        visited_count: visited.len(),
        visited_nodes: sorted_ids(&visited),
        edges_considered,
        trace,
    }
}

pub(super) fn search_astar(graph: &GraphState, request: &PathfinderRequest) -> SearchResult {
    let mode = ModeKey::from_request(&request.path_mode, request.weighted_mode);
    let initial_heuristic = heuristic_lower_bound(
        graph,
        &request.source_player_id,
        &request.target_player_id,
        mode,
    );
    let mut heap = BinaryHeap::from([AStarState {
        total_cost: initial_heuristic,
        path_cost: 0,
        heuristic_cost: initial_heuristic,
        tie_break: tie_break_distance(graph, &request.source_player_id, &request.target_player_id),
        id: request.source_player_id.clone(),
    }]);
    let mut distances = HashMap::from([(request.source_player_id.clone(), 0usize)]);
    let mut parents = HashMap::from([(request.source_player_id.clone(), None)]);
    let mut visited = HashSet::new();
    let mut trace = Vec::new();
    let mut trace_step = 1usize;
    let mut expansions = 0usize;
    let mut edges_considered = 0usize;
    let mut found = false;

    while let Some(current) = heap.pop() {
        if expansions >= request.options.max_steps {
            break;
        }

        if visited.contains(&current.id) {
            continue;
        }
        if current.path_cost > distances.get(&current.id).copied().unwrap_or(usize::MAX) {
            continue;
        }
        visited.insert(current.id.clone());
        expansions += 1;

        if should_record_trace(request.options.include_trace, &trace, "expand") {
            let mut frontier: Vec<String> = heap.iter().map(|item| item.id.clone()).collect();
            frontier.sort();
            push_trace_step(
                &mut trace,
                trace_step,
                "expand",
                Some(current.id.clone()),
                frontier,
                &visited,
                vec![],
            );
            trace_step += 1;
        }

        if current.id == request.target_player_id {
            found = true;
            break;
        }

        for neighbor in neighbors_for(graph, &current.id) {
            if !neighbor.is_allowed(&request.path_mode) {
                continue;
            }
            edges_considered += 1;
            let next_path_cost = current.path_cost + traversal_cost(request, &neighbor);
            let known = distances.get(&neighbor.id).copied();
            let improved = known.is_none() || next_path_cost < known.unwrap();

            if improved {
                distances.insert(neighbor.id.clone(), next_path_cost);
                parents.insert(neighbor.id.clone(), Some(current.id.clone()));
                let heuristic =
                    heuristic_lower_bound(graph, &neighbor.id, &request.target_player_id, mode);
                heap.push(AStarState {
                    total_cost: next_path_cost + heuristic,
                    path_cost: next_path_cost,
                    heuristic_cost: heuristic,
                    tie_break: tie_break_distance(graph, &neighbor.id, &request.target_player_id),
                    id: neighbor.id.clone(),
                });
            }

            if should_record_trace(request.options.include_trace, &trace, "discover") {
                let mut frontier_after: Vec<String> =
                    heap.iter().map(|item| item.id.clone()).collect();
                frontier_after.sort();
                push_trace_step(
                    &mut trace,
                    trace_step,
                    "discover",
                    Some(current.id.clone()),
                    frontier_after,
                    &visited,
                    vec![TraceHighlightedEdge {
                        from: current.id.clone(),
                        to: neighbor.id.clone(),
                        relation: neighbor.relation_for_mode(&request.path_mode),
                        state: if improved {
                            "exploring".to_string()
                        } else {
                            "seen".to_string()
                        },
                    }],
                );
                trace_step += 1;
            }
        }
    }

    if !found {
        if should_record_trace(request.options.include_trace, &trace, "complete") {
            push_trace_step(
                &mut trace,
                trace_step,
                "complete",
                None,
                vec![],
                &visited,
                vec![],
            );
        }
        return SearchResult {
            found: false,
            path_nodes: vec![],
            path_edges: vec![],
            visited_count: visited.len(),
            visited_nodes: sorted_ids(&visited),
            edges_considered,
            trace,
        };
    }

    let (path_nodes, path_edges) = build_path(
        graph,
        &parents,
        &request.target_player_id,
        &request.path_mode,
    );
    if should_record_trace(request.options.include_trace, &trace, "resolve") {
        push_trace_step(
            &mut trace,
            trace_step,
            "resolve",
            Some(request.target_player_id.clone()),
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
        );
    }

    SearchResult {
        found: true,
        path_nodes,
        path_edges,
        visited_count: visited.len(),
        visited_nodes: sorted_ids(&visited),
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
    trace_step: &mut usize,
    expansions: &mut usize,
    edges_considered: &mut usize,
    meeting_node: &mut Option<String>,
) {
    if *expansions >= request.options.max_steps {
        return;
    }
    let current = if let Some(current) = queue.pop_front() {
        current
    } else {
        return;
    };
    *expansions += 1;

    if should_record_trace(request.options.include_trace, trace, "expand") {
        let combined_visited = union_visited(own_visited, other_visited);
        push_trace_step(
            trace,
            *trace_step,
            "expand",
            Some(current.clone()),
            frontier_snapshot.clone(),
            &combined_visited,
            vec![],
        );
        *trace_step += 1;
    }

    for neighbor in neighbors_for(graph, &current) {
        if !neighbor.is_allowed(&request.path_mode) {
            continue;
        }
        *edges_considered += 1;
        let is_new = !own_visited.contains(&neighbor.id);

        if is_new {
            own_visited.insert(neighbor.id.clone());
            own_parents.insert(neighbor.id.clone(), Some(current.clone()));
            queue.push_back(neighbor.id.clone());
        }

        if should_record_trace(request.options.include_trace, trace, "discover") {
            let combined_now = union_visited(own_visited, other_visited);
            push_trace_step(
                trace,
                *trace_step,
                "discover",
                Some(current.clone()),
                frontier_snapshot.clone(),
                &combined_now,
                vec![TraceHighlightedEdge {
                    from: current.clone(),
                    to: neighbor.id.clone(),
                    relation: neighbor.relation_for_mode(&request.path_mode),
                    state: if is_new {
                        "exploring".to_string()
                    } else {
                        "seen".to_string()
                    },
                }],
            );
            *trace_step += 1;
        }

        if other_visited.contains(&neighbor.id) {
            *meeting_node = Some(neighbor.id.clone());
            return;
        }
    }
}

pub(super) fn search_bidirectional(
    graph: &GraphState,
    request: &PathfinderRequest,
) -> SearchResult {
    let mut source_queue = VecDeque::from([request.source_player_id.clone()]);
    let mut target_queue = VecDeque::from([request.target_player_id.clone()]);
    let mut source_visited = HashSet::from([request.source_player_id.clone()]);
    let mut target_visited = HashSet::from([request.target_player_id.clone()]);
    let mut source_parents = HashMap::from([(request.source_player_id.clone(), None)]);
    let mut target_parents = HashMap::from([(request.target_player_id.clone(), None)]);
    let mut trace = Vec::new();
    let mut trace_step = 1usize;
    let mut expansions = 0usize;
    let mut edges_considered = 0usize;
    let mut meeting_node = None;

    while !source_queue.is_empty()
        && !target_queue.is_empty()
        && meeting_node.is_none()
        && expansions < request.options.max_steps
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
            &mut trace_step,
            &mut expansions,
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
            &mut trace_step,
            &mut expansions,
            &mut edges_considered,
            &mut meeting_node,
        );
    }

    let combined_visited = union_visited(&source_visited, &target_visited);

    if meeting_node.is_none() {
        if should_record_trace(request.options.include_trace, &trace, "complete") {
            push_trace_step(
                &mut trace,
                trace_step,
                "complete",
                None,
                vec![],
                &combined_visited,
                vec![],
            );
        }
        return SearchResult {
            found: false,
            path_nodes: vec![],
            path_edges: vec![],
            visited_count: combined_visited.len(),
            visited_nodes: sorted_ids(&combined_visited),
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

    let path_nodes: Vec<String> = left_nodes.into_iter().chain(right_nodes).collect();
    let mut path_edges = Vec::new();
    for index in 0..path_nodes.len().saturating_sub(1) {
        let from = path_nodes[index].clone();
        let to = path_nodes[index + 1].clone();
        path_edges.push(PathEdge {
            from: from.clone(),
            to: to.clone(),
            relation: relation_for_path(graph, &from, &to, &request.path_mode),
        });
    }

    if should_record_trace(request.options.include_trace, &trace, "resolve") {
        push_trace_step(
            &mut trace,
            trace_step,
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
        );
    }

    SearchResult {
        found: true,
        path_nodes,
        path_edges,
        visited_count: combined_visited.len(),
        visited_nodes: sorted_ids(&combined_visited),
        edges_considered,
        trace,
    }
}

fn sorted_ids(ids: &HashSet<String>) -> Vec<String> {
    let mut values: Vec<String> = ids.iter().cloned().collect();
    values.sort();
    values
}

#[cfg(test)]
mod tests {
    use super::super::graph::{GraphState, Neighbor, PairRelation};
    use super::*;
    use crate::models::{GraphNode, PrototypeDataset};
    use std::collections::HashMap;

    fn graph_with_edges(edges: &[(&str, &str, &str, u32, u32)]) -> GraphState {
        let mut node_ids = std::collections::BTreeSet::new();
        let mut adjacency: HashMap<String, Vec<Neighbor>> = HashMap::new();
        let mut pair_relations = HashMap::new();
        let mut dataset_edges = Vec::new();

        for (left, right, dominant_relation, ally_weight, total_matches) in edges {
            node_ids.insert((*left).to_string());
            node_ids.insert((*right).to_string());

            let neighbor = Neighbor {
                id: (*right).to_string(),
                ally_weight: *ally_weight,
                total_matches: *total_matches,
                dominant_relation: (*dominant_relation).to_string(),
            };
            adjacency
                .entry((*left).to_string())
                .or_default()
                .push(neighbor.clone());
            adjacency
                .entry((*right).to_string())
                .or_default()
                .push(Neighbor {
                    id: (*left).to_string(),
                    ..neighbor
                });

            pair_relations.insert(
                format!("{}|{}", left.min(right), left.max(right)),
                PairRelation {
                    ally_weight: *ally_weight,
                    enemy_weight: total_matches.saturating_sub(*ally_weight),
                    total_matches: *total_matches,
                    dominant_relation: (*dominant_relation).to_string(),
                },
            );

            dataset_edges.push(GraphEdge {
                from: (*left).to_string(),
                to: (*right).to_string(),
                relation: (*dominant_relation).to_string(),
                weight: *total_matches,
            });
        }

        let nodes: Vec<GraphNode> = node_ids
            .into_iter()
            .map(|id| GraphNode {
                id: id.clone(),
                label: id,
                x: 0.0,
                y: 0.0,
                cluster_id: None,
                is_bridge: None,
                is_star: None,
            })
            .collect();
        let node_map = nodes
            .iter()
            .cloned()
            .map(|node| (node.id.clone(), node))
            .collect();

        let mut graph = GraphState {
            node_map,
            adjacency,
            pair_relations,
            player_rows: HashMap::new(),
            dataset: PrototypeDataset {
                nodes,
                edges: dataset_edges,
            },
            population_snapshot: GraphSnapshot {
                nodes: vec![],
                edges: vec![],
            },
            cluster_membership: HashMap::new(),
            cluster_summaries: vec![],
            cluster_hops: HashMap::new(),
            landmark_distances: HashMap::new(),
            min_costs: HashMap::new(),
            node_indices: HashMap::new(),
        };

        let mut ordered_nodes: Vec<String> = graph.node_map.keys().cloned().collect();
        ordered_nodes.sort();
        graph.node_indices = ordered_nodes
            .iter()
            .enumerate()
            .map(|(index, node_id)| (node_id.clone(), index))
            .collect();

        graph
    }

    fn request(
        source: &str,
        target: &str,
        algorithm: &str,
        path_mode: &str,
        weighted_mode: bool,
    ) -> PathfinderRequest {
        PathfinderRequest {
            source_player_id: source.to_string(),
            target_player_id: target.to_string(),
            algorithm: algorithm.to_string(),
            path_mode: path_mode.to_string(),
            weighted_mode,
            options: PathfinderOptions {
                include_trace: false,
                max_steps: 100,
            },
        }
    }

    fn assert_astar_matches_dijkstra(graph: &GraphState, request: &PathfinderRequest) {
        let mut dijkstra_request = request.clone();
        dijkstra_request.algorithm = "dijkstra".to_string();
        let mut astar_request = request.clone();
        astar_request.algorithm = "astar".to_string();

        let dijkstra = search_dijkstra(graph, &dijkstra_request);
        let astar = search_astar(graph, &astar_request);

        assert_eq!(astar.found, dijkstra.found);
        assert_eq!(astar.path_nodes, dijkstra.path_nodes);
        assert_eq!(astar.path_edges.len(), dijkstra.path_edges.len());
    }

    #[test]
    fn dijkstra_prefers_lexicographically_smaller_equal_cost_target() {
        let graph = graph_with_edges(&[
            ("source", "target", "ally", 1, 1),
            ("source", "zzz", "ally", 1, 1),
        ]);

        let result = search_dijkstra(
            &graph,
            &request("source", "target", "dijkstra", "social-path", false),
        );

        assert!(result.found);
        assert_eq!(result.path_nodes, vec!["source", "target"]);
        assert_eq!(result.visited_count, 2);
    }

    #[test]
    fn dijkstra_uses_weighted_costs_to_prefer_stronger_route() {
        let graph = graph_with_edges(&[
            ("source", "target", "ally", 1, 1),
            ("source", "bridge", "ally", 10, 10),
            ("bridge", "target", "ally", 10, 10),
        ]);

        let result = search_dijkstra(
            &graph,
            &request("source", "target", "dijkstra", "social-path", true),
        );

        assert!(result.found);
        assert_eq!(result.path_nodes, vec!["source", "bridge", "target"]);
    }

    #[test]
    fn astar_matches_dijkstra_on_unweighted_social_paths() {
        let graph = graph_with_edges(&[
            ("source", "a", "ally", 1, 1),
            ("a", "target", "ally", 1, 1),
            ("source", "b", "ally", 1, 1),
            ("b", "c", "ally", 1, 1),
            ("c", "target", "ally", 1, 1),
        ]);

        assert_astar_matches_dijkstra(
            &graph,
            &request("source", "target", "astar", "social-path", false),
        );
    }

    #[test]
    fn astar_matches_dijkstra_on_weighted_social_paths() {
        let graph = graph_with_edges(&[
            ("source", "target", "ally", 1, 1),
            ("source", "bridge", "ally", 40, 40),
            ("bridge", "target", "ally", 40, 40),
            ("source", "detour", "ally", 5, 5),
            ("detour", "target", "ally", 5, 5),
        ]);

        assert_astar_matches_dijkstra(
            &graph,
            &request("source", "target", "astar", "social-path", true),
        );
    }

    #[test]
    fn astar_matches_dijkstra_on_battle_paths() {
        let graph = graph_with_edges(&[
            ("source", "enemy_hop", "enemy", 0, 3),
            ("enemy_hop", "target", "enemy", 0, 4),
            ("source", "friend", "ally", 1, 1),
            ("friend", "target", "ally", 1, 1),
        ]);

        assert_astar_matches_dijkstra(
            &graph,
            &request("source", "target", "astar", "battle-path", false),
        );
    }

    #[test]
    fn astar_handles_partial_cluster_metadata_safely() {
        let mut graph = graph_with_edges(&[
            ("source", "clustered", "ally", 3, 3),
            ("clustered", "target", "ally", 3, 3),
            ("source", "unclustered", "ally", 1, 1),
            ("unclustered", "target", "ally", 1, 1),
        ]);
        graph
            .cluster_membership
            .insert("source".to_string(), "cluster-1".to_string());
        graph
            .cluster_membership
            .insert("clustered".to_string(), "cluster-1".to_string());
        graph
            .cluster_membership
            .insert("target".to_string(), "cluster-2".to_string());

        assert_astar_matches_dijkstra(
            &graph,
            &request("source", "target", "astar", "social-path", false),
        );
    }

    #[test]
    fn astar_matches_dijkstra_on_tie_heavy_graphs() {
        let graph = graph_with_edges(&[
            ("source", "a", "ally", 1, 1),
            ("a", "target", "ally", 1, 1),
            ("source", "b", "ally", 1, 1),
            ("b", "target", "ally", 1, 1),
            ("source", "c", "ally", 1, 1),
            ("c", "target", "ally", 1, 1),
        ]);

        assert_astar_matches_dijkstra(
            &graph,
            &request("source", "target", "astar", "social-path", false),
        );
    }

    #[test]
    fn astar_and_dijkstra_report_no_path_consistently() {
        let graph =
            graph_with_edges(&[("source", "a", "ally", 1, 1), ("target", "b", "ally", 1, 1)]);

        assert_astar_matches_dijkstra(
            &graph,
            &request("source", "target", "astar", "social-path", false),
        );
        assert!(
            !search_astar(
                &graph,
                &request("source", "target", "astar", "social-path", false)
            )
            .found
        );
    }

    #[test]
    fn astar_handles_same_source_and_target() {
        let graph = graph_with_edges(&[("source", "other", "ally", 1, 1)]);

        let result = search_astar(
            &graph,
            &request("source", "source", "astar", "social-path", false),
        );

        assert!(result.found);
        assert_eq!(result.path_nodes, vec!["source"]);
    }

    #[test]
    fn bidirectional_finds_shortest_unweighted_path() {
        let graph = graph_with_edges(&[
            ("source", "target", "ally", 1, 1),
            ("source", "long1", "ally", 1, 1),
            ("long1", "long2", "ally", 1, 1),
            ("long2", "target", "ally", 1, 1),
        ]);

        let result = search_bidirectional(
            &graph,
            &request("source", "target", "bidirectional", "social-path", false),
        );

        assert!(result.found);
        assert_eq!(result.path_nodes, vec!["source", "target"]);
    }
}
