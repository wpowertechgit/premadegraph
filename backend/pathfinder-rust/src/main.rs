mod engine;
mod models;

use engine::{
    apply_runtime_breakdown, assortativity_analysis, assortativity_significance_analysis,
    betweenness_centrality_analysis, build_graph_state, compare_algorithms, engine_spec_response,
    export_birdseye_bundle, export_graph_v2_bundle, global_view_response, options_response,
    player_focus_response, run_search, signed_balance_analysis,
    signed_balance_sensitivity_analysis,
};
use models::{
    AssortativityRequest, AssortativitySignificanceRequest, BetweennessCentralityRequest,
    CompareRequest, PathfinderRequest, SignedBalanceRequest, SignedBalanceSweepRequest,
};
use serde::{Deserialize, Serialize};
use std::env;
use std::io::{self, BufRead, Read, Write};
use std::time::Instant;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ServeEnvelope {
    id: u64,
    command: String,
    #[serde(default)]
    payload: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ServeResponseEnvelope {
    id: u64,
    ok: bool,
    result: Option<serde_json::Value>,
    error: Option<String>,
}

fn read_stdin() -> String {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .expect("failed to read stdin");
    input
}

fn ensure_graph<'a>(
    graph: &'a mut Option<engine::GraphState>,
    graph_build_ms: &mut f64,
) -> &'a engine::GraphState {
    if graph.is_none() {
        let started_at = Instant::now();
        *graph = Some(build_graph_state());
        *graph_build_ms = started_at.elapsed().as_secs_f64() * 1000.0;
    } else {
        *graph_build_ms = 0.0;
    }

    graph.as_ref().expect("graph state should be initialized")
}

fn execute_command(
    command: &str,
    payload: Option<&str>,
    graph: &mut Option<engine::GraphState>,
) -> Result<String, String> {
    let command_started_at = Instant::now();
    let mut graph_build_ms = 0.0;

    match command {
        "options" => {
            serde_json::to_string(&options_response(ensure_graph(graph, &mut graph_build_ms)))
                .map_err(|error| error.to_string())
        }
        "global-view" => serde_json::to_string(&global_view_response(ensure_graph(
            graph,
            &mut graph_build_ms,
        )))
        .map_err(|error| error.to_string()),
        "spec" => serde_json::to_string(&engine_spec_response()).map_err(|error| error.to_string()),
        "run" => {
            let input = payload.unwrap_or_default();
            let request: PathfinderRequest = serde_json::from_str(input)
                .map_err(|error| format!("invalid run payload: {error}"))?;
            let graph_state = ensure_graph(graph, &mut graph_build_ms);
            let mut response = run_search(graph_state, request);
            apply_runtime_breakdown(
                &mut response,
                graph_build_ms,
                command_started_at.elapsed().as_secs_f64() * 1000.0,
            );
            serde_json::to_string(&response).map_err(|error| error.to_string())
        }
        "player-focus" => {
            let input = payload.unwrap_or_default();
            let parsed: serde_json::Value = serde_json::from_str(input)
                .map_err(|error| format!("invalid player focus payload: {error}"))?;
            let player_id = parsed["playerId"]
                .as_str()
                .ok_or_else(|| "player focus payload requires playerId".to_string())?;
            serde_json::to_string(&player_focus_response(
                ensure_graph(graph, &mut graph_build_ms),
                player_id,
            ))
            .map_err(|error| error.to_string())
        }
        "compare" => {
            let input = payload.unwrap_or_default();
            let request: CompareRequest = serde_json::from_str(input)
                .map_err(|error| format!("invalid compare payload: {error}"))?;
            serde_json::to_string(&compare_algorithms(
                ensure_graph(graph, &mut graph_build_ms),
                request,
            ))
            .map_err(|error| error.to_string())
        }
        "signed-balance" => {
            let input = payload.unwrap_or_default();
            let request: SignedBalanceRequest = if input.trim().is_empty() {
                serde_json::from_str("{}").map_err(|error| {
                    format!("failed to build default signed balance request: {error}")
                })?
            } else {
                serde_json::from_str(input)
                    .map_err(|error| format!("invalid signed balance payload: {error}"))?
            };
            serde_json::to_string(&signed_balance_analysis(
                ensure_graph(graph, &mut graph_build_ms),
                request,
            ))
            .map_err(|error| error.to_string())
        }
        "assortativity" => {
            let input = payload.unwrap_or_default();
            let request: AssortativityRequest = if input.trim().is_empty() {
                serde_json::from_str("{}").map_err(|error| {
                    format!("failed to build default assortativity request: {error}")
                })?
            } else {
                serde_json::from_str(input)
                    .map_err(|error| format!("invalid assortativity payload: {error}"))?
            };
            serde_json::to_string(&assortativity_analysis(
                ensure_graph(graph, &mut graph_build_ms),
                request,
            ))
            .map_err(|error| error.to_string())
        }
        "balance-sweep" => {
            let input = payload.unwrap_or_default();
            let request: SignedBalanceSweepRequest = if input.trim().is_empty() {
                serde_json::from_str("{}").map_err(|error| {
                    format!("failed to build default balance sweep request: {error}")
                })?
            } else {
                serde_json::from_str(input)
                    .map_err(|error| format!("invalid balance sweep payload: {error}"))?
            };
            serde_json::to_string(&signed_balance_sensitivity_analysis(
                ensure_graph(graph, &mut graph_build_ms),
                request,
            ))
            .map_err(|error| error.to_string())
        }
        "assortativity-significance" => {
            let input = payload.unwrap_or_default();
            let request: AssortativitySignificanceRequest = if input.trim().is_empty() {
                serde_json::from_str("{}").map_err(|error| {
                    format!("failed to build default assortativity significance request: {error}")
                })?
            } else {
                serde_json::from_str(input).map_err(|error| {
                    format!("invalid assortativity significance payload: {error}")
                })?
            };
            serde_json::to_string(&assortativity_significance_analysis(
                ensure_graph(graph, &mut graph_build_ms),
                request,
            ))
            .map_err(|error| error.to_string())
        }
        "betweenness-centrality" => {
            let input = payload.unwrap_or_default();
            let request: BetweennessCentralityRequest = if input.trim().is_empty() {
                serde_json::from_str("{}").map_err(|error| {
                    format!("failed to build default betweenness centrality request: {error}")
                })?
            } else {
                serde_json::from_str(input)
                    .map_err(|error| format!("invalid betweenness centrality payload: {error}"))?
            };
            serde_json::to_string(&betweenness_centrality_analysis(
                ensure_graph(graph, &mut graph_build_ms),
                request,
            ))
            .map_err(|error| error.to_string())
        }
        "birdseye-3d-export" => Ok(export_birdseye_bundle().display().to_string()),
        "graph-v2-export" => Ok(export_graph_v2_bundle().display().to_string()),
        _ => serde_json::to_string(&engine_spec_response()).map_err(|error| error.to_string()),
    }
}

fn run_server() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = io::BufReader::new(stdin.lock());
    let mut writer = io::BufWriter::new(stdout.lock());
    let mut graph = None;
    let mut line = String::new();

    loop {
        line.clear();
        let read = reader
            .read_line(&mut line)
            .expect("failed to read serve input");
        if read == 0 {
            break;
        }
        if line.trim().is_empty() {
            continue;
        }

        let envelope: Result<ServeEnvelope, _> = serde_json::from_str(line.trim_end());
        let response = match envelope {
            Ok(request) => match execute_command(
                &request.command,
                Some(&request.payload.to_string()),
                &mut graph,
            ) {
                Ok(output) => ServeResponseEnvelope {
                    id: request.id,
                    ok: true,
                    result: serde_json::from_str(&output)
                        .ok()
                        .or_else(|| Some(serde_json::Value::String(output))),
                    error: None,
                },
                Err(error) => ServeResponseEnvelope {
                    id: request.id,
                    ok: false,
                    result: None,
                    error: Some(error),
                },
            },
            Err(error) => ServeResponseEnvelope {
                id: 0,
                ok: false,
                result: None,
                error: Some(format!("invalid serve envelope: {error}")),
            },
        };

        let encoded = serde_json::to_string(&response).expect("failed to encode serve response");
        writeln!(writer, "{encoded}").expect("failed to write serve output");
        writer.flush().expect("failed to flush serve output");
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let command = args.get(1).map(String::as_str).unwrap_or("spec");
    if command == "serve" {
        run_server();
        return;
    }

    let mut graph = None;
    eprintln!("[pathfinder_rust] command={} started", command);
    let input = match command {
        "run"
        | "player-focus"
        | "compare"
        | "signed-balance"
        | "assortativity"
        | "balance-sweep"
        | "assortativity-significance"
        | "betweenness-centrality" => read_stdin(),
        _ => String::new(),
    };
    let output = execute_command(command, Some(&input), &mut graph).expect("command failed");

    eprintln!("[pathfinder_rust] command={} finished", command);
    if !output.is_empty() {
        println!("{}", output);
    }
}
