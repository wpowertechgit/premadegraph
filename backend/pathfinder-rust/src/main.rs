mod engine;
mod models;

use engine::{
    build_graph_state, compare_algorithms, engine_spec_response, export_birdseye_bundle,
    global_view_response, options_response, player_focus_response, run_search,
    signed_balance_analysis,
};
use models::{CompareRequest, PathfinderRequest, SignedBalanceRequest};
use std::env;
use std::io::{self, Read};

fn read_stdin() -> String {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .expect("failed to read stdin");
    input
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let command = args.get(1).map(String::as_str).unwrap_or("spec");
    let mut graph = None;

    let output = match command {
        "options" => serde_json::to_string(&options_response(
            graph.get_or_insert_with(build_graph_state),
        ))
        .unwrap(),
        "global-view" => serde_json::to_string(&global_view_response(
            graph.get_or_insert_with(build_graph_state),
        ))
        .unwrap(),
        "spec" => serde_json::to_string(&engine_spec_response()).unwrap(),
        "run" => {
            let input = read_stdin();
            let request: PathfinderRequest =
                serde_json::from_str(&input).expect("invalid run payload");
            serde_json::to_string(&run_search(
                graph.get_or_insert_with(build_graph_state),
                request,
            ))
            .unwrap()
        }
        "player-focus" => {
            let input = read_stdin();
            let payload: serde_json::Value =
                serde_json::from_str(&input).expect("invalid player focus payload");
            let player_id = payload["playerId"]
                .as_str()
                .expect("player focus payload requires playerId");
            serde_json::to_string(&player_focus_response(
                graph.get_or_insert_with(build_graph_state),
                player_id,
            ))
            .unwrap()
        }
        "compare" => {
            let input = read_stdin();
            let request: CompareRequest =
                serde_json::from_str(&input).expect("invalid compare payload");
            serde_json::to_string(&compare_algorithms(
                graph.get_or_insert_with(build_graph_state),
                request,
            ))
            .unwrap()
        }
        "signed-balance" => {
            let input = read_stdin();
            let request: SignedBalanceRequest = if input.trim().is_empty() {
                serde_json::from_str("{}").expect("failed to build default signed balance request")
            } else {
                serde_json::from_str(&input).expect("invalid signed balance payload")
            };
            serde_json::to_string(&signed_balance_analysis(
                graph.get_or_insert_with(build_graph_state),
                request,
            ))
            .unwrap()
        }
        "birdseye-3d-export" => export_birdseye_bundle().display().to_string(),
        _ => serde_json::to_string(&engine_spec_response()).unwrap(),
    };

    if !output.is_empty() {
        println!("{}", output);
    }
}
