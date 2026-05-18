use std::collections::HashMap;

// ─── Tribe-level lineage node ─────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TribeLineageNode {
    pub tribe_id: u32,
    pub cluster_id: String,
    pub tick_born: u64,
    pub tick_died: Option<u64>,
    pub extinction_cause: Option<crate::tombstone::ExtinctionCause>,
}

/// DAG-based entity lineage system.
///
/// Maps every entity to its two parent entities. Seed entities (founded from
/// cluster profiles) have `u32::MAX` as both parent sentinels. The registry
/// avoids string concatenation in hot paths — all lineage operations are O(depth)
/// HashMap lookups.
///
/// Thread-safety is delegated to the outer `RwLock` on `TribeSimulation`.
#[derive(Clone)]
pub struct LineageRegistry {
    /// entity_id -> (parent_a_id, parent_b_id)
    /// u32::MAX sentinel for seed entities (no parent).
    registry: HashMap<u32, (u32, u32)>,
    next_id: u32,
    /// cluster_id -> Vec of seed entity IDs originating from that cluster.
    seed_to_entity_ids: HashMap<String, Vec<u32>>,
    /// Tribe-level conquest/absorption DAG.
    tribe_nodes: HashMap<u32, TribeLineageNode>,
}

pub const SEED_SENTINEL: u32 = u32::MAX;

impl LineageRegistry {
    pub fn new() -> Self {
        Self {
            registry: HashMap::new(),
            next_id: 1,
            seed_to_entity_ids: HashMap::new(),
            tribe_nodes: HashMap::new(),
        }
    }

    /// Register a non-seed entity with two parents. Returns new entity_id.
    pub fn register(&mut self, parent_a: u32, parent_b: u32) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        self.registry.insert(id, (parent_a, parent_b));
        id
    }

    /// Register a seed entity with no parents, linked to a cluster.
    pub fn register_seed(&mut self, cluster_id: &str) -> u32 {
        let id = self.register(SEED_SENTINEL, SEED_SENTINEL);
        self.seed_to_entity_ids
            .entry(cluster_id.to_string())
            .or_default()
            .push(id);
        id
    }

    /// Walk DAG from entity_id back to seed, following parent_a.
    /// Returns Vec of (parent_a, parent_b) pairs from entity outward.
    pub fn resolve_lineage(&self, entity_id: u32) -> Vec<(u32, u32)> {
        let mut chain = Vec::new();
        let mut current = entity_id;
        loop {
            match self.registry.get(&current) {
                Some(&(a, b)) => {
                    chain.push((a, b));
                    if a == SEED_SENTINEL || b == SEED_SENTINEL {
                        break;
                    }
                    current = a;
                }
                None => break,
            }
        }
        chain
    }

    /// Trace entity back to its original seed cluster.
    pub fn seed_from_entity(&self, entity_id: u32) -> Option<String> {
        // Collect all entity IDs along the parent_a chain
        let mut visited = vec![entity_id];
        let mut current = entity_id;
        loop {
            match self.registry.get(&current) {
                Some(&(a, b)) if a != SEED_SENTINEL && b != SEED_SENTINEL => {
                    current = a;
                    visited.push(current);
                }
                _ => break,
            }
        }
        // Check which visited entity is a registered seed
        for &vid in &visited {
            for (cluster_id, ids) in &self.seed_to_entity_ids {
                if ids.contains(&vid) {
                    return Some(cluster_id.clone());
                }
            }
        }
        None
    }

    /// Check if an entity_id exists in the registry.
    pub fn contains(&self, entity_id: u32) -> bool {
        self.registry.contains_key(&entity_id)
    }

    /// Total number of registered entities.
    pub fn total_entity_count(&self) -> usize {
        self.registry.len()
    }

    /// Iterate over seed clusters and their entity IDs.
    pub fn seed_clusters(&self) -> impl Iterator<Item = (&String, &Vec<u32>)> {
        self.seed_to_entity_ids.iter()
    }

    /// Get the parent pair for an entity.
    pub fn parents(&self, entity_id: u32) -> Option<(u32, u32)> {
        self.registry.get(&entity_id).copied()
    }

    // ─── Tribe-level DAG ─────────────────────────────────────────────────────

    pub fn register_tribe(&mut self, tribe_id: u32, cluster_id: &str, tick: u64) {
        self.tribe_nodes.insert(tribe_id, TribeLineageNode {
            tribe_id,
            cluster_id: cluster_id.to_string(),
            tick_born: tick,
            tick_died: None,
            extinction_cause: None,
        });
    }

    pub fn record_tribe_death(&mut self, tribe_id: u32, cause: &crate::tombstone::ExtinctionCause, tick: u64) {
        if let Some(node) = self.tribe_nodes.get_mut(&tribe_id) {
            node.tick_died = Some(tick);
            node.extinction_cause = Some(cause.clone());
        }
    }

    pub fn tribe_node(&self, tribe_id: u32) -> Option<&TribeLineageNode> {
        self.tribe_nodes.get(&tribe_id)
    }

    pub fn all_tribe_nodes(&self) -> impl Iterator<Item = &TribeLineageNode> {
        self.tribe_nodes.values()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_and_resolve() {
        let mut reg = LineageRegistry::new();

        // Register two seed entities
        let seed_a = reg.register_seed("cluster-alpha");
        let seed_b = reg.register_seed("cluster-beta");

        // Register a child
        let child = reg.register(seed_a, seed_b);

        // Resolve child lineage
        let chain = reg.resolve_lineage(child);
        assert_eq!(chain.len(), 2); // child's parents + seed's sentinel parents
        assert_eq!(chain[0], (seed_a, seed_b));
        assert_eq!(chain[1], (SEED_SENTINEL, SEED_SENTINEL));
    }

    #[test]
    fn test_seed_from_entity() {
        let mut reg = LineageRegistry::new();
        let seed = reg.register_seed("cluster-gamma");
        let child = reg.register(seed, seed);

        assert_eq!(reg.seed_from_entity(child), Some("cluster-gamma".to_string()));
        assert_eq!(reg.seed_from_entity(seed), Some("cluster-gamma".to_string()));
    }

    #[test]
    fn test_contains_and_count() {
        let mut reg = LineageRegistry::new();
        assert_eq!(reg.total_entity_count(), 0);

        let seed = reg.register_seed("cluster-delta");
        assert!(reg.contains(seed));
        assert_eq!(reg.total_entity_count(), 1);

        let child = reg.register(seed, seed);
        assert!(reg.contains(child));
        assert_eq!(reg.total_entity_count(), 2);
    }

    #[test]
    fn test_nonexistent_entity() {
        let reg = LineageRegistry::new();
        assert!(!reg.contains(999));
        assert!(reg.resolve_lineage(999).is_empty());
        assert!(reg.seed_from_entity(999).is_none());
    }

    #[test]
    fn test_seed_clusters() {
        let mut reg = LineageRegistry::new();
        reg.register_seed("cluster-x");
        reg.register_seed("cluster-y");
        reg.register_seed("cluster-x"); // second seed in same cluster

        let clusters: Vec<_> = reg.seed_clusters().collect();
        assert_eq!(clusters.len(), 2);

        let x_count = clusters.iter().find(|(k, _)| *k == "cluster-x").map(|(_, v)| v.len()).unwrap();
        assert_eq!(x_count, 2);
    }

    #[test]
    fn tribe_dag_register_and_death() {
        let mut reg = LineageRegistry::new();
        reg.register_tribe(1, "cluster-alpha", 0);
        reg.register_tribe(2, "cluster-beta", 5);

        let cause = crate::tombstone::ExtinctionCause::ConqueredByWar { conqueror_id: 2 };
        reg.record_tribe_death(1, &cause, 42);

        let node = reg.tribe_node(1).unwrap();
        assert_eq!(node.tribe_id, 1);
        assert_eq!(node.cluster_id, "cluster-alpha");
        assert_eq!(node.tick_born, 0);
        assert_eq!(node.tick_died, Some(42));
        matches!(node.extinction_cause, Some(crate::tombstone::ExtinctionCause::ConqueredByWar { conqueror_id: 2 }));

        let node2 = reg.tribe_node(2).unwrap();
        assert!(node2.tick_died.is_none());

        assert_eq!(reg.all_tribe_nodes().count(), 2);
    }

    #[test]
    fn merger_cross_link_is_resolvable() {
        // Simulate D4: absorber merges with absorbed.
        // A synthetic merger entity (absorber_head, absorbed_head) links the two DAG branches.
        let mut reg = LineageRegistry::new();

        let absorber_seed = reg.register_seed("cluster-absorber");
        let absorbed_seed = reg.register_seed("cluster-absorbed");

        // Reproduce one generation in each tribe
        let absorber_child = reg.register(absorber_seed, absorber_seed);
        let absorbed_child = reg.register(absorbed_seed, absorbed_seed);

        // Merger cross-link: synthetic node linking the two head entities
        let merger_entity = reg.register(absorber_child, absorbed_child);

        // The merger entity's parents should be the two head citizens
        assert_eq!(reg.parents(merger_entity), Some((absorber_child, absorbed_child)));

        // resolve_lineage from merger_entity should reach absorber's branch
        let chain = reg.resolve_lineage(merger_entity);
        assert!(!chain.is_empty(), "merger entity must have resolvable lineage");

        // Both seed clusters still intact
        assert_eq!(reg.seed_from_entity(absorber_seed), Some("cluster-absorber".to_string()));
        assert_eq!(reg.seed_from_entity(absorbed_seed), Some("cluster-absorbed".to_string()));
    }
}
