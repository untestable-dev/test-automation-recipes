// Recipe: https://recipes.untestable.dev/recipes/auth/test-totp-2fa/
import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';

test('enroll TOTP with a code generated in the test', async ({ page }) => {
	await page.goto('/apps/totp/');

	// The manual-entry secret next to the QR code.
	const secret = (await page.getByTestId('totp-secret').innerText()).replace(/\s/g, '');

	// The 30-second cliff: don't submit a code about to expire.
	if (authenticator.timeRemaining() < 3) {
		await page.waitForTimeout(authenticator.timeRemaining() * 1000);
	}

	await page.locator('#code').fill(authenticator.generate(secret));
	await page.getByRole('button', { name: 'Verify' }).click();
	await expect(page.locator('#status')).toHaveText('Two-factor enabled');
});

test('a wrong code is rejected', async ({ page }) => {
	await page.goto('/apps/totp/');
	await page.locator('#code').fill('000000');
	await page.getByRole('button', { name: 'Verify' }).click();
	await expect(page.locator('#status')).toHaveText('Invalid code');
});
