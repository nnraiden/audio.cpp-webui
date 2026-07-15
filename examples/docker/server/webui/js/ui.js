import { elements } from "./dom.js";
import { isGenerationModel, isSpeechModel } from "./modelTasks.js";
import { getSelectedModel, state } from "./state.js";
import { renderGenerationFields } from "./genFamilies.js";
import { renderFamilyFields, renderFamilyPanelTools } from "./ttsFamilies.js";

function renderMetricItems(metrics) {
  return Object.entries(metrics)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([label, value]) => (
      `<div><dt>${label}</dt><dd>${value}</dd></div>`
    ))
    .join("");
}

export function logEvent(message) {
  const stamp = new Date().toLocaleTimeString();
  elements.eventLog.textContent = `[${stamp}] ${message}\n${elements.eventLog.textContent}`;
}

export function renderHealth(payload) {
  elements.healthStatus.textContent = "Ready";
  elements.healthStatus.className = "status-value ok";
  elements.healthDetail.textContent = `${payload.backend} backend, ${payload.models} configured model(s)`;
}

export function renderHealthError(message) {
  elements.healthStatus.textContent = "Unavailable";
  elements.healthStatus.className = "status-value error";
  elements.healthDetail.textContent = message;
}

export function renderModels() {
  const selectedId = state.selectedModelId;
  elements.modelSelect.innerHTML = state.models
    .map((model) => `<option value="${model.id}" ${model.id === selectedId ? "selected" : ""}>${model.id}</option>`)
    .join("");

  const model = getSelectedModel();
  elements.modelFamily.value = model?.family ?? "";
  elements.modelTask.value = model?.task ?? "";
  elements.modelMode.value = model?.mode ?? "";
  elements.modelSummary.textContent = model
    ? `Using ${model.id} (${model.family}) for ${model.task} in ${model.mode} mode.`
    : "No model is currently available.";

  const isTts = isSpeechModel(model);
  const isGen = isGenerationModel(model);
  const isAsr = model?.task === "asr";
  elements.ttsPanel.classList.toggle("hidden", !isTts);
  elements.genPanel.classList.toggle("hidden", !isGen);
  elements.asrPanel.classList.toggle("hidden", !isAsr);
  elements.ttsPanelTools.innerHTML = isTts ? renderFamilyPanelTools(model) : "";
}

export function renderTtsFamilyForm(model, draft) {
  elements.ttsFamilyFields.innerHTML = renderFamilyFields(model, draft, state.voiceCatalog);
}

export function renderGenerationFamilyForm(model, draft) {
  elements.genFamilyFields.innerHTML = renderGenerationFields(model, draft);
}

function renderAudioResult(target, { audioUrl, metrics }) {
  target.audio.src = audioUrl;
  target.download.href = audioUrl;
  target.metrics.innerHTML = renderMetricItems({
    "Wall ms": metrics.wallMs,
    "Audio ms": metrics.audioDurationMs,
    "RTF": metrics.rtf,
  });
  target.result.classList.remove("hidden");
}

export function renderTtsResult({ audioUrl, metrics }) {
  renderAudioResult(
    {
      audio: elements.ttsAudio,
      download: elements.ttsDownload,
      metrics: elements.ttsMetrics,
      result: elements.ttsResult,
    },
    { audioUrl, metrics }
  );
}

export function renderGenerationResult({ audioUrl, metrics }) {
  renderAudioResult(
    {
      audio: elements.genAudio,
      download: elements.genDownload,
      metrics: elements.genMetrics,
      result: elements.genResult,
    },
    { audioUrl, metrics }
  );
}

export function renderAsrResult(payload) {
  elements.asrText.textContent = payload.text ?? "";
  elements.asrMetrics.innerHTML = renderMetricItems({
    "Wall ms": payload.timing?.wall_ms,
    "Audio ms": payload.timing?.audio_duration_ms,
    "RTF": payload.timing?.rtf,
  });
  elements.asrResult.classList.remove("hidden");
}

export function clearOutputs() {
  elements.ttsResult.classList.add("hidden");
  elements.genResult.classList.add("hidden");
  elements.asrResult.classList.add("hidden");
}
