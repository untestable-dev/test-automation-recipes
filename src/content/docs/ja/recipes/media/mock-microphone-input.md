---
title: マイク入力をモックする
description: getUserMedia() に実際の音声ファイルを流し込み、音声認識・ボイスメモ・オーディオメーターをすべてのブラウザでテストする。
sidebar:
  order: 1
---

**ユースケース:** アプリがユーザーの声を録音する — 音声認識(Speech-to-Text)、ボイスメモ、発音を採点する語学学習アプリ、音声レベルメーター。**マイクに向かって話す**自動テストを書きたい。

## なぜ難しいのか

Playwrightにはマイク入力のためのAPIがありません。よく見つかる回避策には、それぞれ大きな制約があります:

- `--use-file-for-fake-audio-capture` は **Chromium専用**、**WAVのみ**対応、しかもファイルは**ブラウザ起動時に固定**されます。最初の画面ではAと言い、次の画面ではBと言う、といったことができません。
- OSレベルの仮想オーディオデバイスに音声を流す方法は動きますが、CIで運用するのは非常につらいです。

## レシピ

[playwright-audio-mocking](https://www.npmjs.com/package/playwright-audio-mocking) は、ページ読み込み前に `navigator.mediaDevices.getUserMedia` を置き換え、実際のWeb Audioベースの `MediaStream` を返します。その先にあるもの — `MediaRecorder`、`AnalyserNode`、WebRTC、音声認識API — はすべて無改造で動作し、Chromium・Firefox・WebKitに対応しています。

```sh
npm install -D playwright-audio-mocking
```

```ts
import { test, expect } from '@playwright/test';
import { mockMicrophone } from 'playwright-audio-mocking';

test('transcribes speech', async ({ page }) => {
  const mic = await mockMicrophone(page);   // page.goto() より前にインストールする
  await page.goto('/voice-memo');

  await page.getByRole('button', { name: 'Record' }).click();
  await mic.play('tests/fixtures/hello-world.wav');  // マイクに音声を流し込む
  await mic.waitForEnd();
  await page.getByRole('button', { name: 'Stop' }).click();

  await expect(page.getByTestId('transcript')).toContainText('hello world');
});
```

### 実行時の制御

起動時フラグと違い、再生はテストの途中でも完全にスクリプトから制御できます:

```ts
await mic.play('fixtures/greeting.mp3');            // ブラウザがデコードできる形式なら何でも
await mic.play('fixtures/question.mp3');            // ストリーミング中のファイル切り替え
await mic.play('fixtures/hold-music.mp3', { loop: true });
await mic.pause();                                  // 無音になり、再生位置は保持
await mic.resume();
await mic.stop();                                   // 無音になり、再生位置はリセット

const { playing, position, duration } = await mic.status();
```

### フィクスチャファイルなしで音声を生成する

ファイルパスの代わりにバイト列を渡せます — たとえばTTS APIの出力を直接流し込めば、テストごとに違う内容を話させることができます:

```ts
await mic.play(Buffer.from(await synthesizeSpeech('add milk to my shopping list')));
```

## 注意点

- `mockMicrophone(page)` は **必ず** `page.goto()` より前に呼んでください — initスクリプトとして注入されるためです。
- Chromiumでは `RECOMMENDED_CHROMIUM_ARGS`(`--autoplay-policy=no-user-gesture-required`)を付けて起動すると、ユーザー操作なしでWeb Audioを開始できます。
- モックが置き換えるのは**音声**トラックのみです。`getUserMedia({ audio, video })` の場合、videoの制約はデフォルトで本来の実装にパススルーされます。

## 関連レシピ

- [WebRTC通話をテストする](../test-webrtc-calls/) — モックしたマイクを発信者の声として使う。
- [音が鳴っていることを検証する](../assert-sound-is-playing/) — 同じ問題の出力側。
- [カメラ入力をモックする](../mock-camera-input/) — 映像版。
