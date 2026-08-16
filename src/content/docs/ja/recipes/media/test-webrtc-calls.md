---
title: WebRTC通話をテストする
description: 1つのPlaywrightテストで発信者と着信者を動かし、実際の音声を通話に流し、相手側に聞こえていることを検証する。
sidebar:
  order: 3
---

**ユースケース:** アプリにリアルタイム通話がある — ビデオチャット、サポートホットラインのウィジェット、ペアプログラミングのボイス。ユーザーAが参加して話し、ユーザーBが実際にメディアを受信するテストを書きたい。

> ▶ **動くサンプル**: [`test-webrtc-calls.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/media/test-webrtc-calls.spec.ts) / [デモを触る](https://demo.untestable.dev/apps/call/)(実行方法は [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme))

## なぜ難しいのか

通話には**2つのブラウザ**と両側のメディアデバイスが必要で、しかもDOMに一切現れないもの — 接続は確立されたか? 音声は*流れて*いるか? — を検証しなければなりません。Playwrightは複数ページのオーケストレーションはできますが、メディアそのものについては何も提供しません。

## レシピ

### 1つのテストに2人のユーザー

`browser.newContext()` はそれぞれが独立したユーザーです(ストレージも権限も別)。発信者/着信者にぴったりです:

```ts
import { test, expect } from '@playwright/test';
import { mockMicrophone } from 'playwright-audio-mocking';

test('callee hears the caller', async ({ browser }) => {
  const caller = await (await browser.newContext()).newPage();
  const callee = await (await browser.newContext()).newPage();

  // ナビゲーション前に発信者へ「声」を与える
  const mic = await mockMicrophone(caller);

  const room = `test-${Date.now()}`;
  await caller.goto(`/call/${room}`);
  await callee.goto(`/call/${room}`);

  await caller.getByRole('button', { name: 'Join' }).click();
  await callee.getByRole('button', { name: 'Join' }).click();

  // 通話が接続されたことを示すUIレベルのシグナル
  await expect(callee.getByTestId('remote-participant')).toBeVisible();

  // 発信者が話す…
  await mic.play('tests/fixtures/hello.wav');

  // …着信者の <audio> 要素に実際のエネルギーが乗っている(下記参照)
  await expect
    .poll(() => remoteAudioLevel(callee), { timeout: 10_000 })
    .toBeGreaterThan(0.01);
});
```

### 音声が実際に流れていることの検証

「接続済み」バッジを信用せず、リモートストリームを測定しましょう。ほとんどのアプリはストリームを `<audio>`/`<video>` 要素にアタッチするので、アプリのコードに触れずにタップできます:

```ts
function remoteAudioLevel(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const el = document.querySelector('audio, video') as HTMLMediaElement;
    const stream = (el.srcObject as MediaStream) ?? (el as any).captureStream();
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    await new Promise((r) => setTimeout(r, 200)); // フレームが届くのを少し待つ
    analyser.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length); // RMS
  });
}
```

接続レベルの検証には `getStats()` が真実の情報源です — `packetsReceived` は増え続け、`audioLevel` は非ゼロであるべきです。これには `RTCPeerConnection` のハンドルが必要です。アプリが公開していない場合はinitスクリプトで捕まえます:

```ts
await callee.addInitScript(() => {
  const OrigPC = window.RTCPeerConnection;
  (window as any).__pcs = [];
  window.RTCPeerConnection = class extends OrigPC {
    constructor(...args: any[]) {
      super(...args);
      (window as any).__pcs.push(this);
    }
  };
});
```

## 注意点

- ヘッドレスChromiumはローカルICE候補をmDNSの `.local` 名で隠すため接続が `new` のまま進まないことがあります。テストでは `--disable-features=WebRtcHideLocalIpsWithMdns` を付けて起動してください。
- フェイクデバイスは両方動かしましょう: 内容を制御したい音声はモックマイク、カメラのフォールバックには `--use-fake-device-for-media-stream`([カメラ入力をモックする](../mock-camera-input/)参照)。
- 1つのブラウザプロセスに2ページはCIで遅くなることがあります。タイミングが重要なら、小さなシグナリングフィクスチャを使って2ワーカーに分けましょう。
- TURN/STUNの挙動はlocalhostと本番ネットワークで異なります — localhostで通った通話は、NAT越えが動くことの証明にはなりません。

## 関連レシピ

- [マイク入力をモックする](../mock-microphone-input/)
- [音が鳴っていることを検証する](../assert-sound-is-playing/)
