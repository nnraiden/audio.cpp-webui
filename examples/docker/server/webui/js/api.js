import { API_BASE } from "./config.js";

function normalizeFetchError(error) {
  if (error instanceof TypeError) {
    return new Error(
      `Request to ${API_BASE} failed. Check that the local Web UI proxy is running and that it can reach the audio.cpp backend.`
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

export async function fetchWebUiVoiceCatalog(modelId) {
  let response;
  try {
    response = await fetch(`/__webui/voice-catalog?model=${encodeURIComponent(modelId)}`);
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
