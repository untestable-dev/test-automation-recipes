---
title: Test map UIs with inertial panning
description: Pan a map by an exact pixel distance and assert what the user actually saw — without touching the app's DOM or JS.
sidebar:
  order: 1
---

**Use case:** your app embeds a map (Leaflet, MapLibre, Google Maps) or any pannable/zoomable canvas. You want to test "when the user swipes left, the map pans smoothly and settles on the next city" — including the inertia.

> ▶ **Runnable sample**: [`test-map-uis.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/complex-ui/test-map-uis.spec.ts) — how to run: [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme)

## Why this is hard

Maps break every assumption DOM-based testing relies on:

- The content is **pixels on a canvas** — there are no elements to `locator()` on.
- Dragging has **inertia**: the view keeps moving after the pointer lifts, so "drag 300px" pans some *other*, physics-dependent distance.
- There's no reliable "the map is done moving" event to await; `networkidle` doesn't cover animation frames.

You can often cheat by calling the map's JS API (`map.panTo(...)`) — but then you're testing the map library, not the *gesture handling* your users rely on.

## Recipe

[playwright-interactive-ui-test](https://github.com/tsuemura/playwright-interactive-ui-test) is an experimental toolkit that treats the screen the way a user does: all observation is pixel-based (screenshots + CDP screencast), no DOM or app-JS access required. It provides:

- **Gesture synthesis** — `swipe` / `flick` with velocity profiles, so inertial scrolling actually triggers.
- **Visual stability waiting** — "the picture stopped changing" instead of arbitrary timeouts.
- **Phase-correlation odometry** — measures how far the *image* actually shifted, to sub-pixel accuracy.
- **Closed-loop control** — `panByPixels` iterates gesture → measure → correct until the view has moved exactly the distance you asked for, inertia included.

```ts
import { test, expect } from 'playwright-interactive-ui-test';

test('swiping pans the map with inertia', async ({ page, interactive }) => {
  await page.goto('/map');
  await interactive.waitForStability();          // initial tiles rendered

  // A flick: fast swipe, released at speed → inertia takes over.
  await interactive.flick({ dx: -300, dy: 0 });
  await interactive.waitForStability();          // wait for physics to settle

  // The view moved further than the finger did — that's the inertia working.
  // (Measured by phase correlation between before/after screenshots.)
});

test('pan the map exactly 400px east', async ({ page, interactive }) => {
  await page.goto('/map');
  await interactive.waitForStability();

  const result = await interactive.panByPixels({ dx: -400, dy: 0 });

  expect(result.converged).toBe(true);
  expect(Math.abs(result.error.dx)).toBeLessThan(4);  // within tolerance
  expect(Math.abs(result.error.dy)).toBeLessThan(4);
});
```

`panByPixels` returns what actually happened:

```ts
interface PanResult {
  achieved: { dx: number; dy: number };  // measured via visual odometry
  error: { dx: number; dy: number };     // residual vs. the target
  iterations: PanIteration[];            // each gesture→measure→correct step
  converged: boolean;
}
```

### Asserting the destination

Once you can pan deterministically, destination assertions become ordinary visual checks:

```ts
await interactive.panByPixels({ dx: -400, dy: 0 });
await expect(page).toHaveScreenshot('tokyo-station-in-view.png', {
  maxDiffPixelRatio: 0.02,
});
```

For CI determinism, serve **procedurally generated tiles** from your test server (the library's demo app does this with Leaflet) — real tile servers change imagery, break offline runs, and rate-limit CI.

## Caveats

- The toolkit is an **experimental prototype** — APIs may change. The techniques (velocity-profile gestures, phase correlation, pixel-stability waits) are stable ideas you can lift into your own helpers.
- Screencast-based observation is Chromium-only (CDP); gestures and screenshot odometry work everywhere.
- Phase correlation measures *dominant* image shift — overlaid UI (headers, controls) that stays put dilutes the signal, so measure on a cropped region of pure map.

## Related

- [Test canvas rendering](../test-canvas-rendering/) — static canvas content.
- [Catch toasts and flicker](../catch-toasts-and-flicker/) — pixel-based observation of transient UI.
