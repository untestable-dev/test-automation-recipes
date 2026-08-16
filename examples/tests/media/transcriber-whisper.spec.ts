// Recipe: https://recipes.untestable.dev/recipes/media/mock-microphone-input/
// Heavyweight showcase: streams JFK's inaugural address (public domain) into a
// mocked microphone and lets in-browser Whisper transcribe it. Downloads a
// ~40MB model from the Hugging Face CDN, so it only runs when asked:
//
//   WHISPER=1 npx playwright test tests/media/transcriber-whisper.spec.ts
import { test, expect } from '@playwright/test';
import { mockMicrophone } from 'playwright-audio-mocking';

test.skip(!process.env.WHISPER, 'set WHISPER=1 to run (downloads a ~40MB model)');
test.setTimeout(300_000);

test('in-browser Whisper transcribes the mocked microphone', async ({ page }) => {
	const mic = await mockMicrophone(page);

	// ?device=wasm keeps the ONNX backend deterministic on machines without a GPU.
	await page.goto('https://demo.untestable.dev/apps/transcriber/?device=wasm');

	await page.getByTestId('record').click();
	await expect(page.getByTestId('status')).toContainText('Recording');

	await mic.play('tests/fixtures/jfk.wav');
	await mic.waitForEnd({ timeout: 30_000 });
	await page.getByTestId('stop').click();

	await expect(page.getByTestId('transcript')).toContainText('ask not what your country', {
		timeout: 240_000,
		ignoreCase: true,
	});
});
