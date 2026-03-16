mod engine;
mod models;

use engine::{
    build_graph_state, compare_algorithms, engine_spec_response, global_view_response,
    options_response, player_focus_response, run_search,
};
use models::{CompareRequest, PathfinderRequest};
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
    let graph = build_graph_state();
    let args: Vec<String> = env::args().collect();
    let command = args.get(1).map(String::as_str).unwrap_or("spec");

    let output = match command {
        "options" => serde_json::to_string(&options_response(&graph)).unwrap(),
        "global-view" => serde_json::to_string(&global_view_response(&graph)).unwrap(),
        "spec" => serde_json::to_string(&engine_spec_response()).unwrap(),
        "run" => {
            let input = read_stdin();
            let request: PathfinderRequest =
                serde_json::from_str(&input).expect("invalid run payload");
            serde_json::to_string(&run_search(&graph, request)).unwrap()
        }
        "player-focus" => {
            let input = read_stdin();
            let payload: serde_json::Value =
                serde_json::from_str(&input).expect("invalid player focus payload");
            let player_id = payload["playerId"]
                .as_str()
                .expect("player focus payload requires playerId");
            serde_json::to_string(&player_focus_response(&graph, player_id)).unwrap()
        }
        "compare" => {
            let input = read_stdin();
            let request: CompareRequest =
                serde_json::from_str(&input).expect("invalid compare payload");
            serde_json::to_string(&compare_algorithms(&graph, request)).unwrap()
        }
        _ => serde_json::to_string(&engine_spec_response()).unwrap(),
    };

    println!("{}", output);
}
