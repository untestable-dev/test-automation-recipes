// Recipe: https://recipes.untestable.dev/recipes/strategy/auto-repair-flaky-tests/
import { test, expect } from '@playwright/test';

// The naive pattern: sleep, remember where the button was, click there.
// Staged rendering shifts the button 800–1300ms after load, so this races —
// it passes or fails depending on backend timing. Run it with:
//   FLAKY_DEMO=1 npx playwright test tests/strategy/auto-repair-flaky-tests.spec.ts
// (excluded from normal runs via grepInvert in playwright.config.ts)
test('add to cart — naive timing-based version', { tag: '@flaky-demo' }, async ({ page }) => {
	await page.goto('/apps/staged-render/');
	await page.waitForTimeout(300); // "the page looks ready"
	const box = (await page.getByRole('button', { name: 'Add to cart' }).boundingBox())!;
	await page.waitForTimeout(700); // "just in case"
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(page.locator('#cart-count')).toHaveText('1', { timeout: 2_000 });
});

// The repair from the recipe: assert the CAUSE first (the late content has
// landed), then act on the element itself — stable no matter the timing.
test(
	'add to cart — waits for the staged content first',
	{ tag: ['@uc:quality.flaky-free'] },
	async ({ page }) => {
		await page.goto('/apps/staged-render/');
		await expect(page.locator('.item')).toHaveCount(6); // the cause, not a sleep
		await page.getByRole('button', { name: 'Add to cart' }).click();
		await expect(page.locator('#cart-count')).toHaveText('1');
	},
);
