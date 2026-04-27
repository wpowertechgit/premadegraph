INSERT INTO players (puuid, display_name, region, detected_role, role_confidence, match_count, opscore, feedscore) VALUES
('puuid-001', 'AstraCarry', 'EUNE', 'ADC', 0.91, 42, 8.40, 2.20),
('puuid-002', 'MidlaneNova', 'EUNE', 'MID', 0.88, 37, 7.90, 2.80),
('puuid-003', 'JunglePulse', 'EUNE', 'JUNGLE', 0.84, 55, 7.30, 3.10),
('puuid-004', 'TopForge', 'EUNE', 'TOP', 0.79, 31, 6.80, 3.80),
('puuid-005', 'WardSaint', 'EUNE', 'SUPPORT', 0.93, 48, 7.10, 2.70),
('puuid-006', 'RiverBlade', 'EUNE', 'JUNGLE', 0.76, 26, 6.20, 4.60),
('puuid-007', 'BotComet', 'EUNE', 'ADC', 0.82, 29, 6.90, 3.40),
('puuid-008', 'ControlMage', 'EUNE', 'MID', 0.87, 33, 8.10, 2.50),
('puuid-009', 'EvgenyCh', 'EUNE', 'TOP', 0.74, 22, 5.90, 4.90),
('puuid-010', 'VisionHarbor', 'EUNE', 'SUPPORT', 0.90, 40, 7.60, 2.40);

INSERT INTO matches (riot_match_id, queue_type, region, patch_version, started_at, duration_seconds, winning_side, metadata) VALUES
('EUN1_1001', 'RANKED_SOLO_5x5', 'EUNE', '16.1', '2026-02-01 18:00:00', 1842, 'BLUE', '{"map":"Summoners Rift","source":"sample"}'),
('EUN1_1002', 'RANKED_SOLO_5x5', 'EUNE', '16.1', '2026-02-02 19:10:00', 2014, 'RED', '{"map":"Summoners Rift","source":"sample"}'),
('EUN1_1003', 'RANKED_FLEX_SR', 'EUNE', '16.1', '2026-02-03 20:20:00', 1720, 'BLUE', '{"map":"Summoners Rift","source":"sample"}'),
('EUN1_1004', 'RANKED_SOLO_5x5', 'EUNE', '16.2', '2026-02-04 21:30:00', 2260, 'RED', '{"map":"Summoners Rift","source":"sample"}'),
('EUN1_1005', 'RANKED_FLEX_SR', 'EUNE', '16.2', '2026-02-05 17:45:00', 1932, 'BLUE', '{"map":"Summoners Rift","source":"sample"}'),
('EUN1_1006', 'RANKED_SOLO_5x5', 'EUNE', '16.2', '2026-02-06 18:35:00', 2050, 'BLUE', '{"map":"Summoners Rift","source":"sample"}'),
('EUN1_1007', 'RANKED_FLEX_SR', 'EUNE', '16.3', '2026-02-07 19:40:00', 1888, 'RED', '{"map":"Summoners Rift","source":"sample"}'),
('EUN1_1008', 'RANKED_SOLO_5x5', 'EUNE', '16.3', '2026-02-08 20:05:00', 2144, 'BLUE', '{"map":"Summoners Rift","source":"sample"}'),
('EUN1_1009', 'RANKED_FLEX_SR', 'EUNE', '16.3', '2026-02-09 21:25:00', 1674, 'RED', '{"map":"Summoners Rift","source":"sample"}'),
('EUN1_1010', 'RANKED_SOLO_5x5', 'EUNE', '16.4', '2026-02-10 22:00:00', 2305, 'BLUE', '{"map":"Summoners Rift","source":"sample"}');

INSERT INTO teams (match_id, side, win, kills, towers_destroyed, dragons_taken, barons_taken)
SELECT match_id, 'BLUE', winning_side = 'BLUE', 18 + (match_id % 5), 7 + (match_id % 3), 2 + (match_id % 2), match_id % 2 FROM matches;

INSERT INTO match_participants (match_id, team_id, player_id, champion_name, lane, role, kills, deaths, assists, gold_earned, vision_score, damage_to_champions, win)
SELECT m.match_id, t.team_id, p.player_id,
       ('Champion' || p.player_id), p.detected_role, p.detected_role,
       (p.player_id % 9) + 1, (p.player_id % 5) + 1, (p.player_id % 12) + 3,
       9000 + (p.player_id * 375), 12 + (p.player_id * 2), 14000 + (p.player_id * 950), t.win
FROM matches m
JOIN teams t ON t.match_id = m.match_id AND t.side = 'BLUE'
JOIN players p ON p.player_id = ((m.match_id - 1) % 10) + 1;

INSERT INTO player_relationships (player_a_id, player_b_id, relation_type, ally_count, enemy_count, weight, confidence, first_seen_at, last_seen_at) VALUES
(1, 2, 'ally', 8, 1, 7.00, 0.8889, '2026-02-01', '2026-02-10'),
(1, 3, 'ally', 6, 2, 4.00, 0.7500, '2026-02-01', '2026-02-09'),
(2, 4, 'enemy', 1, 7, -6.00, 0.8750, '2026-02-02', '2026-02-10'),
(3, 5, 'ally', 5, 1, 4.00, 0.8333, '2026-02-03', '2026-02-09'),
(4, 6, 'mixed', 3, 3, 0.00, 0.5000, '2026-02-04', '2026-02-10'),
(5, 7, 'ally', 7, 0, 7.00, 1.0000, '2026-02-05', '2026-02-10'),
(6, 8, 'enemy', 0, 6, -6.00, 1.0000, '2026-02-05', '2026-02-09'),
(7, 9, 'ally', 4, 2, 2.00, 0.6667, '2026-02-06', '2026-02-10'),
(8, 10, 'ally', 5, 1, 4.00, 0.8333, '2026-02-07', '2026-02-10'),
(9, 10, 'enemy', 1, 5, -4.00, 0.8333, '2026-02-08', '2026-02-10');

INSERT INTO clusters (cluster_code, cluster_type, algorithm, member_count, density, average_opscore, average_feedscore, metadata) VALUES
('python_population:1', 'python_population', 'louvain', 3, 0.76000, 7.87, 2.70, '{"role_hint":"carry-heavy"}'),
('python_population:2', 'python_population', 'louvain', 2, 0.68000, 7.50, 2.95, '{"role_hint":"mid-support"}'),
('python_population:3', 'python_population', 'louvain', 4, 0.54000, 6.90, 3.70, '{"role_hint":"mixed"}'),
('rust_pathfinding:1', 'rust_pathfinding', 'connected_components', 5, 0.62000, 7.20, 3.10, '{"min_weight":3}'),
('rust_pathfinding:2', 'rust_pathfinding', 'connected_components', 3, 0.71000, 7.00, 3.20, '{"min_weight":3}'),
('balance:1', 'signed_balance', 'triad_balance', 3, 1.00000, 7.80, 2.80, '{"balanced_ratio":0.83}'),
('balance:2', 'signed_balance', 'triad_balance', 3, 0.90000, 6.60, 3.90, '{"balanced_ratio":0.67}'),
('assortativity:1', 'assortativity', 'pearson_numeric', 5, 0.48000, 7.30, 3.00, '{"metric":"opscore"}'),
('temporal:1', 'temporal_stability', 'rolling_variance', 2, 0.50000, 7.85, 2.45, '{"window":5}'),
('cohesion:1', 'community_cohesion', 'edge_density', 4, 0.82000, 7.10, 3.20, '{"cohesion_rank":1}');

INSERT INTO cluster_members (cluster_id, player_id, member_role, is_bridge, is_star, centrality_score)
SELECT ((player_id - 1) % 10) + 1, player_id,
       CASE WHEN player_id IN (1, 8) THEN 'star' WHEN player_id IN (3, 6) THEN 'bridge' ELSE 'member' END,
       player_id IN (3, 6), player_id IN (1, 8), player_id * 0.037
FROM players;

INSERT INTO analysis_runs (run_type, graph_mode, started_at, finished_at, status, processed_nodes, processed_edges, parameters, result_summary) VALUES
('cluster_build', 'ally', '2026-02-10 10:00', '2026-02-10 10:02', 'finished', 10, 10, '{"min_weight":3}', '{"clusters":3}'),
('signed_balance', 'signed', '2026-02-10 10:10', '2026-02-10 10:12', 'finished', 10, 10, '{"min_confidence":0.6}', '{"balanced_ratio":0.74}'),
('assortativity', 'ally', '2026-02-10 10:20', '2026-02-10 10:21', 'finished', 10, 6, '{"metric":"opscore"}', '{"coefficient":0.52}'),
('assortativity', 'battle', '2026-02-10 10:25', '2026-02-10 10:26', 'finished', 10, 10, '{"metric":"feedscore"}', '{"coefficient":0.08}'),
('temporal_stability', 'matches', '2026-02-10 10:30', '2026-02-10 10:33', 'finished', 10, 0, '{"window":5}', '{"stable_players":4}'),
('pathfinding', 'ally', '2026-02-10 10:40', '2026-02-10 10:41', 'finished', 10, 6, '{"algorithm":"astar"}', '{"queries":4}'),
('pathfinding', 'battle', '2026-02-10 10:45', '2026-02-10 10:46', 'finished', 10, 10, '{"algorithm":"dijkstra"}', '{"queries":3}'),
('community_cohesion', 'ally', '2026-02-10 10:50', '2026-02-10 10:52', 'finished', 10, 6, '{"min_cluster_size":2}', '{"top_density":0.82}'),
('brandes', 'ally', '2026-02-10 11:00', '2026-02-10 11:04', 'finished', 10, 6, '{"parallel":true}', '{"top_player":"JunglePulse"}'),
('score_calibration', 'matches', '2026-02-10 11:10', '2026-02-10 11:15', 'finished', 10, 0, '{"model":"linear"}', '{"features":6}');

INSERT INTO performance_snapshots (player_id, run_id, match_sample_size, opscore, feedscore, volatility_index, best_streak, worst_streak)
SELECT player_id, 5, match_count, opscore, feedscore, (10 - opscore) / 5.0, (player_id % 4) + 1, (player_id % 3)
FROM players;

INSERT INTO path_queries (run_id, source_player_id, target_player_id, algorithm, graph_mode, path_length, total_weight, path_json) VALUES
(6, 1, 5, 'astar', 'ally', 3, 11.000, '[1,2,3,5]'),
(6, 2, 7, 'astar', 'ally', 4, 13.000, '[2,1,3,5,7]'),
(6, 3, 10, 'astar', 'ally', 3, 10.000, '[3,5,7,10]'),
(6, 4, 8, 'astar', 'ally', 5, 14.000, '[4,2,1,3,6,8]'),
(7, 5, 9, 'dijkstra', 'battle', 2, 6.000, '[5,7,9]'),
(7, 6, 1, 'dijkstra', 'battle', 3, 8.000, '[6,4,2,1]'),
(7, 7, 2, 'dijkstra', 'battle', 2, 9.000, '[7,5,2]'),
(6, 8, 4, 'bfs', 'ally', 3, 7.000, '[8,10,9,4]'),
(6, 9, 3, 'bfs', 'ally', 4, 8.000, '[9,7,5,3]'),
(7, 10, 6, 'dijkstra', 'battle', 2, 10.000, '[10,8,6]');
