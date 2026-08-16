---
title: Test passkeys (WebAuthn)
description: Register and sign in with passkeys in CI using Chromium's virtual authenticator — no fingerprint reader required.
sidebar:
  order: 1
---

**Use case:** your app supports passkey registration and login (WebAuthn). You want CI to prove that a user can enroll a passkey and sign back in with it — with no security key plugged in and no Touch ID prompt.

> ▶ **Runnable sample**: [`test-passkeys-webauthn.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/auth/test-passkeys-webauthn.spec.ts) / [live demo](https://demo.untestable.dev/apps/passkeys/) — how to run: [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme)

## Why this is hard

WebAuthn deliberately talks to *hardware* (platform authenticator, security key) through a browser-native prompt that no automation can click. Playwright has no passkey API; `navigator.credentials.create()` simply hangs headless.

## Recipe

Chromium ships a **virtual authenticator** behind CDP — a software security key your test controls:

```ts
import { test, expect } from '@playwright/test';

test('register a passkey, then sign in with it', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',            // a platform authenticator (like Touch ID)
      hasResidentKey: true,             // passkeys are discoverable credentials
      hasUserVerification: true,
      isUserVerified: true,             // "the fingerprint matched"
      automaticPresenceSimulation: true // auto-approve prompts
    },
  });

  // Enroll
  await page.goto('/account/security');
  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await expect(page.getByText('Passkey added')).toBeVisible();

  // The credential really exists on the (virtual) device:
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  expect(credentials).toHaveLength(1);

  // Sign out, sign back in with the passkey
  await page.goto('/logout');
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
  await expect(page).toHaveURL('/dashboard');
});
```

### Testing the unhappy paths

The virtual authenticator shines where real hardware can't be scripted at all:

```ts
// User cancels / verification fails (wrong finger):
await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });

// Device with no credentials (new laptop):
await cdp.send('WebAuthn.removeCredential', { authenticatorId, credentialId });

// Roaming security key instead of platform authenticator:
// transport: 'usb', hasResidentKey: false
```

Assert your UI degrades properly: error messages, fallback to password, re-enroll flows.

## Caveats

- Virtual authenticators are **Chromium-only**. Firefox/WebKit have no Playwright-reachable equivalent — cover them with lower-level tests of your server's WebAuthn ceremony (e.g. via `@simplewebauthn/server`'s test helpers).
- WebAuthn requires a **secure context**: `https://` or `localhost`. Use `localhost` in CI or trust a dev certificate.
- Credentials are scoped to the RP ID (domain) — a test against `staging.example.com` says nothing about `example.com` origins/subdomain configuration.

## Related

- [Test TOTP two-factor login](../test-totp-2fa/) — the other second factor.
