---
title: Test WebRTC calls
description: Run caller and callee in one Playwright test, speak real audio into the call, and assert the other side hears it.
sidebar:
  order: 3
---

**Use case:** your app has real-time calls — video chat, a support hotline widget, pair-programming voice. You want a test where user A joins, speaks, and user B actually receives the media.

## Why this is hard

A call needs **two browsers**, media devices on both ends, and assertions about things that never touch the DOM: is a connection established? is audio *flowing*? Playwright can orchestrate multiple pages, but gives you nothing for the media itself.

## Recipe

### Two users, one test

Each `browser.newContext()` is an isolated user (own storage, own permissions) — perfect for caller/callee:

```ts
import { test, expect } from '@playwright/test';
import { mockMicrophone } from 'playwright-audio-mocking';

test('callee hears the caller', async ({ browser }) => {
  const caller = await (await browser.newContext()).newPage();
  const callee = await (await browser.newContext()).newPage();

  // Give the caller a voice before navigation.
  const mic = await mockMicrophone(caller);

  const room = `test-${Date.now()}`;
  await caller.goto(`/call/${room}`);
  await callee.goto(`/call/${room}`);

  await caller.getByRole('button', { name: 'Join' }).click();
  await callee.getByRole('button', { name: 'Join' }).click();

  // UI-level signal that the call connected.
  await expect(callee.getByTestId('remote-participant')).toBeVisible();

  // The caller speaks…
  await mic.play('tests/fixtures/hello.wav');

  // …and the callee's <audio> element carries actual energy (see below).
  await expect
    .poll(() => remoteAudioLevel(callee), { timeout: 10_000 })
    .toBeGreaterThan(0.01);
});
```

### Asserting audio is actually flowing

Don't trust a "connected" badge — measure the remote stream. Most apps attach it to an `<audio>`/`<video>` element, which you can tap without touching app code:

```ts
function remoteAudioLevel(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const el = document.querySelector('audio, video') as HTMLMediaElement;
    const stream = (el.srcObject as MediaStream) ?? (el as any).captureStream();
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    await new Promise((r) => setTimeout(r, 200)); // let some frames arrive
    analyser.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length); // RMS
  });
}
```

For connection-level assertions, `getStats()` is the source of truth — `packetsReceived` must grow, `audioLevel` must be non-zero. This requires a handle on the `RTCPeerConnection`; if your app doesn't expose one, capture it with an init script:

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

## Caveats

- Run both fake devices: mocked mic for the *content* you control, `--use-fake-device-for-media-stream` as a fallback camera (see [Mock camera input](../mock-camera-input/)).
- Two pages in one browser process can be slow in CI; if timings matter, use two workers with a small signaling fixture instead.
- TURN/STUN behavior differs between localhost and production networks — a passing localhost call doesn't prove NAT traversal works.

## Related

- [Mock microphone input](../mock-microphone-input/)
- [Assert sound is playing](../assert-sound-is-playing/)
