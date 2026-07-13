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
      "path": "/models/vibevoice/1.5B/voices/speaker_a.wav"
    }
  ]
}
```

Field meanings:

- `voices`: flat list for generic voice selectors and backward compatibility
- `presets`: configured `voice_presets` with enough metadata to resolve `voice_id` or `voice_ref`
- `samples`: discovered `.wav` sample files for families that consume raw reference WAVs

Backend aggregation rules:

- `voice_presets` from `server.json` become `voices[]` and `presets[]`
- model-native cached voices such as `model_root/embeddings/*.safetensors` become `voices[]`
- `voice_samples_base` becomes `samples[]`

## Web UI Voice Selection Rules

The frontend normalizes backend and fallback metadata into one catalog provider, then lets each TTS family choose its own UI and serializer rules:

- generic families use `voices[]` and send JSON with the OpenAI-style `voice` field
- `pocket_tts` offers either built-in/cached `voices[]` or a local uploaded WAV sent as multipart `voice_ref`
- `vibevoice` renders an ordered speaker list and sources each row from either `samples[]`, `presets[].voice_ref`, or a local uploaded WAV; the request serializer sends those entries through ordered `voice_samples`

If the backend only returns the legacy flat shape:

```json
{ "voices": ["scarlett", "ashley_johnson"] }
```

the web UI fallback route `GET /__webui/voice-catalog?model=<id>` reads `examples/docker/server/server.json` and reconstructs:

- `presets[]` from configured `voice_presets`
- `samples[]` from `voice_samples_base`, if configured

This keeps the browser code simple while still allowing the separate web UI to work against older backend builds that do not yet expose structured voice metadata.

## Config Expectations

For families that use named built-in or cached voices, no extra config is required beyond the model path and any optional `voice_presets`.

For families that use raw reference WAV libraries, configure one of:

- `voice_presets` with `voice_ref` entries
- `voice_samples_base` pointing at a directory of `.wav` files

Example:

```json
{
  "id": "vibevoice_1.5b",
  "family": "vibevoice",
  "path": "/models/vibevoice/1.5B",
  "task": "tts",
  "mode": "offline",
  "voice_samples_base": "/models/vibevoice/1.5B/voices",
  "voice_presets": {
    "scarlett": {
      "voice_ref": "/models/vibevoice/1.5B/voices/scarlett.wav"
    }
  }
}
```

## Failure Modes

Common failure patterns:

- Calling `/v1/...` on the web UI port instead of `/api/v1/...`
- Running an older `audiocpp_server` build that still returns only `voices[]`
- Selecting `vibevoice` when neither `voice_presets.voice_ref` nor `voice_samples_base` is available
- Serving the web UI without access to the intended `server.json`, which disables the fallback catalog enrichment
