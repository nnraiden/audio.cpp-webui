# Web UI

This Web UI is a separate mini-project for testing `audiocpp_server` from a browser, with minimal backend support added where the UI needs structured model metadata.

Location:

- `examples/docker/server/webui/`

The UI serves its own frontend locally and proxies browser API requests to the configured audio.cpp backend, so the browser does not call the backend cross-origin directly.

## Run

Start the audio.cpp backend first. For your Podman compose setup:

```bash
docker compose -f compose.podman.yml up
```

That exposes the backend at `http://127.0.0.1:8880`.

Start the Web UI separately:

```bash
cd webui
npm start
```

Defaults:

- Web UI: `http://127.0.0.1:3000`
- Proxied backend: `http://127.0.0.1:8880`

Override the backend origin if needed:

```bash
AUDIOCPP_API_ORIGIN=http://127.0.0.1:8080 npm start
```

Expose the Web UI to your LAN:

```bash
WEBUI_HOST=0.0.0.0 npm start
```

Or with an explicit port:

```bash
WEBUI_HOST=0.0.0.0 WEBUI_PORT=3000 npm start
```

Then open it from another machine using your host machine's LAN IP, for example:

```text
http://192.168.1.50:3000
```

## Current v1 Scope

- Fetch models from `GET /v1/models`
- Switch between TTS and ASR models based on the server-reported task
- For TTS models, submit text to `POST /v1/audio/speech`
- For TTS models, populate the voice picker from `GET /v1/audio/voices?model=<id>`
- For multi-speaker TTS families such as `vibevoice`, submit `voice_samples` through `POST /v1/audio/speech`
- For ASR models, upload WAV audio to `POST /v1/audio/transcriptions`

Non-goals:

- No browser-side voice cloning flow
- No sidecar container
