---
title: Test clipboard interactions
description: Verify copy buttons, paste handling and rich clipboard formats across browsers.
sidebar:
  order: 3
---

**Use case:** a "Copy link" button, a spreadsheet grid that accepts pasted cells, an editor that cleans up pasted Word markup. Copy/paste is a core interaction — and one of the most browser-divergent things you can automate.

## Why this is hard

The clipboard is a **system** resource guarded by permissions and user-activation rules that differ per browser. Playwright has no first-class clipboard API, and what works on Chromium silently fails on WebKit.

## Recipe

### Chromium: grant permissions, use the async API

```ts
import { test, expect } from '@playwright/test';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('copy button puts the share URL on the clipboard', async ({ page }) => {
  await page.goto('/document/42');
  await page.getByRole('button', { name: 'Copy link' }).click();

  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toBe('https://example.com/s/abc123');
});
```

### Testing paste

Real paste = clipboard content + a paste event. Write the clipboard, then send the real keyboard chord so the app's `paste` listener fires:

```ts
test('pasting cells fills the grid', async ({ page }) => {
  await page.goto('/sheet');
  await page.evaluate(() =>
    navigator.clipboard.writeText('1\t2\n3\t4'),   // TSV, like a spreadsheet copy
  );

  await page.locator('.cell-a1').click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+v' : 'Control+v');

  await expect(page.locator('.cell-b2')).toHaveText('4');
});
```

For rich formats (HTML paste from Word, images), construct the `DataTransfer` yourself and dispatch the event — this also sidesteps permission prompts entirely:

```ts
await page.locator('#editor').evaluate((el) => {
  const dt = new DataTransfer();
  dt.setData('text/html', '<b>bold</b> from Word<o:p></o:p>');
  dt.setData('text/plain', 'bold from Word');
  el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
});
await expect(page.locator('#editor strong')).toHaveText('bold');
```

### Firefox and WebKit

`permissions: [...]` clipboard grants are Chromium-only. Portable options:

- **Dispatch `ClipboardEvent`s** (above) — tests your app's handlers on every browser; skips the real clipboard.
- **Firefox**: enable the testing pref — `firefoxUserPrefs: { 'dom.events.testing.asyncClipboard': true }`.
- **WebKit**: reading requires user activation; the event-dispatch approach is the practical route.

A common pattern: full real-clipboard coverage on Chromium, event-level coverage of the same features cross-browser.

## Caveats

- Clipboard state leaks between tests in the same context — write a known value in `beforeEach` or use fresh contexts.
- Headed vs. headless behavior differs for user-activation checks; CI headless is the environment to make green.
- Never assert against the *host machine's* clipboard (e.g. via OS utilities) — parallel workers will fight over it.

## Related

- [Test IME composition input](../../complex-ui/test-ime-composition/) — the other "system text input" recipe.
