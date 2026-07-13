# Web UI And Backend Contract

This note describes how the example web UI under `examples/docker/server/webui/` talks to `audiocpp_server`, which endpoints are browser-facing, and how voice catalogs are populated for different TTS families.

## Transport Model

The web UI is not served by `audiocpp_server` directly. A small Node server serves the static frontend and proxies browser API requests to the audio.cpp backend.

Browser-visible routes on the web UI server:

| Route | Purpose |
|---|---|
| `GET /` | Serves the web UI HTML. |
| `GET /api/*` | Proxies requests to the configured `AUDIOCPP_API_ORIGIN`. |
| `GET /__webui/config` | Returns the proxy target origin for diagnostics. |
| `GET /__webui/voice-catalog?model=<id>` | Web UI fallback metadata derived from `server.json`. |

This means:

- `http://<webui-host>:<webui-port>/api/v1/models` reaches `audiocpp_server`
- `http://<webui-host>:<webui-port>/v1/models` does not; it is a web UI route and falls back to the app shell

## Development

The example web UI is a small Node-served app under `examples/docker/server/webui/`.

- Start it with `npm start`
- Lint it with `npm run lint`

`npm run lint` uses the checked-in `eslint.config.js` plus `npx eslint@9`, so the example does not need a separate bundler or build pipeline.

## Runtime API Usage

The frontend currently relies on these proxied backend routes:

| Route | Used for |
|---|---|
| `GET /api/health` | Backend readiness and configured model count |
| `GET /api/v1/models` | Available model ids and family metadata |
| `GET /api/v1/audio/voices?model=<id>` | Voice catalog for the active TTS model |
| `POST /api/v1/audio/speech` | TTS requests, as JSON or multipart uploads |
| `POST /api/v1/audio/transcriptions` | ASR requests |

## Voice Catalog Contract

`GET /v1/audio/voices?model=<id>` is an audio.cpp extension used by the web UI to populate voice pickers. It is not part of the OpenAI API.

The normalized response shape is:

```json
{
  "voices": ["alba", "cosette", "speaker_a"],
  "presets": [
    {
      "id": "speaker_a",
      "voice_id": null,
      "voice_ref": "/models/vibevoice/1.5B/voices/speaker_a.wav",
      "reference_text": null,
      "is_default": false
    }
  ],
  "samples": [
    {
      "id": "speaker_a",
      "path": "/models/voices/speaker_a.wav"
    }
  ]
}
```

Field meanings:

- `voices`: flat list for generic voice selectors and backward compatibility
- `presets`: configured `voice_presets` with enough metadata to resolve `voice_id` or `voice_ref`
- `samples`: discovered shared `.wav` sample files from top-level `voice_samples_base`

Backend aggregation rules:

- `voice_presets` from `server.json` become `voices[]` and `presets[]`
- model-native cached voices such as `model_root/embeddings/*.safetensors` become `voices[]`
- top-level `voice_samples_base` becomes `samples[]`

## Web UI Voice Selection Rules

The frontend normalizes backend and fallback metadata into one catalog provider, then lets each TTS family choose its own UI and serializer rules:

- generic families use `voices[]` and send JSON with the OpenAI-style `voice` field
- `pocket_tts` offers either built-in/cached `voices[]` or clone mode with either `samples[]` or a local uploaded WAV sent as `voice_ref`
- `vibevoice` renders an ordered speaker list and keeps shared `samples[]`, preset-backed `presets[].voice_ref`, and local uploaded WAVs as separate row sources; the request serializer sends those entries through ordered `voice_samples`
- families that do not consume raw WAV clone references ignore `samples[]`

If the backend only returns the legacy flat shape:

```json
{ "voices": ["scarlett", "ashley_johnson"] }
```

the web UI fallback route `GET /__webui/voice-catalog?model=<id>` reads `examples/docker/server/server.json` and reconstructs:

- `presets[]` from configured `voice_presets`
- `samples[]` from top-level `voice_samples_base`, if configured

This keeps the browser code simple while still allowing the separate web UI to work against older backend builds that do not yet expose structured voice metadata.

## Config Expectations

For families that use named built-in or cached voices, no extra config is required beyond the model path and any optional `voice_presets`.

For families that use raw reference WAV libraries, configure one of:

- `voice_presets` with `voice_ref` entries
- top-level `voice_samples_base` pointing at a directory of `.wav` files

Example:

```json
{
  "voice_samples_base": "/models/voices",
  "models": [
    {
      "id": "vibevoice_1.5b",
      "family": "vibevoice",
      "path": "/models/vibevoice/1.5B",
      "task": "tts",
      "mode": "offline",
      "voice_presets": {
        "scarlett": {
          "voice_ref": "/models/voices/scarlett.wav"
        }
      }
    }
  ]
}
```

## Failure Modes

Common failure patterns:

- Calling `/v1/...` on the web UI port instead of `/api/v1/...`
- Running an older `audiocpp_server` build that still returns only `voices[]`
- Selecting `vibevoice` when neither `voice_presets.voice_ref` nor top-level `voice_samples_base` is available
- Expecting `npm run build`; this example web UI is served directly by Node and currently ships with `npm start` and `npm run lint`, but no separate build step
- Serving the web UI without access to the intended `server.json`, which disables the fallback catalog enrichment
