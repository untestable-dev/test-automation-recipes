// Recipe: https://recipes.untestable.dev/recipes/complex-ui/test-ime-composition/
import { test, expect } from '@playwright/test';

test('Enter during IME composition confirms, not submits', async ({ page }) => {
	await page.goto('/apps/search-form/');
	await page.locator('#q').click();

	const cdp = await page.context().newCDPSession(page);

	// Start composing: the field shows the underlined preedit string.
	await cdp.send('Input.imeSetComposition', {
		text: 'にほんご',
		selectionStart: 4,
		selectionEnd: 4,
	});

	// The preedit is visible in the field…
	await expect(page.locator('#q')).toHaveValue('にほんご');
	// …but the counter must not count unconfirmed text.
	await expect(page.locator('#count')).toHaveText('0');

	// Enter while composing = "confirm the candidate", never "submit".
	await cdp.send('Input.dispatchKeyEvent', {
		type: 'rawKeyDown', key: 'Enter', code: 'Enter',
		windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229,
	});
	await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
	await expect(page.locator('#result')).toHaveText('');

	// Commit the composition (compositionend fires).
	await cdp.send('Input.insertText', { text: '日本語' });
	await expect(page.locator('#q')).toHaveValue('日本語');
	await expect(page.locator('#count')).toHaveText('3');

	// Enter after committing submits as usual.
	await page.keyboard.press('Enter');
	await expect(page.locator('#result')).toHaveText('Searched: 日本語');
	await expect(page).toHaveURL(/\?q=/);
});
