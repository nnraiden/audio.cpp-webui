import { fetchHealth, fetchModels, fetchVoices, runGeneration, synthesizeSpeech, synthesizeSpeechStream, transcribeAudio } from "./api.js";
import { elements } from "./dom.js";
import { isGenerationModel, isSpeechModel } from "./modelTasks.js";
import { buildGenerationRequest, ensureGenerationDraft, readGenerationDraftFromDom, updateGenerationDraftFile } from "./genFamilies.js";
import { clearOutputs, logEvent, renderAsrResult, renderGenerationFamilyForm, renderGenerationResult, renderHealth, renderHealthError, renderModels, renderTtsFamilyForm, renderTtsResult } from "./ui.js";
import { getFamilyDraft, getSelectedModel, setFamilyDraft, setGenerationAudioUrl, setModels, setSelectedModelId, setTtsAudioUrl, setTtsStreamingEnabled, setVoiceCatalog, state } from "./state.js";
import { buildSpeechRequest, ensureFamilyDraft, readFamilyDraftFromDom, updateFamilyDraftFile } from "./ttsFamilies.js";

let activeTtsStream = null;
let activeTtsPlayer = null;

function createStreamingAudioPlayer() {
  const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("This browser does not support AudioContext streaming playback.");
  }

  const context = new AudioContextCtor();
  let nextTime = 0;
  let closed = false;
  let closeTimer = null;

  return {
    async appendChunk({ pcm, sampleRate, channels }) {
      if (closed) {
        return;
      }
      if (context.state === "suspended") {
        await context.resume();
      }

      const pcmCopy = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength);
      const samples = new Int16Array(pcmCopy);
      const frameCount = samples.length / channels;
      const audioBuffer = context.createBuffer(channels, frameCount, sampleRate);

      for (let channel = 0; channel < channels; channel += 1) {
        const output = audioBuffer.getChannelData(channel);
        for (let frame = 0; frame < frameCount; frame += 1) {
          output[frame] = samples[frame * channels + channel] / 32768;
        }
      }

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);
      nextTime = Math.max(nextTime, context.currentTime + 0.02);
      source.start(nextTime);
      nextTime += audioBuffer.duration;
    },
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      if (closeTimer !== null) {
        globalThis.clearTimeout(closeTimer);
      }
      await context.close();
    },
    finish(onClosed) {
      if (closed || closeTimer !== null) {
        return;
      }
      const delayMs = Math.max(0, ((nextTime - context.currentTime) * 1000) + 250);
      closeTimer = globalThis.setTimeout(() => {
        this.close()
          .catch(() => {})
          .finally(() => {
            onClosed?.();
          });
      }, delayMs);
    },
  };
}

async function disposeActiveTtsStream() {
  if (activeTtsStream) {
    activeTtsStream.abortController.abort();
  }
  if (activeTtsPlayer) {
    try {
      await activeTtsPlayer.close();
    } catch {
      // Ignore cleanup errors during stream replacement.
    }
  }
  activeTtsStream = null;
  activeTtsPlayer = null;
}

async function loadHealth() {
  try {
    const payload = await fetchHealth();
    renderHealth(payload);
    logEvent(`Backend healthy on ${payload.backend} with ${payload.models} configured model(s).`);
  } catch (error) {
    renderHealthError(error.message);
    logEvent(`Health check failed: ${error.message}`);
  }
}

async function loadModels() {
  const models = await fetchModels();
  setModels(models);
  renderModels();
  syncTtsFamilyForm();
  syncGenerationFamilyForm();
  await syncVoices();
  logEvent(`Loaded ${models.length} model definition(s).`);
}

function currentFamilyKey() {
  const model = getSelectedModel();
  return model?.id ?? model?.family ?? "default";
}

function readCurrentFamilyDraft() {
  const model = getSelectedModel();
  return readFamilyDraftFromDom(
    model,
    elements.ttsFamilyFields,
    ensureFamilyDraft(model, getFamilyDraft(currentFamilyKey()))
  );
}

function readCurrentGenerationDraft() {
  const model = getSelectedModel();
  return readGenerationDraftFromDom(
    model,
    elements.genFamilyFields,
    ensureGenerationDraft(model, getFamilyDraft(currentFamilyKey()))
  );
}

function syncTtsFamilyForm() {
  const model = getSelectedModel();
  const key = currentFamilyKey();
  const draft = ensureFamilyDraft(model, getFamilyDraft(key));
  setFamilyDraft(key, draft);
  renderTtsFamilyForm(model, draft);
}

function syncGenerationFamilyForm() {
  const model = getSelectedModel();
  const key = currentFamilyKey();
  const draft = ensureGenerationDraft(model, getFamilyDraft(key));
  setFamilyDraft(key, draft);
  renderGenerationFamilyForm(model, draft);
}

async function syncVoices() {
  const model = getSelectedModel();
  if (!isSpeechModel(model)) {
    setVoiceCatalog({ voices: [], presets: [], samples: [] });
    return;
  }
  try {
    const catalog = await fetchVoices(model.id);
    setVoiceCatalog(catalog);
    syncTtsFamilyForm();
    logEvent(
      `Loaded ${catalog.voices?.length ?? 0} voice option(s), ` +
      `${catalog.presets?.length ?? 0} preset voice(s), and ` +
      `${catalog.samples?.length ?? 0} sample voice(s) for ${model.id}.`
    );
  } catch (error) {
    setVoiceCatalog({ voices: [], presets: [], samples: [] });
    syncTtsFamilyForm();
    logEvent(`Voice lookup failed for ${model.id}: ${error.message}`);
  }
}

async function refreshAll() {
  await disposeActiveTtsStream();
  clearOutputs();
  await loadHealth();
  await loadModels();
}

async function handleTtsSubmit(event) {
  event.preventDefault();
  const model = getSelectedModel();
  if (!model) {
    logEvent("No model selected for TTS.");
    return;
  }

  const draft = readCurrentFamilyDraft();
  setFamilyDraft(currentFamilyKey(), draft);
  const sharedFields = {};
  if (elements.ttsSeed.value) {
    sharedFields.seed = Number(elements.ttsSeed.value);
  }
  if (elements.ttsMaxTokens.value) {
    sharedFields.max_tokens = Number(elements.ttsMaxTokens.value);
  }
  if (elements.ttsTextChunkSize.value) {
    sharedFields.text_chunk_size = Number(elements.ttsTextChunkSize.value);
  }

  logEvent(`Submitting TTS request for ${model.id}.`);
  try {
    await disposeActiveTtsStream();
    const request = buildSpeechRequest(model, draft, sharedFields, state.voiceCatalog);
    const shouldStream = state.ttsStreamingEnabled && model.mode === "streaming";

    if (shouldStream) {
      const player = createStreamingAudioPlayer();
      activeTtsPlayer = player;
      const abortController = new globalThis.AbortController();
      activeTtsStream = { abortController, player };
      logEvent(`Streaming TTS audio for ${model.id}.`);
      const result = await synthesizeSpeechStream(request, {
        signal: abortController.signal,
        onChunk: async (chunk) => {
          await player.appendChunk(chunk);
        },
      });
      const audioUrl = URL.createObjectURL(result.blob);
      setTtsAudioUrl(audioUrl);
      renderTtsResult({ audioUrl, metrics: result.metrics });
      logEvent(`Streaming TTS request for ${model.id} completed.`);
      player.finish(() => {
        if (activeTtsPlayer === player) {
          activeTtsPlayer = null;
        }
      });
      activeTtsStream = null;
      return;
    }

    const result = await synthesizeSpeech(request);
    const audioUrl = URL.createObjectURL(result.blob);
    setTtsAudioUrl(audioUrl);
    renderTtsResult({ audioUrl, metrics: result.metrics });
    logEvent(`TTS request for ${model.id} completed.`);
  } catch (error) {
    if (error.name === "AbortError") {
      logEvent(`TTS request for ${model.id} was cancelled.`);
    } else {
      logEvent(`TTS request failed: ${error.message}`);
    }
    activeTtsStream = null;
    activeTtsPlayer = null;
  }
}

async function handleGenerationSubmit(event) {
  event.preventDefault();
  const model = getSelectedModel();
  if (!model) {
    logEvent("No model selected for generation.");
    return;
  }

  const draft = readCurrentGenerationDraft();
  setFamilyDraft(currentFamilyKey(), draft);

  logEvent(`Submitting generation request for ${model.id}.`);
  try {
    const result = await runGeneration(buildGenerationRequest(model, draft));
    const audioUrl = URL.createObjectURL(result.blob);
    setGenerationAudioUrl(audioUrl);
    renderGenerationResult({ audioUrl, metrics: result.metrics });
    logEvent(`Generation request for ${model.id} completed.`);
  } catch (error) {
    logEvent(`Generation request failed: ${error.message}`);
  }
}

async function handleAsrSubmit(event) {
  event.preventDefault();
  const model = getSelectedModel();
  const file = elements.asrFile.files?.[0];
  if (!model) {
    logEvent("No model selected for ASR.");
    return;
  }
  if (!file) {
    logEvent("Choose a WAV file before submitting ASR.");
    return;
  }

  logEvent(`Submitting ASR request for ${model.id} with ${file.name}.`);
  try {
    const payload = await transcribeAudio({
      model: model.id,
      file,
      language: elements.asrLanguage.value.trim(),
    });
    renderAsrResult(payload);
    logEvent(`ASR request for ${model.id} completed.`);
  } catch (error) {
    logEvent(`ASR request failed: ${error.message}`);
  }
}

function attachEvents() {
  elements.refreshModels.addEventListener("click", () => {
    refreshAll().catch((error) => logEvent(`Refresh failed: ${error.message}`));
  });

  elements.clearLog.addEventListener("click", () => {
    elements.eventLog.textContent = "Log cleared.";
  });

  elements.ttsPanelTools.addEventListener("change", (event) => {
    if (event.target.dataset.role !== "tts-streaming-toggle") {
      return;
    }
    setTtsStreamingEnabled(event.target.checked);
    renderModels();
  });

  elements.modelSelect.addEventListener("change", async (event) => {
    const model = getSelectedModel();
    if (isSpeechModel(model)) {
      setFamilyDraft(currentFamilyKey(), readCurrentFamilyDraft());
    } else if (isGenerationModel(model)) {
      setFamilyDraft(currentFamilyKey(), readCurrentGenerationDraft());
    }
    setSelectedModelId(event.target.value);
    await disposeActiveTtsStream();
    clearOutputs();
    renderModels();
    syncTtsFamilyForm();
    syncGenerationFamilyForm();
    await syncVoices();
    logEvent(`Switched active model to ${event.target.value}.`);
  });

  elements.ttsFamilyFields.addEventListener("click", (event) => {
    const action = event.target.dataset.action;
    if (!action) {
      return;
    }
    const model = getSelectedModel();
    const draft = readCurrentFamilyDraft();
    if (action === "add-speaker") {
      draft.speakers.push({ source: "sample", serverValue: "", uploadFile: null });
    }
    if (action === "remove-speaker") {
      const index = Number(event.target.dataset.index);
      if (draft.speakers.length > 1) {
        draft.speakers.splice(index, 1);
      }
    }
    setFamilyDraft(currentFamilyKey(), ensureFamilyDraft(model, draft));
    syncTtsFamilyForm();
  });

  elements.ttsFamilyFields.addEventListener("input", () => {
    setFamilyDraft(currentFamilyKey(), readCurrentFamilyDraft());
  });

  elements.genFamilyFields.addEventListener("input", () => {
    setFamilyDraft(currentFamilyKey(), readCurrentGenerationDraft());
  });

  elements.ttsFamilyFields.addEventListener("change", (event) => {
    if (event.target.dataset.role === "pocket-clone-file") {
      const draft = updateFamilyDraftFile(
        getSelectedModel(),
        readCurrentFamilyDraft(),
        "pocket-clone-file",
        null,
        event.target.files?.[0] ?? null
      );
      setFamilyDraft(currentFamilyKey(), draft);
      syncTtsFamilyForm();
      return;
    }
    if (event.target.dataset.role === "speaker-upload-file") {
      const draft = updateFamilyDraftFile(
        getSelectedModel(),
        readCurrentFamilyDraft(),
        "speaker-upload-file",
        Number(event.target.dataset.index),
        event.target.files?.[0] ?? null
      );
      setFamilyDraft(currentFamilyKey(), draft);
      syncTtsFamilyForm();
      return;
    }
    if (event.target.dataset.role === "omnivoice-upload-file") {
      const draft = updateFamilyDraftFile(
        getSelectedModel(),
        readCurrentFamilyDraft(),
        "omnivoice-upload-file",
        null,
        event.target.files?.[0] ?? null
      );
      setFamilyDraft(currentFamilyKey(), draft);
      syncTtsFamilyForm();
      return;
    }
    if (event.target.dataset.role === "chatterbox-upload-file") {
      const draft = updateFamilyDraftFile(
        getSelectedModel(),
        readCurrentFamilyDraft(),
        "chatterbox-upload-file",
        null,
        event.target.files?.[0] ?? null
      );
      setFamilyDraft(currentFamilyKey(), draft);
      syncTtsFamilyForm();
      return;
    }
    if (event.target.dataset.role === "moss-upload-file") {
      const draft = updateFamilyDraftFile(
        getSelectedModel(),
        readCurrentFamilyDraft(),
        "moss-upload-file",
        null,
        event.target.files?.[0] ?? null
      );
      setFamilyDraft(currentFamilyKey(), draft);
      syncTtsFamilyForm();
      return;
    }
    setFamilyDraft(currentFamilyKey(), readCurrentFamilyDraft());
    syncTtsFamilyForm();
  });

  elements.genFamilyFields.addEventListener("change", (event) => {
    if (event.target.dataset.role === "ace-step-audio-file") {
      const draft = updateGenerationDraftFile(
        getSelectedModel(),
        readCurrentGenerationDraft(),
        "ace-step-audio-file",
        event.target.files?.[0] ?? null
      );
      setFamilyDraft(currentFamilyKey(), draft);
      syncGenerationFamilyForm();
      return;
    }
    setFamilyDraft(currentFamilyKey(), readCurrentGenerationDraft());
    syncGenerationFamilyForm();
  });

  elements.ttsForm.addEventListener("submit", (event) => {
    handleTtsSubmit(event).catch((error) => logEvent(`TTS submit failed: ${error.message}`));
  });

  elements.genForm.addEventListener("submit", (event) => {
    handleGenerationSubmit(event).catch((error) => logEvent(`Generation submit failed: ${error.message}`));
  });

  elements.asrForm.addEventListener("submit", (event) => {
    handleAsrSubmit(event).catch((error) => logEvent(`ASR submit failed: ${error.message}`));
  });
}

attachEvents();
refreshAll().catch((error) => logEvent(`Initial load failed: ${error.message}`));
