#!/usr/bin/env bash

mkdir -p output
server_url="${AUDIOCPP_SERVER_URL:-http://localhost:8080}"

curl "${server_url}/v1/audio/speech" -H 'Content-Type: application/json' -o output/speech.wav -d '
{
  "model": "pocket-tts",
  "input": "You are successfully running a text-to-speech model using audio.cpp, a pure C++ inference engine for audio models.",
  "voice": "alba"
}
'

echo "Saved to: output/speech.wav"
