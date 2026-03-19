#!/bin/sh
set -eu

echo "Ensuring Rust pathfinder binary is built..."
cargo build --release --manifest-path /app/pathfinder-rust/Cargo.toml

export PATHFINDER_RUST_BIN=/app/pathfinder-rust/target/release/pathfinder_rust

echo "Starting backend server..."
exec node /app/server.js
