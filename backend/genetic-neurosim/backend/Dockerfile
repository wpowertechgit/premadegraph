# Build stage
FROM rust:1.88-slim-bookworm AS builder

WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY src ./src

# Build the real source directly. The old dummy-main cache step could leave a
# valid no-op neurosim-backend binary in the image, causing code-0 restart loops.
RUN cargo build --release --locked

# Final stage
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/local/bin
COPY --from=builder /usr/src/app/target/release/neurosim-backend .

# Recordings directory
RUN mkdir recordings

EXPOSE 8000
CMD ["./neurosim-backend"]
