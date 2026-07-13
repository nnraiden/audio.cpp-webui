# audio.cpp Web UI

This is the frontend source for the `audiocpp_server` Web UI.

Recommended usage is to let `audiocpp_server` serve these files directly through `webui_root`. Standalone `npm start` is still available for manual local use.

## Run

From this directory:

```bash
npm start
```

Standalone defaults:

```bash
WEBUI_HOST=127.0.0.1 WEBUI_PORT=3000 AUDIOCPP_API_ORIGIN=http://127.0.0.1:8880 npm start
```

Use environment variables only. Do not pass `--host` to `npm start`; this project’s Node server does not parse CLI flags for host or port.
