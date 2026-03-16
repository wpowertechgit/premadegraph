use super::graph::{
    allowed_neighbors, build_path, heuristic_lower_bound, relation_for_path, tie_break_distance,
    GraphState, ModeKey,
};
use crate::models::*;
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap, HashSet, VecDeque};

#[derive(Debug, Clone)]
pub(super) struct SearchResult {
    pub(super) found: bool,
    pub(super) path_nodes: Vec<String>,
    pub(super) path_edges: Vec<PathEdge>,
    pub(super) visited_count: usize,
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
            .then_with(|| self.id.cmp(&other.id))
    }
}

impl PartialOrd for QueueState {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
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
        active_node_id: active,
        frontier_node_ids: frontier,
        visited_node_ids: visited_ids,
        highlighted_edges,
    }
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
            .then_with(|| self.id.cmp(&other.id))
    }
}

impl PartialOrd for AStarState {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

fn traversal_cost(request: &PathfinderRequest, neighbor: &super::graph::Neighbor) -> usize {
    let weight = neighbor.weight_for_mode(&request.path_mode) as usize;
    if !request.weighted_mode {
        return 1000;
    }

    let safe = weight.max(1);
    (1000 + safe - 1) / safe
}

pub(super) fn search_bfs(graph: &GraphState, request: &PathfinderRequest) -> SearchResult {
    let mut queue = VecDeque::from([request.source_player_id.clone()]);
    let mut visited = HashSet::from([request.source_player_id.clone()]);
    let mut parents = HashMap::from([(request.source_player_id.clone(), None)]);
    let mut trace = Vec::new();
    let mut step = 1usize;
    let mut edges_considered = 0usize;
    let mut found = false;

    while let Some(current) = queue.pop_front() {
        if step > request.options.max_steps {
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

        for neighbor in allowed_neighbors(graph, &current, &request.path_mode) {
            if step > request.options.max_steps {
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
                    relation: neighbor.relation_for_mode(&request.path_mode),
                    state: if is_new {
                        "exploring".to_string()
                    } else {
                        "seen".to_string()
                    },
                }],
            ));
            step += 1;

            if is_new && neighbor.id == request.target_player_id {
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
        build_path(graph, &parents, &request.target_player_id, &request.path_mode);

    trace.push(create_trace_step(
        step,
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

pub(super) fn search_dijkstra(graph: &GraphState, request: &PathfinderRequest) -> SearchResult {
    let mut heap = BinaryHeap::from([QueueState {
        cost: 0,
        id: request.source_player_id.clone(),
    }]);
    let mut distances = HashMap::from([(request.source_player_id.clone(), 0usize)]);
    let mut parents = HashMap::from([(request.source_player_id.clone(), None)]);
    let mut visited = HashSet::new();
    let mut trace = Vec::new();
    let mut step = 1usize;
    let mut edges_considered = 0usize;
    let mut found = false;

    while let Some(current) = heap.pop() {
        if step > request.options.max_steps {
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

        if current.id == request.target_player_id {
            found = true;
            break;
        }

        for neighbor in allowed_neighbors(graph, &current.id, &request.path_mode) {
            if step > request.options.max_steps {
                break;
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
                    relation: neighbor.relation_for_mode(&request.path_mode),
                    state: if improved {
                        "exploring".to_string()
                    } else {
                        "seen".to_string()
                    },
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
        build_path(graph, &parents, &request.target_player_id, &request.path_mode);

    trace.push(create_trace_step(
        step,
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

pub(super) fn search_astar(graph: &GraphState, request: &PathfinderRequest) -> SearchResult {
    let mode = ModeKey::from_request(&request.path_mode, request.weighted_mode);
    let initial_heuristic =
        heuristic_lower_bound(graph, &request.source_player_id, &request.target_player_id, mode);
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
    let mut step = 1usize;
    let mut edges_considered = 0usize;
    let mut found = false;

    while let Some(current) = heap.pop() {
        if step > request.options.max_steps {
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

        if current.id == request.target_player_id {
            found = true;
            break;
        }

        for neighbor in allowed_neighbors(graph, &current.id, &request.path_mode) {
            if step > request.options.max_steps {
                break;
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
                    relation: neighbor.relation_for_mode(&request.path_mode),
                    state: if improved {
                        "exploring".to_string()
                    } else {
                        "seen".to_string()
                    },
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
        build_path(graph, &parents, &request.target_player_id, &request.path_mode);
    trace.push(create_trace_step(
        step,
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

    for neighbor in allowed_neighbors(graph, &current, &request.path_mode) {
        if *step > request.options.max_steps {
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
                relation: neighbor.relation_for_mode(&request.path_mode),
                state: if is_new {
                    "exploring".to_string()
                } else {
                    "seen".to_string()
                },
            }],
        ));
        *step += 1;

        if other_visited.contains(&neighbor.id) {
            *meeting_node = Some(neighbor.id.clone());
            return;
        }
    }
}

pub(super) fn search_bidirectional(graph: &GraphState, request: &PathfinderRequest) -> SearchResult {
    let mut source_queue = VecDeque::from([request.source_player_id.clone()]);
    let mut target_queue = VecDeque::from([request.target_player_id.clone()]);
    let mut source_visited = HashSet::from([request.source_player_id.clone()]);
    let mut target_visited = HashSet::from([request.target_player_id.clone()]);
    let mut source_parents = HashMap::from([(request.source_player_id.clone(), None)]);
    let mut target_parents = HashMap::from([(request.target_player_id.clone(), None)]);
    let mut trace = Vec::new();
    let mut step = 1usize;
    let mut edges_considered = 0usize;
    let mut meeting_node = None;

    while !source_queue.is_empty()
        && !target_queue.is_empty()
        && meeting_node.is_none()
        && step <= request.options.max_steps
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
