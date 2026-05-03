# Build stage
FROM rust:1.88-slim-bookworm AS builder

WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
# Pre-build dummy to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src

COPY src ./src
# Build for release
RUN cargo build --release

# Final stage
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/local/bin
COPY --from=builder /usr/src/app/target/release/neurosim-backend .

# Recordings directory
RUN mkdir recordings

EXPOSE 8000
CMD ["./neurosim-backend"]
