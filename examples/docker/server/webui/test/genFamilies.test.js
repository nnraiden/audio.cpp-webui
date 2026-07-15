import assert from "node:assert/strict";

import { buildGenerationRequest, ensureGenerationDraft, renderGenerationFields, updateGenerationDraftFile } from "../js/genFamilies.js";
import { isGenerationModel, isSpeechModel } from "../js/modelTasks.js";

const ACE_STEP_MODEL = {
  id: "ace-step",
  family: "ace_step",
  task: "gen",
  mode: "offline",
};

function formEntries(formData) {
  return Array.from(formData.entries()).map(([key, value]) => [key, value instanceof File ? value.name : value]);
}

function testTaskClassification() {
  assert.equal(isSpeechModel(ACE_STEP_MODEL), false);
  assert.equal(isGenerationModel(ACE_STEP_MODEL), true);
}

function testAceStepRendering() {
  const draft = ensureGenerationDraft(ACE_STEP_MODEL, null);
  const html = renderGenerationFields(ACE_STEP_MODEL, draft);
  assert.match(html, /Prompt/);
  assert.match(html, /Route/);
  assert.match(html, /Advanced ACE-Step controls/);
}

function testAceStepRouteRendering() {
  const textDraft = ensureGenerationDraft(ACE_STEP_MODEL, {
    route: "text2music",
  });
  const textHtml = renderGenerationFields(ACE_STEP_MODEL, textDraft);
  assert.match(textHtml, /Text to Music/);
  assert.match(textHtml, /Source audio is ignored/);
  assert.match(textHtml, /data-visibility="ace-step-lyrics"/);
  assert.match(textHtml, /data-visibility="ace-step-audio" class="field hidden"|class="field hidden" data-visibility="ace-step-audio"/);

  const coverDraft = ensureGenerationDraft(ACE_STEP_MODEL, {
    route: "cover",
  });
  const coverHtml = renderGenerationFields(ACE_STEP_MODEL, coverDraft);
  assert.match(coverHtml, /Source Audio WAV Required/);

  const repaintDraft = ensureGenerationDraft(ACE_STEP_MODEL, {
    route: "repaint",
  });
  const repaintHtml = renderGenerationFields(ACE_STEP_MODEL, repaintDraft);
  assert.match(repaintHtml, /Repaint Start Seconds/);
  assert.match(repaintHtml, /Repaint End Seconds/);
}

function testAceStepSerializationTextToMusic() {
  const draft = ensureGenerationDraft(ACE_STEP_MODEL, {
    prompt: "cinematic synth pop with clear vocals",
    lyrics: "We rise with the morning light",
    route: "text2music",
    language: "en",
    durationSeconds: "60",
    bpm: "120",
    keyscale: "C major",
    timesignature: "4/4",
    showAdvanced: true,
    numInferenceSteps: "12",
    guidanceScale: "1.5",
    seed: "1234",
    negativePrompt: "muddy mix",
    lmTemperature: "0.7",
    lmCfgScale: "2.5",
    lmTopK: "32",
    lmTopP: "0.95",
    lmRepetitionPenalty: "1.1",
  });
  const request = buildGenerationRequest(ACE_STEP_MODEL, draft);
  assert.equal(request.transport, "json");
  assert.deepEqual(request.payload, {
    model: "ace-step",
    text: "cinematic synth pop with clear vocals",
    language: "en",
    route: "text2music",
    lyrics: "We rise with the morning light",
    duration_seconds: 60,
    options: {
      bpm: 120,
      keyscale: "C major",
      timesignature: "4/4",
      num_inference_steps: 12,
      guidance_scale: 1.5,
      seed: 1234,
      negative_prompt: "muddy mix",
      lm_temperature: 0.7,
      lm_cfg_scale: 2.5,
      lm_top_k: 32,
      lm_top_p: 0.95,
      lm_repetition_penalty: 1.1,
    },
  });
}

function testAceStepSerializationWithUpload() {
  const uploadFile = new File(["RIFF"], "source.wav", { type: "audio/wav" });
  const draft = updateGenerationDraftFile(
    ACE_STEP_MODEL,
    ensureGenerationDraft(ACE_STEP_MODEL, {
      prompt: "extract vocals",
      route: "extract",
      trackName: "vocals",
    }),
    "ace-step-audio-file",
    uploadFile
  );
  const request = buildGenerationRequest(ACE_STEP_MODEL, draft);
  assert.equal(request.transport, "multipart");
  assert.deepEqual(formEntries(request.payload), [
    ["model", "ace-step"],
    ["text", "extract vocals"],
    ["language", "en"],
    ["route", "extract"],
    ["track_name", "vocals"],
    ["audio", "source.wav"],
  ]);
}

function testAceStepSerializationRepaint() {
  const uploadFile = new File(["RIFF"], "song.wav", { type: "audio/wav" });
  const draft = updateGenerationDraftFile(
    ACE_STEP_MODEL,
    ensureGenerationDraft(ACE_STEP_MODEL, {
      prompt: "replace the middle with a brighter chorus",
      route: "repaint",
      repaintStart: "20",
      repaintEnd: "35",
      repaintMode: "conservative",
      repaintStrength: "0.4",
    }),
    "ace-step-audio-file",
    uploadFile
  );
  const request = buildGenerationRequest(ACE_STEP_MODEL, draft);
  assert.equal(request.transport, "multipart");
  const entries = formEntries(request.payload);
  assert.deepEqual(entries, [
    ["model", "ace-step"],
    ["text", "replace the middle with a brighter chorus"],
    ["language", "en"],
    ["route", "repaint"],
    ["repaint_start", "20"],
    ["repaint_end", "35"],
    ["options", JSON.stringify({ repaint_mode: "conservative", repaint_strength: 0.4 })],
    ["audio", "song.wav"],
  ]);
}

function testAceStepSerializationCompleteTrackClasses() {
  const draft = ensureGenerationDraft(ACE_STEP_MODEL, {
    prompt: "finish this as a cinematic rock track",
    route: "complete",
    completeTrackClasses: "drums, bass, vocals",
  });
  const request = buildGenerationRequest(ACE_STEP_MODEL, draft);
  assert.equal(request.transport, "json");
  assert.deepEqual(request.payload.options, {
    complete_track_classes: ["drums", "bass", "vocals"],
  });
}

function testAceStepValidation() {
  assert.throws(
    () => buildGenerationRequest(
      ACE_STEP_MODEL,
      ensureGenerationDraft(ACE_STEP_MODEL, {
        prompt: "",
      })
    ),
    /Enter a prompt before submitting/
  );
  assert.throws(
    () => buildGenerationRequest(
      ACE_STEP_MODEL,
      ensureGenerationDraft(ACE_STEP_MODEL, {
        prompt: "extract vocals",
        route: "extract",
      })
    ),
    /Upload a WAV file/
  );
  assert.throws(
    () => buildGenerationRequest(ACE_STEP_MODEL, updateGenerationDraftFile(
      ACE_STEP_MODEL,
      ensureGenerationDraft(ACE_STEP_MODEL, {
        prompt: "replace the middle",
        route: "repaint",
      }),
      "ace-step-audio-file",
      new File(["RIFF"], "song.wav", { type: "audio/wav" })
    )),
    /Enter repaint start and end seconds/
  );
}

function testHiddenFieldsDoNotSerializeAfterRouteSwitch() {
  const draft = ensureGenerationDraft(ACE_STEP_MODEL, {
    prompt: "new prompt",
    route: "text2music",
    trackName: "vocals",
    repaintStart: "10",
    repaintEnd: "20",
    completeTrackClasses: "drums",
  });
  const request = buildGenerationRequest(ACE_STEP_MODEL, draft);
  assert.deepEqual(request.payload, {
    model: "ace-step",
    text: "new prompt",
    language: "en",
    route: "text2music",
  });
}

function main() {
  testTaskClassification();
  testAceStepRendering();
  testAceStepRouteRendering();
  testAceStepSerializationTextToMusic();
  testAceStepSerializationWithUpload();
  testAceStepSerializationRepaint();
  testAceStepSerializationCompleteTrackClasses();
  testAceStepValidation();
  testHiddenFieldsDoNotSerializeAfterRouteSwitch();
  console.log("genFamilies test passed");
}

main();
