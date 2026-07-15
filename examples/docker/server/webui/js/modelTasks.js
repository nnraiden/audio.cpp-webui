export function isSpeechModel(model) {
  return model?.task === "tts" || model?.task === "clon";
}
