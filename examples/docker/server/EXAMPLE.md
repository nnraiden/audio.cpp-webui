# Docker Compose Server

Run the audio.cpp server (as configured in `server.json`) in Docker. If `webui_root` is set, the same container also serves the Web UI.

## Setup

**1. Download the PocketTTS model**

Get the English model from [kyutai/pocket-tts](https://huggingface.co/kyutai/pocket-tts/) on Hugging Face.
Place the files from `languages/english/` into `../models/pocket-tts/languages/english/`:

The directory should look like:
```
../models/pocket-tts/languages/english/
├── model.safetensors
├── tokenizer.model
└── embeddings/
    ├── alba.safetensors
    └── ...
```

**2. Start the server**

CPU:

```bash
docker compose -f cpu-server.yml up
```

GPU (CUDA):

```bash
docker compose -f cuda-server.yml up
```

If `server.json` contains `"webui_root": "/app/webui"`, open `http://localhost:8080/` after the container is healthy.

**3. Optionally: Wait for server to be ready**

```bash
./wait-for-server.sh
```

## Generate speech

```bash
./tts.sh
```

This sends a request to `http://localhost:8080/v1/audio/speech` and saves the result to `output/speech.wav`.
