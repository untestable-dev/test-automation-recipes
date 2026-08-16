// Recipe: https://recipes.untestable.dev/recipes/strategy/replace-e2e-with-unit-tests/
// ONE journey test proves the wiring; the price-matrix lives in unit tests
// (unit/checkout-total.test.mjs — run with `node --test unit/`).
import { test, expect } from '@playwright/test';

test(
	'member discount reaches the screen',
	{ tag: ['@uc:checkout.journey', '@uc:checkout.member.discount'] },
	async ({ page }) => {
		await page.goto('/apps/checkout/');
		// subtotal 5600 ≥ 3000 → free shipping, no member discount yet
		await expect(page.locator('#total')).toHaveText('Total: 5600');

		await page.getByLabel("I'm a member").check();
		// 5600 × 0.95 = 5320 — the extracted function's result, on screen
		await expect(page.locator('#total')).toHaveText('Total: 5320');
	},
);
