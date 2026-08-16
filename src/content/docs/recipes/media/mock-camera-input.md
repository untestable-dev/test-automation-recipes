---
title: Mock camera input
description: Feed a prepared video file into getUserMedia() to test QR scanners, video chat previews and camera capture flows.
sidebar:
  order: 2
---

**Use case:** your app uses the camera — a QR/barcode scanner, an ID-document capture flow, a video chat preview. You want tests to "show" the camera a prepared video.

> ▶ **Runnable sample**: [`mock-camera-input.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/media/mock-camera-input.spec.ts) / [live demo](https://demo.untestable.dev/apps/camera-scan/) — how to run: [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme)

## Why this is hard

There is no Playwright API for camera input, and unlike audio there's no cross-browser library that solves it cleanly (yet). What exists is a patchwork of browser-specific switches.

## Recipe

### Chromium: fake device + video file

Chromium can replace the camera with a looping video at launch:

```ts
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: {
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',      // auto-accept the permission prompt
            '--use-fake-device-for-media-stream',  // provide a fake camera
            '--use-file-for-fake-video-capture=tests/fixtures/qr-code.y4m',
          ],
        },
      },
    },
  ],
});
```

The file must be **Y4M** (raw, uncompressed) or MJPEG. Convert anything with ffmpeg:

```sh
ffmpeg -i qr-code.mp4 -pix_fmt yuv420p qr-code.y4m
```

Y4M files are huge (raw frames) — keep fixtures short and small, and don't commit them to git without LFS.

### Firefox: fake test streams

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

Firefox generates a synthetic test pattern — good enough for "the preview renders", useless for QR scanning (you can't choose the content).

### WebKit and content-controlled streams: canvas injection

When you need *specific* frames on any browser, replace `getUserMedia` yourself with a canvas-backed stream:

```ts
await page.addInitScript(() => {
  const draw = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.src = '/fixtures/qr-code.png';       // serve fixtures from your test server
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

This is the same technique [playwright-audio-mocking](https://www.npmjs.com/package/playwright-audio-mocking) uses for audio — the app receives a genuine `MediaStream` and can't tell the difference. Swap the drawn image mid-test (e.g. via `page.evaluate`) to simulate "pointing the camera at something else".

## Caveats

- `--use-file-for-fake-video-capture` loops the video forever and cannot be switched at runtime.
- The canvas approach doesn't emulate device labels/IDs in `enumerateDevices()` unless you also patch it; apps with camera-selection UIs may need that.
- WebKit on Linux CI has no camera at all — canvas injection is the only route.

## Related

- [Mock microphone input](../mock-microphone-input/) — the audio side, solved properly by a library.
- [Test WebRTC calls](../test-webrtc-calls/) — combine both fakes for a full call.
