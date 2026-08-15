---
title: Test journeys across web and mobile
description: Drive a browser and a real mobile app in one test — deep-link handoffs, QR logins, and signups that start on the web and finish in the app.
sidebar:
  order: 4
---

**Use case:** your product's real user journey crosses devices — sign up on the web, verify on your phone; scan a QR code on a TV or desktop screen to log in in the app; tap a deep link in a campaign page that lands in the native app. Each half works when tested alone. The bug lives in the handoff.

## Why this is hard

- **Two ecosystems, no shared runner.** Playwright doesn't speak to native apps; Appium doesn't do desktop browsers well. Neither owns the whole journey.
- The handoff artifact — a QR code, a magic link, a one-time code — is *generated* on one side and *consumed* on the other, so neither tool can assert on it alone.
- Sessions and state live in your backend; the UIs are just two windows onto it.

## Recipe

### One orchestrator, two drivers

Keep Playwright as the test runner and attach an Appium session (via the [WebdriverIO](https://webdriver.io/) client) inside the test. One test file, one report, both devices:

```ts
import { test, expect } from '@playwright/test';
import { remote, type Browser as Wdio } from 'webdriverio';

let app: Wdio;

test.beforeAll(async () => {
  app = await remote({
    hostname: 'localhost', port: 4723,          // Appium server
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:app': process.env.APP_APK,        // or iOS + XCUITest
    },
  });
});
test.afterAll(async () => { await app?.deleteSession(); });

test('signup starts on web, finishes in the app', async ({ page }) => {
  // Web half
  const email = `user-${Date.now()}@example.test`;
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByText('Check your phone')).toBeVisible();

  // Handoff: grab the continuation link (from a test inbox, or a test API)
  const link = await fetchMagicLink(email);     // see the email-testing recipe

  // App half: enter through the deep link
  await app.execute('mobile: deepLink', { url: link, package: 'com.example.app' });
  const welcome = app.$('~welcome-banner');     // accessibility id
  await welcome.waitForDisplayed({ timeout: 15_000 });
  await expect(page.getByText('Connected to your phone')).toBeVisible(); // web reacts too
});
```

### QR-code handoffs

When the handoff is visual, decode it instead of eyeballing it — screenshot the element, decode in Node, feed the payload to the device:

```ts
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const shot = await page.locator('#login-qr').screenshot();
const png = PNG.sync.read(shot);
const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
await app.execute('mobile: deepLink', { url: qr!.data, package: 'com.example.app' });
```

This also *proves the QR is scannable* — a rendering regression (low contrast, clipped quiet zone) fails the decode step.

### Assert the handoff in the backend, not just the UIs

The strongest assertion is that both halves now share one session:

```ts
await expect
  .poll(() => api.get(`/test/sessions?email=${email}`).then((r) => r.json()))
  .toMatchObject({ devices: ['web', 'android'], linked: true });
```

## Caveats

- This is the most expensive test you own — keep **one or two** cross-device journeys and push everything else down to per-platform tests.
- In CI you need an emulator next to the browser (e.g. `reactivecircus/android-emulator-runner` on GitHub Actions, or a device cloud); boot it once per job, not per test.
- If the app side is simple, [Maestro](https://maestro.mobile.dev/) flows launched via CLI from the same test are a lighter alternative to a full Appium session.
- Mobile *web* is a different, cheaper problem — Playwright's device emulation covers viewport/touch, but it cannot exercise app handoffs.

## Related

- [Test transactional email](../test-emails/) — where `fetchMagicLink` comes from.
- [Measure use-case coverage](../../strategy/measure-use-case-coverage/) — cross-device journeys are exactly the use cases worth tracking.
