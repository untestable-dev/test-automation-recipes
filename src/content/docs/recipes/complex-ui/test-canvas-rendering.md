---
title: Test canvas rendering
description: Assert on charts, WebGL scenes and drawing apps where the UI is pixels, not DOM.
sidebar:
  order: 3
---

**Use case:** a chart library, a diagram editor, a WebGL product configurator, a drawing app. The thing you must assert on is *painted*, not in the DOM — `page.locator()` sees one big `<canvas>` and nothing inside it.

> ▶ **Runnable sample**: [`test-canvas-rendering.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/complex-ui/test-canvas-rendering.spec.ts) — how to run: [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme)

## Why this is hard

- No elements, no text, no ARIA tree (usually) — the standard toolkit goes dark.
- Canvas output is **environment-sensitive**: GPU, antialiasing and font rasterization differ across machines, so naïve screenshot comparison flakes.
- Animations and transitions mean the pixels you assert on depend on *when* you look.

## Recipe

### 1. Make rendering deterministic first

Screenshot assertions only work if the same input paints the same pixels:

```ts
// Freeze time-driven animation (Playwright's built-in fake clock).
await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });

// Seed randomness before the app loads.
await page.addInitScript(() => {
  let seed = 42;
  Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
});

// Disable CSS animation/transition noise.
await page.emulateMedia({ reducedMotion: 'reduce' });
```

For WebGL, prefer software rendering in CI so every machine rasterizes identically: `--use-gl=swiftshader` (Chromium).

### 2. Screenshot assertions, with tolerance and masks

```ts
await expect(page.locator('#chart')).toHaveScreenshot('revenue-chart.png', {
  maxDiffPixelRatio: 0.01,       // absorb antialiasing differences
  mask: [page.locator('.live-timestamp')],
});
```

Generate baselines *in CI's environment* (e.g. via a Docker image), not on your laptop — cross-platform font rendering is the #1 source of false diffs.

### 3. Probe pixels instead of comparing everything

For "the third bar is red and taller than the second", sample the canvas directly — far more robust than full-image comparison:

```ts
const barColor = await page.evaluate(() => {
  const canvas = document.querySelector('#chart canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const [r, g, b] = ctx.getImageData(260, 180, 1, 1).data;
  return { r, g, b };
});
expect(barColor.r).toBeGreaterThan(200);  // red-ish
```

WebGL canvases need `preserveDrawingBuffer: true` to be readable this way — or screenshot the element and decode the PNG in Node instead.

### 4. Assert through the data layer when one exists

Many chart libraries expose their model (`chart.getDatasetMeta(...)`, scene graphs in three.js). Pixel-test *that the model is painted*, and assert *values* via the model — splitting "is it drawn correctly" from "is the data correct" kills most flakiness.

### Animated canvas: measure motion, not frames

For canvases that *move* (pan/zoom, physics), single screenshots are the wrong tool — measure image shift with phase correlation and wait for visual stability instead. That's the approach [playwright-interactive-ui-test](https://github.com/tsuemura/playwright-interactive-ui-test) packages up — see [Test map UIs](../test-map-uis/).

## Caveats

- `getImageData` fails on tainted canvases (cross-origin images without CORS headers).
- Headless vs. headed rendering can differ; pick one for baselines and stick to it.
- Don't chase pixel-perfect: tolerance + targeted probes beat `maxDiffPixels: 0` and a graveyard of stale baselines.

## Related

- [Test map UIs](../test-map-uis/) — the interactive/inertial case.
- [Catch toasts and flicker](../catch-toasts-and-flicker/) — when the pixels change *behind your back*.
