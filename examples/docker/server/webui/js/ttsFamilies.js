const DEFAULT_TEXT = "audio.cpp is serving this request through the framework runtime.";

const VIBEVOICE_TEXT = [
  "Speaker 1: Hello, thanks for joining this test.",
  "Speaker 2: Happy to be here. The script format is working.",
].join("\n");

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
      for (const [key, value] of Object.entries(shared)) {
        formData.append(key, String(value));
      }
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
      for (const [key, value] of Object.entries(shared)) {
        formData.append(key, String(value));
      }
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
  }
  return nextDraft;
}

export function buildSpeechRequest(model, draft, sharedFields) {
  const spec = getFamilySpec(model);
  spec.validateDraft(draft);
  return spec.serializeRequest(model, draft, sharedFields);
}
