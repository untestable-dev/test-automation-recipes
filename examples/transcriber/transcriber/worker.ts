import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import type { WorkerRequest, WorkerResponse } from './messages';

const MODEL = 'onnx-community/whisper-tiny';

env.allowLocalModels = false;

// Hugging Face returns 404 to requests carrying a workers.dev Referer
// (anti-scraping), which breaks model downloads on the deployed site.
// Strip the referrer from every fetch this worker makes.
const originalFetch = self.fetch.bind(self);
self.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  originalFetch(input, { ...init, referrerPolicy: 'no-referrer' })) as typeof fetch;

const respond = (message: WorkerResponse) => self.postMessage(message);

let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function getTranscriber(device: string): Promise<AutomaticSpeechRecognitionPipeline> {
  transcriberPromise ??= createTranscriber(device);
  return transcriberPromise;
}

async function createTranscriber(device: string): Promise<AutomaticSpeechRecognitionPipeline> {
  const options = {
    progress_callback: (p: any) => {
      if (p.status === 'progress' && typeof p.progress === 'number') {
        respond({ type: 'model-progress', file: String(p.file ?? ''), progress: p.progress });
      }
    },
  };
  // `as any`: the pipeline() option types explode into a union TS refuses to represent.
  const create = (device: string) =>
    pipeline('automatic-speech-recognition', MODEL, { ...options, device } as any);
  if (device === 'wasm') return create('wasm');
  try {
    return await create('webgpu');
  } catch {
    // No (usable) WebGPU — fall back to the WASM backend.
    return create('wasm');
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'preload') {
      await getTranscriber(msg.device);
      respond({ type: 'model-ready' });
    } else if (msg.type === 'transcribe-live') {
      // Partial pass over the audio captured so far. Errors are non-fatal —
      // the next tick simply tries again.
      try {
        const transcriber = await getTranscriber(msg.device);
        const options: Record<string, unknown> = { chunk_length_s: 30, stride_length_s: 5 };
        if (msg.language !== 'auto') {
          options.language = msg.language;
          options.task = 'transcribe';
        }
        const result = await transcriber(msg.audio, options);
        const text = Array.isArray(result) ? result.map((r) => r.text).join('') : result.text;
        respond({ type: 'live-result', text });
      } catch {
        respond({ type: 'live-result', text: '' });
      }
    } else if (msg.type === 'transcribe') {
      const transcriber = await getTranscriber(msg.device);
      const started = performance.now();
      const options: Record<string, unknown> = { chunk_length_s: 30, stride_length_s: 5 };
      if (msg.language !== 'auto') {
        options.language = msg.language;
        options.task = 'transcribe';
      }
      const result = await transcriber(msg.audio, options);
      const text = Array.isArray(result) ? result.map((r) => r.text).join('') : result.text;
      respond({ type: 'result', text, elapsedMs: Math.round(performance.now() - started) });
    }
  } catch (err) {
    respond({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
