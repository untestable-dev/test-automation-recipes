---
title: Test IME composition input
description: Test Japanese, Chinese and Korean text entry — composition events, candidate confirmation, and the bugs only CJK users see.
sidebar:
  order: 4
---

**Use case:** your app has a search box, an editor, a form — and users in Japan type into it through an IME (Input Method Editor): they type `nihongo`, see an underlined composition string `にほんご`, and confirm it into `日本語`. Autocomplete dropdowns, character counters and `Enter`-to-submit handlers routinely break *only* during composition.

> ▶ **Runnable sample**: [`test-ime-composition.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/complex-ui/test-ime-composition.spec.ts) / [live demo](https://demo.untestable.dev/apps/search-form/) — how to run: [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme)

## Why this is hard

- `page.fill()` and `keyboard.insertText()` set the value **without any composition events** — the exact code path IME users exercise (`compositionstart` → `compositionupdate` → `compositionend`) is never run.
- `keyboard.type()` fires key events per character but still no composition.
- The classic bug — `Enter` during composition submits the form instead of confirming the candidate — is invisible to all of the above.

## Recipe

### Chromium: real composition via CDP

Chromium's DevTools protocol can drive the IME machinery itself:

```ts
import { test, expect } from '@playwright/test';

test('Enter during composition does not submit', async ({ page }) => {
  await page.goto('/search');
  await page.locator('#q').click();

  const cdp = await page.context().newCDPSession(page);

  // Start composing: the field shows an underlined preedit string.
  await cdp.send('Input.imeSetComposition', {
    text: 'にほんご',
    selectionStart: 4,
    selectionEnd: 4,
  });

  // Enter here means "confirm the candidate", NOT "submit the form".
  await cdp.send('Input.insertText', { text: '日本語' }); // compositionend

  await expect(page.locator('#q')).toHaveValue('日本語');
  await expect(page).toHaveURL(/\/search$/);  // no submit happened
});
```

### Cross-browser: dispatch composition events

Firefox/WebKit have no equivalent CDP surface. Dispatching the event sequence exercises your app's listeners (though not the browser's own IME internals):

```ts
await page.locator('#q').evaluate((el: HTMLInputElement) => {
  const fire = (type: string, data: string) =>
    el.dispatchEvent(new CompositionEvent(type, { data, bubbles: true }));
  el.focus();
  fire('compositionstart', '');
  for (const chunk of ['に', 'にほ', 'にほん', 'にほんご']) {
    fire('compositionupdate', chunk);
    el.value = chunk;
    el.dispatchEvent(new InputEvent('input', { data: chunk, inputType: 'insertCompositionText', bubbles: true }));
  }
  el.value = '日本語';
  fire('compositionend', '日本語');
  el.dispatchEvent(new InputEvent('input', { data: '日本語', inputType: 'insertCompositionText', bubbles: true }));
});
```

### What to assert

The bugs live in the interactions, not the final value:

- **Enter/Escape during composition** — must confirm/cancel the candidate, never submit or close the dialog (`keydown` during composition has `isComposing: true` and legacy `keyCode === 229`; code that checks neither is buggy).
- **Character counters & validation** — must not count the preedit string, or must settle correctly after `compositionend`.
- **Autocomplete** — should it query on `にほ` (preedit) or only on confirmed text? Assert whichever your spec says.
- **`maxlength` fields** — composition can temporarily exceed the limit; confirmation must not truncate to garbage.

## Caveats

- `Input.imeSetComposition` is Chromium-only; the event-dispatch variant runs everywhere but bypasses the browser's own IME plumbing — use both when you can.
- Don't sprinkle IME simulation over every test. One focused suite per text-entry surface catches the class of bug.

## Related

- [Test canvas rendering](../test-canvas-rendering/) — editors that paint their own text run into both problems at once.
