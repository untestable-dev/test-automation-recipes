---
title: Test transactional email
description: Assert that signup confirmations, magic links and password resets actually arrive — and click the links in them.
sidebar:
  order: 1
---

**Use case:** signup sends a confirmation link, password reset sends a token, an order sends a receipt. The user journey *leaves the browser* — and your test must follow it into the inbox and back.

> ▶ **Runnable sample**: [`test-emails.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/beyond-browser/test-emails.spec.ts) / [live demo](https://demo.untestable.dev/apps/signup-email/) — how to run: [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme)

## Why this is hard

Playwright ends at the browser. The email leaves your app via SMTP, and there's nothing to `locator()` on. Sending real email from CI is worse: slow, rate-limited, spam-filtered, and it leaks test traffic to real providers.

## Recipe

Run a **capturing SMTP server** and read what your app sent through its REST API. [Mailpit](https://mailpit.axllent.org/) is the modern standard (successor to MailHog):

```yaml
# docker-compose.test.yml
services:
  mailpit:
    image: axllent/mailpit
    ports:
      - '1025:1025'   # SMTP — point your app here
      - '8025:8025'   # Web UI + REST API
```

Point the app under test at `smtp://localhost:1025`, then:

```ts
import { test, expect } from '@playwright/test';

const MAILPIT = 'http://localhost:8025/api/v1';

async function waitForEmail(request, to: string, subject: RegExp) {
  return expect
    .poll(async () => {
      const res = await request.get(`${MAILPIT}/search?query=to:${to}`);
      const { messages } = await res.json();
      return messages?.find((m) => subject.test(m.Subject)) ?? null;
    }, { timeout: 15_000 })
    .not.toBeNull()
    .then(async () => {
      const res = await request.get(`${MAILPIT}/search?query=to:${to}`);
      const { messages } = await res.json();
      return messages.find((m) => subject.test(m.Subject));
    });
}

test('signup confirmation link works', async ({ page, request }) => {
  const email = `user-${Date.now()}@example.test`;

  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign up' }).click();

  // Find the message…
  const msg = await waitForEmail(request, email, /confirm your account/i);

  // …extract the link from the HTML body…
  const detail = await (await request.get(`${MAILPIT}/message/${msg.ID}`)).json();
  const link = detail.HTML.match(/href="([^"]*\/confirm[^"]*)"/)?.[1];
  expect(link).toBeTruthy();

  // …and complete the journey in the browser.
  await page.goto(link!);
  await expect(page.getByText('Account confirmed')).toBeVisible();
});
```

### What's worth asserting

- **Delivery + addressing** — right recipient, right subject; unique addresses per test (`user-${Date.now()}@…`) keep runs independent.
- **The link round-trip** — the token in the email actually works, once, and expires.
- **Content** — assert on data (names, amounts) with contains-matchers, not full-body snapshots; templates churn.
- **Negative cases** — unsubscribe honored, no email on failed signup. `GET /api/v1/messages` after a short wait proves silence.

### Rendering checks

Mailpit can screenshot the HTML body — pipe it into your visual-testing flow for template regressions. For real-client rendering (Outlook…), that's a specialized service (Litmus etc.), not CI territory.

## Caveats

- Reset Mailpit between tests (`DELETE /api/v1/messages`) or scope every query by recipient.
- If the app is in a container, the SMTP host is `mailpit:1025`, not `localhost`.
- Staging environments that send through a real provider (SES, SendGrid) can often be pointed at Mailpit's SMTP instead — same assertion code, before *and* after deploy.

## Related

- [Test TOTP two-factor login](../../auth/test-totp-2fa/) — email-code login is this recipe plus a regex.
- [Test PDF output](../test-pdf-output/) — receipts often arrive as attachments (Mailpit serves those over the API too).
