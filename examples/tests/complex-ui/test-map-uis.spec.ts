// Recipe: https://recipes.untestable.dev/recipes/complex-ui/test-map-uis/
import { test, expect, type Page } from '@playwright/test';
import { measureShift, waitForVisualStability } from '../helpers/pixels';

const CENTER = { x: 640, y: 300 };

/** Fast accelerating swipe, released while still moving → triggers inertia. */
async function flick(page: Page, dx: number, dy: number) {
	await page.mouse.move(CENTER.x, CENTER.y);
	await page.mouse.down();
	const steps = 12;
	for (let i = 1; i <= steps; i++) {
		const t = i / steps;
		const ease = t * t; // accelerate towards release
		await page.mouse.move(CENTER.x + dx * ease, CENTER.y + dy * ease);
		await page.waitForTimeout(10);
	}
	await page.mouse.up();
}

/** Slow drag that comes to a rest before release → no inertia. */
async function drag(page: Page, dx: number, dy: number) {
	await page.mouse.move(CENTER.x, CENTER.y);
	await page.mouse.down();
	const steps = 20;
	for (let i = 1; i <= steps; i++) {
		await page.mouse.move(CENTER.x + (dx * i) / steps, CENTER.y + (dy * i) / steps);
		await page.waitForTimeout(25);
	}
	await page.waitForTimeout(150); // finger rests → release velocity ~0
	await page.mouse.up();
}

test('a flick pans further than the finger travelled (inertia)', async ({ page }) => {
	await page.goto('/apps/map/');
	const map = page.locator('#map');
	const before = await waitForVisualStability(map);

	await flick(page, -250, 0);
	const after = await waitForVisualStability(map);

	const shift = measureShift(before, after);
	// The finger moved 250px; inertia must carry the map further than that.
	expect(Math.abs(shift.dx)).toBeGreaterThan(260);
	expect(Math.abs(shift.dx)).toBeLessThan(500);
	expect(Math.abs(shift.dy)).toBeLessThan(20);
});

test('a slow drag pans by exactly the drag distance', async ({ page }) => {
	await page.goto('/apps/map/');
	const map = page.locator('#map');
	const before = await waitForVisualStability(map);

	await drag(page, -200, 0);
	const after = await waitForVisualStability(map);

	const shift = measureShift(before, after);
	expect(Math.abs(Math.abs(shift.dx) - 200)).toBeLessThanOrEqual(15);
	expect(Math.abs(shift.dy)).toBeLessThan(15);
});
