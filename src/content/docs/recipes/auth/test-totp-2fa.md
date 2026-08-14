---
title: Test TOTP two-factor login
description: Generate authenticator-app codes inside your test and get through 2FA without a phone.
sidebar:
  order: 2
---

**Use case:** accounts on your app (or the app you must log into before testing anything else) are protected by an authenticator app — Google Authenticator-style 6-digit codes. Tests need to get past that screen.

## Why this is hard

The code changes every 30 seconds and lives on a phone. But TOTP is an open algorithm (RFC 6238): the phone only knows a **shared secret** — and if your test knows it too, it can compute the same codes.

## Recipe

```sh
npm install -D otplib
```

### Capture the secret at enrollment

The QR code shown during 2FA setup encodes an `otpauth://` URI containing the secret. Almost every app also shows it as a "can't scan? enter manually" string — grab that:

```ts
import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';

test('enroll TOTP and log in with it', async ({ page }) => {
  await page.goto('/account/security');
  await page.getByRole('button', { name: 'Enable 2FA' }).click();

  // The manual-entry secret next to the QR code.
  const secret = (await page.getByTestId('totp-secret').innerText()).replace(/\s/g, '');

  // Confirm enrollment like the app would.
  await page.getByLabel('Verification code').fill(authenticator.generate(secret));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('Two-factor enabled')).toBeVisible();

  // Later: any login just recomputes the code.
  await page.goto('/logout');
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Verification code').fill(authenticator.generate(secret));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL('/dashboard');
});
```

For pre-provisioned test accounts, store the secret alongside the password in your secret manager and skip the enrollment scrape.

### Don't log in through the UI every test

2FA makes UI login *expensive*. Do it once in a setup project and reuse the authenticated state:

```ts
// auth.setup.ts — runs once
await page.context().storageState({ path: 'playwright/.auth/user.json' });

// playwright.config.ts
use: { storageState: 'playwright/.auth/user.json' },
```

Keep exactly one test that exercises the full 2FA UI; everything else starts logged in.

### The 30-second cliff

A code generated at second 29 of its window can expire in transit. Avoid the flake by generating early in the window:

```ts
const msLeft = authenticator.timeRemaining() * 1000;
if (msLeft < 3000) await page.waitForTimeout(msLeft); // roll into a fresh window
await page.getByLabel('Verification code').fill(authenticator.generate(secret));
```

## Caveats

- If enrollment only shows a QR image (no manual string), decode it: screenshot the element and run it through a QR library (e.g. `jsqr`), then parse the `otpauth://` URI.
- Server clock skew breaks TOTP in both directions; most servers accept ±1 window. If codes "randomly" fail in CI, check the runner's NTP sync first.
- SMS-based 2FA is a different recipe (test SMS inboxes like Twilio's) — prefer TOTP for test accounts; it's free and offline.

## Related

- [Test passkeys (WebAuthn)](../test-passkeys-webauthn/)
- [Test transactional email](../../beyond-browser/test-emails/) — email-code logins use the same pattern with an inbox API.
