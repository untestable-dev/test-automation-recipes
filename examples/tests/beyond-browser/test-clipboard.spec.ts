// Recipe: https://recipes.untestable.dev/recipes/beyond-browser/test-clipboard/
import { test, expect } from '@playwright/test';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('copy button puts the share URL on the clipboard', async ({ page }) => {
	await page.goto('/apps/clipboard/');
	await page.getByRole('button', { name: 'Copy link' }).click();
	await expect(page.locator('#copy-status')).toHaveText('Copied!');

	const text = await page.evaluate(() => navigator.clipboard.readText());
	expect(text).toBe('http://localhost:4173/s/abc123');
});

test('pasting TSV fills the grid', async ({ page }) => {
	await page.goto('/apps/clipboard/');
	await page.evaluate(() => navigator.clipboard.writeText('1\t2\n3\t4'));

	await page.locator('#a1').click();
	await page.keyboard.press('ControlOrMeta+v');

	await expect(page.locator('#b2')).toHaveText('4');
	await expect(page.locator('#b1')).toHaveText('2');
});

test('rich paste is sanitized to bold only', async ({ page }) => {
	await page.goto('/apps/clipboard/');
	await page.locator('#editor').evaluate((el) => {
		const dt = new DataTransfer();
		dt.setData('text/html', '<b>bold</b> from Word<script>document.title="pwned"</script>');
		dt.setData('text/plain', 'bold from Word');
		el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
	});

	await expect(page.locator('#editor strong')).toHaveText('bold');
	await expect(page.locator('#editor script')).toHaveCount(0);
	await expect(page).not.toHaveTitle('pwned');
});
