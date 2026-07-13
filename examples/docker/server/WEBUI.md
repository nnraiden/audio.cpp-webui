# Web UI

This Web UI lives under `examples/docker/server/webui/`, but `audiocpp_server` can also serve it directly when `webui_root` is configured.

Location:

- `examples/docker/server/webui/`

Recommended mode is backend-hosted: the browser loads the UI from the same origin as `audiocpp_server`, so there is no separate proxy hop and no CORS issue.

## Integrated Run

For the container examples, set `"webui_root": "/app/webui"` in `server.json` and start the backend:

```bash
docker compose -f compose.podman.yml up
```

That exposes both the API and the Web UI at `http://127.0.0.1:8880`.

Open:

```text
http://127.0.0.1:8880
```

Expose it to your LAN by publishing the backend port and binding the server to `0.0.0.0` in `server.json`.

## Standalone Run

If you still want to run the Web UI by itself:

```bash
cd webui
npm start
```

Lint the Web UI:

```bash
cd webui
npm run lint
```

The lint script uses `npx` to run ESLint with the checked-in `eslint.config.js`, so no separate frontend build step is required for this example app.

Defaults:

- Web UI: `http://127.0.0.1:3000`
- Proxied backend: `http://127.0.0.1:8880`

Override host, port, or backend origin manually:

```bash
WEBUI_HOST=0.0.0.0 WEBUI_PORT=3000 AUDIOCPP_API_ORIGIN=http://127.0.0.1:8080 npm start
```

Then open it from another machine using your host machine's LAN IP, for example:

```text
http://192.168.1.50:3000
```

## Current v1 Scope

- Fetch models from `GET /v1/models`
- Switch between TTS and ASR models based on the server-reported task
- For TTS models, submit text to `POST /v1/audio/speech`
- For TTS models, populate family-specific voice controls from `GET /v1/audio/voices?model=<id>`
- For `pocket_tts`, choose either a built-in/cached `voice`, a shared WAV sample from `samples[]`, or a locally uploaded WAV for clone mode
- For multi-speaker TTS families such as `vibevoice`, choose each speaker row from shared WAV `samples[]`, preset-backed `voice_presets`, or a local upload, then submit ordered `voice_samples` through `POST /v1/audio/speech`
- For ASR models, upload WAV audio to `POST /v1/audio/transcriptions`

Non-goals:

- No sidecar container
