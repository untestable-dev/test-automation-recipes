---
title: Assert sound is playing
description: Verify that audio is audibly playing — not just that .play() was called — using Web Audio analysis.
sidebar:
  order: 4
---

**Use case:** a notification chime, a media player, a game. The regression you fear is *silence* — the element "plays" but no sound comes out (muted track, broken codec, autoplay policy, volume 0).

> ▶ **Runnable sample**: [`assert-sound-is-playing.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/media/assert-sound-is-playing.spec.ts) — how to run: [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme)

## Why this is hard

Headless browsers have no speakers, and Playwright has no "is sound coming out" API. `expect(el).toHaveJSProperty('paused', false)` passes even when the output is silent — `paused === false` only means the element *wants* to play.

## Recipe

### Tap the element with an AnalyserNode

`captureStream()` clones a media element's output as a `MediaStream`; an `AnalyserNode` then gives you the waveform. Non-zero RMS energy = audible signal:

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

### Assert on *what* is playing, not just *that* it plays

Frequency data distinguishes a chime from a buzz — useful when several sounds share one element:

```ts
const dominantHz = await page.evaluate(() => {
  const analyser = (window as any).__analyser; // set up as above
  const bins = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(bins);
  const peak = bins.indexOf(Math.max(...bins));
  return (peak * analyser.context.sampleRate) / 2 / bins.length;
});
expect(dominantHz).toBeGreaterThan(800);   // the chime is ~880 Hz
expect(dominantHz).toBeLessThan(950);
```

### Web Audio apps (no media element)

If sound comes from `AudioContext` directly (games, synths), capture the app's context via an init script and connect your analyser to its destination:

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

Then create the analyser inside `page.evaluate`, connecting `__audioCtx.destination`'s inputs through it.

## Caveats

- Launch Chromium with `--autoplay-policy=no-user-gesture-required` or the context may be suspended before any user gesture.
- `captureStream()` on media elements is not implemented in WebKit — run these assertions on Chromium/Firefox, or route through Web Audio.
- Muted elements (`el.muted = true`) still produce energy in `captureStream()` on some browsers — assert `el.muted === false` separately if muting is the bug you're hunting.

## Related

- [Mock microphone input](../mock-microphone-input/) — the input side.
- [Test WebRTC calls](../test-webrtc-calls/) — the same RMS trick applied to a live call.
