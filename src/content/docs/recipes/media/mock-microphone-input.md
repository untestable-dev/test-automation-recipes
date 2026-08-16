---
title: Mock microphone input
description: Stream real audio files into getUserMedia() so you can test speech recognition, voice memos and audio meters on every browser.
sidebar:
  order: 1
---

**Use case:** your app records the user's voice — speech-to-text, a voice memo, a language-learning app grading pronunciation, an audio level meter. You want an automated test that *speaks into the microphone*.

## Why this is hard

Playwright has no API for microphone input. The workarounds you'll find have sharp edges:

- `--use-file-for-fake-audio-capture` is **Chromium-only**, accepts **WAV only**, and the file is **fixed at browser launch** — you can't say one thing on the first screen and another thing later.
- Piping audio through a real OS-level virtual device works but is miserable in CI.

## Recipe

[playwright-audio-mocking](https://www.npmjs.com/package/playwright-audio-mocking) replaces `navigator.mediaDevices.getUserMedia` before the page loads and backs it with a real Web Audio `MediaStream`. Anything downstream — `MediaRecorder`, `AnalyserNode`, WebRTC, speech APIs — works unmodified, on Chromium, Firefox and WebKit.

```sh
npm install -D playwright-audio-mocking
```

```ts
import { test, expect } from '@playwright/test';
import { mockMicrophone } from 'playwright-audio-mocking';

test('transcribes speech', async ({ page }) => {
  const mic = await mockMicrophone(page);   // install BEFORE page.goto()
  await page.goto('/voice-memo');

  await page.getByRole('button', { name: 'Record' }).click();
  await mic.play('tests/fixtures/hello-world.wav');  // stream into the mic
  await mic.waitForEnd();
  await page.getByRole('button', { name: 'Stop' }).click();

  await expect(page.getByTestId('transcript')).toContainText('hello world');
});
```

### Runtime control

Unlike launch-time flags, playback is fully scriptable mid-test:

```ts
await mic.play('fixtures/greeting.mp3');            // any format the browser decodes
await mic.play('fixtures/question.mp3');            // switch files mid-stream
await mic.play('fixtures/hold-music.mp3', { loop: true });
await mic.pause();                                  // silence, position kept
await mic.resume();
await mic.stop();                                   // silence, position reset

const { playing, position, duration } = await mic.status();
```

### Generated speech, no fixture files

Pass bytes instead of a path — for example straight from a TTS API, so each test can say something unique:

```ts
await mic.play(Buffer.from(await synthesizeSpeech('add milk to my shopping list')));
```

## Caveats

- Call `mockMicrophone(page)` **before** `page.goto()` — it's injected as an init script.
- On Chromium, launch with `RECOMMENDED_CHROMIUM_ARGS` (`--autoplay-policy=no-user-gesture-required`) so Web Audio can start without a user gesture.
- The mock replaces the **audio** track only; `getUserMedia({ audio, video })` passes the video constraint through to the real implementation by default.

## Related

- [Test WebRTC calls](../test-webrtc-calls/) — use the mocked mic as the caller's voice.
- [Assert sound is playing](../assert-sound-is-playing/) — the output side of the same problem.
- [Mock camera input](../mock-camera-input/) — the video equivalent.
