// Recipe: https://recipes.untestable.dev/recipes/media/mock-microphone-input/
import { test, expect } from '@playwright/test';
import { mockMicrophone } from 'playwright-audio-mocking';

test('the app records audio from the mocked microphone', async ({ page }) => {
	const mic = await mockMicrophone(page); // install BEFORE page.goto()
	await page.goto('/apps/voice-memo/');

	await page.getByRole('button', { name: 'Record' }).click();
	await mic.play('tests/fixtures/hello.wav');
	await mic.waitForEnd();
	await page.getByRole('button', { name: 'Stop' }).click();

	await expect(page.locator('#result')).toContainText('Voice detected');
});
