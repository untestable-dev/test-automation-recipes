// Recipe: https://recipes.untestable.dev/recipes/auth/test-passkeys-webauthn/
import { test, expect } from '@playwright/test';
import type { CDPSession } from '@playwright/test';

let cdp: CDPSession;
let authenticatorId: string;

test.beforeEach(async ({ page }) => {
	cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	({ authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport: 'internal', // a platform authenticator (like Touch ID)
			hasResidentKey: true, // passkeys are discoverable credentials
			hasUserVerification: true,
			isUserVerified: true, // "the fingerprint matched"
			automaticPresenceSimulation: true, // auto-approve prompts
		},
	}));
	await page.goto('/apps/passkeys/');
});

test('register a passkey, then sign in with it', async ({ page }) => {
	await page.getByRole('button', { name: 'Add a passkey' }).click();
	await expect(page.locator('#status')).toHaveText('Passkey added');

	// The credential really exists on the (virtual) device:
	const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
	expect(credentials).toHaveLength(1);

	await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
	await expect(page.locator('#status')).toHaveText('Signed in');
});

test('failed user verification shows the error state', async ({ page }) => {
	await page.getByRole('button', { name: 'Add a passkey' }).click();
	await expect(page.locator('#status')).toHaveText('Passkey added');

	// "wrong finger": verification fails from here on
	await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false });

	await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
	await expect(page.locator('#status')).toHaveText('Sign-in failed');
});
