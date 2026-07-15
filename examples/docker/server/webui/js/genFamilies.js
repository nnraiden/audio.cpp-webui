const DEFAULT_PROMPT = "Describe the music or audio you want to generate.";

const ACE_STEP_ROUTE_OPTIONS = [
  { value: "text2music", label: "Text to Music", audioPolicy: "ignored", helper: "Generate music from prompt text and optional lyrics. Source audio is ignored." },
  { value: "complete", label: "Complete", audioPolicy: "optional", helper: "Continue or complete a track. Source audio is optional." },
  { value: "lego", label: "Lego", audioPolicy: "required", helper: "Generate a new layer or transformation from source audio. Source audio is required." },
  { value: "extract", label: "Extract", audioPolicy: "required", helper: "Extract a target track from source audio. Source audio is required." },
  { value: "cover", label: "Cover", audioPolicy: "required", helper: "Generate a cover version from source audio. Source audio is required." },
  { value: "cover-nofsq", label: "Cover Without FSQ", audioPolicy: "required", helper: "Generate a cover without FSQ conditioning. Source audio is required." },
  { value: "repaint", label: "Repaint", audioPolicy: "required", helper: "Replace a span inside source audio. Source audio and repaint bounds are required." },
];

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

function normalizeNumericDraftValue(value) {
  return typeof value === "string" ? value : "";
}

function routeConfig(route) {
  return ACE_STEP_ROUTE_OPTIONS.find((entry) => entry.value === route) ?? ACE_STEP_ROUTE_OPTIONS[0];
}

function routeUsesAudio(route) {
  return routeConfig(route).audioPolicy !== "ignored";
}

function routeRequiresAudio(route) {
  return routeConfig(route).audioPolicy === "required";
}

function routeUsesTrackName(route) {
  return route === "lego" || route === "extract";
}

function routeUsesLyrics(route) {
  return route === "text2music" || route === "cover" || route === "cover-nofsq";
}

function routeUsesCompleteTrackClasses(route) {
  return route === "complete";
}

function routeUsesRepaintWindow(route) {
  return route === "repaint";
}

function parseCommaSeparatedList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderPromptField(spec, draft) {
  const helperMarkup = spec.helper
    ? `<small class="family-helper">${escapeHtml(spec.helper)}</small>`
    : "";
  return `
    <label class="field">
      <span>${escapeHtml(spec.promptLabel)}</span>
      <textarea data-role="gen-prompt-input" rows="${spec.promptRows}" placeholder="${escapeHtml(spec.placeholder)}">${escapeHtml(draft.prompt)}</textarea>
      ${helperMarkup}
    </label>
  `;
}

function renderRouteOptions(selectedValue) {
  return ACE_STEP_ROUTE_OPTIONS
    .map((option) => (
      `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>${escapeHtml(option.label)}</option>`
    ))
    .join("");
}

function renderAceStepAdvanced(draft) {
  const advancedFields = [
    { key: "num_inference_steps", label: "Num Inference Steps", step: "1", value: draft.numInferenceSteps },
    { key: "guidance_scale", label: "Guidance Scale", step: "0.1", value: draft.guidanceScale },
    { key: "seed", label: "Seed", step: "1", value: draft.seed },
    { key: "negative_prompt", label: "Negative Prompt", type: "text", value: draft.negativePrompt },
    { key: "lm_temperature", label: "Planner Temperature", step: "0.01", value: draft.lmTemperature },
    { key: "lm_cfg_scale", label: "Planner CFG Scale", step: "0.1", value: draft.lmCfgScale },
    { key: "lm_top_k", label: "Planner Top K", step: "1", value: draft.lmTopK },
    { key: "lm_top_p", label: "Planner Top P", step: "0.01", value: draft.lmTopP },
    { key: "lm_repetition_penalty", label: "Planner Repetition Penalty", step: "0.01", value: draft.lmRepetitionPenalty },
    { key: "audio_cover_strength", label: "Audio Cover Strength", step: "0.01", value: draft.audioCoverStrength },
    { key: "cover_noise_strength", label: "Cover Noise Strength", step: "0.01", value: draft.coverNoiseStrength },
  ];
  const fieldsMarkup = advancedFields.map((field) => (
    `<label class="field">
      <span>${escapeHtml(field.label)}</span>
      <input
        data-role="ace-step-advanced-input"
        data-key="${escapeHtml(field.key)}"
        type="${field.type ?? "number"}"
        ${field.type === "text" ? "" : `step="${field.step}"`}
        value="${escapeHtml(field.value)}"
        placeholder="Optional"
      >
    </label>`
  )).join("");
  return `
    <div class="field-stack">
      <label class="toggle-row">
        <input data-role="ace-step-show-advanced" type="checkbox" ${draft.showAdvanced ? "checked" : ""}>
        <span>Advanced ACE-Step controls</span>
      </label>
      <div class="field-grid ${draft.showAdvanced ? "" : "hidden"}" data-visibility="ace-step-advanced">
        ${fieldsMarkup}
        <label class="field">
          <span>Sampler Mode</span>
          <select data-role="ace-step-sampler-mode">
            <option value="euler" ${draft.samplerMode === "euler" ? "selected" : ""}>euler</option>
            <option value="heun" ${draft.samplerMode === "heun" ? "selected" : ""}>heun</option>
          </select>
        </label>
        <label class="field">
          <span>Repaint Mode</span>
          <select data-role="ace-step-repaint-mode">
            <option value="balanced" ${draft.repaintMode === "balanced" ? "selected" : ""}>balanced</option>
            <option value="conservative" ${draft.repaintMode === "conservative" ? "selected" : ""}>conservative</option>
            <option value="aggressive" ${draft.repaintMode === "aggressive" ? "selected" : ""}>aggressive</option>
          </select>
        </label>
        <label class="field">
          <span>Repaint Strength</span>
          <input data-role="ace-step-repaint-strength" type="number" step="0.01" value="${escapeHtml(draft.repaintStrength)}" placeholder="Optional">
        </label>
      </div>
      <small class="family-helper"><code>flow_edit_morph</code> is not exposed here because the backend marks that path as not usable yet.</small>
    </div>
  `;
}

const FAMILY_SPECS = {
  ace_step: {
    promptLabel: "Prompt",
    promptRows: 6,
    placeholder: "cinematic synth pop with clear vocals",
    helper: "",
    createDraft() {
      return {
        prompt: DEFAULT_PROMPT,
        lyrics: "",
        route: "text2music",
        audioFile: null,
        trackName: "",
        completeTrackClasses: "",
        repaintStart: "",
        repaintEnd: "",
        language: "en",
        durationSeconds: "",
        bpm: "",
        keyscale: "",
        timesignature: "",
        showAdvanced: false,
        numInferenceSteps: "",
        guidanceScale: "",
        seed: "",
        negativePrompt: "",
        lmTemperature: "",
        lmCfgScale: "",
        lmTopK: "",
        lmTopP: "",
        lmRepetitionPenalty: "",
        audioCoverStrength: "",
        coverNoiseStrength: "",
        samplerMode: "euler",
        repaintMode: "balanced",
        repaintStrength: "",
      };
    },
    ensureDraft(existingDraft) {
      const draft = existingDraft ?? this.createDraft();
      draft.prompt = typeof draft.prompt === "string" ? draft.prompt : DEFAULT_PROMPT;
      draft.lyrics = typeof draft.lyrics === "string" ? draft.lyrics : "";
      draft.route = routeConfig(draft.route).value;
      draft.audioFile = draft.audioFile instanceof File ? draft.audioFile : null;
      draft.trackName = typeof draft.trackName === "string" ? draft.trackName : "";
      draft.completeTrackClasses = typeof draft.completeTrackClasses === "string" ? draft.completeTrackClasses : "";
      draft.repaintStart = normalizeNumericDraftValue(draft.repaintStart);
      draft.repaintEnd = normalizeNumericDraftValue(draft.repaintEnd);
      draft.language = typeof draft.language === "string" && draft.language.trim() ? draft.language : "en";
      draft.durationSeconds = normalizeNumericDraftValue(draft.durationSeconds);
      draft.bpm = normalizeNumericDraftValue(draft.bpm);
      draft.keyscale = typeof draft.keyscale === "string" ? draft.keyscale : "";
      draft.timesignature = typeof draft.timesignature === "string" ? draft.timesignature : "";
      draft.showAdvanced = draft.showAdvanced === true;
      draft.numInferenceSteps = normalizeNumericDraftValue(draft.numInferenceSteps);
      draft.guidanceScale = normalizeNumericDraftValue(draft.guidanceScale);
      draft.seed = normalizeNumericDraftValue(draft.seed);
      draft.negativePrompt = typeof draft.negativePrompt === "string" ? draft.negativePrompt : "";
      draft.lmTemperature = normalizeNumericDraftValue(draft.lmTemperature);
      draft.lmCfgScale = normalizeNumericDraftValue(draft.lmCfgScale);
      draft.lmTopK = normalizeNumericDraftValue(draft.lmTopK);
      draft.lmTopP = normalizeNumericDraftValue(draft.lmTopP);
      draft.lmRepetitionPenalty = normalizeNumericDraftValue(draft.lmRepetitionPenalty);
      draft.audioCoverStrength = normalizeNumericDraftValue(draft.audioCoverStrength);
      draft.coverNoiseStrength = normalizeNumericDraftValue(draft.coverNoiseStrength);
      draft.samplerMode = draft.samplerMode === "heun" ? "heun" : "euler";
      draft.repaintMode = ["balanced", "conservative", "aggressive"].includes(draft.repaintMode) ? draft.repaintMode : "balanced";
      draft.repaintStrength = normalizeNumericDraftValue(draft.repaintStrength);
      return draft;
    },
    renderFields(draft) {
      const route = routeConfig(draft.route);
      const uploadName = draft.audioFile?.name ?? "No file selected";
      return `
        ${renderPromptField(this, draft)}
        <label class="field">
          <span>Route</span>
          <select data-role="ace-step-route">
            ${renderRouteOptions(draft.route)}
          </select>
          <small class="family-helper">${escapeHtml(route.helper)}</small>
        </label>
        <label class="field ${routeUsesLyrics(draft.route) ? "" : "hidden"}" data-visibility="ace-step-lyrics">
          <span>Lyrics</span>
          <textarea data-role="ace-step-lyrics" rows="5" placeholder="Optional lyrics for vocal generations.">${escapeHtml(draft.lyrics)}</textarea>
        </label>
        <label class="field ${routeUsesAudio(draft.route) ? "" : "hidden"}" data-visibility="ace-step-audio">
          <span>Source Audio WAV${routeRequiresAudio(draft.route) ? " Required" : ""}</span>
          <input data-role="ace-step-audio-file" type="file" accept=".wav,audio/wav">
          <small>${escapeHtml(uploadName)}</small>
        </label>
        <label class="field ${routeUsesTrackName(draft.route) ? "" : "hidden"}" data-visibility="ace-step-track-name">
          <span>Track Name</span>
          <input data-role="ace-step-track-name" type="text" value="${escapeHtml(draft.trackName)}" placeholder="e.g. guitar or vocals">
        </label>
        <label class="field ${routeUsesCompleteTrackClasses(draft.route) ? "" : "hidden"}" data-visibility="ace-step-complete-track-classes">
          <span>Complete Track Classes</span>
          <input data-role="ace-step-complete-track-classes" type="text" value="${escapeHtml(draft.completeTrackClasses)}" placeholder="e.g. drums, bass, vocals">
          <small class="family-helper">Comma-separated classes used to shape the completion instruction.</small>
        </label>
        <div class="field-grid ${routeUsesRepaintWindow(draft.route) ? "" : "hidden"}" data-visibility="ace-step-repaint-window">
          <label class="field">
            <span>Repaint Start Seconds</span>
            <input data-role="ace-step-repaint-start" type="number" step="0.1" value="${escapeHtml(draft.repaintStart)}" placeholder="Required">
          </label>
          <label class="field">
            <span>Repaint End Seconds</span>
            <input data-role="ace-step-repaint-end" type="number" step="0.1" value="${escapeHtml(draft.repaintEnd)}" placeholder="Required">
          </label>
        </div>
        <div class="field-grid">
          <label class="field">
            <span>Language</span>
            <input data-role="ace-step-language" type="text" value="${escapeHtml(draft.language)}" placeholder="en">
          </label>
          <label class="field">
            <span>Duration Seconds</span>
            <input data-role="ace-step-duration-seconds" type="number" step="0.1" value="${escapeHtml(draft.durationSeconds)}" placeholder="Optional">
          </label>
          <label class="field">
            <span>BPM</span>
            <input data-role="ace-step-bpm" type="number" step="1" value="${escapeHtml(draft.bpm)}" placeholder="Optional">
          </label>
          <label class="field">
            <span>Key Scale</span>
            <input data-role="ace-step-keyscale" type="text" value="${escapeHtml(draft.keyscale)}" placeholder="Optional">
          </label>
          <label class="field">
            <span>Time Signature</span>
            <input data-role="ace-step-timesignature" type="text" value="${escapeHtml(draft.timesignature)}" placeholder="Optional">
          </label>
        </div>
        ${renderAceStepAdvanced(draft)}
      `;
    },
    readDraftFromDom(root, existingDraft) {
      const draft = this.ensureDraft(existingDraft);
      draft.prompt = root.querySelector('[data-role="gen-prompt-input"]')?.value ?? draft.prompt;
      draft.lyrics = root.querySelector('[data-role="ace-step-lyrics"]')?.value ?? draft.lyrics;
      draft.route = root.querySelector('[data-role="ace-step-route"]')?.value ?? draft.route;
      draft.trackName = root.querySelector('[data-role="ace-step-track-name"]')?.value ?? draft.trackName;
      draft.completeTrackClasses = root.querySelector('[data-role="ace-step-complete-track-classes"]')?.value ?? draft.completeTrackClasses;
      draft.repaintStart = root.querySelector('[data-role="ace-step-repaint-start"]')?.value ?? draft.repaintStart;
      draft.repaintEnd = root.querySelector('[data-role="ace-step-repaint-end"]')?.value ?? draft.repaintEnd;
      draft.language = root.querySelector('[data-role="ace-step-language"]')?.value ?? draft.language;
      draft.durationSeconds = root.querySelector('[data-role="ace-step-duration-seconds"]')?.value ?? draft.durationSeconds;
      draft.bpm = root.querySelector('[data-role="ace-step-bpm"]')?.value ?? draft.bpm;
      draft.keyscale = root.querySelector('[data-role="ace-step-keyscale"]')?.value ?? draft.keyscale;
      draft.timesignature = root.querySelector('[data-role="ace-step-timesignature"]')?.value ?? draft.timesignature;
      draft.showAdvanced = root.querySelector('[data-role="ace-step-show-advanced"]')?.checked ?? draft.showAdvanced;
      draft.samplerMode = root.querySelector('[data-role="ace-step-sampler-mode"]')?.value ?? draft.samplerMode;
      draft.repaintMode = root.querySelector('[data-role="ace-step-repaint-mode"]')?.value ?? draft.repaintMode;
      draft.repaintStrength = root.querySelector('[data-role="ace-step-repaint-strength"]')?.value ?? draft.repaintStrength;
      for (const input of root.querySelectorAll('[data-role="ace-step-advanced-input"]')) {
        const key = input.dataset.key;
        const value = input.value ?? "";
        if (key === "num_inference_steps") {
          draft.numInferenceSteps = value;
        }
        if (key === "guidance_scale") {
          draft.guidanceScale = value;
        }
        if (key === "seed") {
          draft.seed = value;
        }
        if (key === "negative_prompt") {
          draft.negativePrompt = value;
        }
        if (key === "lm_temperature") {
          draft.lmTemperature = value;
        }
        if (key === "lm_cfg_scale") {
          draft.lmCfgScale = value;
        }
        if (key === "lm_top_k") {
          draft.lmTopK = value;
        }
        if (key === "lm_top_p") {
          draft.lmTopP = value;
        }
        if (key === "lm_repetition_penalty") {
          draft.lmRepetitionPenalty = value;
        }
        if (key === "audio_cover_strength") {
          draft.audioCoverStrength = value;
        }
        if (key === "cover_noise_strength") {
          draft.coverNoiseStrength = value;
        }
      }
      return draft;
    },
    serializeRequest(model, draft) {
      const request = {
        model: model.id,
        text: draft.prompt.trim(),
        language: draft.language.trim(),
        route: draft.route,
      };
      if (draft.lyrics.trim() && routeUsesLyrics(draft.route)) {
        request.lyrics = draft.lyrics.trim();
      }
      if (draft.trackName.trim() && routeUsesTrackName(draft.route)) {
        request.track_name = draft.trackName.trim();
      }
      if (draft.durationSeconds !== "") {
        request.duration_seconds = Number(draft.durationSeconds);
      }
      if (draft.route === "repaint") {
        request.repaint_start = Number(draft.repaintStart);
        request.repaint_end = Number(draft.repaintEnd);
      }

      const options = {};
      const completeTrackClasses = parseCommaSeparatedList(draft.completeTrackClasses);
      if (completeTrackClasses.length > 0 && routeUsesCompleteTrackClasses(draft.route)) {
        options.complete_track_classes = completeTrackClasses;
      }
      if (draft.bpm !== "") {
        options.bpm = Number(draft.bpm);
      }
      if (draft.keyscale.trim()) {
        options.keyscale = draft.keyscale.trim();
      }
      if (draft.timesignature.trim()) {
        options.timesignature = draft.timesignature.trim();
      }
      if (draft.numInferenceSteps !== "") {
        options.num_inference_steps = Number(draft.numInferenceSteps);
      }
      if (draft.guidanceScale !== "") {
        options.guidance_scale = Number(draft.guidanceScale);
      }
      if (draft.seed !== "") {
        options.seed = Number(draft.seed);
      }
      if (draft.negativePrompt.trim()) {
        options.negative_prompt = draft.negativePrompt.trim();
      }
      if (draft.lmTemperature !== "") {
        options.lm_temperature = Number(draft.lmTemperature);
      }
      if (draft.lmCfgScale !== "") {
        options.lm_cfg_scale = Number(draft.lmCfgScale);
      }
      if (draft.lmTopK !== "") {
        options.lm_top_k = Number(draft.lmTopK);
      }
      if (draft.lmTopP !== "") {
        options.lm_top_p = Number(draft.lmTopP);
      }
      if (draft.lmRepetitionPenalty !== "") {
        options.lm_repetition_penalty = Number(draft.lmRepetitionPenalty);
      }
      if (draft.audioCoverStrength !== "") {
        options.audio_cover_strength = Number(draft.audioCoverStrength);
      }
      if (draft.coverNoiseStrength !== "") {
        options.cover_noise_strength = Number(draft.coverNoiseStrength);
      }
      if (draft.samplerMode !== "euler") {
        options.sampler_mode = draft.samplerMode;
      }
      if (draft.repaintMode !== "balanced") {
        options.repaint_mode = draft.repaintMode;
      }
      if (draft.repaintStrength !== "") {
        options.repaint_strength = Number(draft.repaintStrength);
      }
      if (Object.keys(options).length > 0) {
        request.options = options;
      }

      if (!draft.audioFile) {
        return {
          transport: "json",
          payload: request,
        };
      }

      const formData = new FormData();
      for (const [key, value] of Object.entries(request)) {
        if (key === "options") {
          formData.append("options", JSON.stringify(value));
          continue;
        }
        formData.append(key, String(value));
      }
      formData.append("audio", draft.audioFile);
      return {
        transport: "multipart",
        payload: formData,
      };
    },
    validateDraft(draft) {
      if (!draft.prompt.trim()) {
        throw new Error("Enter a prompt before submitting.");
      }
      if (routeRequiresAudio(draft.route) && !draft.audioFile) {
        throw new Error("Upload a WAV file for the selected ACE-Step route.");
      }
      if (routeUsesRepaintWindow(draft.route) && (draft.repaintStart === "" || draft.repaintEnd === "")) {
        throw new Error("Enter repaint start and end seconds for ACE-Step repaint.");
      }
    },
  },
  default: {
    promptLabel: "Prompt",
    promptRows: 6,
    placeholder: "Describe the audio you want.",
    helper: "Family-specific controls are not implemented for this generation model yet. This fallback submits prompt text only.",
    createDraft() {
      return { prompt: DEFAULT_PROMPT };
    },
    ensureDraft(existingDraft) {
      const draft = existingDraft ?? this.createDraft();
      draft.prompt = typeof draft.prompt === "string" ? draft.prompt : DEFAULT_PROMPT;
      return draft;
    },
    renderFields(draft) {
      return renderPromptField(this, draft);
    },
    readDraftFromDom(root, existingDraft) {
      const draft = this.ensureDraft(existingDraft);
      draft.prompt = root.querySelector('[data-role="gen-prompt-input"]')?.value ?? draft.prompt;
      return draft;
    },
    serializeRequest(model, draft) {
      return {
        transport: "json",
        payload: {
          model: model.id,
          text: draft.prompt.trim(),
        },
      };
    },
    validateDraft(draft) {
      if (!draft.prompt.trim()) {
        throw new Error("Enter a prompt before submitting.");
      }
    },
  },
};

export function getGenerationSpec(model) {
  return FAMILY_SPECS[familyKey(model)] ?? FAMILY_SPECS.default;
}

export function createInitialGenerationDraft(model) {
  return getGenerationSpec(model).createDraft();
}

export function ensureGenerationDraft(model, existingDraft) {
  return getGenerationSpec(model).ensureDraft(existingDraft);
}

export function renderGenerationFields(model, draft) {
  return getGenerationSpec(model).renderFields(draft);
}

export function readGenerationDraftFromDom(model, root, existingDraft) {
  return getGenerationSpec(model).readDraftFromDom(root, existingDraft);
}

export function updateGenerationDraftFile(model, draft, role, file) {
  const nextDraft = ensureGenerationDraft(model, draft);
  if (familyKey(model) === "ace_step" && role === "ace-step-audio-file") {
    nextDraft.audioFile = file ?? null;
  }
  return nextDraft;
}

export function buildGenerationRequest(model, draft) {
  const spec = getGenerationSpec(model);
  spec.validateDraft(draft);
  return spec.serializeRequest(model, draft);
}
