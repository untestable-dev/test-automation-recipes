---
title: カメラ入力をモックする
description: getUserMedia() に用意した動画ファイルを流し込み、QRスキャナー・ビデオチャットプレビュー・カメラ撮影フローをテストする。
sidebar:
  order: 2
---

**ユースケース:** アプリがカメラを使う — QR/バーコードスキャナー、本人確認書類の撮影フロー、ビデオチャットのプレビュー。用意した動画をカメラに「見せる」テストを書きたい。

> ▶ **動くサンプル**: [`mock-camera-input.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/media/mock-camera-input.spec.ts) / [デモを触る](https://demo.untestable.dev/apps/camera-scan/)(実行方法は [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme))

## なぜ難しいのか

Playwrightにはカメラ入力のためのAPIがなく、音声と違ってこの問題をきれいに解決するクロスブラウザのライブラリも(まだ)存在しません。あるのはブラウザごとのスイッチの寄せ集めです。

## レシピ

### Chromium: フェイクデバイス + 動画ファイル

Chromiumは起動時にカメラをループ再生の動画に置き換えられます:

```ts
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: {
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',      // 権限プロンプトを自動承認する
            '--use-fake-device-for-media-stream',  // フェイクカメラを提供する
            '--use-file-for-fake-video-capture=tests/fixtures/qr-code.y4m',
          ],
        },
      },
    },
  ],
});
```

ファイルは **Y4M**(非圧縮の生データ)またはMJPEGでなければなりません。ffmpegで何でも変換できます:

```sh
ffmpeg -i qr-code.mp4 -pix_fmt yuv420p qr-code.y4m
```

Y4Mファイルは巨大です(生フレームのため)。フィクスチャは短く小さく保ち、LFSなしでgitにコミットしないようにしましょう。

### Firefox: フェイクテストストリーム

```ts
use: {
  launchOptions: {
    firefoxUserPrefs: {
      'media.navigator.streams.fake': true,
      'media.navigator.permission.disabled': true,
    },
  },
},
```

Firefoxは合成のテストパターンを生成します。「プレビューが描画される」ことの確認には十分ですが、内容を選べないのでQRスキャンには使えません。

### WebKitと内容を制御したいストリーム: canvas注入

どのブラウザでも*特定の*フレームを流したい場合は、canvasベースのストリームで `getUserMedia` を自前で置き換えます:

```ts
await page.addInitScript(() => {
  const draw = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.src = '/fixtures/qr-code.png';       // フィクスチャはテストサーバーから配信する
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(() => draw(canvas));
    };
  };
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (!constraints?.video) return original(constraints);
    const canvas = document.createElement('canvas');
    canvas.width = 1280; canvas.height = 720;
    draw(canvas);
    const stream = canvas.captureStream(30);
    if (constraints.audio) {
      const audio = await original({ audio: constraints.audio });
      audio.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
    return stream;
  };
});
```

これは [playwright-audio-mocking](https://www.npmjs.com/package/playwright-audio-mocking) が音声で使っているのと同じ手法です — アプリは本物の `MediaStream` を受け取るため、違いを検知できません。テスト中に描画する画像を差し替えれば(`page.evaluate` などで)、「カメラを別のものに向けた」状況をシミュレートできます。

## 注意点

- `--use-file-for-fake-video-capture` は動画を永遠にループし、実行時に切り替えられません。
- canvas方式は `enumerateDevices()` のデバイスラベル/IDをエミュレートしません(併せてパッチしない限り)。カメラ選択UIのあるアプリでは対応が必要かもしれません。
- Linux CI上のWebKitにはカメラが一切ありません — canvas注入が唯一の道です。

## 関連レシピ

- [マイク入力をモックする](../mock-microphone-input/) — 音声側。こちらはライブラリできちんと解決済み。
- [WebRTC通話をテストする](../test-webrtc-calls/) — 両方のフェイクを組み合わせて通話全体をテストする。
