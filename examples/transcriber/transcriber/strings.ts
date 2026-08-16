import type { Lang } from '../i18n';

// JS-generated UI strings. Static copy lives in index.html as lang-tagged spans.
const en = {
  pageTitle: 'Voice Transcriber | Web App Demos',
  modelLoading: (file: string, pct: number) => `Loading model… ${file} ${pct}%`,
  modelReady: 'Model ready',
  recording: 'Recording (live transcription)…',
  transcribed: (seconds: number) => `Transcription complete (${seconds} s)`,
  errorPrefix: 'Error',
  converting: 'Converting audio…',
  transcribing: 'Transcribing…',
  listening: 'Listening…',
  transcriptPlaceholder: 'The transcript will appear here',
  formattedPlaceholder: 'The formatted result will appear here',
  formatting: 'Formatting with LLM…',
  formatFailed: 'Formatting failed (skipped where /api/format is unavailable, e.g. local runs)',
  micError: 'Could not access the microphone',
  langAuto: 'Auto-detect',
  langJapanese: 'Japanese',
  langEnglish: 'English',
};

const ja: typeof en = {
  pageTitle: '音声文字起こしサービス | Web App Demos',
  modelLoading: (file: string, pct: number) => `モデル読み込み中… ${file} ${pct}%`,
  modelReady: 'モデル準備完了',
  recording: '録音中(リアルタイム認識)…',
  transcribed: (seconds: number) => `文字起こし完了(${seconds} 秒)`,
  errorPrefix: 'エラー',
  converting: '音声を変換中…',
  transcribing: '文字起こし中…',
  listening: '認識中…',
  transcriptPlaceholder: 'ここに文字起こし結果が表示されます',
  formattedPlaceholder: 'ここに整形結果が表示されます',
  formatting: 'LLMで整形中…',
  formatFailed: '整形に失敗しました(ローカル実行など /api/format が無い環境ではスキップされます)',
  micError: 'マイクを取得できませんでした',
  langAuto: '自動判定',
  langJapanese: '日本語',
  langEnglish: 'English',
};

export const STRINGS: Record<Lang, typeof en> = { en, ja };
