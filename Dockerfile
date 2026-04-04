# TalkCody API Service - Minimal Dockerfile
# Builds only the standalone API server without GUI dependencies

FROM rust:1-slim AS builder
WORKDIR /app

# Install only essential build dependencies (no GUI libraries)
RUN apt-get update && apt-get install -y \
    git \
    pkg-config \
    libssl-dev \
    libsqlite3-dev \
    cmake \
    clang \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace configuration
COPY src-tauri/Cargo.toml ./src-tauri/Cargo.toml
COPY src-tauri/core/Cargo.toml ./src-tauri/core/Cargo.toml
COPY src-tauri/server/Cargo.toml ./src-tauri/server/Cargo.toml

# Copy source files for core and server
COPY src-tauri/core/src ./src-tauri/core/src
COPY src-tauri/server/src ./src-tauri/server/src

# Build the API server
WORKDIR /app/src-tauri
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
ENV CARGO_BUILD_JOBS=2

RUN cargo build -p talkcody-server --release && \
    cp ./target/release/api_service /tmp/api_service

# =============================================================================
# Runtime - Minimal production image (no GUI dependencies)
# =============================================================================
FROM debian:testing-slim AS runtime

# Install only runtime dependencies (no GUI)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash appuser && \
    mkdir -p /data/talkcody /data/workspace && \
    chown -R appuser:appuser /data

# Copy binary
COPY --from=builder /tmp/api_service /usr/local/bin/api_service
RUN chown appuser:appuser /usr/local/bin/api_service

USER appuser

ENV HOST=0.0.0.0
ENV PORT=8080
ENV DATA_ROOT=/data/talkcody
ENV WORKSPACE_ROOT=/data/workspace
ENV RUST_LOG=info

EXPOSE 8080

CMD ["api_service"]
