import { API_BASE } from "./config.js";

function normalizeFetchError(error) {
  if (error instanceof TypeError) {
    return new Error(
      `Request to ${API_BASE || "same-origin backend"} failed. Check that the audio.cpp server is reachable.`
    );
  }
  return error;
}

async function parseError(response) {
  try {
    const payload = await response.json();
    return payload?.error?.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

function decodeBase64Bytes(base64) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeWavPcm16(pcmChunks, sampleRate, channels) {
  const totalPcmBytes = pcmChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const wavBytes = new Uint8Array(44 + totalPcmBytes);
  const view = new DataView(wavBytes.buffer);

  const writeAscii = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + totalPcmBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, totalPcmBytes, true);

  let offset = 44;
  for (const chunk of pcmChunks) {
    wavBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new globalThis.Blob([wavBytes], { type: "audio/wav" });
}

function withStreamingFields(request) {
  if (request.transport === "multipart") {
    const payload = request.payload;
    payload.set("stream", "true");
    payload.set("stream_format", "sse");
    payload.set("response_format", "pcm");
    return {
      transport: "multipart",
      payload,
    };
  }
  return {
    transport: "json",
    payload: {
      ...request.payload,
      stream: true,
      stream_format: "sse",
      response_format: "pcm",
    },
  };
}

export async function fetchHealth() {
  let response;
  try {
    response = await fetch(`${API_BASE}/health`);
  } catch (error) {
    throw normalizeFetchError(error);
  }
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function fetchModels() {
  let response;
  try {
    response = await fetch(`${API_BASE}/v1/models`);
  } catch (error) {
    throw normalizeFetchError(error);
  }
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const payload = await response.json();
  return payload.data ?? [];
}

export async function fetchVoices(modelId) {
  let response;
  try {
    response = await fetch(`${API_BASE}/v1/audio/voices?model=${encodeURIComponent(modelId)}`);
  } catch (error) {
    throw normalizeFetchError(error);
  }
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function synthesizeSpeech(request) {
  const isMultipart = request.transport === "multipart";
  let response;
  try {
    response = await fetch(`${API_BASE}/v1/audio/speech`, {
      method: "POST",
      headers: isMultipart ? undefined : {
        "Content-Type": "application/json",
      },
      body: isMultipart ? request.payload : JSON.stringify(request.payload),
    });
  } catch (error) {
    throw normalizeFetchError(error);
  }
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return {
    blob: await response.blob(),
    metrics: {
      wallMs: response.headers.get("X-AudioCPP-Wall-Ms"),
      audioDurationMs: response.headers.get("X-AudioCPP-Audio-Duration-Ms"),
      rtf: response.headers.get("X-AudioCPP-RTF"),
    },
  };
}

function decodeBase64Wav(audioBase64) {
  return new globalThis.Blob([decodeBase64Bytes(audioBase64)], { type: "audio/wav" });
}

export async function synthesizeSpeechStream(request, { signal, onChunk } = {}) {
  const streamedRequest = withStreamingFields(request);
  const isMultipart = streamedRequest.transport === "multipart";
  let response;
  try {
    response = await fetch(`${API_BASE}/v1/audio/speech`, {
      method: "POST",
      headers: isMultipart ? undefined : {
        "Content-Type": "application/json",
      },
      body: isMultipart ? streamedRequest.payload : JSON.stringify(streamedRequest.payload),
      signal,
    });
  } catch (error) {
    throw normalizeFetchError(error);
  }
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  if (!response.body) {
    throw new Error("Streaming response body was unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new globalThis.TextDecoder();
  const pcmChunks = [];
  const metrics = {};
  let buffer = "";
  let streamComplete = false;
  let sampleRate = null;
  let channels = null;

  const handleEvent = async (payloadText) => {
    if (payloadText === "[DONE]") {
      streamComplete = true;
      return;
    }
    const payload = JSON.parse(payloadText);
    if (payload.type === "speech.audio.delta") {
      const chunkSampleRate = Number(payload.sample_rate);
      const chunkChannels = Number(payload.channels);
      if (!Number.isFinite(chunkSampleRate) || chunkSampleRate <= 0) {
        throw new Error("Streaming speech chunk omitted sample_rate.");
      }
      if (!Number.isFinite(chunkChannels) || chunkChannels <= 0) {
        throw new Error("Streaming speech chunk omitted channels.");
      }
      if (sampleRate === null) {
        sampleRate = chunkSampleRate;
      } else if (sampleRate !== chunkSampleRate) {
        throw new Error("Streaming speech changed sample_rate mid-stream.");
      }
      if (channels === null) {
        channels = chunkChannels;
      } else if (channels !== chunkChannels) {
        throw new Error("Streaming speech changed channel count mid-stream.");
      }

      const pcm = decodeBase64Bytes(payload.audio);
      pcmChunks.push(pcm);
      if (onChunk) {
        await onChunk({ pcm, sampleRate, channels });
      }
      return;
    }
    if (payload.type === "speech.audio.done") {
      metrics.ttftMs = payload.timing?.ttft_ms ?? null;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart());
      if (dataLines.length > 0) {
        await handleEvent(dataLines.join("\n"));
      }
      separatorIndex = buffer.indexOf("\n\n");
    }

    if (done) {
      break;
    }
  }

  if (!streamComplete) {
    throw new Error("Streaming speech ended before [DONE].");
  }
  if (sampleRate === null || channels === null || pcmChunks.length === 0) {
    throw new Error("Streaming speech produced no playable PCM output.");
  }

  return {
    blob: encodeWavPcm16(pcmChunks, sampleRate, channels),
    metrics,
  };
}

export async function runGeneration(request) {
  const isMultipart = request.transport === "multipart";
  let response;
  try {
    response = await fetch(`${API_BASE}/v1/tasks/run`, {
      method: "POST",
      headers: isMultipart ? undefined : {
        "Content-Type": "application/json",
      },
      body: isMultipart ? request.payload : JSON.stringify(request.payload),
    });
  } catch (error) {
    throw normalizeFetchError(error);
  }
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const payload = await response.json();
  const audioBase64 = payload.audio ?? payload.named_audio_outputs?.[0]?.audio;
  if (!audioBase64) {
    throw new Error("Generation response did not contain audio output.");
  }
  return {
    blob: decodeBase64Wav(audioBase64),
    metrics: {
      wallMs: payload.timing?.wall_ms,
      audioDurationMs: payload.timing?.audio_duration_ms,
      rtf: payload.timing?.rtf,
    },
    payload,
  };
}

export async function transcribeAudio({ model, file, language }) {
  const form = new FormData();
  form.append("model", model);
  form.append("file", file);
  if (language) {
    form.append("language", language);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}/v1/audio/transcriptions`, {
      method: "POST",
      body: form,
    });
  } catch (error) {
    throw normalizeFetchError(error);
  }
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}
