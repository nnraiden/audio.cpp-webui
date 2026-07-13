export const state = {
  models: [],
  selectedModelId: "",
  voiceCatalog: {
    voices: [],
    presets: [],
    samples: [],
  },
  ttsAudioUrl: null,
  familyDrafts: {},
};

export function getSelectedModel() {
  return state.models.find((model) => model.id === state.selectedModelId) ?? null;
}

export function setModels(models) {
  state.models = models;
  if (!models.some((model) => model.id === state.selectedModelId)) {
    state.selectedModelId = models[0]?.id ?? "";
  }
}

export function setSelectedModelId(modelId) {
  state.selectedModelId = modelId;
}

export function setVoiceCatalog(catalog) {
  state.voiceCatalog = {
    voices: catalog.voices ?? [],
    presets: catalog.presets ?? [],
    samples: catalog.samples ?? [],
  };
}

export function setTtsAudioUrl(nextUrl) {
  if (state.ttsAudioUrl) {
    URL.revokeObjectURL(state.ttsAudioUrl);
  }
  state.ttsAudioUrl = nextUrl;
}

export function getFamilyDraft(key) {
  return state.familyDrafts[key] ?? null;
}

export function setFamilyDraft(key, draft) {
  state.familyDrafts[key] = draft;
}
