use crate::models::*;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone)]
pub(super) struct Neighbor {
    pub(super) id: String,
    pub(super) relation: String,
    pub(super) weight: u32,
}

#[derive(Debug, Clone)]
pub(super) struct PairRelation {
    pub(super) ally_weight: u32,
    pub(super) enemy_weight: u32,
    pub(super) dominant_relation: String,
}

#[derive(Debug, Clone)]
pub struct GraphState {
    pub(super) node_map: HashMap<String, GraphNode>,
    pub(super) adjacency: HashMap<String, Vec<Neighbor>>,
    pub(super) pair_relations: HashMap<String, PairRelation>,
    pub(super) dataset: PrototypeDataset,
}

pub fn load_dataset() -> PrototypeDataset {
    serde_json::from_str(include_str!("../../../pathfinder/prototypeData.json"))
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
        adjacency.get_mut(&edge.from).unwrap().push(Neighbor {
            id: edge.to.clone(),
            relation: edge.relation.clone(),
            weight: edge.weight,
        });
        adjacency.get_mut(&edge.to).unwrap().push(Neighbor {
            id: edge.from.clone(),
            relation: edge.relation.clone(),
            weight: edge.weight,
        });

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
            right
                .weight
                .cmp(&left.weight)
                .then_with(|| left.id.cmp(&right.id))
        });
    }

    GraphState {
        node_map,
        adjacency,
        pair_relations,
        dataset,
    }
}

pub(super) fn allowed_neighbors(graph: &GraphState, node_id: &str, path_mode: &str) -> Vec<Neighbor> {
    graph
        .adjacency
        .get(node_id)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|neighbor| path_mode == "battle-path" || neighbor.relation == "ally")
        .collect()
}

pub(super) fn relation_for_path(graph: &GraphState, from: &str, to: &str, path_mode: &str) -> String {
    if path_mode == "social-path" {
        return "ally".to_string();
    }

    graph
        .pair_relations
        .get(&edge_key(from, to))
        .map(|relation| relation.dominant_relation.clone())
        .unwrap_or_else(|| "ally".to_string())
}

pub(super) fn build_path(
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

pub(super) fn graph_snapshot(
    graph: &GraphState,
    path_mode: &str,
    source_id: &str,
    target_id: &str,
) -> GraphSnapshot {
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
