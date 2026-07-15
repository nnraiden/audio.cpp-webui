import assert from "node:assert/strict";

import { buildSpeechRequest, ensureFamilyDraft, renderFamilyFields, renderFamilyPanelTools, updateFamilyDraftFile } from "../js/ttsFamilies.js";

const OMNIVOICE_MODEL = {
  id: "omni",
  family: "omnivoice",
  task: "tts",
  mode: "offline",
};

const OMNIVOICE_CATALOG = {
  voices: [],
  presets: [
    {
      id: "assistant",
      voice_ref: "/srv/presets/assistant.wav",
      reference_text: "Preset transcript",
    },
  ],
  samples: [
    {
      id: "shared/guide",
      path: "/srv/shared/guide.wav",
      transcript_text: "Shared transcript",
    },
  ],
};

const CHATTERBOX_MODEL = {
  id: "chatterbox",
  family: "chatterbox",
  task: "clon",
  mode: "offline",
};

const CHATTERBOX_CATALOG = {
  voices: [],
  presets: [],
  samples: [
    {
      id: "shared/voice",
      path: "/srv/shared/voice.wav",
      transcript_text: "Shared voice transcript",
    },
  ],
};

function formEntries(formData) {
  return Array.from(formData.entries()).map(([key, value]) => [key, value instanceof File ? value.name : value]);
}

function testOmniVoiceCloneRendering() {
  const baseDraft = ensureFamilyDraft(OMNIVOICE_MODEL, null);

  const cloneHtml = renderFamilyFields(OMNIVOICE_MODEL, baseDraft, OMNIVOICE_CATALOG);
  assert.match(cloneHtml, /Reference Source/);
  assert.match(cloneHtml, /Shared WAV Sample/);
  assert.match(cloneHtml, /Preset/);
  assert.match(cloneHtml, /Upload WAV/);
  assert.match(cloneHtml, /Reference Transcript Required/);

  const sampleDraft = ensureFamilyDraft(OMNIVOICE_MODEL, {
    ...baseDraft,
    samplePath: "/srv/shared/guide.wav",
  });
  const sampleHtml = renderFamilyFields(OMNIVOICE_MODEL, sampleDraft, OMNIVOICE_CATALOG);
  assert.match(sampleHtml, />Shared transcript</);
  assert.match(sampleHtml, /readonly/);

  const presetDraft = ensureFamilyDraft(OMNIVOICE_MODEL, {
    ...baseDraft,
    source: "preset",
    presetId: "assistant",
  });
  const presetHtml = renderFamilyFields(OMNIVOICE_MODEL, presetDraft, OMNIVOICE_CATALOG);
  assert.match(presetHtml, />Preset transcript</);
  assert.match(presetHtml, /readonly/);

  const uploadDraft = ensureFamilyDraft(OMNIVOICE_MODEL, {
    ...baseDraft,
    source: "upload",
    referenceText: "Editable upload transcript",
  });
  const uploadHtml = renderFamilyFields(OMNIVOICE_MODEL, uploadDraft, OMNIVOICE_CATALOG);
  assert.match(uploadHtml, />Editable upload transcript</);
  assert.doesNotMatch(uploadHtml, /data-role="omnivoice-reference-text"[^>]*readonly/);
  assert.match(uploadHtml, /Reference transcript is required when uploading a reference WAV/);
}

function testOmniVoicePanelHint() {
  const html = renderFamilyPanelTools(OMNIVOICE_MODEL);
  assert.match(html, /OmniVoice Tags/);
  assert.match(html, /\[laughter\]/);
  assert.match(html, /\[question-en\]/);
  assert.match(html, /\[dissatisfaction-hnn\]/);
  assert.equal(renderFamilyPanelTools({ id: "pocket", family: "pocket_tts" }), "");
}

function testOmniVoiceDesignAndAdvancedRendering() {
  const draft = ensureFamilyDraft(OMNIVOICE_MODEL, {
    mode: "design",
    instructions: "Warm documentary narrator",
    showAdvanced: true,
    guidanceScale: "2.5",
  });
  const html = renderFamilyFields(OMNIVOICE_MODEL, draft, OMNIVOICE_CATALOG);
  assert.match(html, /Instruction/);
  assert.match(html, /Warm documentary narrator/);
  assert.match(html, /Use comma-separated assigned attributes only, not freeform prose/);
  assert.match(html, /female, young adult, moderate pitch, british accent/);
  assert.match(html, /american accent/);
  assert.match(html, /Advanced OmniVoice controls/);
  assert.match(html, /Guidance Scale/);
  assert.match(html, /Num Inference Steps/);
  assert.match(html, /Chunk Duration Seconds/);
  assert.match(html, /<div class="hidden" data-visibility="omnivoice-clone-panel">/);
}

function testOmniVoiceSerialization() {
  const sharedDraft = ensureFamilyDraft(OMNIVOICE_MODEL, {
    prompt: "Shared sample prompt",
    mode: "clone",
    source: "sample",
    samplePath: "/srv/shared/guide.wav",
    showAdvanced: true,
    numInferenceSteps: "16",
    guidanceScale: "2.0",
    speed: "1.1",
    audioChunkDurationSeconds: "15",
    audioChunkThresholdSeconds: "30",
  });
  const sharedRequest = buildSpeechRequest(
    OMNIVOICE_MODEL,
    sharedDraft,
    { seed: 7, max_tokens: 96 },
    OMNIVOICE_CATALOG
  );
  assert.equal(sharedRequest.transport, "json");
  assert.deepEqual(sharedRequest.payload, {
    model: "omni",
    input: "Shared sample prompt",
    voice_ref: "/srv/shared/guide.wav",
    reference_text: "Shared transcript",
    seed: 7,
    max_tokens: 96,
    num_inference_steps: 16,
    guidance_scale: 2,
    speed: 1.1,
    audio_chunk_duration_seconds: 15,
    audio_chunk_threshold_seconds: 30,
  });

  const presetDraft = ensureFamilyDraft(OMNIVOICE_MODEL, {
    prompt: "Preset prompt",
    mode: "clone",
    source: "preset",
    presetId: "assistant",
  });
  const presetRequest = buildSpeechRequest(OMNIVOICE_MODEL, presetDraft, {}, OMNIVOICE_CATALOG);
  assert.equal(presetRequest.transport, "json");
  assert.deepEqual(presetRequest.payload, {
    model: "omni",
    input: "Preset prompt",
    voice: "assistant",
    reference_text: "Preset transcript",
  });

  const uploadFile = new File(["RIFF"], "voice.wav", { type: "audio/wav" });
  const uploadDraft = updateFamilyDraftFile(
    OMNIVOICE_MODEL,
    ensureFamilyDraft(OMNIVOICE_MODEL, {
      prompt: "Upload prompt",
      mode: "clone",
      source: "upload",
      referenceText: "Upload transcript",
      speed: "0.9",
    }),
    "omnivoice-upload-file",
    null,
    uploadFile
  );
  const uploadRequest = buildSpeechRequest(OMNIVOICE_MODEL, uploadDraft, { seed: 13 }, OMNIVOICE_CATALOG);
  assert.equal(uploadRequest.transport, "multipart");
  assert.deepEqual(formEntries(uploadRequest.payload), [
    ["model", "omni"],
    ["input", "Upload prompt"],
    ["seed", "13"],
    ["speed", "0.9"],
    ["voice_ref", "voice.wav"],
    ["reference_text", "Upload transcript"],
  ]);

  const designDraft = ensureFamilyDraft(OMNIVOICE_MODEL, {
    prompt: "Design prompt",
    mode: "design",
    instructions: "Airy and cinematic",
    guidanceScale: "3.5",
  });
  const designRequest = buildSpeechRequest(OMNIVOICE_MODEL, designDraft, {}, OMNIVOICE_CATALOG);
  assert.equal(designRequest.transport, "json");
  assert.deepEqual(designRequest.payload, {
    model: "omni",
    input: "Design prompt",
    instructions: "Airy and cinematic",
    guidance_scale: 3.5,
  });
}

function testOmniVoiceTranscriptValidation() {
  assert.throws(
    () => buildSpeechRequest(
      OMNIVOICE_MODEL,
      ensureFamilyDraft(OMNIVOICE_MODEL, {
        prompt: "Shared sample prompt",
        mode: "clone",
        source: "sample",
        samplePath: "/srv/shared/missing.wav",
      }),
      {},
      { voices: [], presets: [], samples: [{ id: "missing", path: "/srv/shared/missing.wav", transcript_text: null }] }
    ),
    /shared sample does not have reference text/
  );

  assert.throws(
    () => buildSpeechRequest(
      OMNIVOICE_MODEL,
      ensureFamilyDraft(OMNIVOICE_MODEL, {
        prompt: "Preset prompt",
        mode: "clone",
        source: "preset",
        presetId: "assistant",
      }),
      {},
      { voices: [], presets: [{ id: "assistant", voice_ref: "/srv/p.wav", reference_text: null }], samples: [] }
    ),
    /preset does not include reference text/
  );

  const uploadFile = new File(["RIFF"], "voice.wav", { type: "audio/wav" });
  assert.throws(
    () => buildSpeechRequest(
      OMNIVOICE_MODEL,
      updateFamilyDraftFile(
        OMNIVOICE_MODEL,
        ensureFamilyDraft(OMNIVOICE_MODEL, {
          prompt: "Upload prompt",
          mode: "clone",
          source: "upload",
          referenceText: "",
        }),
        "omnivoice-upload-file",
        null,
        uploadFile
      ),
      {},
      OMNIVOICE_CATALOG
    ),
    /Enter reference text for the uploaded OmniVoice reference WAV/
  );
}

function testChatterboxRendering() {
  const baseDraft = ensureFamilyDraft(CHATTERBOX_MODEL, null);

  const html = renderFamilyFields(CHATTERBOX_MODEL, baseDraft, CHATTERBOX_CATALOG);
  assert.match(html, /Shared WAV Sample/);
  assert.match(html, /Upload WAV/);
  assert.match(html, /Reference Transcript/);
  assert.match(html, /Advanced Chatterbox controls/);
  assert.match(html, /Guidance Scale/);
  assert.match(html, /Temperature/);
  assert.match(html, /Top P/);
  assert.match(html, /Repetition Penalty/);
  assert.match(html, /Do Sample/);

  const sampleDraft = ensureFamilyDraft(CHATTERBOX_MODEL, {
    ...baseDraft,
    samplePath: "/srv/shared/voice.wav",
  });
  const sampleHtml = renderFamilyFields(CHATTERBOX_MODEL, sampleDraft, CHATTERBOX_CATALOG);
  assert.match(sampleHtml, />Reference transcript comes from a same-stem .txt file/);
  assert.match(sampleHtml, /readonly/);

  const uploadDraft = ensureFamilyDraft(CHATTERBOX_MODEL, {
    ...baseDraft,
    source: "upload",
    referenceText: "Upload transcript",
  });
  const uploadHtml = renderFamilyFields(CHATTERBOX_MODEL, uploadDraft, CHATTERBOX_CATALOG);
  assert.match(uploadHtml, />Transcript is optional when uploading/);
  assert.doesNotMatch(uploadHtml, /data-role="chatterbox-reference-text"[^>]*readonly/);
}

function testChatterboxSerialization() {
  const sharedDraft = ensureFamilyDraft(CHATTERBOX_MODEL, {
    prompt: "Hello from Chatterbox.",
    source: "sample",
    samplePath: "/srv/shared/voice.wav",
    showAdvanced: true,
    guidanceScale: "0.7",
    temperature: "0.9",
    topP: "0.7",
    repetitionPenalty: "1.5",
    doSample: true,
  });
  const sharedRequest = buildSpeechRequest(
    CHATTERBOX_MODEL,
    sharedDraft,
    { seed: 42, max_tokens: 500 },
    CHATTERBOX_CATALOG
  );
  assert.equal(sharedRequest.transport, "json");
  assert.deepEqual(sharedRequest.payload, {
    model: "chatterbox",
    input: "Hello from Chatterbox.",
    voice_ref: "/srv/shared/voice.wav",
    seed: 42,
    max_tokens: 500,
    guidance_scale: 0.7,
    temperature: 0.9,
    top_p: 0.7,
    repetition_penalty: 1.5,
    do_sample: "true",
  });

  const uploadFile = new File(["RIFF"], "voice.wav", { type: "audio/wav" });
  const uploadDraft = updateFamilyDraftFile(
    CHATTERBOX_MODEL,
    ensureFamilyDraft(CHATTERBOX_MODEL, {
      prompt: "Upload prompt",
      source: "upload",
      referenceText: "Upload transcript",
      showAdvanced: true,
      guidanceScale: "0.5",
      temperature: "0.8",
      topP: "0.8",
      repetitionPenalty: "2.0",
      doSample: true,
    }),
    "chatterbox-upload-file",
    null,
    uploadFile
  );
  const uploadRequest = buildSpeechRequest(CHATTERBOX_MODEL, uploadDraft, { seed: 13 }, CHATTERBOX_CATALOG);
  assert.equal(uploadRequest.transport, "multipart");
  assert.deepEqual(formEntries(uploadRequest.payload), [
    ["model", "chatterbox"],
    ["input", "Upload prompt"],
    ["seed", "13"],
    ["voice_ref", "voice.wav"],
    ["reference_text", "Upload transcript"],
    ["guidance_scale", "0.5"],
    ["temperature", "0.8"],
    ["top_p", "0.8"],
    ["repetition_penalty", "2"],
    ["do_sample", "true"],
  ]);
}

function testChatterboxValidation() {
  assert.throws(
    () => buildSpeechRequest(
      CHATTERBOX_MODEL,
      ensureFamilyDraft(CHATTERBOX_MODEL, {
        prompt: "",
        source: "sample",
        samplePath: "",
      }),
      {},
      CHATTERBOX_CATALOG
    ),
    /Enter text before submitting/
  );

  assert.throws(
    () => buildSpeechRequest(
      CHATTERBOX_MODEL,
      ensureFamilyDraft(CHATTERBOX_MODEL, {
        prompt: "Hello.",
        source: "sample",
        samplePath: "/srv/shared/missing.wav",
      }),
      {},
      { voices: [], presets: [], samples: [{ id: "missing", path: "/srv/shared/missing.wav", transcript_text: null }] }
    ),
    /shared sample does not have reference text/
  );

  assert.throws(
    () => buildSpeechRequest(
      CHATTERBOX_MODEL,
      ensureFamilyDraft(CHATTERBOX_MODEL, {
        prompt: "Hello.",
        source: "upload",
        uploadFile: null,
      }),
      {},
      CHATTERBOX_CATALOG
    ),
    /Upload a WAV file for Chatterbox/
  );
}

function main() {
  testOmniVoiceCloneRendering();
  testOmniVoicePanelHint();
  testOmniVoiceDesignAndAdvancedRendering();
  testOmniVoiceSerialization();
  testOmniVoiceTranscriptValidation();
  testChatterboxRendering();
  testChatterboxSerialization();
  testChatterboxValidation();
  console.log("ttsFamilies test passed");
}

main();
