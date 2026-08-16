// Recipe: https://recipes.untestable.dev/recipes/beyond-browser/test-pdf-output/
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// pdf-parse is CommonJS; require the parser directly (the package entry
// point runs a self-test when loaded outside require()).
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse/lib/pdf-parse.js');

test('the downloaded invoice PDF contains the right data', async ({ page }) => {
	await page.goto('/apps/invoice/');

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download invoice' }).click();
	const download = await downloadPromise;

	// Note: hand pdf-parse a plain Uint8Array — its bundled pdf.js
	// misparses Node Buffers in some environments.
	const bytes = new Uint8Array(readFileSync((await download.path())!));
	const { text, numpages } = await pdf(bytes);

	expect(numpages).toBe(1);
	expect(text).toContain('Invoice #1042');
	expect(text).toContain('Total: $1,337.00');
	expect(text).not.toContain('undefined'); // the classic template bug
});
