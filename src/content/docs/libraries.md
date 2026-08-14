---
title: Featured libraries
description: The open-source libraries these recipes are built on.
---

Several recipes on this site are powered by small, focused open-source libraries. Each one exists because a recipe needed it — they solve exactly one hard problem each.

## playwright-audio-mocking

Stream any audio file into a website's microphone (`getUserMedia()`) from Playwright — on **Chromium, Firefox and WebKit**, with runtime `play` / `pause` / `stop` / `loop` control.

Chromium's built-in fake-audio flag only supports WAV, only works on Chromium, and can't switch files at runtime. This library replaces `getUserMedia` with a real Web Audio-backed `MediaStream`, so `MediaRecorder`, analysers, WebRTC and speech recognition all work unmodified.

- npm: [playwright-audio-mocking](https://www.npmjs.com/package/playwright-audio-mocking)
- GitHub: [tsuemura/playwright-audio-mocking](https://github.com/tsuemura/playwright-audio-mocking)
- Used in: [Mock microphone input](../recipes/media/mock-microphone-input/), [Test WebRTC calls](../recipes/media/test-webrtc-calls/)

## agent-screen-observer

Watches the screen while a test (or an AI agent) drives a UI, and reports **visual events** — toasts that fade away, error screens that flash by, late layout shifts, animated regions — as compact text with on-demand image evidence.

It uses classical computer vision (pixel diffing against a pre-action baseline) over a CDP screencast, so detection is deterministic: no LLM, no frame-rate guessing. A one-line summary costs tens of tokens instead of streaming full screenshots.

- npm: [agent-screen-observer](https://www.npmjs.com/package/agent-screen-observer)
- GitHub: [tsuemura/agent-screen-observer](https://github.com/tsuemura/agent-screen-observer)
- Used in: [Catch toasts and flicker](../recipes/complex-ui/catch-toasts-and-flicker/), [Auto-repair flaky tests](../recipes/strategy/auto-repair-flaky-tests/)

## playwright-interactive-ui-test

An experimental toolkit for testing **highly interactive UIs** — map panning with inertia, canvas rendering, physics animations — without touching the app's DOM or JavaScript. All observation is pixel-based: gesture synthesis with velocity profiles, phase-correlation visual odometry to measure how far the view actually moved, and closed-loop control that pans by an exact pixel distance.

- GitHub: [tsuemura/playwright-interactive-ui-test](https://github.com/tsuemura/playwright-interactive-ui-test) *(experimental)*
- Used in: [Test map UIs](../recipes/complex-ui/test-map-uis/), [Test canvas rendering](../recipes/complex-ui/test-canvas-rendering/)
