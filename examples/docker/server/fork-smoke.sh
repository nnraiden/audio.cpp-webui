#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-compose.podman.yml}"
SERVICE_NAME="${SERVICE_NAME:-audiocpp-server}"
BASE_URL="${BASE_URL:-http://127.0.0.1:8880}"
VOICE_MODEL_ID="${VOICE_MODEL_ID:-pocket-tts}"
SKIP_BUILD="${SKIP_BUILD:-0}"

detect_compose() {
    if command -v docker >/dev/null 2>&1; then
        echo "docker compose"
        return
    fi
    if command -v podman-compose >/dev/null 2>&1; then
        echo "podman-compose"
        return
    fi
    if command -v podman >/dev/null 2>&1; then
        echo "podman compose"
        return
    fi
    echo "No supported compose command found. Install docker compose or podman-compose." >&2
    exit 1
}

COMPOSE_CMD="$(detect_compose)"

compose() {
    # shellcheck disable=SC2086
    $COMPOSE_CMD -f "$COMPOSE_FILE" "$@"
}

cleanup() {
    compose down >/dev/null 2>&1 || true
}

wait_for_health() {
    local url="$1"
    local timeout="${2:-60}"
    local i
    for ((i = 0; i < timeout; ++i)); do
        if curl -fsS -o /dev/null "${url}/health"; then
            return 0
        fi
        sleep 1
    done
    echo "Server did not become healthy at ${url}/health after ${timeout}s" >&2
    return 1
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="$3"
    if [[ "$haystack" != *"$needle"* ]]; then
        echo "$message" >&2
        exit 1
    fi
}

trap cleanup EXIT

cd "$SCRIPT_DIR"

if [[ "$SKIP_BUILD" != "1" ]]; then
    echo "Building ${SERVICE_NAME} via ${COMPOSE_CMD}..."
    compose build "$SERVICE_NAME"
fi

echo "Starting ${SERVICE_NAME}..."
compose up -d "$SERVICE_NAME"

wait_for_health "$BASE_URL"
echo "Server is healthy."

echo "Checking packaged Web UI files in the container..."
compose exec -T "$SERVICE_NAME" test -f /app/webui/index.html

echo "Checking backend-hosted Web UI root..."
ROOT_HEADERS="$(curl -fsSI "${BASE_URL}/")"
assert_contains "$ROOT_HEADERS" "200" "Web UI root did not return HTTP 200."
assert_contains "$ROOT_HEADERS" "text/html" "Web UI root did not return text/html."

echo "Checking model list..."
MODELS_JSON="$(curl -fsS "${BASE_URL}/v1/models")"
assert_contains "$MODELS_JSON" "\"data\"" "Model list response is missing data[]."

if [[ -n "$VOICE_MODEL_ID" ]]; then
    echo "Checking voice catalog for ${VOICE_MODEL_ID}..."
    VOICES_JSON="$(curl -fsS "${BASE_URL}/v1/audio/voices?model=${VOICE_MODEL_ID}")"
    assert_contains "$VOICES_JSON" "\"voices\"" "Voice catalog response is missing voices[]."
fi

echo "fork smoke test passed"
