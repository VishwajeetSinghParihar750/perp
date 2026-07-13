#!/usr/bin/env bash
# Single-container entrypoint for the free Render web service.
# Runs an in-container Redis plus all three backend services (engine, dbpoller,
# backend) in one process group. If any of them exits, the whole container
# exits non-zero so Render restarts it.
set -euo pipefail

echo "[start] booting perp backend stack..."

# 1. Start in-container Redis (ephemeral cache/stream store).
if [ -z "${REDIS_URL:-}" ] || [ "${REDIS_URL}" = "redis://127.0.0.1:6379" ]; then
  echo "[start] starting local redis-server..."
  redis-server --daemonize yes --save "" --appendonly no
  export REDIS_URL="redis://127.0.0.1:6379"
  # Wait for redis to accept connections.
  for i in $(seq 1 30); do
    if redis-cli ping >/dev/null 2>&1; then
      echo "[start] redis is up"
      break
    fi
    sleep 0.5
  done
else
  echo "[start] using external REDIS_URL"
fi

# 2. Apply database migrations (creates tables + TimescaleDB hypertables/aggregates).
echo "[start] running prisma migrate deploy..."
(cd packages/db && bunx prisma migrate deploy)

# 3. Engine persists snapshots to ./data/snapshots relative to its own cwd.
mkdir -p apps/engine/data/snapshots

# 4. Launch the three services. Each runs from its own directory so relative
#    paths (e.g. engine snapshots) resolve correctly.
pids=()

start_service() {
  local name="$1"; local dir="$2"
  echo "[start] launching ${name}..."
  ( cd "${dir}" && exec bun run start ) &
  pids+=("$!")
}

start_service "engine"   "apps/engine"
start_service "dbpoller" "apps/dbpoller"
start_service "backend"  "apps/backend"

# If any service dies, tear the rest down so the container restarts cleanly.
terminate() {
  echo "[start] shutting down services..."
  for pid in "${pids[@]}"; do
    kill "${pid}" 2>/dev/null || true
  done
}
trap terminate SIGINT SIGTERM

# Wait for the first process to exit, then propagate failure.
wait -n
exit_code=$?
echo "[start] a service exited with code ${exit_code}; stopping container"
terminate
exit "${exit_code}"
