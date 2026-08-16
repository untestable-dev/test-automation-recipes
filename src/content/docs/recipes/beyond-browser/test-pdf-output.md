---
title: Test PDF output
description: Download the invoice your app generates and assert on its text, data and layout.
sidebar:
  order: 2
---

**Use case:** your app generates PDFs — invoices, reports, tickets, contracts. "Clicking *Download invoice* produces a correct PDF" is a real user journey, and a regression here reaches customers on paper.

> ▶ **Runnable sample**: [`test-pdf-output.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/beyond-browser/test-pdf-output.spec.ts) / [live demo](https://demo.untestable.dev/apps/invoice/) — how to run: [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme)

## Why this is hard

The browser either downloads the file (nothing rendered to assert on) or shows it in a native PDF viewer Playwright can't see into. Either way, the content lives in a binary file, not the DOM.

## Recipe

### Capture the download

```ts
import { test, expect } from '@playwright/test';

test('invoice PDF contains the right data', async ({ page }) => {
  await page.goto('/orders/1042');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download invoice' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  // …assert on `path` below
});
```

If the PDF opens inline instead of downloading, fetch it directly with the page's cookies: `const pdf = await page.request.get(url).then(r => r.body())`.

### Assert on the text

```sh
npm install -D pdf-parse
```

```ts
import pdf from 'pdf-parse';
import { readFileSync } from 'node:fs';

const { text, numpages } = await pdf(readFileSync(path));

expect(numpages).toBe(1);
expect(text).toContain('Invoice #1042');
expect(text).toContain('Total: $1,337.00');
expect(text).not.toContain('undefined');   // the classic template bug
```

`pdf-parse` flattens layout — columns and tables come out in reading order, so assert on fragments, not exact whole-document strings.

### Assert on the layout (visual)

Text checks miss broken layouts: overlapping columns, a logo pushed onto page 2. Rasterize and reuse Playwright's visual comparison:

```sh
# poppler-utils; in CI: apt-get install poppler-utils / brew install poppler
pdftoppm -png -r 100 invoice.pdf out/invoice
```

```ts
import { execFileSync } from 'node:child_process';

execFileSync('pdftoppm', ['-png', '-r', '100', path, 'out/invoice']);
expect(readFileSync('out/invoice-1.png')).toMatchSnapshot('invoice-page1.png', {
  maxDiffPixelRatio: 0.02,
});
```

Mask or stabilize dynamic regions first (dates, invoice numbers) — either fixed test data, or crop known-stable regions with `sharp` before comparing.

### Deeper checks when it matters

- **Machine-readable invoices** (ZUGFeRD/Factur-X) embed XML — extract and validate against schema.
- **PDF/A compliance** for archival documents: `verapdf` in CI.
- **Accessibility** (tagged PDF): at minimum assert text is extractable (a scanned-image PDF returns empty `text` — a real regression class after "we switched the PDF library").

## Caveats

- PDF generation is often async server-side — poll the download endpoint rather than racing the button click.
- Font substitution makes rasterized output differ between machines; generate baselines in the same Docker image CI uses.
- `page.pdf()` in Playwright *creates* PDFs of web pages (Chromium-only); it's unrelated to asserting on PDFs your app generates.

## Related

- [Test transactional email](../test-emails/) — PDFs frequently arrive as email attachments.
