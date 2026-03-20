use super::graph::GraphState;
use crate::models::{
    SignedBalanceClusterSummary, SignedBalanceDecisions, SignedBalanceGraphSummary,
    SignedBalanceNodeSummary, SignedBalanceRequest, SignedBalanceResponse,
    SignedBalanceTriadSummary, SignedTiePolicy, SignedTriadExample, SignedTriadExampleEdge,
    SignedTriadExampleNode, SignedTriadTypeCount,
};
use std::collections::{BTreeSet, HashMap};

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
enum EdgeSign {
    Positive,
    Negative,
}

impl EdgeSign {
    fn is_negative(self) -> bool {
        matches!(self, Self::Negative)
    }
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
enum TriadPattern {
    PositivePositivePositive,
    PositivePositiveNegative,
    PositiveNegativeNegative,
    NegativeNegativeNegative,
}

impl TriadPattern {
    fn from_signs(signs: [EdgeSign; 3]) -> Self {
        let negative_count = signs.into_iter().filter(|sign| sign.is_negative()).count();
        match negative_count {
            0 => Self::PositivePositivePositive,
            1 => Self::PositivePositiveNegative,
            2 => Self::PositiveNegativeNegative,
            _ => Self::NegativeNegativeNegative,
        }
    }

    fn is_balanced(self) -> bool {
        matches!(
            self,
            Self::PositivePositivePositive | Self::PositiveNegativeNegative
        )
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::PositivePositivePositive => "+++",
            Self::PositivePositiveNegative => "++-",
            Self::PositiveNegativeNegative => "+--",
            Self::NegativeNegativeNegative => "---",
        }
    }

    fn index(self) -> usize {
        match self {
            Self::PositivePositivePositive => 0,
            Self::PositivePositiveNegative => 1,
            Self::PositiveNegativeNegative => 2,
            Self::NegativeNegativeNegative => 3,
        }
    }

    fn ordered() -> [Self; 4] {
        [
            Self::PositivePositivePositive,
            Self::PositivePositiveNegative,
            Self::PositiveNegativeNegative,
            Self::NegativeNegativeNegative,
        ]
    }
}

#[derive(Debug, Clone)]
struct ProjectedEdge {
    left: String,
    right: String,
    sign: EdgeSign,
}

#[derive(Debug, Default, Clone, Copy)]
struct ProjectionStats {
    candidate_edges: usize,
    analyzed_edges: usize,
    excluded_low_support_edges: usize,
    excluded_tied_edges: usize,
}

#[derive(Debug, Default, Clone, Copy)]
struct NodeParticipation {
    total_triads: usize,
    unbalanced_triads: usize,
}

#[derive(Debug, Default, Clone, Copy)]
struct ClusterParticipation {
    total_triads: usize,
    balanced_triads: usize,
    unbalanced_triads: usize,
}

#[derive(Debug)]
struct AnalysisComputation {
    projected_nodes: usize,
    triad_total: usize,
    balanced_count: usize,
    unbalanced_count: usize,
    triad_distribution: [usize; 4],
    example_triads: Vec<SignedTriadExample>,
    top_unbalanced_nodes: Vec<SignedBalanceNodeSummary>,
    cluster_summaries: Vec<SignedBalanceClusterSummary>,
}

pub(super) fn signed_balance_response(
    graph: &GraphState,
    request: SignedBalanceRequest,
) -> SignedBalanceResponse {
    let (projected_edges, projection_stats) = build_projected_edges(graph, &request);
    let cluster_sizes: HashMap<String, usize> = graph
        .cluster_summaries
        .iter()
        .map(|cluster| (cluster.cluster_id.clone(), cluster.size))
        .collect();
    let computation = analyze_projected_graph(
        &projected_edges,
        &graph.cluster_membership,
        &cluster_sizes,
        graph,
        request.max_top_nodes,
        request.include_cluster_summaries,
    );

    let triad_type_distribution = TriadPattern::ordered()
        .into_iter()
        .map(|pattern| SignedTriadTypeCount {
            triad_type: pattern.as_str().to_string(),
            balanced: pattern.is_balanced(),
            count: computation.triad_distribution[pattern.index()],
        })
        .collect();

    let mut warnings = Vec::new();
    if request.tie_policy == SignedTiePolicy::Exclude && projection_stats.excluded_tied_edges > 0 {
        warnings.push(format!(
            "{} tied edges were excluded because ally and enemy evidence were equal.",
            projection_stats.excluded_tied_edges
        ));
    }
    if computation.triad_total == 0 {
        warnings.push(
            "No fully connected signed triads matched the current support threshold and tie policy."
                .to_string(),
        );
    }

    SignedBalanceResponse {
        status: if computation.triad_total > 0 {
            "ok".to_string()
        } else {
            "no_triads".to_string()
        },
        decisions: SignedBalanceDecisions {
            graph_scope: "filtered runtime graph".to_string(),
            edge_projection: "multi-match history collapsed into a signed simple graph".to_string(),
            support_measure: "allyWeight + enemyWeight".to_string(),
            canonical_positive_sign: "ally".to_string(),
            canonical_negative_sign: "enemy".to_string(),
            sign_rule: "dominant relation from allyWeight versus enemyWeight".to_string(),
            tie_policy: request.tie_policy,
            min_edge_support: request.min_edge_support,
            valid_triad_rule: "fully connected triples where all three edges meet the minimum support and resolve to a sign".to_string(),
        },
        graph_summary: SignedBalanceGraphSummary {
            filtered_nodes: graph.node_map.len(),
            projected_nodes: computation.projected_nodes,
            candidate_edges: projection_stats.candidate_edges,
            analyzed_edges: projection_stats.analyzed_edges,
            excluded_low_support_edges: projection_stats.excluded_low_support_edges,
            excluded_tied_edges: projection_stats.excluded_tied_edges,
        },
        triads: SignedBalanceTriadSummary {
            total_analyzed: computation.triad_total,
            balanced_count: computation.balanced_count,
            unbalanced_count: computation.unbalanced_count,
            balanced_ratio: ratio(computation.balanced_count, computation.triad_total),
        },
        triad_type_distribution,
        example_triads: computation.example_triads,
        top_unbalanced_nodes: computation.top_unbalanced_nodes,
        cluster_summaries: computation.cluster_summaries,
        warnings,
    }
}

fn build_projected_edges(
    graph: &GraphState,
    request: &SignedBalanceRequest,
) -> (Vec<ProjectedEdge>, ProjectionStats) {
    let mut stats = ProjectionStats::default();
    let mut edges = Vec::new();

    for (key, relation) in &graph.pair_relations {
        stats.candidate_edges += 1;
        if relation.total_matches < request.min_edge_support {
            stats.excluded_low_support_edges += 1;
            continue;
        }

        let Some(sign) = derive_edge_sign(
            relation.ally_weight,
            relation.enemy_weight,
            request.tie_policy,
        ) else {
            stats.excluded_tied_edges += 1;
            continue;
        };

        let Some((left, right)) = key.split_once('|') else {
            continue;
        };
        edges.push(ProjectedEdge {
            left: left.to_string(),
            right: right.to_string(),
            sign,
        });
        stats.analyzed_edges += 1;
    }

    edges.sort_by(|left, right| {
        left.left
            .cmp(&right.left)
            .then_with(|| left.right.cmp(&right.right))
    });
    (edges, stats)
}

fn analyze_projected_graph(
    projected_edges: &[ProjectedEdge],
    cluster_membership: &HashMap<String, String>,
    cluster_sizes: &HashMap<String, usize>,
    graph: &GraphState,
    max_top_nodes: usize,
    include_cluster_summaries: bool,
) -> AnalysisComputation {
    let mut adjacency: HashMap<String, BTreeSet<String>> = HashMap::new();
    let mut edge_signs = HashMap::new();

    for edge in projected_edges {
        adjacency
            .entry(edge.left.clone())
            .or_default()
            .insert(edge.right.clone());
        adjacency
            .entry(edge.right.clone())
            .or_default()
            .insert(edge.left.clone());
        edge_signs.insert(edge_key(&edge.left, &edge.right), edge.sign);
    }

    let mut triad_distribution = [0usize; 4];
    let mut triad_examples: [Vec<SignedTriadExample>; 4] =
        [Vec::new(), Vec::new(), Vec::new(), Vec::new()];
    let mut triad_total = 0usize;
    let mut balanced_count = 0usize;
    let mut unbalanced_count = 0usize;
    let mut node_participation: HashMap<String, NodeParticipation> = HashMap::new();
    let mut cluster_participation: HashMap<String, ClusterParticipation> = HashMap::new();

    let mut ordered_nodes: Vec<String> = adjacency.keys().cloned().collect();
    ordered_nodes.sort();

    for left in &ordered_nodes {
        let Some(left_neighbors) = adjacency.get(left) else {
            continue;
        };

        for middle in left_neighbors {
            if middle.as_str() <= left.as_str() {
                continue;
            }

            let Some(middle_neighbors) = adjacency.get(middle) else {
                continue;
            };

            for right in left_neighbors.intersection(middle_neighbors) {
                if right.as_str() <= middle.as_str() {
                    continue;
                }

                let Some(&left_middle) = edge_signs.get(&edge_key(left, middle)) else {
                    continue;
                };
                let Some(&left_right) = edge_signs.get(&edge_key(left, right)) else {
                    continue;
                };
                let Some(&middle_right) = edge_signs.get(&edge_key(middle, right)) else {
                    continue;
                };

                let pattern = TriadPattern::from_signs([left_middle, left_right, middle_right]);
                let balanced = pattern.is_balanced();
                triad_distribution[pattern.index()] += 1;
                triad_total += 1;

                if triad_examples[pattern.index()].len() < 2 {
                    triad_examples[pattern.index()].push(build_example_triad(
                        graph,
                        left,
                        middle,
                        right,
                        left_middle,
                        left_right,
                        middle_right,
                        pattern,
                    ));
                }

                if balanced {
                    balanced_count += 1;
                } else {
                    unbalanced_count += 1;
                }

                for node_id in [left.as_str(), middle.as_str(), right.as_str()] {
                    let entry = node_participation.entry(node_id.to_string()).or_default();
                    entry.total_triads += 1;
                    if !balanced {
                        entry.unbalanced_triads += 1;
                    }
                }

                let left_cluster = cluster_membership.get(left);
                let middle_cluster = cluster_membership.get(middle);
                let right_cluster = cluster_membership.get(right);
                if let (Some(a), Some(b), Some(c)) = (left_cluster, middle_cluster, right_cluster) {
                    if a == b && b == c {
                        let entry = cluster_participation.entry(a.clone()).or_default();
                        entry.total_triads += 1;
                        if balanced {
                            entry.balanced_triads += 1;
                        } else {
                            entry.unbalanced_triads += 1;
                        }
                    }
                }
            }
        }
    }

    let mut top_unbalanced_nodes: Vec<SignedBalanceNodeSummary> = node_participation
        .into_iter()
        .filter(|(_, participation)| participation.total_triads > 0)
        .map(|(player_id, participation)| SignedBalanceNodeSummary {
            label: graph
                .node_map
                .get(&player_id)
                .map(|node| node.label.clone())
                .unwrap_or_else(|| player_id.clone()),
            player_id,
            total_triads: participation.total_triads,
            unbalanced_triads: participation.unbalanced_triads,
            instability_score: ratio(participation.unbalanced_triads, participation.total_triads),
        })
        .collect();
    top_unbalanced_nodes.sort_by(|left, right| {
        right
            .unbalanced_triads
            .cmp(&left.unbalanced_triads)
            .then_with(|| right.total_triads.cmp(&left.total_triads))
            .then_with(|| right.instability_score.total_cmp(&left.instability_score))
            .then_with(|| left.label.cmp(&right.label))
            .then_with(|| left.player_id.cmp(&right.player_id))
    });
    top_unbalanced_nodes.truncate(max_top_nodes);

    let mut cluster_summaries = if include_cluster_summaries {
        cluster_participation
            .into_iter()
            .filter(|(_, participation)| participation.total_triads > 0)
            .map(|(cluster_id, participation)| SignedBalanceClusterSummary {
                size: cluster_sizes.get(&cluster_id).copied().unwrap_or(0),
                cluster_id,
                local_triads: participation.total_triads,
                balanced_count: participation.balanced_triads,
                unbalanced_count: participation.unbalanced_triads,
                balanced_ratio: ratio(participation.balanced_triads, participation.total_triads),
            })
            .collect()
    } else {
        Vec::new()
    };
    cluster_summaries.sort_by(|left, right| {
        right
            .local_triads
            .cmp(&left.local_triads)
            .then_with(|| right.unbalanced_count.cmp(&left.unbalanced_count))
            .then_with(|| left.cluster_id.cmp(&right.cluster_id))
    });

    AnalysisComputation {
        projected_nodes: adjacency.len(),
        triad_total,
        balanced_count,
        unbalanced_count,
        triad_distribution,
        example_triads: triad_examples.into_iter().flatten().collect(),
        top_unbalanced_nodes,
        cluster_summaries,
    }
}

fn build_example_triad(
    graph: &GraphState,
    left: &str,
    middle: &str,
    right: &str,
    left_middle: EdgeSign,
    left_right: EdgeSign,
    middle_right: EdgeSign,
    pattern: TriadPattern,
) -> SignedTriadExample {
    SignedTriadExample {
        triad_type: pattern.as_str().to_string(),
        balanced: pattern.is_balanced(),
        nodes: vec![
            SignedTriadExampleNode {
                player_id: left.to_string(),
                label: node_label(graph, left),
            },
            SignedTriadExampleNode {
                player_id: middle.to_string(),
                label: node_label(graph, middle),
            },
            SignedTriadExampleNode {
                player_id: right.to_string(),
                label: node_label(graph, right),
            },
        ],
        edges: vec![
            SignedTriadExampleEdge {
                from: left.to_string(),
                to: middle.to_string(),
                sign: edge_sign_value(left_middle),
            },
            SignedTriadExampleEdge {
                from: left.to_string(),
                to: right.to_string(),
                sign: edge_sign_value(left_right),
            },
            SignedTriadExampleEdge {
                from: middle.to_string(),
                to: right.to_string(),
                sign: edge_sign_value(middle_right),
            },
        ],
    }
}

fn node_label(graph: &GraphState, player_id: &str) -> String {
    graph
        .node_map
        .get(player_id)
        .map(|node| node.label.clone())
        .unwrap_or_else(|| player_id.to_string())
}

fn edge_sign_value(sign: EdgeSign) -> i8 {
    match sign {
        EdgeSign::Positive => 1,
        EdgeSign::Negative => -1,
    }
}

fn derive_edge_sign(
    ally_weight: u32,
    enemy_weight: u32,
    tie_policy: SignedTiePolicy,
) -> Option<EdgeSign> {
    if ally_weight > enemy_weight {
        Some(EdgeSign::Positive)
    } else if enemy_weight > ally_weight {
        Some(EdgeSign::Negative)
    } else if ally_weight == 0 && enemy_weight == 0 {
        None
    } else {
        match tie_policy {
            SignedTiePolicy::Exclude => None,
            SignedTiePolicy::Ally => Some(EdgeSign::Positive),
            SignedTiePolicy::Enemy => Some(EdgeSign::Negative),
        }
    }
}

fn edge_key(left: &str, right: &str) -> String {
    if left <= right {
        format!("{}|{}", left, right)
    } else {
        format!("{}|{}", right, left)
    }
}

fn ratio(numerator: usize, denominator: usize) -> f64 {
    if denominator == 0 {
        0.0
    } else {
        numerator as f64 / denominator as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ClusterSummary, GraphNode, PrototypeDataset};

    fn empty_graph_state() -> GraphState {
        GraphState {
            node_map: HashMap::new(),
            adjacency: HashMap::new(),
            pair_relations: HashMap::new(),
            player_rows: HashMap::new(),
            dataset: PrototypeDataset {
                nodes: Vec::new(),
                edges: Vec::new(),
            },
            population_snapshot: crate::models::GraphSnapshot {
                nodes: Vec::new(),
                edges: Vec::new(),
            },
            cluster_membership: HashMap::new(),
            cluster_summaries: Vec::new(),
            cluster_hops: HashMap::new(),
            landmark_distances: HashMap::new(),
            min_costs: HashMap::new(),
            node_indices: HashMap::new(),
        }
    }

    #[test]
    fn derives_edge_sign_with_explicit_tie_policy() {
        assert_eq!(
            derive_edge_sign(4, 1, SignedTiePolicy::Exclude),
            Some(EdgeSign::Positive)
        );
        assert_eq!(
            derive_edge_sign(1, 4, SignedTiePolicy::Exclude),
            Some(EdgeSign::Negative)
        );
        assert_eq!(derive_edge_sign(2, 2, SignedTiePolicy::Exclude), None);
        assert_eq!(
            derive_edge_sign(2, 2, SignedTiePolicy::Ally),
            Some(EdgeSign::Positive)
        );
        assert_eq!(
            derive_edge_sign(2, 2, SignedTiePolicy::Enemy),
            Some(EdgeSign::Negative)
        );
    }

    #[test]
    fn classifies_triad_patterns_correctly() {
        assert!(TriadPattern::from_signs([
            EdgeSign::Positive,
            EdgeSign::Positive,
            EdgeSign::Positive,
        ])
        .is_balanced());
        assert!(!TriadPattern::from_signs([
            EdgeSign::Positive,
            EdgeSign::Positive,
            EdgeSign::Negative,
        ])
        .is_balanced());
        assert!(TriadPattern::from_signs([
            EdgeSign::Positive,
            EdgeSign::Negative,
            EdgeSign::Negative,
        ])
        .is_balanced());
        assert!(!TriadPattern::from_signs([
            EdgeSign::Negative,
            EdgeSign::Negative,
            EdgeSign::Negative,
        ])
        .is_balanced());
    }

    #[test]
    fn thresholded_projection_removes_weak_edges_from_triads() {
        let graph = empty_graph_state();
        let cluster_membership = HashMap::from([
            ("a".to_string(), "cluster:1".to_string()),
            ("b".to_string(), "cluster:1".to_string()),
            ("c".to_string(), "cluster:1".to_string()),
        ]);
        let cluster_sizes = HashMap::from([("cluster:1".to_string(), 3usize)]);
        let edges = vec![
            ProjectedEdge {
                left: "a".to_string(),
                right: "b".to_string(),
                sign: EdgeSign::Positive,
            },
            ProjectedEdge {
                left: "a".to_string(),
                right: "c".to_string(),
                sign: EdgeSign::Positive,
            },
        ];

        let result = analyze_projected_graph(
            &edges,
            &cluster_membership,
            &cluster_sizes,
            &graph,
            10,
            true,
        );

        assert_eq!(result.triad_total, 0);
        assert_eq!(result.balanced_count, 0);
        assert_eq!(result.unbalanced_count, 0);
    }

    #[test]
    fn tiny_signed_graph_reports_balanced_and_unbalanced_triads() {
        let mut graph = empty_graph_state();
        graph.node_map = HashMap::from([
            (
                "a".to_string(),
                GraphNode {
                    id: "a".to_string(),
                    label: "Alpha".to_string(),
                    x: 0.0,
                    y: 0.0,
                    cluster_id: Some("cluster:1".to_string()),
                    is_bridge: Some(false),
                    is_star: Some(false),
                },
            ),
            (
                "b".to_string(),
                GraphNode {
                    id: "b".to_string(),
                    label: "Bravo".to_string(),
                    x: 0.0,
                    y: 0.0,
                    cluster_id: Some("cluster:1".to_string()),
                    is_bridge: Some(false),
                    is_star: Some(false),
                },
            ),
            (
                "c".to_string(),
                GraphNode {
                    id: "c".to_string(),
                    label: "Charlie".to_string(),
                    x: 0.0,
                    y: 0.0,
                    cluster_id: Some("cluster:1".to_string()),
                    is_bridge: Some(false),
                    is_star: Some(false),
                },
            ),
            (
                "d".to_string(),
                GraphNode {
                    id: "d".to_string(),
                    label: "Delta".to_string(),
                    x: 0.0,
                    y: 0.0,
                    cluster_id: Some("cluster:1".to_string()),
                    is_bridge: Some(false),
                    is_star: Some(false),
                },
            ),
        ]);
        graph.cluster_membership = HashMap::from([
            ("a".to_string(), "cluster:1".to_string()),
            ("b".to_string(), "cluster:1".to_string()),
            ("c".to_string(), "cluster:1".to_string()),
            ("d".to_string(), "cluster:1".to_string()),
        ]);
        graph.cluster_summaries = vec![ClusterSummary {
            cluster_id: "cluster:1".to_string(),
            cluster_type: "rust_pathfinding".to_string(),
            algorithm: "strong_components".to_string(),
            size: 4,
            best_op: None,
            worst_feed: None,
            center_x: 0.0,
            center_y: 0.0,
            highlighted_members: Vec::new(),
        }];
        let cluster_sizes = HashMap::from([("cluster:1".to_string(), 4usize)]);
        let edges = vec![
            ProjectedEdge {
                left: "a".to_string(),
                right: "b".to_string(),
                sign: EdgeSign::Positive,
            },
            ProjectedEdge {
                left: "a".to_string(),
                right: "c".to_string(),
                sign: EdgeSign::Positive,
            },
            ProjectedEdge {
                left: "b".to_string(),
                right: "c".to_string(),
                sign: EdgeSign::Negative,
            },
            ProjectedEdge {
                left: "a".to_string(),
                right: "d".to_string(),
                sign: EdgeSign::Negative,
            },
            ProjectedEdge {
                left: "b".to_string(),
                right: "d".to_string(),
                sign: EdgeSign::Negative,
            },
            ProjectedEdge {
                left: "c".to_string(),
                right: "d".to_string(),
                sign: EdgeSign::Positive,
            },
        ];

        let result = analyze_projected_graph(
            &edges,
            &graph.cluster_membership,
            &cluster_sizes,
            &graph,
            10,
            true,
        );

        assert_eq!(result.triad_total, 4);
        assert_eq!(result.balanced_count, 2);
        assert_eq!(result.unbalanced_count, 2);
        assert_eq!(
            result.triad_distribution[TriadPattern::PositivePositiveNegative.index()],
            2
        );
        assert_eq!(
            result.triad_distribution[TriadPattern::PositiveNegativeNegative.index()],
            2
        );
        assert_eq!(
            result
                .top_unbalanced_nodes
                .first()
                .map(|node| node.player_id.as_str()),
            Some("a")
        );
        assert_eq!(
            result
                .cluster_summaries
                .first()
                .map(|cluster| cluster.local_triads),
            Some(4)
        );
    }
}
