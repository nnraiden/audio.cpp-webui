# audio.cpp Web UI

This is a separate project for testing `audiocpp_server` from a browser without modifying `audio.cpp` itself.

It works by serving the frontend locally and proxying browser API requests to the configured audio.cpp backend, so the browser never makes a cross-origin request directly to `:8880`.

## Run

From this directory:

```bash
npm start
```

Defaults:

- Web UI: `http://127.0.0.1:3000`
- audio.cpp backend: `http://127.0.0.1:8880`

Override them with environment variables:

```bash
WEBUI_PORT=3001 AUDIOCPP_API_ORIGIN=http://127.0.0.1:8080 npm start
```

Use environment variables only. Do not pass `--host` to `npm start`; this project’s Node server does not parse CLI flags for host or port.
