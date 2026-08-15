---
title: 音が鳴っていることを検証する
description: .play() が呼ばれたことではなく、音が実際に聞こえる状態で再生されていることを、Web Audioの解析で検証する。
sidebar:
  order: 4
---

**ユースケース:** 通知チャイム、メディアプレイヤー、ゲーム。恐れるべきリグレッションは*無音*です — 要素は「再生中」なのに音が出ていない(ミュートされたトラック、壊れたコーデック、自動再生ポリシー、音量0)。

## なぜ難しいのか

ヘッドレスブラウザにはスピーカーがなく、Playwrightには「音が出ているか」を調べるAPIがありません。`expect(el).toHaveJSProperty('paused', false)` は出力が無音でも通ります — `paused === false` は要素が再生*しようとしている*ことしか意味しないのです。

## レシピ

### AnalyserNodeで要素をタップする

`captureStream()` はメディア要素の出力を `MediaStream` として複製し、`AnalyserNode` で波形を取得できます。RMSエネルギーが非ゼロ = 聞こえる信号がある、ということです:

```ts
import { test, expect } from '@playwright/test';

async function audioRms(page, selector: string) {
  return page.evaluate(async (sel) => {
    const el = document.querySelector(sel) as HTMLMediaElement;
    const stream = (el as any).captureStream?.() ?? (el as any).mozCaptureStream();
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    ctx.createMediaStreamSource(stream).connect(analyser);
    await new Promise((r) => setTimeout(r, 300));
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
  }, selector);
}

test('notification chime is audible', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect.poll(() => audioRms(page, '#chime')).toBeGreaterThan(0.01);
});
```

### *鳴っている*ことだけでなく、*何が*鳴っているかを検証する

周波数データを見ればチャイムとブザーを区別できます。1つの要素を複数の音が共有している場合に便利です:

```ts
const dominantHz = await page.evaluate(() => {
  const analyser = (window as any).__analyser; // 上記と同様にセットアップしておく
  const bins = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(bins);
  const peak = bins.indexOf(Math.max(...bins));
  return (peak * analyser.context.sampleRate) / 2 / bins.length;
});
expect(dominantHz).toBeGreaterThan(800);   // チャイムは約880Hz
expect(dominantHz).toBeLessThan(950);
```

### Web Audioアプリ(メディア要素なし)

音が `AudioContext` から直接出る場合(ゲーム、シンセサイザー)は、initスクリプトでアプリのコンテキストを捕まえ、そのdestinationにアナライザーを接続します:

```ts
await page.addInitScript(() => {
  const Orig = window.AudioContext;
  window.AudioContext = class extends Orig {
    constructor(...args: any[]) {
      super(...args);
      (window as any).__audioCtx = this;
    }
  };
});
```

その後 `page.evaluate` 内でアナライザーを作り、`__audioCtx.destination` への入力を経由させます。

## 注意点

- Chromiumは `--autoplay-policy=no-user-gesture-required` を付けて起動してください。そうしないとユーザー操作の前にコンテキストがサスペンドされることがあります。
- メディア要素の `captureStream()` はWebKitでは実装されていません — この検証はChromium/Firefoxで実行するか、Web Audio経由にしてください。
- ミュートされた要素(`el.muted = true`)でも、一部のブラウザでは `captureStream()` にエネルギーが乗ります — ミュートこそが追いたいバグなら `el.muted === false` を別途検証しましょう。

## 関連レシピ

- [マイク入力をモックする](../mock-microphone-input/) — 入力側。
- [WebRTC通話をテストする](../test-webrtc-calls/) — 同じRMSのトリックをライブ通話に適用する。
