# Pathfinder Backend Prototype

## Document Role

This document captures the earlier backend-migration stage and serves as historical context for the later Rust runtime architecture.

## Related Documents

- [Unified Cluster Persistence And Exact A*](unified-cluster-persistence-and-astar.md)
- [Bird's-Eye 3D Sphere](birdseye-3d-sphere.md)
- [Signed Balance Theory And Implementation](signed-balance-theory.md)
- [New GUI Overview](new-gui-overview.md)

## Purpose

This prototype keeps the existing frontend demo intact while adding an optional backend execution path for:

- request and response contract validation
- signed graph search execution
- future migration planning to a faster engine runtime

## Prototype Endpoints

- `GET /api/pathfinder/options`
- `GET /api/pathfinder/engine-spec`
- `POST /api/pathfinder/run`
- `POST /api/pathfinder/compare`
- `GET /api/pathfinder-rust/options`
- `GET /api/pathfinder-rust/engine-spec`
- `POST /api/pathfinder-rust/run`
- `POST /api/pathfinder-rust/compare`

## Signed Graph Model

Each player pair is modeled as a relation record with:

- `allyWeight`
- `enemyWeight`
- `totalMatches`
- `dominantRelation`

Traversal rules:

- `social-path`: only ally edges
- `battle-path`: ally and enemy edges

## Why Backend First

The real graph size makes the browser the wrong place for the search core. The frontend should only:

- send the search request
- receive path, stats, trace, and a reduced graph snapshot
- replay the trace visually

## Migration Path

### Rust

1. Move the signed graph and algorithms into a Rust crate.
2. Keep the Node server as the API shell.
3. Preserve the current JSON response contract so the frontend does not need a rewrite.

Current prototype files:

- `backend/pathfinder-rust/Cargo.toml`
- `backend/pathfinder-rust/src/main.rs`
- `backend/pathfinder-rust/src/engine.rs`
- `backend/pathfinder-rust/src/models.rs`
- `backend/pathfinder/rustBridge.js`

Binary discovery:

- set `PATHFINDER_RUST_BIN`, or
- build the crate so one of these exists:
  - `backend/pathfinder-rust/target/release/pathfinder_rust(.exe)`
  - `backend/pathfinder-rust/target/debug/pathfinder_rust(.exe)`

## Conclusions

The main conclusion of the prototype phase was that the search core belonged on the backend, and eventually in Rust, while the frontend should preserve a stable response contract.
