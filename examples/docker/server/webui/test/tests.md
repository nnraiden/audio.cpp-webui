# Web UI Tests

This folder contains the Web UI smoke test plus focused JS coverage for family-specific form logic.

## What It Covers

`smoke.cjs` verifies two startup behaviors:

- `npm start` can launch the Web UI on a free local port
- the server serves `GET /`
- startup fails cleanly when the target port is already in use

`ttsFamilies.test.js` verifies TTS-family rendering and request serialization paths, including OmniVoice clone and voice-design behavior.

`genFamilies.test.js` verifies the music-generation family path for `task: "gen"` models, starting with ACE-Step route rendering, validation, and request serialization.

Together these checks cover startup plus the modular TTS-family request builder without inflating server smoke coverage.

## Run It

From `examples/docker/server/webui/`:

```bash
npm test
```

This runs:

```bash
node test/smoke.cjs
node --experimental-default-type=module test/ttsFamilies.test.js
node --experimental-default-type=module test/genFamilies.test.js
```

## Requirements

- `node`
- `npm`
- permission to bind local loopback ports on `127.0.0.1`

The smoke test chooses free ephemeral ports automatically. It does not rely on port `3000`.

## What Failure Looks Like

If startup works, the test exits successfully and prints:

```text
webui smoke test passed
```

If the port is already occupied, the Web UI is expected to exit non-zero and print a clear message like:

```text
Web UI failed to bind 127.0.0.1:<port> because the address is already in use.
```

## Related Checks

- `npm start`: manual launch
- `npm run lint`: frontend linting
- `node --check server.js`: quick syntax check for the Node entrypoint
- [../FORK_TESTS.md](/secondary/docker/audio.cpp/examples/docker/server/FORK_TESTS.md): full fork acceptance workflow, including Docker smoke
