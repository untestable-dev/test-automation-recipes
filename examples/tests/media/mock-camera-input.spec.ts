// Recipe: https://recipes.untestable.dev/recipes/media/mock-camera-input/
import { test, expect } from '@playwright/test';

test('the app sees content from the injected fake camera', async ({ page }) => {
	// Replace getUserMedia with a canvas-backed stream BEFORE navigation —
	// works on any browser, and the app can't tell the difference.
	// (For a QR-scanner app, draw a QR image on the canvas the same way.)
	await page.addInitScript(() => {
		const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
		navigator.mediaDevices.getUserMedia = async (constraints) => {
			if (!constraints?.video) return original(constraints);
			const canvas = document.createElement('canvas');
			canvas.width = 640;
			canvas.height = 480;
			const ctx = canvas.getContext('2d')!;
			const paint = () => {
				ctx.fillStyle = '#ff0000';
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			};
			paint();
			setInterval(paint, 100); // keep frames flowing
			return canvas.captureStream(30);
		};
	});

	await page.goto('/apps/camera-scan/');
	await page.getByRole('button', { name: 'Start camera' }).click();

	const detected = page.locator('#detected');
	await expect(detected).toContainText('Detected:');
	await expect
		.poll(async () => {
			const d = await detected.evaluate((el) => ({ ...(el as HTMLElement).dataset }));
			return { r: Number(d.r), g: Number(d.g), b: Number(d.b) };
		})
		.toEqual(expect.objectContaining({ r: expect.any(Number) }));

	const rgb = await detected.evaluate((el) => ({
		r: Number((el as HTMLElement).dataset.r),
		g: Number((el as HTMLElement).dataset.g),
		b: Number((el as HTMLElement).dataset.b),
	}));
	expect(rgb.r).toBeGreaterThan(200); // the fake camera is showing pure red
	expect(rgb.g).toBeLessThan(50);
	expect(rgb.b).toBeLessThan(50);
});
