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
      ${renderVoiceSelect("Shared WAV Sample", sampleOptions, draft.cloneSample, "Select shared sample")}
      <label class="field">
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
    validateDraft(draft) {
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
        cloneSample: "",
        cloneFile: null,
      };
    },
    ensureDraft(existingDraft) {
      const draft = existingDraft ?? this.createDraft();
      draft.prompt = typeof draft.prompt === "string" ? draft.prompt : DEFAULT_TEXT;
      draft.mode = draft.mode === "clone" ? "clone" : "voice";
      draft.voice = typeof draft.voice === "string" ? draft.voice : "";
      draft.cloneSample = typeof draft.cloneSample === "string" ? draft.cloneSample : "";
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
      draft.cloneSample = root.querySelector('[data-visibility="pocket-clone-mode"] [data-role="voice-select"]')?.value ?? draft.cloneSample;
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

      if (draft.cloneSample) {
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

      const formData = new FormData();
      formData.append("model", model.id);
      formData.append("input", draft.prompt.trim());
      appendFields(formData, shared);
      if (draft.cloneFile) {
        formData.append("voice_ref", draft.cloneFile);
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
      if (draft.mode === "clone" && !draft.cloneSample && !draft.cloneFile) {
        throw new Error("Choose a shared WAV sample or upload a WAV file for PocketTTS clone mode.");
      }
    },
  },
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

export function renderFamilyPanelTools(model) {
  if (familyKey(model) !== "omnivoice") {
    return "";
  }
  const tagList = OMNIVOICE_TAGS.map((tag) => `<code>${escapeHtml(tag)}</code>`).join("");
  return `
    <details class="panel-hint">
      <summary>OmniVoice Tags</summary>
      <div class="panel-hint-card">
        <p>Insert tags directly in the input text.</p>
        <div class="panel-tag-list">${tagList}</div>
      </div>
    </details>
  `;
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
  return nextDraft;
}

export function buildSpeechRequest(model, draft, sharedFields, voiceCatalog = { voices: [], presets: [], samples: [] }) {
  const spec = getFamilySpec(model);
  spec.validateDraft(draft, voiceCatalog);
  return spec.serializeRequest(model, draft, sharedFields, voiceCatalog);
}
