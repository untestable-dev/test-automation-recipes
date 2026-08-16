export type WorkerRequest =
  | { type: 'preload'; device: string }
  | { type: 'transcribe'; audio: Float32Array; language: string; device: string }
  | { type: 'transcribe-live'; audio: Float32Array; language: string; device: string };

export type WorkerResponse =
  | { type: 'model-progress'; file: string; progress: number }
  | { type: 'model-ready' }
  | { type: 'result'; text: string; elapsedMs: number }
  | { type: 'live-result'; text: string }
  | { type: 'error'; message: string };
