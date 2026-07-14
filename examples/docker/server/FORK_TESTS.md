# Fork Tests

This fork keeps a small acceptance suite for the behaviors that differ from upstream `audio.cpp`: backend-hosted Web UI, shared voice sample discovery, standalone Web UI startup, and Docker packaging of the integrated UI.

Run this suite after:

- merging or rebasing from upstream
- changing `app/server/`
- changing `.devops/`
- changing `examples/docker/server/`

## Source-Level Checks

Build and run the backend tests that cover the fork-specific server behavior:

```bash
cmake -S . -B build
cmake --build build --parallel --target server_config_test server_runtime_test
ctest --test-dir build -R 'server_(config|runtime)_test' --output-on-failure
```

These verify:

- top-level `webui_root`
- top-level `voice_samples_base`
- backend-hosted `/`
- static asset serving and SPA fallback
- `GET /v1/audio/voices` returning `presets[]` and shared `samples[]`

## Standalone Web UI Check

From `examples/docker/server/webui/`:

```bash
npm test
```

This verifies the manual standalone path still starts with `npm start`, serves `/`, and fails clearly on port conflicts.

## Docker Smoke Check

From `examples/docker/server/`:

```bash
bash fork-smoke.sh
```

Defaults:

- compose file: `compose.podman.yml`
- service: `audiocpp-server`
- base URL: `http://127.0.0.1:8880`
- voice model probe: `pocket-tts`

Useful overrides:

```bash
COMPOSE_FILE=cuda-server.yml BASE_URL=http://127.0.0.1:8080 bash fork-smoke.sh
SKIP_BUILD=1 bash fork-smoke.sh
VOICE_MODEL_ID=vibevoice_1.5b bash fork-smoke.sh
VOICE_MODEL_ID= bash fork-smoke.sh
```

The Docker smoke test verifies:

- the image still builds with the current `.dockerignore`
- the runtime container contains `/app/webui/index.html`
- `GET /health` succeeds
- `GET /` serves HTML from the backend-hosted UI path
- `GET /v1/models` succeeds
- `GET /v1/audio/voices?model=<id>` still returns JSON when a probe model is configured

## Config Files

`server.json.example` is tracked in git. Copy it to `server.personal.json`
for your own config (gitignored). Update your compose to mount
`./server.personal.json:/app/server.json:ro,Z` instead of
`./server.json:/app/server.json:ro,Z` to avoid conflicts when upstream
deletes or changes their `server.json`.

## Failure Hints

- C++ test failures usually mean backend config or route behavior drifted.
- `npm test` failures usually mean standalone Web UI startup or routing drifted.
- `fork-smoke.sh` failures usually mean Docker packaging, compose wiring, mounted config, or backend-hosted UI integration drifted.
