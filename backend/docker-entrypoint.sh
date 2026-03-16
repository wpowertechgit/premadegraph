#!/bin/sh
set -eu

echo "Ensuring Rust pathfinder binary is built..."
cargo build --manifest-path /app/pathfinder-rust/Cargo.toml

echo "Starting backend server..."
exec node /app/server.js
