export function isSpeechModel(model) {
  return model?.task === "tts" || model?.task === "clon";
}

export function isGenerationModel(model) {
  return model?.task === "gen";
}
