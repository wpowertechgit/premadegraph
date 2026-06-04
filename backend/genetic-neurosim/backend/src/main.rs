mod db;
mod desktop_protocol;
pub mod events;
mod frame_v1;
pub mod lineage_registry;
mod simulation;
pub mod tombstone;
pub mod tribes;
pub mod war;
pub mod world;

use std::{
    collections::BTreeMap,
    env,
    fs::File,
    io::{BufWriter, Write},
    net::SocketAddr,
    path::PathBuf,
    sync::Arc,
    time::Duration,
};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use db::Database;
use desktop_protocol::{wrap_frame_v1, wrap_tribal_legacy_frame};
use futures::{SinkExt, StreamExt};
use serde::Serialize;
use simulation::{
    ConfigPatch, ControlConfig, ControlResponse, GodModeResponse, InterventionRequest,
    InterventionResponse, LineageResolveResponse, LineageSeedResponse, LineageStatsResponse,
    RecentEventsResponse, RecordingSummary, ReplayRecordingRequest, RestartSeedRequest, RunSummary,
    SaveRecordingRequest, SharedSimulation, StatusResponse, TileOwnershipResponse,
    TombstonesResponse, TribeEventsResponse, TribeSimulation, TribeSnapshotResponse,
    WorldSnapshotResponse,
};
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use war::ActiveWarsResponse;

#[derive(Clone)]
struct AppState {
    simulation: SharedSimulation,
    database: Arc<Database>,
    frame_tx: broadcast::Sender<Arc<Vec<u8>>>,
    frame_v1_tx: broadcast::Sender<Arc<Vec<u8>>>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
}

#[derive(Debug, Clone)]
struct CliRunConfig {
    ticks: u64,
    checkpoint_interval: u64,
    log_path: Option<PathBuf>,
    seed: u64,
    synthetic_clusters: usize,
    use_dataset_export: bool,
    require_dataset_export: bool,
    scenario_id: Option<String>,
}

#[derive(Default, Serialize)]
struct CliRunMarkers {
    wars_declared: usize,
    wars_ended: usize,
    disputes_resolved: usize,
    alliances_formed: usize,
    merges_completed: usize,
    migrations_entered: usize,
    generations_advanced: usize,
    tribe_extinctions: usize,
}

impl CliRunConfig {
    fn default_log_path() -> PathBuf {
        PathBuf::from("logs/neurosim-cli-run.jsonl")
    }

    /// Build a unique log path: logs/neurosim-{seed}-{dataset}-{nonce}.jsonl
    /// Dataset label comes from PREMADEGRAPH_DATASET_ID env var ("synthetic" if absent).
    /// Nonce from time so parallel same-seed runs don't collide.
    fn unique_log_path(seed: u64) -> PathBuf {
        use std::time::{SystemTime, UNIX_EPOCH};
        let dataset = env::var("PREMADEGRAPH_DATASET_ID")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "synthetic".to_string());
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_nanos();
        let nonce = (seed ^ (nanos as u64)).wrapping_mul(0x9e3779b97f4a7c15) >> 32;
        PathBuf::from(format!(
            "logs/neurosim-{seed}-{dataset}-{nonce:08x}.jsonl"
        ))
    }

    fn usage() -> &'static str {
        "Usage: neurosim-backend --cli-run [--ticks N] [--checkpoint-interval N] [--log PATH|-] [--seed N] [--clusters N] [--use-dataset-export|--require-dataset-export] [--scenario ID]"
    }

    fn from_args<I>(args: I) -> Result<Option<Self>, String>
    where
        I: IntoIterator<Item = String>,
    {
        let args: Vec<String> = args.into_iter().collect();
        if args.is_empty() {
            return Ok(None);
        }
        if args.iter().any(|arg| arg == "--help" || arg == "-h") {
            return Err(Self::usage().to_string());
        }
        if !args
            .iter()
            .any(|arg| arg == "--cli-run" || arg == "cli-run")
        {
            return Ok(None);
        }

        let mut explicit_log = false;
        let mut config = Self {
            ticks: 100_000,
            checkpoint_interval: 50,
            log_path: Some(Self::default_log_path()),
            seed: 42,
            synthetic_clusters: 64,
            use_dataset_export: false,
            require_dataset_export: false,
            scenario_id: None,
        };

        let mut index = 0;
        while index < args.len() {
            match args[index].as_str() {
                "--cli-run" | "cli-run" => index += 1,
                "--ticks" => {
                    config.ticks = parse_arg_value(&args, &mut index, "--ticks")?;
                }
                "--checkpoint-interval" => {
                    config.checkpoint_interval =
                        parse_arg_value(&args, &mut index, "--checkpoint-interval")?;
                }
                "--log" => {
                    let value: String = parse_arg_value(&args, &mut index, "--log")?;
                    config.log_path = if value == "-" {
                        None
                    } else {
                        Some(PathBuf::from(value))
                    };
                    explicit_log = true;
                }
                "--seed" => {
                    config.seed = parse_arg_value(&args, &mut index, "--seed")?;
                }
                "--clusters" => {
                    config.synthetic_clusters = parse_arg_value(&args, &mut index, "--clusters")?;
                }
                "--use-dataset-export" => {
                    config.use_dataset_export = true;
                    index += 1;
                }
                "--require-dataset-export" => {
                    config.use_dataset_export = true;
                    config.require_dataset_export = true;
                    index += 1;
                }
                "--scenario" => {
                    let value: String = parse_arg_value(&args, &mut index, "--scenario")?;
                    config.scenario_id = if value.is_empty() { None } else { Some(value) };
                }
                "--stdout" => {
                    config.log_path = None;
                    index += 1;
                }
                other => return Err(format!("Unknown CLI argument: {other}")),
            }
        }

        if config.ticks == 0 {
            return Err("--ticks must be greater than zero".to_string());
        }
        if config.checkpoint_interval == 0 {
            return Err("--checkpoint-interval must be greater than zero".to_string());
        }
        if config.synthetic_clusters == 0 && config.scenario_id.is_none() {
            return Err("--clusters must be greater than zero".to_string());
        }

        // Assign unique log path unless caller specified --log explicitly.
        if !explicit_log {
            config.log_path = Some(Self::unique_log_path(config.seed));
        }

        Ok(Some(config))
    }
}

fn parse_arg_value<T>(args: &[String], index: &mut usize, flag: &str) -> Result<T, String>
where
    T: std::str::FromStr,
    T::Err: std::fmt::Display,
{
    let value_index = *index + 1;
    let value = args
        .get(value_index)
        .ok_or_else(|| format!("{flag} requires a value"))?;
    *index += 2;
    value
        .parse::<T>()
        .map_err(|error| format!("Invalid value for {flag}: {error}"))
}

fn parse_live_seed_from_args<I>(args: I) -> Result<Option<u64>, String>
where
    I: IntoIterator<Item = String>,
{
    let args: Vec<String> = args.into_iter().collect();
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--seed" => {
                return parse_arg_value(&args, &mut index, "--seed").map(Some);
            }
            arg if arg.starts_with("--seed=") => {
                let value = arg.trim_start_matches("--seed=");
                return value
                    .parse::<u64>()
                    .map(Some)
                    .map_err(|error| format!("Invalid value for --seed: {error}"));
            }
            _ => index += 1,
        }
    }
    Ok(None)
}

fn live_world_seed_from_env_or_args() -> Result<u64, String> {
    if let Some(seed) = parse_live_seed_from_args(env::args().skip(1))? {
        return Ok(seed);
    }

    match env::var("NEUROSIM_WORLD_SEED") {
        Ok(value) if !value.trim().is_empty() => value
            .trim()
            .parse::<u64>()
            .map_err(|error| format!("Invalid NEUROSIM_WORLD_SEED: {error}")),
        _ => Ok(ControlConfig::default().world_seed),
    }
}

async fn run_cli_validation(config: CliRunConfig) -> Result<(), String> {
    let mut writer = open_cli_log_writer(config.log_path.as_ref())?;
    let (mut clusters, cluster_source) = load_cli_clusters(&config).await?;
    clusters.sort_by(|a, b| a.id.cmp(&b.id));

    let mut control = ControlConfig {
        clusters,
        world_seed: config.seed,
        scenario_id: config.scenario_id.clone(),
        ..Default::default()
    };
    if control.scenario_id.is_some() {
        control.clusters.clear();
    }

    let simulation = TribeSimulation::shared(control);
    if config.scenario_id.is_some() {
        simulation.write().reinitialize();
    }

    write_json_line(
        &mut writer,
        &serde_json::json!({
            "type": "run_started",
            "ticks_requested": config.ticks,
            "checkpoint_interval": config.checkpoint_interval,
            "seed": config.seed,
            "cluster_source": cluster_source,
            "premadegraph_dataset_id": std::env::var("PREMADEGRAPH_DATASET_ID").ok().filter(|id| !id.is_empty()),
            "scenario_id": config.scenario_id,
            "input_labels": simulation::INPUT_LABELS,
            "output_labels": simulation::OUTPUT_LABELS,
            "status": simulation.read().status(),
        }),
    )?;

    let mut last_event_id = None;
    let mut event_counts: BTreeMap<String, usize> = BTreeMap::new();
    let mut markers = CliRunMarkers::default();
    drain_cli_events(
        &simulation,
        &mut writer,
        &mut last_event_id,
        &mut event_counts,
        &mut markers,
    )?;

    for _ in 0..config.ticks {
        simulation.write().step();
        drain_cli_events(
            &simulation,
            &mut writer,
            &mut last_event_id,
            &mut event_counts,
            &mut markers,
        )?;

        let tick = simulation.read().simulation_tick();
        if tick == 1 || tick % config.checkpoint_interval == 0 || tick == config.ticks {
            write_cli_checkpoint(&simulation, &mut writer, &event_counts, &markers)?;
        }
        if simulation.read().is_halted() {
            break;
        }
    }

    let (summary, metrics, lineage_stats, tombstones, winner) = {
        let sim = simulation.read();
        let winner = sim.run_summary().tribes.into_iter()
            .find(|t| t.alive)
            .map(|t| serde_json::json!({
                "tribe_id": t.id,
                "cluster_id": t.cluster_id,
                "polity_tier": t.polity_tier,
                "polity_behavior": t.polity_behavior,
                "population": t.population,
                "territory_tiles": t.territory_count,
                "max_population": t.max_population,
                "ticks_alive": t.ticks_alive,
                "a_combat": t.a_combat,
                "a_resource": t.a_resource,
                "a_risk": t.a_risk,
                "a_map_objective": t.a_map_objective,
                "a_team": t.a_team,
                "wars_won": t.wars_won,
                "wars_lost": t.wars_lost,
            }));
        (
            sim.run_summary(),
            sim.validation_metrics(),
            sim.lineage_stats(),
            sim.tombstones(),
            winner,
        )
    };
    write_json_line(
        &mut writer,
        &serde_json::json!({
            "type": "final_summary",
            "summary": summary,
            "winner": winner,
            "metrics": metrics,
            "lineage_stats": lineage_stats,
            "tombstones": tombstones,
            "event_counts": event_counts,
            "markers": markers,
        }),
    )?;
    writer.flush().map_err(|error| error.to_string())?;

    match &config.log_path {
        Some(path) => eprintln!("NeuroSim CLI run wrote JSONL log to {}", path.display()),
        None => eprintln!("NeuroSim CLI run wrote JSONL log to stdout"),
    }

    // Write dedicated tombstone report alongside the JSONL log.
    if let Some(log_path) = &config.log_path {
        let tombstone_path = log_path.with_extension("tombstones.json");
        let report = serde_json::json!({
            "run_seed": config.seed,
            "run_ticks": config.ticks,
            "total_tribes": summary.total_tribes,
            "tombstones": tombstones.records,
        });
        if let Ok(content) = serde_json::to_string_pretty(&report) {
            let _ = std::fs::write(&tombstone_path, content);
            eprintln!("Tombstone report: {}", tombstone_path.display());
        }
    }

    Ok(())
}

async fn load_cli_clusters(config: &CliRunConfig) -> Result<(Vec<simulation::ClusterProfile>, String), String> {
    if config.scenario_id.is_some() {
        return Ok((Vec::new(), "scenario".to_string()));
    }

    if config.use_dataset_export {
        match Database::connect().await {
            Ok(database) => match database.fetch_simulation_config().await {
                Ok(export) if !export.clusters.is_empty() => {
                    return Ok((export.clusters, "dataset_export".to_string()));
                }
                Ok(_) if config.require_dataset_export => {
                    return Err("Dataset export returned no clusters".to_string());
                }
                Ok(_) => eprintln!("Dataset export returned no clusters; using synthetic validation clusters"),
                Err(error) if config.require_dataset_export => {
                    return Err(format!("Dataset export fetch failed: {error}"));
                }
                Err(error) => eprintln!("Dataset export fetch failed ({error}); using synthetic validation clusters"),
            },
            Err(error) if config.require_dataset_export => {
                return Err(format!("Dataset export connection failed: {error}"));
            }
            Err(error) => eprintln!("Dataset export connection failed ({error}); using synthetic validation clusters"),
        }
    }

    Ok((
        synthetic_validation_clusters(config.synthetic_clusters),
        format!("synthetic_{}", config.synthetic_clusters),
    ))
}

fn synthetic_validation_clusters(count: usize) -> Vec<simulation::ClusterProfile> {
    // Values are pre-divided by 10.0 to match the 0–1 range that server.js produces
    // (server.js divides raw artifact scores by CAP=4.5; these were designed for the
    // old /10.0 normalizer that was removed from TribeStats::from_profile).
    let n = |v: f32| (v / 10.0f32).clamp(0.0, 1.0);
    (0..count)
        .map(|i| {
            let band = (i % 8) as f32;
            let cluster_size = 2 + (i % 9) as u32;
            simulation::ClusterProfile {
                id: format!("cli-cluster-{i:03}"),
                size_ratio: (cluster_size as f32 / 10.0).clamp(0.2, 1.0),
                mean_opscore: n(5.5 + band * 0.22),
                opscore_stddev: 0.4 + (i % 5) as f32 * 0.08,
                cohesion: 0.45 + (i % 6) as f32 * 0.06,
                internal_edge_ratio: 0.30 + (i % 7) as f32 * 0.04,
                a_combat:              n(5.8 + band * 0.34),
                a_risk:                n(4.4 + (7.0 - band) * 0.25),
                a_resource:            n(5.2 + (i % 5) as f32 * 0.45),
                a_map_objective:       n(4.8 + (i % 6) as f32 * 0.42),
                a_team:                n(4.5 + (i % 4) as f32 * 0.55),
                fight_conversion:      n(5.0 + band * 0.30),
                damage_pressure:       n(5.4 + band * 0.28),
                death_cost:            n(3.5 + (i % 5) as f32 * 0.38),
                survival_quality:      n(4.8 + (i % 6) as f32 * 0.35),
                economy:               n(5.0 + (i % 5) as f32 * 0.40),
                tempo:                 n(5.2 + band * 0.25),
                vision_control:        n(4.2 + (i % 7) as f32 * 0.35),
                objective_conversion:  n(4.7 + (i % 6) as f32 * 0.36),
                setup_control:         n(4.5 + (i % 5) as f32 * 0.34),
                protection_support:    n(4.0 + (i % 4) as f32 * 0.45),
                feed_risk:             n(2.0 + (i % 6) as f32 * 0.45),
                cluster_size,
                founder_puuids: vec![],
                founder_names:  vec![],
            }
        })
        .collect()
}

fn open_cli_log_writer(path: Option<&PathBuf>) -> Result<Box<dyn Write>, String> {
    match path {
        Some(path) => {
            if let Some(parent) = path.parent() {
                if !parent.as_os_str().is_empty() {
                    std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
                }
            }
            let file = File::create(path).map_err(|error| error.to_string())?;
            Ok(Box::new(BufWriter::new(file)))
        }
        None => Ok(Box::new(BufWriter::new(std::io::stdout()))),
    }
}

fn write_json_line<T>(writer: &mut Box<dyn Write>, value: &T) -> Result<(), String>
where
    T: Serialize,
{
    serde_json::to_writer(&mut **writer, value).map_err(|error| error.to_string())?;
    writer.write_all(b"\n").map_err(|error| error.to_string())
}

fn drain_cli_events(
    simulation: &SharedSimulation,
    writer: &mut Box<dyn Write>,
    last_event_id: &mut Option<u64>,
    event_counts: &mut BTreeMap<String, usize>,
    markers: &mut CliRunMarkers,
) -> Result<(), String> {
    let events = simulation.read().events_after(*last_event_id);
    for event in events {
        observe_cli_event(&event, event_counts, markers);
        *last_event_id = Some(event.event_id);
        write_json_line(
            writer,
            &build_cli_event_value(&event),
        )?;
    }
    Ok(())
}

fn build_cli_event_value(event: &crate::events::SimulationEvent) -> serde_json::Value {
    let mut value = serde_json::json!({
        "type": "event",
        "event": event,
    });
    if event.event_type == crate::events::EventType::BehaviorChanged {
        let new_behavior = event.flags & 0xff;
        let output_idx = ((event.flags >> 8) & 0xff) as usize;
        value["decoded"] = serde_json::json!({
            "old_behavior": event.value_a as u32,
            "new_behavior": new_behavior,
            "dominant_output_index": output_idx,
            "dominant_output_label": simulation::OUTPUT_LABELS.get(output_idx).copied(),
            "dominant_output_strength": event.value_b,
        });
    }
    value
}

fn observe_cli_event(
    event: &crate::events::SimulationEvent,
    event_counts: &mut BTreeMap<String, usize>,
    markers: &mut CliRunMarkers,
) {
    let label = format!("{:?}", event.event_type);
    *event_counts.entry(label).or_insert(0) += 1;
    match event.event_type {
        crate::events::EventType::WarDeclared => markers.wars_declared += 1,
        crate::events::EventType::WarEnded => markers.wars_ended += 1,
        crate::events::EventType::DisputeResolved => markers.disputes_resolved += 1,
        crate::events::EventType::AllianceFormed => markers.alliances_formed += 1,
        crate::events::EventType::MergeCompleted => markers.merges_completed += 1,
        crate::events::EventType::GenerationAdvanced => markers.generations_advanced += 1,
        crate::events::EventType::TribeExtinct => markers.tribe_extinctions += 1,
        crate::events::EventType::BehaviorChanged
            if (event.flags & 0xff) == crate::tribes::BehaviorState::Migrating as u32 =>
        {
            markers.migrations_entered += 1;
        }
        _ => {}
    }
}

fn write_cli_checkpoint(
    simulation: &SharedSimulation,
    writer: &mut Box<dyn Write>,
    event_counts: &BTreeMap<String, usize>,
    markers: &CliRunMarkers,
) -> Result<(), String> {
    write_json_line(writer, &build_cli_checkpoint_value(simulation, event_counts, markers))
}

fn build_cli_checkpoint_value(
    simulation: &SharedSimulation,
    event_counts: &BTreeMap<String, usize>,
    markers: &CliRunMarkers,
) -> serde_json::Value {
    let (summary, metrics) = {
        let sim = simulation.read();
        (sim.run_summary(), sim.validation_metrics())
    };
    let top_tribes: Vec<&simulation::TribeSummaryRecord> = summary.tribes.iter().take(8).collect();
    serde_json::json!({
        "type": "checkpoint",
        "tick": summary.tick,
        "generation": summary.generation,
        "alive_count": summary.alive_count,
        "extinct_count": summary.extinct_count,
        "total_tribes": summary.total_tribes,
        "war_count": summary.war_count,
        "metrics": metrics,
        "event_counts": event_counts,
        "markers": markers,
        "top_tribes": top_tribes,
        "tribes": &summary.tribes,
    })
}

#[cfg(test)]
mod cli_tests {
    use super::*;

    #[test]
    fn require_dataset_export_implies_dataset_mode() {
        let config = CliRunConfig::from_args([
            "--cli-run".to_string(),
            "--require-dataset-export".to_string(),
        ])
        .expect("valid args")
        .expect("cli mode");

        assert!(config.use_dataset_export);
        assert!(config.require_dataset_export);
    }

    #[test]
    fn checkpoint_contains_every_tribe_not_only_top_sample() {
        let clusters = synthetic_validation_clusters(12);
        let simulation = TribeSimulation::shared(ControlConfig {
            clusters,
            world_seed: 7,
            ..Default::default()
        });
        let value = build_cli_checkpoint_value(
            &simulation,
            &BTreeMap::new(),
            &CliRunMarkers::default(),
        );

        assert_eq!(value["total_tribes"].as_u64(), Some(12));
        assert_eq!(value["top_tribes"].as_array().unwrap().len(), 8);
        assert_eq!(value["tribes"].as_array().unwrap().len(), 12);
    }

    #[test]
    fn checkpoint_exposes_neural_and_behavior_audit_fields() {
        let clusters = synthetic_validation_clusters(2);
        let simulation = TribeSimulation::shared(ControlConfig {
            clusters,
            world_seed: 7,
            ..Default::default()
        });
        simulation.write().step();

        let value = build_cli_checkpoint_value(
            &simulation,
            &BTreeMap::new(),
            &CliRunMarkers::default(),
        );
        let tribe = &value["tribes"].as_array().unwrap()[0];

        assert!(tribe.get("behavior").is_some(), "checkpoint tribe should expose behavior state");
        assert!(tribe.get("last_outputs").is_some(), "checkpoint tribe should expose NN outputs");
        assert!(tribe.get("fitness_score").is_some(), "checkpoint tribe should expose fitness");
    }

    #[test]
    fn checkpoint_metrics_include_dominant_output_histogram() {
        let clusters = synthetic_validation_clusters(12);
        let simulation = TribeSimulation::shared(ControlConfig {
            clusters,
            world_seed: 7,
            ..Default::default()
        });
        simulation.write().step();

        let value = build_cli_checkpoint_value(
            &simulation,
            &BTreeMap::new(),
            &CliRunMarkers::default(),
        );
        let histogram = value["metrics"]["dominant_output_counts"]
            .as_object()
            .expect("checkpoint metrics should expose dominant_output_counts");
        let total: u64 = histogram.values().filter_map(|v| v.as_u64()).sum();

        assert_eq!(total, value["alive_count"].as_u64().unwrap());
    }

    #[test]
    fn behavior_event_rows_decode_behavior_and_dominant_output_separately() {
        let mut event = crate::events::SimulationEvent::new(
            0,
            1,
            0,
            crate::events::EventType::BehaviorChanged,
            crate::events::EventSeverity::Info,
            7,
        );
        event.value_a = crate::tribes::BehaviorState::Settling as u8 as f32;
        event.value_b = 0.77;
        event.flags = crate::tribes::BehaviorState::Migrating as u32 | (3 << 8);

        let value = build_cli_event_value(&event);

        assert_eq!(value["decoded"]["old_behavior"].as_u64(), Some(0));
        assert_eq!(value["decoded"]["new_behavior"].as_u64(), Some(2));
        assert_eq!(value["decoded"]["dominant_output_index"].as_u64(), Some(3));
        assert_eq!(
            value["decoded"]["dominant_output_label"].as_str(),
            Some("migration_drive")
        );
    }

    #[test]
    fn behavior_marker_uses_low_flag_byte_for_new_behavior() {
        let mut event = crate::events::SimulationEvent::new(
            0,
            1,
            0,
            crate::events::EventType::BehaviorChanged,
            crate::events::EventSeverity::Info,
            7,
        );
        event.flags = crate::tribes::BehaviorState::Migrating as u32 | (6 << 8);
        let mut counts = BTreeMap::new();
        let mut markers = CliRunMarkers::default();

        observe_cli_event(&event, &mut counts, &mut markers);

        assert_eq!(markers.migrations_entered, 1);
    }
}

#[tokio::main]
async fn main() {
    match CliRunConfig::from_args(env::args().skip(1)) {
        Ok(Some(config)) => {
            if let Err(error) = run_cli_validation(config).await {
                eprintln!("NeuroSim CLI run failed: {error}");
                std::process::exit(1);
            }
            return;
        }
        Ok(None) => {}
        Err(error) => {
            eprintln!("{error}");
            eprintln!("{}", CliRunConfig::usage());
            std::process::exit(2);
        }
    }

    // Postgres is optional — we prefer PREMADEGRAPH_URL HTTP fetch.
    let db = match Database::connect().await {
        Ok(db) => {
            if db.uses_postgres() {
                println!("Connected to Postgres");
            } else {
                println!("Postgres disabled; HTTP-only mode");
            }
            db
        }
        Err(e) => {
            println!("Postgres unavailable ({e}), HTTP-only mode");
            Database::dummy()
        }
    };

    let mut initial_config = ControlConfig::default();
    initial_config.world_seed = match live_world_seed_from_env_or_args() {
        Ok(seed) => seed,
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(2);
        }
    };
    println!("NeuroSim live world seed: {}", initial_config.world_seed);

    let simulation = TribeSimulation::shared(initial_config);
    let (frame_tx, _) = broadcast::channel::<Arc<Vec<u8>>>(32);
    let (frame_v1_tx, _) = broadcast::channel::<Arc<Vec<u8>>>(32);
    let state = Arc::new(AppState {
        simulation,
        database: Arc::new(db),
        frame_tx,
        frame_v1_tx,
    });

    tokio::spawn(simulation_loop(state.clone()));
    tokio::spawn(initial_cluster_refresh(state.clone()));

    let app = Router::new()
        .route("/health", get(health))
        .route("/ws/simulation", get(ws_simulation)) // kept for compat
        .route("/ws/tribal-simulation", get(ws_simulation)) // new canonical name
        .route("/ws/desktop/v1/frames", get(ws_desktop_v1_frames))
        .route("/ws/desktop/v2/frames", get(ws_desktop_v2_frames))
        .route("/api/status", get(get_status))
        .route("/api/desktop/v1/status", get(get_status))
        .route("/api/config", get(get_config).post(update_config))
        .route("/api/config/refresh", post(refresh_from_db))
        .route("/api/god-mode", post(god_mode))
        .route("/api/recordings", get(list_recordings))
        .route("/api/recordings/save", post(save_recording))
        .route("/api/recordings/replay", post(replay_recording))
        .route("/api/control/pause", post(control_pause))
        .route("/api/desktop/v1/control/pause", post(control_pause))
        .route("/api/control/resume", post(control_resume))
        .route("/api/desktop/v1/control/resume", post(control_resume))
        .route("/api/control/step-tick", post(control_step_tick))
        .route("/api/desktop/v1/control/step-tick", post(control_step_tick))
        .route("/api/control/reset", post(control_reset))
        .route("/api/desktop/v1/control/reset", post(control_reset))
        .route("/api/control/restart-seed", post(control_restart_seed))
        .route("/api/world-snapshot", get(get_world_snapshot))
        .route("/api/desktop/v1/world-snapshot", get(get_world_snapshot))
        .route("/api/tile-ownership", get(get_tile_ownership))
        .route("/api/tribes/{id}", get(get_tribe_snapshot))
        .route("/api/interventions", post(handle_intervention))
        .route("/api/wars/active", get(get_active_wars))
        .route("/api/events/recent", get(get_recent_events))
        .route("/api/tribes/{id}/events", get(get_tribe_events))
        .route("/api/simulation/summary", get(get_run_summary))
        .route("/api/lineage/resolve/{entity_id}", get(get_lineage_resolve))
        .route("/api/lineage/seed/{entity_id}", get(get_lineage_seed))
        .route("/api/lineage/stats", get(get_lineage_stats))
        .route("/api/tombstones", get(get_tombstones))
        .route("/api/desktop/v1/tombstones", get(get_tombstones))
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    let address = SocketAddr::from(([0, 0, 0, 0], 8000));
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .expect("failed to bind NeuroSim backend");
    println!("NeuroSim backend listening on http://{address}");

    axum::serve(listener, app)
        .await
        .expect("axum server stopped unexpectedly");
}

async fn initial_cluster_refresh(state: Arc<AppState>) {
    for attempt in 1..=30 {
        match state.database.fetch_simulation_config().await {
            Ok(config) if !config.clusters.is_empty() => {
                let cluster_count = config.clusters.len();
                let mut simulation = state.simulation.write();
                simulation.set_clusters(config.clusters);
                simulation.reinitialize();
                println!("Loaded {cluster_count} clusters (attempt {attempt})");
                return;
            }
            Ok(_) => println!("No clusters yet (attempt {attempt}), retrying in 3s..."),
            Err(e) => println!("Cluster fetch failed (attempt {attempt}): {e}, retrying in 3s..."),
        }
        tokio::time::sleep(Duration::from_secs(3)).await;
    }

    println!("No cluster export available after startup retries; running empty simulation");
}

async fn simulation_loop(state: Arc<AppState>) {
    let mut final_frame_sent = false;

    loop {
        // Gate: do not advance simulation when no clients are subscribed.
        // Prevents tick from running up to ~600 before first connect.
        let no_subscribers =
            state.frame_tx.receiver_count() == 0 && state.frame_v1_tx.receiver_count() == 0;
        if no_subscribers {
            tokio::time::sleep(Duration::from_millis(200)).await;
            continue;
        }

        let (packet, packet_v1, tick_rate, idle) = {
            let mut simulation = state.simulation.write();
            let (frame, frame_v1) = if simulation.is_halted() || simulation.is_paused() {
                if final_frame_sent {
                    (simulation.current_packet(), simulation.current_packet_v1())
                } else {
                    final_frame_sent = true;
                    simulation.pack_current_frame();
                    (simulation.current_packet(), simulation.current_packet_v1())
                }
            } else {
                final_frame_sent = false;
                simulation.step();
                (simulation.current_packet(), simulation.current_packet_v1())
            };
            let alive_count = simulation.alive_tribe_count();
            let tick = simulation.simulation_tick();
            let gen = simulation.simulation_generation();
            let tick_rate = simulation.config().tick_rate;
            let wrapped_v1 =
                crate::desktop_protocol::wrap_frame_v1(&frame_v1, tick, gen, alive_count);
            (
                frame,
                wrapped_v1,
                tick_rate,
                simulation.is_halted() || simulation.is_paused(),
            )
        };

        let _ = state.frame_tx.send(Arc::new(packet));
        let _ = state.frame_v1_tx.send(Arc::new(packet_v1));

        let sleep_for = if idle {
            Duration::from_millis(250)
        } else {
            let tick_rate = tick_rate.max(1);
            Duration::from_micros((1_000_000 / tick_rate as u64).max(1))
        };
        tokio::time::sleep(sleep_for).await;
    }
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

async fn get_status(State(state): State<Arc<AppState>>) -> Json<StatusResponse> {
    Json(state.simulation.read().status())
}

async fn get_config(State(state): State<Arc<AppState>>) -> Json<ControlConfig> {
    Json(state.simulation.read().config().clone())
}

async fn update_config(
    State(state): State<Arc<AppState>>,
    Json(patch): Json<ConfigPatch>,
) -> Json<ControlConfig> {
    let mut simulation = state.simulation.write();
    simulation.apply_config_patch(patch);
    Json(simulation.config().clone())
}

async fn refresh_from_db(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ControlConfig>, (StatusCode, String)> {
    match state.database.fetch_simulation_config().await {
        Ok(config) => {
            let mut simulation = state.simulation.write();
            simulation.set_clusters(config.clusters);
            simulation.reinitialize();
            Ok(Json(simulation.config().clone()))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

async fn god_mode(State(state): State<Arc<AppState>>) -> Json<GodModeResponse> {
    let mut simulation = state.simulation.write();
    Json(simulation.kill_half_population())
}

async fn list_recordings(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<RecordingSummary>>, (StatusCode, String)> {
    let simulation = state.simulation.read();
    simulation
        .list_recordings()
        .map(Json)
        .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error))
}

async fn save_recording(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SaveRecordingRequest>,
) -> Result<Json<RecordingSummary>, (StatusCode, String)> {
    let mut simulation = state.simulation.write();
    simulation
        .save_recording(request.name)
        .map(Json)
        .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error))
}

async fn replay_recording(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ReplayRecordingRequest>,
) -> Result<Json<RecordingSummary>, (StatusCode, String)> {
    let mut simulation = state.simulation.write();
    simulation
        .replay_recording(&request.recording_id)
        .map(Json)
        .map_err(|error| (StatusCode::BAD_REQUEST, error))
}

async fn control_pause(State(state): State<Arc<AppState>>) -> Json<ControlResponse> {
    let mut simulation = state.simulation.write();
    simulation.pause();
    Json(ControlResponse {
        ok: true,
        status: simulation.status(),
    })
}

async fn control_resume(State(state): State<Arc<AppState>>) -> Json<ControlResponse> {
    let mut simulation = state.simulation.write();
    simulation.resume();
    Json(ControlResponse {
        ok: true,
        status: simulation.status(),
    })
}

async fn control_step_tick(State(state): State<Arc<AppState>>) -> Json<ControlResponse> {
    let mut simulation = state.simulation.write();
    simulation.step_once_when_paused();
    Json(ControlResponse {
        ok: true,
        status: simulation.status(),
    })
}

async fn control_reset(State(state): State<Arc<AppState>>) -> Json<ControlResponse> {
    let mut simulation = state.simulation.write();
    simulation.reset_same_seed();
    Json(ControlResponse {
        ok: true,
        status: simulation.status(),
    })
}

async fn control_restart_seed(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RestartSeedRequest>,
) -> Json<ControlResponse> {
    println!("[neurosim-control] restart-seed requested seed={}", request.world_seed);
    let mut simulation = state.simulation.write();
    simulation.restart_with_seed(request.world_seed);
    println!(
        "[neurosim-control] restart-seed applied seed={} tick={}",
        request.world_seed,
        simulation.status().tick
    );
    Json(ControlResponse {
        ok: true,
        status: simulation.status(),
    })
}

async fn get_world_snapshot(State(state): State<Arc<AppState>>) -> Json<WorldSnapshotResponse> {
    Json(state.simulation.read().world_snapshot())
}

async fn get_tile_ownership(State(state): State<Arc<AppState>>) -> Json<TileOwnershipResponse> {
    Json(state.simulation.read().tile_ownership_snapshot())
}

async fn get_tribe_snapshot(
    Path(id): Path<usize>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<TribeSnapshotResponse>, (StatusCode, String)> {
    state
        .simulation
        .read()
        .tribe_snapshot(id)
        .map(Json)
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("tribe {id} not found")))
}

async fn get_active_wars(State(state): State<Arc<AppState>>) -> Json<ActiveWarsResponse> {
    Json(state.simulation.read().active_wars_snapshot())
}

async fn handle_intervention(
    State(state): State<Arc<AppState>>,
    Json(request): Json<InterventionRequest>,
) -> Result<Json<InterventionResponse>, (StatusCode, String)> {
    let mut simulation = state.simulation.write();
    simulation
        .apply_intervention(request)
        .map(Json)
        .map_err(|msg| (StatusCode::NOT_IMPLEMENTED, msg))
}

#[derive(serde::Deserialize, Default)]
struct LimitQuery {
    limit: Option<usize>,
}

async fn get_recent_events(
    Query(q): Query<LimitQuery>,
    State(state): State<Arc<AppState>>,
) -> Json<RecentEventsResponse> {
    Json(
        state
            .simulation
            .read()
            .events_response(q.limit.unwrap_or(50)),
    )
}

async fn get_tribe_events(
    Path(id): Path<usize>,
    Query(q): Query<LimitQuery>,
    State(state): State<Arc<AppState>>,
) -> Json<TribeEventsResponse> {
    Json(
        state
            .simulation
            .read()
            .tribe_events_response(id, q.limit.unwrap_or(50)),
    )
}

async fn get_run_summary(State(state): State<Arc<AppState>>) -> Json<RunSummary> {
    Json(state.simulation.read().run_summary())
}

async fn get_lineage_resolve(
    Path(entity_id): Path<u32>,
    State(state): State<Arc<AppState>>,
) -> Json<LineageResolveResponse> {
    Json(state.simulation.read().resolve_lineage(entity_id))
}

async fn get_lineage_seed(
    Path(entity_id): Path<u32>,
    State(state): State<Arc<AppState>>,
) -> Json<LineageSeedResponse> {
    Json(state.simulation.read().lineage_seed(entity_id))
}

async fn get_lineage_stats(State(state): State<Arc<AppState>>) -> Json<LineageStatsResponse> {
    Json(state.simulation.read().lineage_stats())
}

async fn get_tombstones(State(state): State<Arc<AppState>>) -> Json<TombstonesResponse> {
    Json(state.simulation.read().tombstones())
}

async fn ws_simulation(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws_client(socket, state))
}

async fn ws_desktop_v1_frames(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws_desktop_v1_client(socket, state))
}

async fn ws_desktop_v2_frames(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws_desktop_v2_client(socket, state))
}

async fn ws_client(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.frame_tx.subscribe();

    let initial_frame = state.simulation.read().current_packet();
    if sender
        .send(Message::Binary(initial_frame.into()))
        .await
        .is_err()
    {
        return;
    }

    loop {
        tokio::select! {
            frame = rx.recv() => {
                let Ok(frame) = frame else {
                    break;
                };
                if sender.send(Message::Binary(frame.as_ref().clone().into())).await.is_err() {
                    break;
                }
            }
            inbound = receiver.next() => {
                match inbound {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        if sender.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
        }
    }
}

async fn ws_desktop_v1_client(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.frame_tx.subscribe();

    let initial_frame = wrap_tribal_legacy_frame(&state.simulation.read().current_packet());
    if sender
        .send(Message::Binary(initial_frame.into()))
        .await
        .is_err()
    {
        return;
    }

    loop {
        tokio::select! {
            frame = rx.recv() => {
                let Ok(frame) = frame else {
                    break;
                };
                let wrapped = wrap_tribal_legacy_frame(frame.as_ref());
                if sender.send(Message::Binary(wrapped.into())).await.is_err() {
                    break;
                }
            }
            inbound = receiver.next() => {
                match inbound {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        if sender.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
        }
    }
}

async fn ws_desktop_v2_client(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.frame_v1_tx.subscribe();

    // Send initial V1 frame — single lock so payload and envelope tribe count are consistent
    let wrapped_initial = {
        let sim = state.simulation.read();
        let v1_payload = sim.current_packet_v1();
        if !v1_payload.is_empty() {
            Some(wrap_frame_v1(
                &v1_payload,
                sim.simulation_tick(),
                sim.simulation_generation(),
                sim.alive_tribe_count(),
            ))
        } else {
            None
        }
    };
    if let Some(wrapped) = wrapped_initial {
        if sender.send(Message::Binary(wrapped.into())).await.is_err() {
            return;
        }
    }

    loop {
        tokio::select! {
            frame = rx.recv() => {
                let Ok(frame) = frame else { break };
                if sender.send(Message::Binary(frame.as_ref().clone().into())).await.is_err() {
                    break;
                }
            }
            inbound = receiver.next() => {
                match inbound {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        if sender.send(Message::Pong(payload)).await.is_err() { break; }
                    }
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
        }
    }
}
