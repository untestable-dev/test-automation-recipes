---
title: Catch toasts and flicker
description: Assert on UI that appears and disappears faster than your assertions — success toasts, flashing error screens, late layout shifts.
sidebar:
  order: 2
---

**Use case:** clicking *Save* shows a toast for two seconds. Or worse: an error screen flashes for 300ms during navigation, a validation message self-dismisses, the layout jumps *after* the page looked done. You need to assert on things that are **gone by the time you look**.

> ▶ **Runnable sample**: [`catch-toasts-and-flicker.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/complex-ui/catch-toasts-and-flicker.spec.ts) — how to run: [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme)

## Why this is hard

- `expect(toast).toBeVisible()` races the toast: if anything delays the assertion (CI load, a slow selector), the toast is gone and the test flakes.
- Asserting a toast **didn't** appear, or that an error screen **didn't flash by**, is even harder — a screenshot after the action proves nothing about what happened *during* it.
- Recording video and eyeballing it doesn't scale, and diffing every frame in an assertion is a project of its own.

## Recipe

[agent-screen-observer](https://www.npmjs.com/package/agent-screen-observer) watches the screen as a stream (CDP screencast — frames arrive only when the page repaints), diffs every frame against the pre-action baseline with classical computer vision, and reports **visual events**: things that appeared and vanished, screens that flashed by, regions that kept animating.

```sh
npm install -D agent-screen-observer
```

### Zero-config with the Playwright fixture

```ts
import { test, expect } from 'agent-screen-observer/playwright';

test('can save', async ({ page }) => {
  await page.goto('/editor');
  await page.click('#save');                       // observed automatically
  await expect(page.locator('h1')).toBeVisible();  // assertions unchanged
});
```

By default it *reports* visual findings (transient elements, flashed screens) as warnings without failing tests — attach it to an existing suite and see what your UI has been doing behind your back.

### Hard assertions on transient UI

Use the core API when the toast *is* the test:

```ts
import { test, expect } from '@playwright/test';
import { ScreenObserver } from 'agent-screen-observer';

test('save shows a confirmation toast', async ({ page }) => {
  await page.goto('/editor');
  const observer = await ScreenObserver.attach(page, { outDir: 'out/save-toast' });

  const report = await observer.observe('click Save', () => page.click('#save'));

  // A toast = something appeared after the action and was gone again.
  const toast = report.events.find((e) => e.type === 'transient_element');
  expect(toast, report.summary).toBeTruthy();
  expect(toast!.appearedAtMs).toBeLessThan(1000);   // showed up promptly

  await observer.detach();
});
```

The report also proves **absence** — no error screen flashed during a navigation:

```ts
const report = await observer.observe('submit order', () =>
  page.click('#place-order'),
);
const nav = report.events.find((e) => e.type === 'full_screen_change');
// states = timeline of screens passed through; >2 means something flashed by.
expect(nav?.states?.length ?? 0, report.summary).toBeLessThanOrEqual(2);
```

Every observation writes evidence to `outDir`: crops of each changed region, keyframes of intermediate screens, before/after shots, and a real-timing `replay.gif` for human review.

### Catching late layout shifts (a flakiness factory)

`report.settled` / `settleTimeMs` tell you when the screen *actually* stopped changing, and activity bursts reveal staged rendering — content that pops in 1–2s after the page "looked ready". These are exactly the pages where `click()` lands on the wrong element once in twenty runs. See [Auto-repair flaky tests](../../strategy/auto-repair-flaky-tests/).

## Caveats

- Capture is **Chromium-only** (CDP screencast).
- Continuously animating regions (spinners, videos, carousels) are auto-masked and reported once as `animated_region` — they don't pollute settle detection.
- Detection is deterministic pixel-diffing — no LLM involved. If you *are* driving the UI with an AI agent, the one-line text summary is designed to be handed to it cheaply (tens of tokens vs. ~1,200 per screenshot).

## Related

- [Auto-repair flaky tests](../../strategy/auto-repair-flaky-tests/) — using observer reports to diagnose flakes.
- [Test map UIs](../test-map-uis/) — pixel-based observation for interactive UIs.
