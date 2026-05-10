mod simulation;
mod db;
mod desktop_protocol;
mod frame_v1;
pub mod world;
pub mod tribes;
pub mod events;
pub mod war;
pub mod lineage_registry;
pub mod tombstone;

use std::{net::SocketAddr, sync::Arc, time::Duration};

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
use futures::{SinkExt, StreamExt};
use serde::Serialize;
use simulation::{
    ConfigPatch, ControlConfig, ControlResponse, GodModeResponse, InterventionRequest,
    InterventionResponse, RecordingSummary, ReplayRecordingRequest, RestartSeedRequest,
    SaveRecordingRequest, SharedSimulation, TribeSimulation, StatusResponse,
    TribeSnapshotResponse, WorldSnapshotResponse, TileOwnershipResponse,
    RecentEventsResponse, TribeEventsResponse, RunSummary,
    LineageResolveResponse, LineageSeedResponse, LineageStatsResponse,
    TombstonesResponse,
};
use war::ActiveWarsResponse;
use db::Database;
use desktop_protocol::{wrap_tribal_legacy_frame, wrap_frame_v1};
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};

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

#[tokio::main]
async fn main() {
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

    let simulation = TribeSimulation::shared(ControlConfig::default());
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
        .route("/ws/simulation", get(ws_simulation))           // kept for compat
        .route("/ws/tribal-simulation", get(ws_simulation))    // new canonical name
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
        .route("/api/control/restart-seed", post(control_restart_seed))
        .route("/api/world-snapshot", get(get_world_snapshot))
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
        let no_subscribers = state.frame_tx.receiver_count() == 0
            && state.frame_v1_tx.receiver_count() == 0;
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
            let wrapped_v1 = crate::desktop_protocol::wrap_frame_v1(&frame_v1, tick, gen, alive_count);
            (frame, wrapped_v1, tick_rate, simulation.is_halted() || simulation.is_paused())
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

async fn refresh_from_db(State(state): State<Arc<AppState>>) -> Result<Json<ControlConfig>, (StatusCode, String)> {
    match state.database.fetch_simulation_config().await {
        Ok(config) => {
            let mut simulation = state.simulation.write();
            simulation.set_clusters(config.clusters);
            simulation.reinitialize();
            Ok(Json(simulation.config().clone()))
        },
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
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
    Json(ControlResponse { ok: true, status: simulation.status() })
}

async fn control_resume(State(state): State<Arc<AppState>>) -> Json<ControlResponse> {
    let mut simulation = state.simulation.write();
    simulation.resume();
    Json(ControlResponse { ok: true, status: simulation.status() })
}

async fn control_step_tick(State(state): State<Arc<AppState>>) -> Json<ControlResponse> {
    let mut simulation = state.simulation.write();
    simulation.step_once_when_paused();
    Json(ControlResponse { ok: true, status: simulation.status() })
}

async fn control_reset(State(state): State<Arc<AppState>>) -> Json<ControlResponse> {
    let mut simulation = state.simulation.write();
    simulation.reset_same_seed();
    Json(ControlResponse { ok: true, status: simulation.status() })
}

async fn control_restart_seed(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RestartSeedRequest>,
) -> Json<ControlResponse> {
    let mut simulation = state.simulation.write();
    simulation.restart_with_seed(request.world_seed);
    Json(ControlResponse { ok: true, status: simulation.status() })
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
    Json(state.simulation.read().events_response(q.limit.unwrap_or(50)))
}

async fn get_tribe_events(
    Path(id): Path<usize>,
    Query(q): Query<LimitQuery>,
    State(state): State<Arc<AppState>>,
) -> Json<TribeEventsResponse> {
    Json(state.simulation.read().tribe_events_response(id, q.limit.unwrap_or(50)))
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

async fn get_lineage_stats(
    State(state): State<Arc<AppState>>,
) -> Json<LineageStatsResponse> {
    Json(state.simulation.read().lineage_stats())
}

async fn get_tombstones(
    State(state): State<Arc<AppState>>,
) -> Json<TombstonesResponse> {
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

    // Send initial V1 frame
    let v1_payload = state.simulation.read().current_packet_v1();
    let wrapped_initial = if !v1_payload.is_empty() {
        let (tick, gen, alive) = {
            let sim = state.simulation.read();
            (sim.simulation_tick(), sim.simulation_generation(), sim.alive_tribe_count())
        };
        Some(wrap_frame_v1(&v1_payload, tick, gen, alive))
    } else {
        None
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
