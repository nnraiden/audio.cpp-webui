const DEFAULT_TEXT = "audio.cpp is serving this request through the framework runtime.";

const VIBEVOICE_TEXT = [
  "Speaker 1: Hello, thanks for joining this test.",
  "Speaker 2: Happy to be here. The script format is working.",
].join("\n");

const OMNIVOICE_TAGS = [
  "[laughter]",
  "[sigh]",
  "[confirmation-en]",
  "[question-en]",
  "[question-ah]",
  "[question-oh]",
  "[question-ei]",
  "[question-yi]",
  "[surprise-ah]",
  "[surprise-oh]",
  "[surprise-wa]",
  "[surprise-yo]",
  "[dissatisfaction-hnn]",
];

const OMNIVOICE_INSTRUCTION_EXAMPLE = "female, young adult, moderate pitch, british accent";
const CHATTERBOX_LANGUAGES = ["en", "de", "fr", "es", "it", "pt", "pl", "tr", "ja", "zh"];
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function familyKey(model) {
  return model?.family ?? "default";
}

function normalizeCatalog(voiceCatalog) {
  return {
    voices: Array.isArray(voiceCatalog?.voices) ? voiceCatalog.voices : [],
    presets: Array.isArray(voiceCatalog?.presets) ? voiceCatalog.presets : [],
    samples: Array.isArray(voiceCatalog?.samples) ? voiceCatalog.samples : [],
  };
}

function makeServerVoiceOptions(voiceCatalog) {
  return normalizeCatalog(voiceCatalog).voices.map((voice) => ({
    id: voice,
    value: voice,
    label: voice,
  }));
}

function makeSampleOptions(voiceCatalog) {
  return normalizeCatalog(voiceCatalog).samples.map((sample) => ({
    id: sample.id,
    value: sample.path,
    label: sample.id,
    transcriptText: sample.transcript_text ?? "",
  }));
}

function makePresetVoiceRefOptions(voiceCatalog) {
  return normalizeCatalog(voiceCatalog).presets
    .filter((preset) => preset.voice_ref)
    .map((preset) => ({
      id: preset.id,
      value: preset.voice_ref,
      label: preset.id,
    }));
}

function makePresetOptions(voiceCatalog) {
  return normalizeCatalog(voiceCatalog).presets.map((preset) => ({
    id: preset.id,
    value: preset.id,
    label: preset.id,
    referenceText: preset.reference_text ?? "",
  }));
}

function findSampleByPath(voiceCatalog, samplePath) {
  return normalizeCatalog(voiceCatalog).samples.find((sample) => sample.path === samplePath) ?? null;
}

function findPresetById(voiceCatalog, presetId) {
  return normalizeCatalog(voiceCatalog).presets.find((preset) => preset.id === presetId) ?? null;
}

function sampleTranscriptText(voiceCatalog, samplePath) {
  return findSampleByPath(voiceCatalog, samplePath)?.transcript_text ?? "";
}

function renderSelectOptions(options, selectedValue, defaultLabel) {
  return [
    `<option value="">${escapeHtml(defaultLabel)}</option>`,
    ...options.map((option) => (
      `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>${escapeHtml(option.label)}</option>`
    )),
  ].join("");
}

function renderVoiceSelect(fieldLabel, options, selectedValue, defaultLabel) {
  return `
    <label class="field">
      <span>${escapeHtml(fieldLabel)}</span>
      <select data-role="voice-select">
        ${renderSelectOptions(options, selectedValue, defaultLabel)}
      </select>
    </label>
  `;
}

function renderPromptField(spec, draft) {
  const helperMarkup = spec.helper
    ? `<small class="family-helper">${escapeHtml(spec.helper)}</small>`
    : "";
  return `
    <label class="field">
      <span>${escapeHtml(spec.promptLabel)}</span>
      <textarea data-role="prompt-input" rows="${spec.promptRows}" placeholder="${escapeHtml(spec.placeholder)}">${escapeHtml(draft.prompt)}</textarea>
      ${helperMarkup}
    </label>
  `;
}

function renderSpeakerRows(draft, voiceCatalog) {
  const selectableSamples = makeSampleOptions(voiceCatalog);
  const presetSamples = makePresetVoiceRefOptions(voiceCatalog);
  const helper = (selectableSamples.length > 0 || presetSamples.length > 0)
    ? "Choose a shared WAV sample, a model preset, or a local WAV for each speaker. Speaker order maps directly to Speaker 1, Speaker 2, and so on."
    : "No server-known WAV references were exposed for this model. Upload local WAVs for each speaker.";

  const rows = draft.speakers.map((speaker, index) => {
    const sampleField = `
      <label class="field speaker-field ${speaker.source === "sample" ? "" : "hidden"}" data-visibility="speaker-sample" data-index="${index}">
        <span>Shared WAV Sample</span>
        <select data-role="speaker-sample-value" data-index="${index}">
          ${renderSelectOptions(selectableSamples, speaker.serverValue ?? "", "Select sample")}
        </select>
      </label>
    `;
    const presetField = `
      <label class="field speaker-field ${speaker.source === "preset" ? "" : "hidden"}" data-visibility="speaker-preset" data-index="${index}">
        <span>Preset Voice</span>
        <select data-role="speaker-preset-value" data-index="${index}">
          ${renderSelectOptions(presetSamples, speaker.serverValue ?? "", "Select preset")}
        </select>
      </label>
    `;
    const uploadName = speaker.uploadFile?.name ?? "No file selected";
    const uploadField = `
      <label class="field speaker-field ${speaker.source === "upload" ? "" : "hidden"}" data-visibility="speaker-upload" data-index="${index}">
        <span>Local WAV</span>
        <input data-role="speaker-upload-file" data-index="${index}" type="file" accept=".wav,audio/wav">
        <small>${escapeHtml(uploadName)}</small>
      </label>
    `;
    return `
      <div class="speaker-row">
        <div class="speaker-row-main">
          <label class="field speaker-source-field">
            <span>Speaker ${index + 1}</span>
            <select data-role="speaker-source" data-index="${index}">
              <option value="sample" ${speaker.source === "sample" ? "selected" : ""}>Shared WAV Sample</option>
              <option value="preset" ${speaker.source === "preset" ? "selected" : ""}>Preset Voice</option>
              <option value="upload" ${speaker.source === "upload" ? "selected" : ""}>Upload WAV</option>
            </select>
          </label>
          ${sampleField}
          ${presetField}
          ${uploadField}
        </div>
        <button class="secondary-button speaker-remove-button" type="button" data-action="remove-speaker" data-index="${index}">Remove</button>
      </div>
    `;
  }).join("");

  return `
    <div class="speaker-list">
      <div class="speaker-list-header">
        <span>Reference Speakers</span>
        <button class="secondary-button" type="button" data-action="add-speaker">Add Speaker</button>
      </div>
      ${rows}
      <small class="family-helper">${escapeHtml(helper)}</small>
    </div>
  `;
}

function renderPocketCloneMode(draft, voiceCatalog) {
  const uploadName = draft.cloneFile?.name ?? "No file selected";
  const sampleOptions = makeSampleOptions(voiceCatalog);
  const presetOptions = makePresetOptions(voiceCatalog);
  return `
    <div class="segmented-control" role="radiogroup" aria-label="PocketTTS voice mode">
      <label class="segment-option">
        <input type="radio" name="pocket-mode" value="voice" data-role="pocket-mode" ${draft.mode === "voice" ? "checked" : ""}>
        <span>Built-in/Cached Voice</span>
      </label>
      <label class="segment-option">
        <input type="radio" name="pocket-mode" value="clone" data-role="pocket-mode" ${draft.mode === "clone" ? "checked" : ""}>
        <span>Clone from WAV</span>
      </label>
    </div>
    <div class="field-stack ${draft.mode === "voice" ? "" : "hidden"}" data-visibility="pocket-voice-mode">
      ${renderVoiceSelect("Voice", makeServerVoiceOptions(voiceCatalog), draft.voice, "Default")}
    </div>
    <div class="field-stack ${draft.mode === "clone" ? "" : "hidden"}" data-visibility="pocket-clone-mode">
      <label class="field">
        <span>Reference Source</span>
        <select data-role="pocket-clone-source">
          <option value="sample" ${draft.cloneSource === "sample" ? "selected" : ""}>Shared WAV Sample</option>
          <option value="preset" ${draft.cloneSource === "preset" ? "selected" : ""}>Preset</option>
          <option value="upload" ${draft.cloneSource === "upload" ? "selected" : ""}>Upload WAV</option>
        </select>
      </label>
      <label class="field ${draft.cloneSource === "sample" ? "" : "hidden"}" data-visibility="pocket-clone-source-sample">
        <span>Shared WAV Sample</span>
        <select data-role="pocket-clone-sample">
          ${renderSelectOptions(sampleOptions, draft.cloneSample, "Select shared sample")}
        </select>
      </label>
      <label class="field ${draft.cloneSource === "preset" ? "" : "hidden"}" data-visibility="pocket-clone-source-preset">
        <span>Preset</span>
        <select data-role="pocket-clone-preset">
          ${renderSelectOptions(presetOptions, draft.clonePreset, "Select preset")}
        </select>
      </label>
      <label class="field ${draft.cloneSource === "upload" ? "" : "hidden"}" data-visibility="pocket-clone-source-upload">
        <span>Or Upload Local WAV</span>
        <input data-role="pocket-clone-file" type="file" accept=".wav,audio/wav">
        <small>${escapeHtml(uploadName)}</small>
      </label>
    </div>
  `;
}

function normalizeNumericDraftValue(value) {
  return typeof value === "string" ? value : "";
}

function makeAdvancedEntries(draft) {
  return [
    { key: "num_inference_steps", label: "Num Inference Steps", type: "number", step: "1", value: draft.numInferenceSteps },
    { key: "guidance_scale", label: "Guidance Scale", type: "number", step: "0.1", value: draft.guidanceScale },
    { key: "speed", label: "Speed", type: "number", step: "0.05", value: draft.speed },
    { key: "audio_chunk_duration_seconds", label: "Chunk Duration Seconds", type: "number", step: "0.1", value: draft.audioChunkDurationSeconds },
    { key: "audio_chunk_threshold_seconds", label: "Chunk Threshold Seconds", type: "number", step: "0.1", value: draft.audioChunkThresholdSeconds },
  ];
}

function collectAdvancedFields(draft) {
  const fields = {};
  for (const entry of makeAdvancedEntries(draft)) {
    if (entry.value !== "") {
      fields[entry.key] = Number(entry.value);
    }
  }
  return fields;
}

function appendFields(formData, fields) {
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, String(value));
  }
}

function resolveOmniVoiceTranscriptState(draft, voiceCatalog) {
  if (draft.source === "sample") {
    return {
      value: findSampleByPath(voiceCatalog, draft.samplePath)?.transcript_text ?? "",
      readOnly: true,
      helper: "Reference transcript is required for OmniVoice clone mode. Shared sample transcript comes from a same-stem .txt file when available.",
    };
  }
  if (draft.source === "preset") {
    return {
      value: findPresetById(voiceCatalog, draft.presetId)?.reference_text ?? "",
      readOnly: true,
      helper: "Reference transcript is required for OmniVoice clone mode. Preset transcript comes from the configured server preset.",
    };
  }
  return {
    value: draft.referenceText,
    readOnly: false,
    helper: "Reference transcript is required when uploading a reference WAV for OmniVoice clone mode.",
  };
}

function renderOmniVoiceCloneMode(draft, voiceCatalog) {
  const sampleOptions = makeSampleOptions(voiceCatalog);
  const presetOptions = makePresetOptions(voiceCatalog);
  const uploadName = draft.uploadFile?.name ?? "No file selected";
  const transcript = resolveOmniVoiceTranscriptState(draft, voiceCatalog);
  return `
    <div class="field-stack" data-visibility="omnivoice-clone-mode">
      <label class="field">
        <span>Reference Source</span>
        <select data-role="omnivoice-source">
          <option value="sample" ${draft.source === "sample" ? "selected" : ""}>Shared WAV Sample</option>
          <option value="preset" ${draft.source === "preset" ? "selected" : ""}>Preset</option>
          <option value="upload" ${draft.source === "upload" ? "selected" : ""}>Upload WAV</option>
        </select>
      </label>
      <label class="field ${draft.source === "sample" ? "" : "hidden"}" data-visibility="omnivoice-source-sample">
        <span>Shared WAV Sample</span>
        <select data-role="omnivoice-sample-path">
          ${renderSelectOptions(sampleOptions, draft.samplePath, "Select shared sample")}
        </select>
      </label>
      <label class="field ${draft.source === "preset" ? "" : "hidden"}" data-visibility="omnivoice-source-preset">
        <span>Preset</span>
        <select data-role="omnivoice-preset-id">
          ${renderSelectOptions(presetOptions, draft.presetId, "Select preset")}
        </select>
      </label>
      <label class="field ${draft.source === "upload" ? "" : "hidden"}" data-visibility="omnivoice-source-upload">
        <span>Local WAV</span>
        <input data-role="omnivoice-upload-file" type="file" accept=".wav,audio/wav">
        <small>${escapeHtml(uploadName)}</small>
      </label>
      <label class="field">
        <span>Reference Transcript Required</span>
        <textarea data-role="omnivoice-reference-text" rows="4" placeholder="Transcript for the reference audio." ${transcript.readOnly ? "readonly" : ""}>${escapeHtml(transcript.value)}</textarea>
        <small class="family-helper">${escapeHtml(transcript.helper)}</small>
      </label>
    </div>
  `;
}

function resolveChatterboxTranscriptState(draft, voiceCatalog) {
  if (draft.source === "sample") {
    return {
      value: sampleTranscriptText(voiceCatalog, draft.samplePath),
      readOnly: true,
      helper: "Reference transcript comes from a same-stem .txt file when available.",
    };
  }
  if (draft.source === "preset") {
    return {
      value: findPresetById(voiceCatalog, draft.presetId)?.reference_text ?? "",
      readOnly: true,
      helper: "Reference transcript comes from the configured server preset when available.",
    };
  }
  return {
    value: draft.referenceText,
    readOnly: false,
    helper: "Transcript is optional when uploading a reference WAV.",
  };
}

function resolveMossTranscriptState(draft, voiceCatalog) {
  if (draft.source === "sample") {
    return {
      value: findSampleByPath(voiceCatalog, draft.samplePath)?.transcript_text ?? "",
      readOnly: true,
      helper: "Reference transcript comes from a same-stem .txt file when available.",
    };
  }
  if (draft.source === "preset") {
    return {
      value: findPresetById(voiceCatalog, draft.presetId)?.reference_text ?? "",
      readOnly: true,
      helper: "Reference transcript comes from the configured server preset when available.",
    };
  }
  return {
    value: draft.referenceText,
    readOnly: false,
    helper: "Transcript is optional when uploading a reference WAV.",
  };
}

function renderOmniVoiceAdvanced(draft) {
  const fields = makeAdvancedEntries(draft).map((entry) => `
    <label class="field">
      <span>${escapeHtml(entry.label)}</span>
      <input
        data-role="omnivoice-advanced-input"
        data-key="${escapeHtml(entry.key)}"
        type="${escapeHtml(entry.type)}"
        ${entry.step ? `step="${escapeHtml(entry.step)}"` : ""}
        value="${escapeHtml(entry.value)}"
        placeholder="Optional">
    </label>
  `).join("");
  return `
    <div class="field-stack">
      <label class="toggle-row">
        <input data-role="omnivoice-show-advanced" type="checkbox" ${draft.showAdvanced ? "checked" : ""}>
        <span>Advanced OmniVoice controls</span>
      </label>
      <div class="field-grid ${draft.showAdvanced ? "" : "hidden"}" data-visibility="omnivoice-advanced">
        ${fields}
      </div>
    </div>
  `;
}

function serializeOmniVoiceRequest(model, draft, shared, voiceCatalog) {
  const advancedFields = collectAdvancedFields(draft);
  if (draft.mode === "design") {
    return {
      transport: "json",
      payload: {
        model: model.id,
        input: draft.prompt.trim(),
        instructions: draft.instructions.trim(),
        ...shared,
        ...advancedFields,
      },
    };
  }

  const transcriptState = resolveOmniVoiceTranscriptState(draft, voiceCatalog);
  if (draft.source === "sample") {
    return {
      transport: "json",
      payload: {
        model: model.id,
        input: draft.prompt.trim(),
        voice_ref: draft.samplePath,
        ...(transcriptState.value ? { reference_text: transcriptState.value } : {}),
        ...shared,
        ...advancedFields,
      },
    };
  }
  if (draft.source === "preset") {
    return {
      transport: "json",
      payload: {
        model: model.id,
        input: draft.prompt.trim(),
        voice: draft.presetId,
        ...(transcriptState.value ? { reference_text: transcriptState.value } : {}),
        ...shared,
        ...advancedFields,
      },
    };
  }

  const formData = new FormData();
  appendFields(formData, {
    model: model.id,
    input: draft.prompt.trim(),
    ...shared,
    ...advancedFields,
  });
  if (draft.uploadFile) {
    formData.append("voice_ref", draft.uploadFile);
  }
  if (draft.referenceText.trim()) {
    formData.append("reference_text", draft.referenceText.trim());
  }
  return {
    transport: "multipart",
    payload: formData,
  };
}

const MOSS_CHUNK_MODES = ["default", "tag_aware", "japanese", "endline"];

function createMossSpec({ maxTokens, textTemperature, textTopP, textTopK }) {
  return {
    promptLabel: "Input Text",
    promptRows: 7,
    placeholder: "",
    defaultValue: DEFAULT_TEXT,
    helper: "",
    textMode: "plain_text",
    cloneMode: "single_wav_optional",
    catalogSources: ["samples", "presets"],
    localUpload: true,
    createDraft() {
      return {
        prompt: DEFAULT_TEXT,
        mode: "text_only",
        source: "sample",
        samplePath: "",
        presetId: "",
        uploadFile: null,
        referenceText: "",
        showAdvanced: false,
        maxTokens: String(maxTokens),
        doSample: true,
        temperature: "1.7",
        topP: "0.8",
        topK: "25",
        repetitionPenalty: "1.0",
        textTemperature: textTemperature,
        textTopP: textTopP,
        textTopK: textTopK,
        textChunkMode: "default",
      };
    },
    ensureDraft(existingDraft) {
      const draft = existingDraft ?? this.createDraft();
      draft.prompt = typeof draft.prompt === "string" ? draft.prompt : DEFAULT_TEXT;
      draft.mode = draft.mode === "clone" ? "clone" : "text_only";
      draft.source = draft.source === "preset" || draft.source === "upload" ? draft.source : "sample";
      draft.samplePath = typeof draft.samplePath === "string" ? draft.samplePath : "";
      draft.presetId = typeof draft.presetId === "string" ? draft.presetId : "";
      draft.uploadFile = draft.uploadFile instanceof File ? draft.uploadFile : null;
      draft.referenceText = typeof draft.referenceText === "string" ? draft.referenceText : "";
      draft.showAdvanced = draft.showAdvanced === true;
      draft.maxTokens = normalizeNumericDraftValue(draft.maxTokens);
      draft.temperature = normalizeNumericDraftValue(draft.temperature);
      draft.topP = normalizeNumericDraftValue(draft.topP);
      draft.topK = normalizeNumericDraftValue(draft.topK);
      draft.repetitionPenalty = normalizeNumericDraftValue(draft.repetitionPenalty);
      draft.textTemperature = normalizeNumericDraftValue(draft.textTemperature);
      draft.textTopP = normalizeNumericDraftValue(draft.textTopP);
      draft.textTopK = normalizeNumericDraftValue(draft.textTopK);
      draft.textChunkMode = typeof draft.textChunkMode === "string" ? draft.textChunkMode : "default";
      return draft;
    },
    renderFields(draft, voiceCatalog) {
      const sampleOptions = makeSampleOptions(voiceCatalog);
      const presetOptions = makePresetOptions(voiceCatalog);
      const uploadName = draft.uploadFile?.name ?? "No file selected";
      const transcript = resolveMossTranscriptState(draft, voiceCatalog);
      const chunkModeOptions = MOSS_CHUNK_MODES
        .map((m) => `<option value="${m}" ${m === draft.textChunkMode ? "selected" : ""}>${m}</option>`)
        .join("");
      return `
        ${renderPromptField(this, draft)}
        <div class="segmented-control" role="radiogroup" aria-label="MOSS mode">
          <label class="segment-option">
            <input type="radio" name="moss-mode" value="text_only" data-role="moss-mode" ${draft.mode === "text_only" ? "checked" : ""}>
            <span>Text Only</span>
          </label>
          <label class="segment-option">
            <input type="radio" name="moss-mode" value="clone" data-role="moss-mode" ${draft.mode === "clone" ? "checked" : ""}>
            <span>Voice Clone</span>
          </label>
        </div>
        <div class="field-stack ${draft.mode === "clone" ? "" : "hidden"}" data-visibility="moss-clone-panel">
          <label class="field">
            <span>Reference Source</span>
            <select data-role="moss-source">
              <option value="sample" ${draft.source === "sample" ? "selected" : ""}>Shared WAV Sample</option>
              <option value="preset" ${draft.source === "preset" ? "selected" : ""}>Preset</option>
              <option value="upload" ${draft.source === "upload" ? "selected" : ""}>Upload WAV</option>
            </select>
          </label>
          <label class="field ${draft.source === "sample" ? "" : "hidden"}" data-visibility="moss-source-sample">
            <span>Shared WAV Sample</span>
            <select data-role="moss-sample-path">
              ${renderSelectOptions(sampleOptions, draft.samplePath, "Select shared sample")}
            </select>
          </label>
          <label class="field ${draft.source === "preset" ? "" : "hidden"}" data-visibility="moss-source-preset">
            <span>Preset</span>
            <select data-role="moss-preset-id">
              ${renderSelectOptions(presetOptions, draft.presetId, "Select preset")}
            </select>
          </label>
          <label class="field ${draft.source === "upload" ? "" : "hidden"}" data-visibility="moss-source-upload">
            <span>Local WAV</span>
            <input data-role="moss-upload-file" type="file" accept=".wav,audio/wav">
            <small>${escapeHtml(uploadName)}</small>
          </label>
          <label class="field" data-visibility="moss-reference-text">
            <span>Reference Transcript</span>
            <textarea data-role="moss-reference-text" rows="4" placeholder="Transcript for the reference audio (optional but recommended)." ${transcript.readOnly ? "readonly" : ""}>${escapeHtml(transcript.value)}</textarea>
            <small class="family-helper">${escapeHtml(transcript.helper)}</small>
          </label>
        </div>
        <div class="field-grid">
          <label class="field">
            <span>Text Chunk Mode</span>
            <select data-role="moss-text-chunk-mode">${chunkModeOptions}</select>
          </label>
        </div>
        <div class="field-stack">
          <label class="toggle-row">
            <input data-role="moss-show-advanced" type="checkbox" ${draft.showAdvanced ? "checked" : ""}>
            <span>Advanced MOSS controls</span>
          </label>
          <div class="field-grid ${draft.showAdvanced ? "" : "hidden"}" data-visibility="moss-advanced">
            <label class="field">
              <span>Max Tokens</span>
              <input data-role="moss-advanced-input" data-key="max_tokens" type="number" value="${escapeHtml(draft.maxTokens)}" placeholder="Optional">
            </label>
            <label class="toggle-row">
              <input data-role="moss-do-sample" type="checkbox" ${draft.doSample ? "checked" : ""}>
              <span>Do Sample</span>
            </label>
            <label class="field">
              <span>Temperature</span>
              <input data-role="moss-advanced-input" data-key="temperature" type="number" step="0.1" value="${escapeHtml(draft.temperature)}" placeholder="Optional">
            </label>
            <label class="field">
              <span>Top P</span>
              <input data-role="moss-advanced-input" data-key="top_p" type="number" step="0.1" value="${escapeHtml(draft.topP)}" placeholder="Optional">
            </label>
            <label class="field">
              <span>Top K</span>
              <input data-role="moss-advanced-input" data-key="top_k" type="number" value="${escapeHtml(draft.topK)}" placeholder="Optional">
            </label>
            <label class="field">
              <span>Repetition Penalty</span>
              <input data-role="moss-advanced-input" data-key="repetition_penalty" type="number" step="0.1" value="${escapeHtml(draft.repetitionPenalty)}" placeholder="Optional">
            </label>
            <label class="field">
              <span>Text Temperature</span>
              <input data-role="moss-advanced-input" data-key="text_temperature" type="number" step="0.1" value="${escapeHtml(draft.textTemperature)}" placeholder="Optional">
            </label>
            <label class="field">
              <span>Text Top P</span>
              <input data-role="moss-advanced-input" data-key="text_top_p" type="number" step="0.1" value="${escapeHtml(draft.textTopP)}" placeholder="Optional">
            </label>
            <label class="field">
              <span>Text Top K</span>
              <input data-role="moss-advanced-input" data-key="text_top_k" type="number" value="${escapeHtml(draft.textTopK)}" placeholder="Optional">
            </label>
          </div>
        </div>
      `;
    },
    readDraftFromDom(root, existingDraft) {
      const draft = this.ensureDraft(existingDraft);
      draft.prompt = root.querySelector('[data-role="prompt-input"]')?.value ?? draft.prompt;
      draft.mode = root.querySelector('[data-role="moss-mode"]:checked')?.value ?? draft.mode;
      draft.source = root.querySelector('[data-role="moss-source"]')?.value ?? draft.source;
      draft.samplePath = root.querySelector('[data-role="moss-sample-path"]')?.value ?? draft.samplePath;
      draft.presetId = root.querySelector('[data-role="moss-preset-id"]')?.value ?? draft.presetId;
      draft.referenceText = root.querySelector('[data-role="moss-reference-text"]')?.value ?? draft.referenceText;
      draft.showAdvanced = root.querySelector('[data-role="moss-show-advanced"]')?.checked ?? draft.showAdvanced;
      draft.doSample = root.querySelector('[data-role="moss-do-sample"]')?.checked ?? draft.doSample;
      draft.textChunkMode = root.querySelector('[data-role="moss-text-chunk-mode"]')?.value ?? draft.textChunkMode;
      for (const input of root.querySelectorAll('[data-role="moss-advanced-input"]')) {
        const key = input.dataset.key;
        const value = input.value ?? "";
        if (key === "max_tokens") {
          draft.maxTokens = value;
        }
        if (key === "temperature") {
          draft.temperature = value;
        }
        if (key === "top_p") {
          draft.topP = value;
        }
        if (key === "top_k") {
          draft.topK = value;
        }
        if (key === "repetition_penalty") {
          draft.repetitionPenalty = value;
        }
        if (key === "text_temperature") {
          draft.textTemperature = value;
        }
        if (key === "text_top_p") {
          draft.textTopP = value;
        }
        if (key === "text_top_k") {
          draft.textTopK = value;
        }
      }
      return draft;
    },
    serializeRequest(model, draft, shared, voiceCatalog) {
      const options = {};
      if (draft.textChunkMode !== "default") {
        options.text_chunk_mode = draft.textChunkMode;
      }
      if (draft.textTemperature !== "") {
        options.text_temperature = Number(draft.textTemperature);
      }
      if (draft.textTopP !== "") {
        options.text_top_p = Number(draft.textTopP);
      }
      if (draft.textTopK !== "") {
        options.text_top_k = Number(draft.textTopK);
      }

      const payloadBase = {
        model: model.id,
        input: draft.prompt.trim(),
        ...(draft.maxTokens !== "" ? { max_tokens: Number(draft.maxTokens) } : {}),
        ...(draft.temperature !== "" ? { temperature: Number(draft.temperature) } : {}),
        ...(draft.topP !== "" ? { top_p: Number(draft.topP) } : {}),
        ...(draft.topK !== "" ? { top_k: Number(draft.topK) } : {}),
        ...(draft.repetitionPenalty !== "" ? { repetition_penalty: Number(draft.repetitionPenalty) } : {}),
        do_sample: draft.doSample ? "true" : "false",
        ...shared,
        ...(Object.keys(options).length > 0 ? { options } : {}),
      };

      if (draft.mode === "clone") {
        if (draft.source === "sample") {
          const referenceText = sampleTranscriptText(voiceCatalog, draft.samplePath).trim();
          return {
            transport: "json",
            payload: {
              ...payloadBase,
              voice_ref: draft.samplePath,
              ...(referenceText ? { reference_text: referenceText } : {}),
            },
          };
        }

        if (draft.source === "preset") {
          const referenceText = findPresetById(voiceCatalog, draft.presetId)?.reference_text?.trim() ?? "";
          return {
            transport: "json",
            payload: {
              ...payloadBase,
              voice: draft.presetId,
              ...(referenceText ? { reference_text: referenceText } : {}),
            },
          };
        }

        const formData = new FormData();
        formData.append("model", model.id);
        formData.append("input", draft.prompt.trim());
        appendFields(formData, shared);
        if (draft.maxTokens !== "") {
          formData.append("max_tokens", String(draft.maxTokens));
        }
        if (draft.temperature !== "") {
          formData.append("temperature", String(draft.temperature));
        }
        if (draft.topP !== "") {
          formData.append("top_p", String(draft.topP));
        }
        if (draft.topK !== "") {
          formData.append("top_k", String(draft.topK));
        }
        if (draft.repetitionPenalty !== "") {
          formData.append("repetition_penalty", String(draft.repetitionPenalty));
        }
        formData.append("do_sample", draft.doSample ? "true" : "false");
        if (draft.uploadFile) {
          formData.append("voice_ref", draft.uploadFile);
        }
        if (draft.referenceText.trim()) {
          formData.append("reference_text", draft.referenceText.trim());
        }
        if (Object.keys(options).length > 0) {
          formData.append("options", JSON.stringify(options));
        }
        return {
          transport: "multipart",
          payload: formData,
        };
      }

      return {
        transport: "json",
        payload: payloadBase,
      };
    },
    validateDraft(draft) {
      if (!draft.prompt.trim()) {
        throw new Error("Enter text before submitting.");
      }
      if (draft.mode === "clone") {
        if (draft.source === "sample" && !draft.samplePath) {
          throw new Error("Choose a shared WAV sample for MOSS voice cloning.");
        }
        if (draft.source === "preset" && !draft.presetId) {
          throw new Error("Choose a preset for MOSS voice cloning.");
        }
        if (draft.source === "upload" && !draft.uploadFile) {
          throw new Error("Upload a WAV file for MOSS voice cloning.");
        }
      }
    },
  };
}

const FAMILY_SPECS = {
  vibevoice: {
    promptLabel: "Script",
    promptRows: 9,
    placeholder: "Speaker 1: Hello.\nSpeaker 2: Hi there.",
    defaultValue: VIBEVOICE_TEXT,
    helper:
      "Use one speaker turn per line. Each non-empty line must start with Speaker N: and the backend matches speaker ids to references in order.",
    textMode: "structured_script",
    cloneMode: "ordered_multi_wav",
    catalogSources: ["samples", "presets"],
    localUpload: true,
    createDraft() {
      return {
        prompt: VIBEVOICE_TEXT,
        speakers: [
          { source: "sample", serverValue: "", uploadFile: null },
          { source: "sample", serverValue: "", uploadFile: null },
        ],
      };
    },
    ensureDraft(existingDraft) {
      const draft = existingDraft ?? this.createDraft();
      draft.prompt = typeof draft.prompt === "string" ? draft.prompt : VIBEVOICE_TEXT;
      draft.speakers = Array.isArray(draft.speakers) && draft.speakers.length > 0
        ? draft.speakers.map((speaker) => ({
          source: speaker?.source === "upload" || speaker?.source === "preset" ? speaker.source : "sample",
          serverValue: typeof speaker?.serverValue === "string" ? speaker.serverValue : "",
          uploadFile: speaker?.uploadFile instanceof File ? speaker.uploadFile : null,
        }))
        : this.createDraft().speakers;
      return draft;
    },
    renderFields(draft, voiceCatalog) {
      return `${renderPromptField(this, draft)}${renderSpeakerRows(draft, voiceCatalog)}`;
    },
    readDraftFromDom(root, existingDraft) {
      const draft = this.ensureDraft(existingDraft);
      draft.prompt = root.querySelector('[data-role="prompt-input"]')?.value ?? draft.prompt;
      draft.speakers = draft.speakers.map((speaker, index) => {
        const source = root.querySelector(`[data-role="speaker-source"][data-index="${index}"]`)?.value ?? speaker.source;
        const serverValue = source === "preset"
          ? (root.querySelector(`[data-role="speaker-preset-value"][data-index="${index}"]`)?.value ?? speaker.serverValue)
          : (root.querySelector(`[data-role="speaker-sample-value"][data-index="${index}"]`)?.value ?? speaker.serverValue);
        return {
          source: source === "upload" || source === "preset" ? source : "sample",
          serverValue,
          uploadFile: speaker.uploadFile ?? null,
        };
      });
      return draft;
    },
    serializeRequest(model, draft, shared) {
      const hasLocalUpload = draft.speakers.some((speaker) => speaker.source === "upload");
      if (!hasLocalUpload) {
        return {
          transport: "json",
          payload: {
            model: model.id,
            input: draft.prompt.trim(),
            voice_samples: draft.speakers
              .map((speaker) => speaker.serverValue)
              .filter((value) => value),
            ...shared,
          },
        };
      }

      const formData = new FormData();
      formData.append("model", model.id);
      formData.append("input", draft.prompt.trim());
      appendFields(formData, shared);
      for (const speaker of draft.speakers) {
        if (speaker.source === "upload") {
          if (speaker.uploadFile) {
            formData.append("voice_samples", speaker.uploadFile);
          }
          continue;
        }
        if (speaker.serverValue) {
          formData.append("voice_samples", speaker.serverValue);
        }
      }
      return {
        transport: "multipart",
        payload: formData,
      };
    },
    validateDraft(draft, voiceCatalog) {
      if (!draft.prompt.trim()) {
        throw new Error("Enter a speaker script before submitting.");
      }
      if (draft.speakers.length === 0) {
        throw new Error("Add at least one speaker reference before submitting.");
      }
      const missingSpeaker = draft.speakers.find((speaker) => (
        speaker.source === "upload" ? !speaker.uploadFile : !speaker.serverValue
      ));
      if (missingSpeaker) {
        throw new Error("Each VibeVoice speaker row needs a shared sample, preset, or local WAV.");
      }
    },
  },
  kokoro_tts: {
    promptLabel: "Input Text",
    promptRows: 7,
    placeholder: "",
    defaultValue: DEFAULT_TEXT,
    helper: "Kokoro uses built-in packaged voices only. Select a server-exposed voice id or preset name.",
    textMode: "plain_text",
    cloneMode: "none",
    catalogSources: ["voices", "presets"],
    localUpload: false,
    createDraft() {
      return {
        prompt: DEFAULT_TEXT,
        voice: "",
      };
    },
    ensureDraft(existingDraft) {
      const draft = existingDraft ?? this.createDraft();
      draft.prompt = typeof draft.prompt === "string" ? draft.prompt : DEFAULT_TEXT;
      draft.voice = typeof draft.voice === "string" ? draft.voice : "";
      return draft;
    },
    renderFields(draft, voiceCatalog) {
      return `
        ${renderVoiceSelect("Voice", makeServerVoiceOptions(voiceCatalog), draft.voice, "Select voice")}
        ${renderPromptField(this, draft)}
      `;
    },
    readDraftFromDom(root, existingDraft) {
      const draft = this.ensureDraft(existingDraft);
      draft.prompt = root.querySelector('[data-role="prompt-input"]')?.value ?? draft.prompt;
      draft.voice = root.querySelector('[data-role="voice-select"]')?.value ?? draft.voice;
      return draft;
    },
    serializeRequest(model, draft, shared) {
      return {
        transport: "json",
        payload: {
          model: model.id,
          input: draft.prompt.trim(),
          voice: draft.voice,
          ...shared,
        },
      };
    },
    validateDraft(draft) {
      if (!draft.voice) {
        throw new Error("Choose a Kokoro voice before submitting.");
      }
      if (!draft.prompt.trim()) {
        throw new Error("Enter text before submitting.");
      }
    },
  },
  pocket_tts: {
    promptLabel: "Input Text",
    promptRows: 7,
    placeholder: "",
    defaultValue: DEFAULT_TEXT,
    helper: "",
    textMode: "plain_text",
    cloneMode: "single_wav_optional",
    catalogSources: ["voices"],
    localUpload: true,
    createDraft() {
      return {
        prompt: DEFAULT_TEXT,
        mode: "voice",
        voice: "",
        cloneSource: "sample",
        cloneSample: "",
        clonePreset: "",
        cloneFile: null,
      };
    },
    ensureDraft(existingDraft) {
      const draft = existingDraft ?? this.createDraft();
      draft.prompt = typeof draft.prompt === "string" ? draft.prompt : DEFAULT_TEXT;
      draft.mode = draft.mode === "clone" ? "clone" : "voice";
      draft.voice = typeof draft.voice === "string" ? draft.voice : "";
      draft.cloneSource = draft.cloneSource === "preset" || draft.cloneSource === "upload" ? draft.cloneSource : "sample";
      draft.cloneSample = typeof draft.cloneSample === "string" ? draft.cloneSample : "";
      draft.clonePreset = typeof draft.clonePreset === "string" ? draft.clonePreset : "";
      draft.cloneFile = draft.cloneFile instanceof File ? draft.cloneFile : null;
      return draft;
    },
    renderFields(draft, voiceCatalog) {
      return `
        ${renderPromptField(this, draft)}
        ${renderPocketCloneMode(draft, voiceCatalog)}
      `;
    },
    readDraftFromDom(root, existingDraft) {
      const draft = this.ensureDraft(existingDraft);
      draft.prompt = root.querySelector('[data-role="prompt-input"]')?.value ?? draft.prompt;
      draft.mode = root.querySelector('[data-role="pocket-mode"]:checked')?.value === "clone" ? "clone" : "voice";
      draft.voice = root.querySelector('[data-role="voice-select"]')?.value ?? draft.voice;
      draft.cloneSource = root.querySelector('[data-role="pocket-clone-source"]')?.value ?? draft.cloneSource;
      draft.cloneSample = root.querySelector('[data-role="pocket-clone-sample"]')?.value ?? draft.cloneSample;
      draft.clonePreset = root.querySelector('[data-role="pocket-clone-preset"]')?.value ?? draft.clonePreset;
      return draft;
    },
    serializeRequest(model, draft, shared) {
      if (draft.mode !== "clone") {
        return {
          transport: "json",
          payload: {
            model: model.id,
            input: draft.prompt.trim(),
            ...(draft.voice ? { voice: draft.voice } : {}),
            ...shared,
          },
        };
      }

      if (draft.cloneSource === "sample" && draft.cloneSample) {
        return {
          transport: "json",
          payload: {
            model: model.id,
            input: draft.prompt.trim(),
            voice_ref: draft.cloneSample,
            ...shared,
          },
        };
      }

      if (draft.cloneSource === "preset" && draft.clonePreset) {
        return {
          transport: "json",
          payload: {
            model: model.id,
            input: draft.prompt.trim(),
            voice: draft.clonePreset,
            ...shared,
          },
        };
      }

      const formData = new FormData();
      formData.append("model", model.id);
      formData.append("input", draft.prompt.trim());
      appendFields(formData, shared);
      if (draft.cloneSource === "upload" && draft.cloneFile) {
        formData.append("voice_ref", draft.cloneFile);
      }
      return {
        transport: "multipart",
        payload: formData,
      };
    },
    validateDraft(draft, voiceCatalog) {
      if (!draft.prompt.trim()) {
        throw new Error("Enter text before submitting.");
      }
      if (draft.mode === "clone" && draft.cloneSource === "sample" && !draft.cloneSample) {
        throw new Error("Choose a shared WAV sample for PocketTTS clone mode.");
      }
      if (draft.mode === "clone" && draft.cloneSource === "preset" && !draft.clonePreset) {
        throw new Error("Choose a preset for PocketTTS clone mode.");
      }
      if (draft.mode === "clone" && draft.cloneSource === "upload" && !draft.cloneFile) {
        throw new Error("Upload a WAV file for PocketTTS clone mode.");
      }
      if (draft.mode === "clone" && !draft.cloneSample && !draft.clonePreset && !draft.cloneFile) {
        throw new Error("Choose a shared WAV sample, preset, or upload a WAV file for PocketTTS clone mode.");
      }
    },
  },
  chatterbox: {
    promptLabel: "Input Text",
    promptRows: 7,
    placeholder: "",
    defaultValue: DEFAULT_TEXT,
    helper: "",
    textMode: "plain_text",
    cloneMode: "single_wav_required",
    catalogSources: ["samples", "presets"],
    localUpload: true,
    createDraft() {
      return {
        prompt: DEFAULT_TEXT,
        source: "sample",
        samplePath: "",
        presetId: "",
        uploadFile: null,
        referenceText: "",
        showAdvanced: false,
        language: "en",
        guidanceScale: "0.5",
        temperature: "0.8",
        topP: "0.8",
        repetitionPenalty: "2.0",
        doSample: true,
      };
    },
    ensureDraft(existingDraft) {
      const draft = existingDraft ?? this.createDraft();
      draft.prompt = typeof draft.prompt === "string" ? draft.prompt : DEFAULT_TEXT;
      draft.source = draft.source === "preset" || draft.source === "upload" ? draft.source : "sample";
      draft.samplePath = typeof draft.samplePath === "string" ? draft.samplePath : "";
      draft.presetId = typeof draft.presetId === "string" ? draft.presetId : "";
      draft.uploadFile = draft.uploadFile instanceof File ? draft.uploadFile : null;
      draft.referenceText = typeof draft.referenceText === "string" ? draft.referenceText : "";
      draft.showAdvanced = draft.showAdvanced === true;
      draft.language = CHATTERBOX_LANGUAGES.includes(draft.language) ? draft.language : "en";
      draft.guidanceScale = normalizeNumericDraftValue(draft.guidanceScale);
      draft.temperature = normalizeNumericDraftValue(draft.temperature);
      draft.topP = normalizeNumericDraftValue(draft.topP);
      draft.repetitionPenalty = normalizeNumericDraftValue(draft.repetitionPenalty);
      return draft;
    },
    renderFields(draft, voiceCatalog) {
      const sampleOptions = makeSampleOptions(voiceCatalog);
      const presetOptions = makePresetOptions(voiceCatalog);
      const uploadName = draft.uploadFile?.name ?? "No file selected";
      const transcript = resolveChatterboxTranscriptState(draft, voiceCatalog);
      const languageOptions = CHATTERBOX_LANGUAGES
        .map((language) => `<option value="${language}" ${language === draft.language ? "selected" : ""}>${language}</option>`)
        .join("");
      return `
        ${renderPromptField(this, draft)}
        <label class="field">
          <span>Reference Source</span>
          <select data-role="chatterbox-source">
            <option value="sample" ${draft.source === "sample" ? "selected" : ""}>Shared WAV Sample</option>
            <option value="preset" ${draft.source === "preset" ? "selected" : ""}>Preset</option>
            <option value="upload" ${draft.source === "upload" ? "selected" : ""}>Upload WAV</option>
          </select>
        </label>
        <label class="field ${draft.source === "sample" ? "" : "hidden"}" data-visibility="chatterbox-source-sample">
          <span>Shared WAV Sample</span>
          <select data-role="chatterbox-sample-path">
            ${renderSelectOptions(sampleOptions, draft.samplePath, "Select shared sample")}
          </select>
        </label>
        <label class="field ${draft.source === "preset" ? "" : "hidden"}" data-visibility="chatterbox-source-preset">
          <span>Preset</span>
          <select data-role="chatterbox-preset-id">
            ${renderSelectOptions(presetOptions, draft.presetId, "Select preset")}
          </select>
        </label>
        <label class="field ${draft.source === "upload" ? "" : "hidden"}" data-visibility="chatterbox-source-upload">
          <span>Local WAV</span>
          <input data-role="chatterbox-upload-file" type="file" accept=".wav,audio/wav">
          <small>${escapeHtml(uploadName)}</small>
        </label>
        <label class="field" data-visibility="chatterbox-reference-text">
          <span>Reference Transcript</span>
          <textarea data-role="chatterbox-reference-text" rows="4" placeholder="Transcript for the reference audio (optional but recommended)." ${transcript.readOnly ? "readonly" : ""}>${escapeHtml(transcript.value)}</textarea>
          <small class="family-helper">${escapeHtml(transcript.helper)}</small>
        </label>
        <label class="field">
          <span>Language</span>
          <select data-role="chatterbox-language">
            ${languageOptions}
          </select>
        </label>
        <div class="field-stack">
          <label class="toggle-row">
            <input data-role="chatterbox-show-advanced" type="checkbox" ${draft.showAdvanced ? "checked" : ""}>
            <span>Advanced Chatterbox controls</span>
          </label>
          <div class="field-grid ${draft.showAdvanced ? "" : "hidden"}" data-visibility="chatterbox-advanced">
            <label class="field">
              <span>Guidance Scale</span>
              <input data-role="chatterbox-advanced-input" data-key="guidance_scale" type="number" step="0.1" value="${escapeHtml(draft.guidanceScale)}" placeholder="Optional">
            </label>
            <label class="field">
              <span>Temperature</span>
              <input data-role="chatterbox-advanced-input" data-key="temperature" type="number" step="0.1" value="${escapeHtml(draft.temperature)}" placeholder="Optional">
            </label>
            <label class="field">
              <span>Top P</span>
              <input data-role="chatterbox-advanced-input" data-key="top_p" type="number" step="0.1" value="${escapeHtml(draft.topP)}" placeholder="Optional">
            </label>
            <label class="field">
              <span>Repetition Penalty</span>
              <input data-role="chatterbox-advanced-input" data-key="repetition_penalty" type="number" step="0.1" value="${escapeHtml(draft.repetitionPenalty)}" placeholder="Optional">
            </label>
            <label class="toggle-row">
              <input data-role="chatterbox-do-sample" type="checkbox" ${draft.doSample ? "checked" : ""}>
              <span>Do Sample</span>
            </label>
          </div>
        </div>
      `;
    },
    readDraftFromDom(root, existingDraft) {
      const draft = this.ensureDraft(existingDraft);
      draft.prompt = root.querySelector('[data-role="prompt-input"]')?.value ?? draft.prompt;
      draft.source = root.querySelector('[data-role="chatterbox-source"]')?.value ?? draft.source;
      draft.samplePath = root.querySelector('[data-role="chatterbox-sample-path"]')?.value ?? draft.samplePath;
      draft.presetId = root.querySelector('[data-role="chatterbox-preset-id"]')?.value ?? draft.presetId;
      draft.referenceText = root.querySelector('[data-role="chatterbox-reference-text"]')?.value ?? draft.referenceText;
      draft.language = root.querySelector('[data-role="chatterbox-language"]')?.value ?? draft.language;
      draft.showAdvanced = root.querySelector('[data-role="chatterbox-show-advanced"]')?.checked ?? draft.showAdvanced;
      draft.doSample = root.querySelector('[data-role="chatterbox-do-sample"]')?.checked ?? draft.doSample;
      for (const input of root.querySelectorAll('[data-role="chatterbox-advanced-input"]')) {
        const key = input.dataset.key;
        const value = input.value ?? "";
        if (key === "guidance_scale") {
          draft.guidanceScale = value;
        }
        if (key === "temperature") {
          draft.temperature = value;
        }
        if (key === "top_p") {
          draft.topP = value;
        }
        if (key === "repetition_penalty") {
          draft.repetitionPenalty = value;
        }
      }
      return draft;
    },
    serializeRequest(model, draft, shared, voiceCatalog) {
      const advancedFields = {};
      const sampleReferenceText = sampleTranscriptText(voiceCatalog, draft.samplePath).trim();
      const presetReferenceText = findPresetById(voiceCatalog, draft.presetId)?.reference_text?.trim() ?? "";
      if (draft.guidanceScale !== "") {
        advancedFields.guidance_scale = Number(draft.guidanceScale);
      }
      if (draft.temperature !== "") {
        advancedFields.temperature = Number(draft.temperature);
      }
      if (draft.topP !== "") {
        advancedFields.top_p = Number(draft.topP);
      }
      if (draft.repetitionPenalty !== "") {
        advancedFields.repetition_penalty = Number(draft.repetitionPenalty);
      }
      advancedFields.do_sample = draft.doSample ? "true" : "false";

      if (draft.source === "sample") {
        return {
          transport: "json",
          payload: {
            model: model.id,
            input: draft.prompt.trim(),
            voice_ref: draft.samplePath,
            language: draft.language,
            ...(sampleReferenceText ? { reference_text: sampleReferenceText } : {}),
            ...shared,
            ...advancedFields,
          },
        };
      }

      if (draft.source === "preset") {
        return {
          transport: "json",
          payload: {
            model: model.id,
            input: draft.prompt.trim(),
            voice: draft.presetId,
            language: draft.language,
            ...(presetReferenceText ? { reference_text: presetReferenceText } : {}),
            ...shared,
            ...advancedFields,
          },
        };
      }

      const formData = new FormData();
      formData.append("model", model.id);
      formData.append("input", draft.prompt.trim());
      formData.append("language", draft.language);
      appendFields(formData, shared);
      if (draft.uploadFile) {
        formData.append("voice_ref", draft.uploadFile);
      }
      if (draft.referenceText.trim()) {
        formData.append("reference_text", draft.referenceText.trim());
      }
      for (const [key, value] of Object.entries(advancedFields)) {
        formData.append(key, String(value));
      }
      return {
        transport: "multipart",
        payload: formData,
      };
    },
    validateDraft(draft) {
      if (!draft.prompt.trim()) {
        throw new Error("Enter text before submitting.");
      }
      if (draft.source === "sample" && !draft.samplePath) {
        throw new Error("Choose a shared WAV sample for Chatterbox voice cloning.");
      }
      if (draft.source === "preset" && !draft.presetId) {
        throw new Error("Choose a preset for Chatterbox voice cloning.");
      }
      if (draft.source === "upload" && !draft.uploadFile) {
        throw new Error("Upload a WAV file for Chatterbox voice cloning.");
      }
    },
  },
  moss_tts_local: createMossSpec({
    maxTokens: 4096,
    textTemperature: "1.0",
    textTopP: "1.0",
    textTopK: "50",
  }),
  moss_tts_nano: createMossSpec({
    maxTokens: 300,
    textTemperature: "1.5",
    textTopP: "1.0",
    textTopK: "50",
  }),
  omnivoice: {
    promptLabel: "Input Text",
    promptRows: 7,
    placeholder: "",
    defaultValue: DEFAULT_TEXT,
    helper: "Add any non-verbal tags directly in the prompt text.",
    textMode: "plain_text",
    cloneMode: "single_wav_required",
    catalogSources: ["samples", "presets"],
    localUpload: true,
    createDraft() {
      return {
        prompt: DEFAULT_TEXT,
        mode: "clone",
        source: "sample",
        samplePath: "",
        presetId: "",
        uploadFile: null,
        referenceText: "",
        instructions: "",
        showAdvanced: false,
        numInferenceSteps: "",
        guidanceScale: "",
        speed: "",
        audioChunkDurationSeconds: "",
        audioChunkThresholdSeconds: "",
      };
    },
    ensureDraft(existingDraft) {
      const draft = existingDraft ?? this.createDraft();
      draft.prompt = typeof draft.prompt === "string" ? draft.prompt : DEFAULT_TEXT;
      draft.mode = draft.mode === "design" ? "design" : "clone";
      draft.source = draft.source === "preset" || draft.source === "upload" ? draft.source : "sample";
      draft.samplePath = typeof draft.samplePath === "string" ? draft.samplePath : "";
      draft.presetId = typeof draft.presetId === "string" ? draft.presetId : "";
      draft.uploadFile = draft.uploadFile instanceof File ? draft.uploadFile : null;
      draft.referenceText = typeof draft.referenceText === "string" ? draft.referenceText : "";
      draft.instructions = typeof draft.instructions === "string" ? draft.instructions : "";
      draft.showAdvanced = draft.showAdvanced === true;
      draft.numInferenceSteps = normalizeNumericDraftValue(draft.numInferenceSteps);
      draft.guidanceScale = normalizeNumericDraftValue(draft.guidanceScale);
      draft.speed = normalizeNumericDraftValue(draft.speed);
      draft.audioChunkDurationSeconds = normalizeNumericDraftValue(draft.audioChunkDurationSeconds);
      draft.audioChunkThresholdSeconds = normalizeNumericDraftValue(draft.audioChunkThresholdSeconds);
      return draft;
    },
    renderFields(draft, voiceCatalog) {
      return `
        ${renderPromptField(this, draft)}
        <div class="segmented-control" role="radiogroup" aria-label="OmniVoice mode">
          <label class="segment-option">
            <input type="radio" name="omnivoice-mode" value="clone" data-role="omnivoice-mode" ${draft.mode === "clone" ? "checked" : ""}>
            <span>Clone</span>
          </label>
          <label class="segment-option">
            <input type="radio" name="omnivoice-mode" value="design" data-role="omnivoice-mode" ${draft.mode === "design" ? "checked" : ""}>
            <span>Voice Design</span>
          </label>
        </div>
        <div class="${draft.mode === "clone" ? "" : "hidden"}" data-visibility="omnivoice-clone-panel">
          ${renderOmniVoiceCloneMode(draft, voiceCatalog)}
        </div>
        <label class="field ${draft.mode === "design" ? "" : "hidden"}" data-visibility="omnivoice-design-panel">
          <span>Instruction</span>
          <textarea data-role="omnivoice-instructions" rows="4" placeholder="${escapeHtml(OMNIVOICE_INSTRUCTION_EXAMPLE)}">${escapeHtml(draft.instructions)}</textarea>
          <small class="family-helper">Use comma-separated assigned attributes only, not freeform prose. Supported English items include gender: <code>male</code>, <code>female</code>; age: <code>child</code>, <code>teenager</code>, <code>young adult</code>, <code>middle-aged</code>, <code>elderly</code>; pitch: <code>very low pitch</code>, <code>low pitch</code>, <code>moderate pitch</code>, <code>high pitch</code>, <code>very high pitch</code>; plus <code>whisper</code> and one accent such as <code>american accent</code>, <code>british accent</code>, <code>australian accent</code>, <code>chinese accent</code>, <code>canadian accent</code>, <code>indian accent</code>, <code>korean accent</code>, <code>portuguese accent</code>, <code>russian accent</code>, or <code>japanese accent</code>. Pick at most one item per category.</small>
        </label>
        ${renderOmniVoiceAdvanced(draft)}
      `;
    },
    readDraftFromDom(root, existingDraft) {
      const draft = this.ensureDraft(existingDraft);
      draft.prompt = root.querySelector('[data-role="prompt-input"]')?.value ?? draft.prompt;
      draft.mode = root.querySelector('[data-role="omnivoice-mode"]:checked')?.value === "design" ? "design" : "clone";
      draft.source = root.querySelector('[data-role="omnivoice-source"]')?.value ?? draft.source;
      draft.samplePath = root.querySelector('[data-role="omnivoice-sample-path"]')?.value ?? draft.samplePath;
      draft.presetId = root.querySelector('[data-role="omnivoice-preset-id"]')?.value ?? draft.presetId;
      draft.referenceText = root.querySelector('[data-role="omnivoice-reference-text"]')?.value ?? draft.referenceText;
      draft.instructions = root.querySelector('[data-role="omnivoice-instructions"]')?.value ?? draft.instructions;
      draft.showAdvanced = root.querySelector('[data-role="omnivoice-show-advanced"]')?.checked ?? draft.showAdvanced;
      for (const input of root.querySelectorAll('[data-role="omnivoice-advanced-input"]')) {
        const key = input.dataset.key;
        const value = input.value ?? "";
        if (key === "num_inference_steps") {
          draft.numInferenceSteps = value;
        }
        if (key === "guidance_scale") {
          draft.guidanceScale = value;
        }
        if (key === "speed") {
          draft.speed = value;
        }
        if (key === "audio_chunk_duration_seconds") {
          draft.audioChunkDurationSeconds = value;
        }
        if (key === "audio_chunk_threshold_seconds") {
          draft.audioChunkThresholdSeconds = value;
        }
      }
      return draft;
    },
    serializeRequest(model, draft, shared, voiceCatalog) {
      return serializeOmniVoiceRequest(model, draft, shared, voiceCatalog);
    },
    validateDraft(draft, voiceCatalog) {
      if (!draft.prompt.trim()) {
        throw new Error("Enter text before submitting.");
      }
      if (draft.mode === "design" && !draft.instructions.trim()) {
        throw new Error("Enter voice-design instructions before submitting.");
      }
      if (draft.mode !== "clone") {
        return;
      }
      if (draft.source === "sample" && !draft.samplePath) {
        throw new Error("Choose a shared WAV sample for OmniVoice clone mode.");
      }
      if (draft.source === "sample" && !resolveOmniVoiceTranscriptState(draft, voiceCatalog).value.trim()) {
        throw new Error("The selected OmniVoice shared sample does not have reference text. Add a same-stem .txt file or use upload mode.");
      }
      if (draft.source === "preset" && !draft.presetId) {
        throw new Error("Choose a preset for OmniVoice clone mode.");
      }
      if (draft.source === "preset" && !resolveOmniVoiceTranscriptState(draft, voiceCatalog).value.trim()) {
        throw new Error("The selected OmniVoice preset does not include reference text.");
      }
      if (draft.source === "upload" && !draft.uploadFile) {
        throw new Error("Upload a WAV file for OmniVoice clone mode.");
      }
      if (draft.source === "upload" && !draft.referenceText.trim()) {
        throw new Error("Enter reference text for the uploaded OmniVoice reference WAV.");
      }
    },
  },
  default: {
    promptLabel: "Input Text",
    promptRows: 7,
    placeholder: "",
    defaultValue: DEFAULT_TEXT,
    helper: "",
    textMode: "plain_text",
    cloneMode: "none",
    catalogSources: ["voices"],
    localUpload: false,
    createDraft() {
      return {
        prompt: DEFAULT_TEXT,
        voice: "",
      };
    },
    ensureDraft(existingDraft) {
      const draft = existingDraft ?? this.createDraft();
      draft.prompt = typeof draft.prompt === "string" ? draft.prompt : DEFAULT_TEXT;
      draft.voice = typeof draft.voice === "string" ? draft.voice : "";
      return draft;
    },
    renderFields(draft, voiceCatalog) {
      return `
        ${renderVoiceSelect("Voice", makeServerVoiceOptions(voiceCatalog), draft.voice, "Default")}
        ${renderPromptField(this, draft)}
      `;
    },
    readDraftFromDom(root, existingDraft) {
      const draft = this.ensureDraft(existingDraft);
      draft.prompt = root.querySelector('[data-role="prompt-input"]')?.value ?? draft.prompt;
      draft.voice = root.querySelector('[data-role="voice-select"]')?.value ?? draft.voice;
      return draft;
    },
    serializeRequest(model, draft, shared) {
      return {
        transport: "json",
        payload: {
          model: model.id,
          input: draft.prompt.trim(),
          ...(draft.voice ? { voice: draft.voice } : {}),
          ...shared,
        },
      };
    },
    validateDraft(draft) {
      if (!draft.prompt.trim()) {
        throw new Error("Enter text before submitting.");
      }
    },
  },
};

export function getFamilySpec(model) {
  return FAMILY_SPECS[familyKey(model)] ?? FAMILY_SPECS.default;
}

export function createInitialFamilyDraft(model) {
  return getFamilySpec(model).createDraft();
}

export function ensureFamilyDraft(model, existingDraft) {
  return getFamilySpec(model).ensureDraft(existingDraft);
}

export function renderFamilyFields(model, draft, voiceCatalog) {
  return getFamilySpec(model).renderFields(draft, voiceCatalog);
}

export function renderFamilyPanelTools(model, options = {}) {
  const parts = [];

  if (model?.mode === "streaming") {
    parts.push(`
      <label class="toggle-row">
        <input type="checkbox" data-role="tts-streaming-toggle" ${options.ttsStreamingEnabled ? "checked" : ""}>
        <span>Stream Audio</span>
      </label>
    `);
  }

  if (familyKey(model) === "omnivoice") {
    const tagList = OMNIVOICE_TAGS.map((tag) => `<code>${escapeHtml(tag)}</code>`).join("");
    parts.push(`
      <details class="panel-hint">
        <summary>OmniVoice Tags</summary>
        <div class="panel-hint-card">
          <p>Insert tags directly in the input text.</p>
          <div class="panel-tag-list">${tagList}</div>
        </div>
      </details>
    `);
  }

  return parts.join("");
}

export function readFamilyDraftFromDom(model, root, existingDraft) {
  return getFamilySpec(model).readDraftFromDom(root, existingDraft);
}

export function updateFamilyDraftFile(model, draft, role, index, file) {
  const nextDraft = ensureFamilyDraft(model, draft);
  const spec = getFamilySpec(model);
  if (spec === FAMILY_SPECS.pocket_tts && role === "pocket-clone-file") {
    if (file) {
      nextDraft.cloneSample = "";
      nextDraft.clonePreset = "";
      nextDraft.cloneSource = "upload";
    }
    nextDraft.cloneFile = file ?? null;
    return nextDraft;
  }
  if (spec === FAMILY_SPECS.vibevoice && role === "speaker-upload-file") {
    const target = nextDraft.speakers[index];
    if (target) {
      target.uploadFile = file ?? null;
    }
    return nextDraft;
  }
  if (spec === FAMILY_SPECS.omnivoice && role === "omnivoice-upload-file") {
    nextDraft.uploadFile = file ?? null;
    return nextDraft;
  }
  if (spec === FAMILY_SPECS.chatterbox && role === "chatterbox-upload-file") {
    nextDraft.uploadFile = file ?? null;
    return nextDraft;
  }
  if (spec === FAMILY_SPECS.moss_tts_local && role === "moss-upload-file") {
    nextDraft.uploadFile = file ?? null;
    return nextDraft;
  }
  if (spec === FAMILY_SPECS.moss_tts_nano && role === "moss-upload-file") {
    nextDraft.uploadFile = file ?? null;
    return nextDraft;
  }
  return nextDraft;
}

export function buildSpeechRequest(model, draft, sharedFields, voiceCatalog = { voices: [], presets: [], samples: [] }) {
  const spec = getFamilySpec(model);
  spec.validateDraft(draft, voiceCatalog);
  return spec.serializeRequest(model, draft, sharedFields, voiceCatalog);
}
