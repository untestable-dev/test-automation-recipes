// Recipe: https://recipes.untestable.dev/recipes/beyond-browser/test-across-web-and-mobile/
import { test, expect } from '@playwright/test';

// The "phone" here is a second browser context — enough to exercise the
// pairing handoff and the backend session state. In production the pairing
// canvas holds a real QR code: screenshot it and decode with jsQR, then feed
// the URL to the device (see the recipe for the Appium variant).
test('pairing started on the big screen completes on the phone', async ({ page, browser, request }) => {
	// Big screen: a pairing session and its scannable code.
	await page.goto('/apps/qr-login/');
	await expect(page.locator('#state')).toHaveText('Waiting for your phone…');
	const qr = page.locator('#qr');
	expect((await qr.screenshot()).byteLength).toBeGreaterThan(0); // the code renders
	const pairUrl = await qr.getAttribute('data-pair-url');
	expect(pairUrl).toContain('/apps/qr-login/phone.html?session=');

	// Phone: a separate context = separate cookies, storage, session.
	const phone = await (await browser.newContext()).newPage();
	await phone.goto(pairUrl!);
	await expect(phone.locator('#state')).toHaveText('Linked');

	// The big screen reacts…
	await expect(page.locator('#state')).toHaveText('Connected to your phone', { timeout: 5_000 });

	// …and the strongest assertion is the shared backend state.
	const sessionId = new URL(pairUrl!).searchParams.get('session');
	const state = await (await request.get(`/api/session/${sessionId}`)).json();
	expect(state).toMatchObject({ devices: ['web', 'phone'], linked: true });

	await phone.context().close();
});
