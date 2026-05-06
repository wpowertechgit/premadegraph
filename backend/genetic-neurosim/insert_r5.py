import re
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

sim_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'src', 'simulation.rs')
with open(sim_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the last occurrence of the Generation Boundary section header
# Using just the unique key text to avoid encoding issues
marker = 'Generation Boundary ────'
idx = content.rfind(marker)
if idx == -1:
    # Try alternative
    idx = content.rfind('Task 10: Generation Boundary')
if idx == -1:
    print('MARKER NOT FOUND')
    exit(1)

before = content[:idx]
last_brace = before.rstrip().rfind('}')
before_insert = before[:last_brace+1]
after_insert = content[idx:]

insert_code = '''

    // ─── R5 merger methods ────────────────────────────────────────────────────

    /// Check allied pairs for merge eligibility. One pair per check interval.
    fn apply_merger(&mut self) {
        use crate::tribes::BehaviorState;
        if self.tick % Self::MERGE_CHECK_INTERVAL != 0 { return; }

        let allied_pairs: Vec<(usize, usize)> = (0..self.tribes.len())
            .filter_map(|i| {
                let t = &self.tribes[i];
                if !t.alive || t.behavior != BehaviorState::Allied { return None; }
                t.ally_tribe.map(|j| if i < j { (i, j) } else { (j, i) })
            })
            .collect();

        for (a, b) in allied_pairs {
            if !self.tribes[a].alive || !self.tribes[b].alive { continue; }
            if self.tribes[a].ally_tribe != Some(b) { continue; }
            if self.tribes[a].ticks_in_state < Self::MERGE_TICK_THRESHOLD { continue; }
            if self.tribes[b].ticks_in_state < Self::MERGE_TICK_THRESHOLD { continue; }

            let (absorber, absorbed) = if self.tribes[a].population >= self.tribes[b].population {
                (a, b)
            } else {
                (b, a)
            };

            if self.try_merge_allies(absorber, absorbed) { break; }
        }
    }

    /// Merge two allied tribes. Absorber gains territory, population, constituents.
    fn try_merge_allies(&mut self, absorber: usize, absorbed: usize) -> bool {
        use crate::tribes::{BehaviorState, PolityTier, SpecializationRole};

        if !self.tribes[absorber].alive || !self.tribes[absorbed].alive { return false; }

        let tick = self.tick;
        let gen = self.generation;
        let absorber_id = self.tribes[absorber].id as u32;
        let absorbed_id = self.tribes[absorbed].id as u32;

        let mut ev = crate::events::SimulationEvent::new(
            0, tick, gen,
            crate::events::EventType::MergeInitiated,
            crate::events::EventSeverity::Important,
            absorber_id,
        );
        ev.other_tribe_id = absorbed_id;
        self.push_event(ev);

        let absorber_cc = self.tribes[absorber].constituent_tribe_ids.len();
        let absorbed_cc = self.tribes[absorbed].constituent_tribe_ids.len();
        let total_in_polity = 1 + absorber_cc + 1 + absorbed_cc;

        for &cid in self.tribes[absorbed].constituent_tribe_ids.clone().iter() {
            if !self.tribes[absorber].constituent_tribe_ids.contains(&cid) {
                self.tribes[absorber].constituent_tribe_ids.push(cid);
            }
        }
        if !self.tribes[absorber].constituent_tribe_ids.contains(&absorbed_id) {
            self.tribes[absorber].constituent_tribe_ids.push(absorbed_id);
        }

        let absorbed_territory: Vec<u16> = self.tribes[absorbed].territory.clone();
        self.tribes[absorber].territory.extend(&absorbed_territory);
        self.tribes[absorber].territory.sort();
        self.tribes[absorber].territory.dedup();

        self.tribes[absorber].population = self.tribes[absorber].population
            .saturating_add(self.tribes[absorbed].population);
        self.tribes[absorber].food_stores += self.tribes[absorbed].food_stores;
        self.tribes[absorber].citizens.extend(self.tribes[absorbed].citizens.clone());
        self.tribes[absorber].founders.extend(self.tribes[absorbed].founders.clone());

        for &t in &absorbed_territory {
            self.world.set_tile_owner(t as usize, absorber_id);
        }

        self.tribes[absorber].lineage.push(
            format!("merged-{}", self.tribes[absorbed].cluster_id)
        );

        let new_tier = Self::polity_tier_for_count(total_in_polity);
        let tier_upgraded = new_tier as u8 > self.tribes[absorber].polity_tier as u8;
        if tier_upgraded {
            self.tribes[absorber].polity_tier = new_tier;
        }

        self.tribes[absorbed].behavior = BehaviorState::Administering;
        self.tribes[absorbed].parent_polity_id = Some(absorber_id);
        self.tribes[absorbed].target_tribe = None;
        self.tribes[absorbed].ally_tribe = None;
        self.tribes[absorbed].ticks_in_state = 0;

        self.tribes[absorber].ally_tribe = None;
        self.tribes[absorber].target_tribe = None;
        self.tribes[absorber].ticks_in_state = 0;

        self.assign_roles(absorber);

        let mut ev2 = crate::events::SimulationEvent::new(
            0, tick, gen,
            crate::events::EventType::MergeCompleted,
            crate::events::EventSeverity::Important,
            absorber_id,
        );
        ev2.other_tribe_id = absorbed_id;
        ev2.value_a = total_in_polity as f32;
        ev2.value_b = new_tier as u8 as f32;
        self.push_event(ev2);

        if tier_upgraded {
            let mut ev3 = crate::events::SimulationEvent::new(
                0, tick, gen,
                crate::events::EventType::PolityUpgraded,
                crate::events::EventSeverity::Important,
                absorber_id,
            );
            ev3.value_a = new_tier as u8 as f32;
            ev3.value_b = total_in_polity as f32;
            self.push_event(ev3);
        }

        true
    }

    /// Assign specialization roles based on dominant artifact.
    fn assign_roles(&mut self, polity_id: usize) {
        use crate::tribes::SpecializationRole;

        let role = Self::assign_specialization_role(&self.tribes[polity_id].stats);
        self.tribes[polity_id].specialization_role = role;

        let polity_id_u32 = polity_id as u32;
        for i in 0..self.tribes.len() {
            if i == polity_id { continue; }
            if self.tribes[i].parent_polity_id == Some(polity_id_u32) {
                let role = Self::assign_specialization_role(&self.tribes[i].stats);
                self.tribes[i].specialization_role = role;
            }
        }

        let tick = self.tick;
        let gen = self.generation;
        let mut ev = crate::events::SimulationEvent::new(
            0, tick, gen,
            crate::events::EventType::RoleAssigned,
            crate::events::EventSeverity::Info,
            polity_id as u32,
        );
        ev.value_a = self.tribes[polity_id].specialization_role as u8 as f32;
        self.push_event(ev);
    }

    /// Check if an Administering tribe rebels (low A_team).
    fn check_rebellion(&mut self, tribe_idx: usize) -> bool {
        use crate::tribes::{BehaviorState, PolityTier, SpecializationRole};

        if !self.tribes[tribe_idx].alive { return false; }
        if self.tribes[tribe_idx].behavior != BehaviorState::Administering { return false; }
        if self.tribes[tribe_idx].stats.a_team >= Self::REBELLION_A_TEAM_THRESHOLD { return false; }

        let parent_id = match self.tribes[tribe_idx].parent_polity_id {
            Some(pid) => pid as usize,
            None => return false,
        };
        if parent_id >= self.tribes.len() || !self.tribes[parent_id].alive {
            return false;
        }

        let tick = self.tick;
        let gen = self.generation;
        let tribe_id = self.tribes[tribe_idx].id as u32;

        self.tribes[parent_id].constituent_tribe_ids.retain(|&cid| cid != tribe_id);

        self.tribes[tribe_idx].parent_polity_id = None;
        self.tribes[tribe_idx].polity_tier = PolityTier::Tribe;
        self.tribes[tribe_idx].behavior = BehaviorState::Settling;
        self.tribes[tribe_idx].ticks_in_state = 0;
        self.tribes[tribe_idx].specialization_role = SpecializationRole::Generalist;

        let total_remaining = 1 + self.tribes[parent_id].constituent_tribe_ids.len();
        let parent_new_tier = Self::polity_tier_for_count(total_remaining);
        if parent_new_tier as u8 < self.tribes[parent_id].polity_tier as u8 {
            self.tribes[parent_id].polity_tier = parent_new_tier;
        }

        let mut ev = crate::events::SimulationEvent::new(
            0, tick, gen,
            crate::events::EventType::RebellionStarted,
            crate::events::EventSeverity::Critical,
            tribe_id,
        );
        ev.other_tribe_id = parent_id as u32;
        self.push_event(ev);

        true
    }

    /// Scan all Administering tribes for low A_team rebellion.
    fn apply_rebellion_check(&mut self) {
        let candidates: Vec<usize> = (0..self.tribes.len())
            .filter(|&i| {
                self.tribes[i].alive
                    && self.tribes[i].behavior == crate::tribes::BehaviorState::Administering
                    && self.tribes[i].stats.a_team < Self::REBELLION_A_TEAM_THRESHOLD
                    && self.tribes[i].ticks_in_state > 100
            })
            .collect();

        for idx in candidates {
            self.check_rebellion(idx);
        }
    }
'''

new_content = before_insert + insert_code + '\n' + after_insert
out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'src', 'simulation.rs')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
print('INSERTED R5 merger methods successfully')
