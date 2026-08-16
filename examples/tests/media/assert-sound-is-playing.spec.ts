// Recipe: https://recipes.untestable.dev/recipes/media/assert-sound-is-playing/
import { test, expect, type Page } from '@playwright/test';

const setupAnalyser = async (page: Page) => {
	await page.evaluate(() => {
		const el = document.querySelector('#chime') as HTMLMediaElement;
		const stream = (el as any).captureStream();
		const ctx = new AudioContext();
		const analyser = ctx.createAnalyser();
		ctx.createMediaStreamSource(stream).connect(analyser);
		(window as any).__analyser = analyser;
	});
};

test('the chime is audible and is actually a chime', async ({ page }) => {
	await page.goto('/apps/chime/');
	await expect(page.locator('#chime')).toHaveAttribute('src', /blob:/);
	await setupAnalyser(page);

	await page.getByRole('button', { name: 'Send' }).click();

	// Audible: non-zero RMS energy on the element's output.
	await expect
		.poll(
			() =>
				page.evaluate(() => {
					const analyser = (window as any).__analyser;
					const data = new Float32Array(analyser.fftSize);
					analyser.getFloatTimeDomainData(data);
					return Math.sqrt(data.reduce((s: number, v: number) => s + v * v, 0) / data.length);
				}),
			{ timeout: 5_000 },
		)
		.toBeGreaterThan(0.01);

	// The *right* sound: dominant frequency near 880Hz.
	const dominantHz = await page.evaluate(() => {
		const analyser = (window as any).__analyser;
		const bins = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(bins);
		let peak = 0;
		for (let i = 1; i < bins.length; i++) if (bins[i] > bins[peak]) peak = i;
		return (peak * analyser.context.sampleRate) / 2 / bins.length;
	});
	expect(dominantHz).toBeGreaterThan(700);
	expect(dominantHz).toBeLessThan(1000);
});
