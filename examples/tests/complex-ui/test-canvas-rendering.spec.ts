// Recipe: https://recipes.untestable.dev/recipes/complex-ui/test-canvas-rendering/
import { test, expect } from '@playwright/test';

// Bar geometry — mirrors the app's constants.
const BASE = 320, BAR_W = 80, GAP = 40, LEFT = 60;
const barCenterX = (i: number) => LEFT + i * (BAR_W + GAP) + BAR_W / 2;

test.beforeEach(async ({ page }) => {
	// Freeze time BEFORE the app loads, then run the entry animation to its
	// end deterministically. No waiting, no mid-animation flakiness.
	await page.clock.install({ time: new Date('2026-01-01T12:00:00') });
	await page.goto('/apps/chart/');
	await page.clock.runFor(1000);
});

function probe(page: import('@playwright/test').Page, x: number, y: number) {
	return page.evaluate(([px, py]) => {
		const ctx = (document.querySelector('#chart') as HTMLCanvasElement).getContext('2d')!;
		const d = ctx.getImageData(px, py, 1, 1).data;
		return { r: d[0], g: d[1], b: d[2], a: d[3] };
	}, [x, y]);
}

function columnHeight(page: import('@playwright/test').Page, x: number) {
	return page.evaluate(([px, base]) => {
		const ctx = (document.querySelector('#chart') as HTMLCanvasElement).getContext('2d')!;
		const col = ctx.getImageData(px, 0, 1, base).data;
		let painted = 0;
		for (let i = 0; i < col.length; i += 4) if (col[i + 3] > 0) painted++;
		return painted;
	}, [x, BASE]);
}

test('the third bar is red', async ({ page }) => {
	const { r, g, b } = await probe(page, barCenterX(2), BASE - 20);
	expect(r).toBeGreaterThan(150);
	expect(r).toBeGreaterThan(g + 50);
	expect(r).toBeGreaterThan(b + 50);
});

test('bar 2 is taller than bar 1, at its full height', async ({ page }) => {
	const h1 = await columnHeight(page, barCenterX(0));
	const h2 = await columnHeight(page, barCenterX(1));
	expect(h2).toBeGreaterThan(h1);
	expect(h2).toBeGreaterThanOrEqual(238); // 80 × 3 fully animated in
	expect(h1).toBeGreaterThanOrEqual(118); // 40 × 3
});
