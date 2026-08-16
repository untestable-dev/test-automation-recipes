import { currentLang, onLangChange } from '../i18n';
import type { WorkerRequest, WorkerResponse } from './messages';
import { STRINGS } from './strings';

const recordBtn = document.getElementById('record') as HTMLButtonElement;
const stopBtn = document.getElementById('stop') as HTMLButtonElement;
const languageSelect = document.getElementById('language') as HTMLSelectElement;
const meterBar = document.getElementById('meter-bar') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const transcriptEl = document.getElementById('transcript') as HTMLDivElement;
const formattedEl = document.getElementById('formatted') as HTMLDivElement;
const useLlmCheckbox = document.getElementById('use-llm') as HTMLInputElement;

/** UI strings for the current language, resolved at call time so switches apply. */
const t = () => STRINGS[currentLang()];

// ?device=wasm forces the ONNX backend — used by the E2E tests for determinism.
const device = new URLSearchParams(location.search).get('device') ?? 'auto';

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

function post(message: WorkerRequest, transfer: Transferable[] = []) {
  worker.postMessage(message, transfer);
}

// Start the model download immediately — by the time the user hits record,
// live recognition can begin on the first tick. Cached by the browser after
// the first visit.
post({ type: 'preload', device });

let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let meterRaf = 0;
let recording = false;
let liveBusy = false;

const LIVE_TICK_MS = 3000;
const LIVE_WINDOW_SAMPLES = 16000 * 30; // transcribe at most the last 30s per pass

// Strings that live outside lang-tagged spans (title, <option> labels,
// placeholders) are re-applied on every language switch.
onLangChange((lang) => {
  const s = STRINGS[lang];
  document.title = s.pageTitle;
  const optionLabels: Record<string, string> = {
    auto: s.langAuto,
    japanese: s.langJapanese,
    english: s.langEnglish,
  };
  for (const opt of languageSelect.options) {
    const label = optionLabels[opt.value];
    if (label) opt.textContent = label;
  }
  transcriptEl.dataset.placeholder = recording ? s.listening : s.transcriptPlaceholder;
  formattedEl.dataset.placeholder = s.formattedPlaceholder;
});

worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'model-progress':
      statusEl.textContent = t().modelLoading(msg.file, Math.round(msg.progress));
      break;
    case 'model-ready':
      statusEl.textContent = recording ? t().recording : t().modelReady;
      break;
    case 'live-result':
      liveBusy = false;
      if (recording && msg.text.trim()) {
        transcriptEl.textContent = msg.text.trim();
      }
      break;
    case 'result':
      transcriptEl.textContent = msg.text.trim();
      statusEl.textContent = t().transcribed(msg.elapsedMs / 1000);
      recordBtn.disabled = false;
      void formatTranscript(msg.text.trim());
      break;
    case 'error':
      statusEl.textContent = `${t().errorPrefix}: ${msg.message}`;
      recordBtn.disabled = false;
      break;
  }
};

async function startRecording() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  audioCtx = new AudioContext();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  audioCtx.createMediaStreamSource(stream).connect(analyser);
  const levels = new Uint8Array(analyser.frequencyBinCount);
  const drawMeter = () => {
    analyser.getByteTimeDomainData(levels);
    let max = 0;
    for (const v of levels) max = Math.max(max, Math.abs(v - 128));
    meterBar.style.width = `${Math.min(100, (max / 128) * 200)}%`;
    meterRaf = requestAnimationFrame(drawMeter);
  };
  drawMeter();

  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
    void liveTranscribe();
  };
  // Timeslice makes ondataavailable fire periodically — that's the realtime tick.
  mediaRecorder.start(LIVE_TICK_MS);

  recording = true;
  recordBtn.disabled = true;
  stopBtn.disabled = false;
  transcriptEl.textContent = '';
  transcriptEl.dataset.placeholder = t().listening;
  formattedEl.textContent = '';
  formattedEl.dataset.placeholder = t().formattedPlaceholder;
  statusEl.textContent = t().recording;
}

/** Transcribe everything captured so far and update the live transcript. */
async function liveTranscribe() {
  if (!recording || liveBusy || chunks.length === 0 || !mediaRecorder) return;
  liveBusy = true;
  try {
    const audio = await toPcm16k(new Blob(chunks, { type: mediaRecorder.mimeType }));
    const window_ =
      audio.length > LIVE_WINDOW_SAMPLES ? audio.slice(-LIVE_WINDOW_SAMPLES) : audio;
    post(
      { type: 'transcribe-live', audio: window_, language: languageSelect.value, device },
      [window_.buffer],
    );
    // liveBusy is cleared when the worker answers with live-result.
  } catch {
    liveBusy = false;
  }
}

async function stopRecording() {
  if (!mediaRecorder || !stream) return;
  recording = false;
  stopBtn.disabled = true;

  const recorder = mediaRecorder;
  const recorded = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
  });
  recorder.stop();
  const blob = await recorded;

  cancelAnimationFrame(meterRaf);
  meterBar.style.width = '0%';
  stream.getTracks().forEach((t) => t.stop());
  stream = null;
  mediaRecorder = null;
  await audioCtx?.close();
  audioCtx = null;

  statusEl.textContent = t().converting;
  const audio = await toPcm16k(blob);
  statusEl.textContent = t().transcribing;
  post({ type: 'transcribe', audio, language: languageSelect.value, device }, [audio.buffer]);
}

let decodeCtx: AudioContext | null = null;

/** Decode the recorded blob straight to 16 kHz mono — Whisper's input format. */
async function toPcm16k(blob: Blob): Promise<Float32Array> {
  // decodeAudioData resamples to the context's rate, so a 16 kHz context
  // gives us Whisper's input format directly. Kept open across live ticks.
  decodeCtx ??= new AudioContext({ sampleRate: 16000 });
  const decoded = await decodeCtx.decodeAudioData(await blob.arrayBuffer());
  return decoded.getChannelData(0);
}

/** Send the raw transcript to the Workers AI endpoint for cleanup. Text only — never audio. */
async function formatTranscript(text: string) {
  formattedEl.textContent = '';
  if (!useLlmCheckbox.checked || !text) return;
  formattedEl.dataset.placeholder = t().formatting;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch('/api/format', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { formatted } = (await res.json()) as { formatted: string };
      formattedEl.textContent = formatted;
      return;
    } catch {
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      formattedEl.dataset.placeholder = t().formatFailed;
    }
  }
}

recordBtn.addEventListener('click', () => {
  startRecording().catch((err) => {
    statusEl.textContent = `${t().micError}: ${err}`;
  });
});

stopBtn.addEventListener('click', () => {
  stopRecording().catch((err) => {
    statusEl.textContent = `${t().errorPrefix}: ${err}`;
    recordBtn.disabled = false;
  });
});
