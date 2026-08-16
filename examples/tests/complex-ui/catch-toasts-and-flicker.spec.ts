// Recipe: https://recipes.untestable.dev/recipes/complex-ui/catch-toasts-and-flicker/
import { test, expect } from '@playwright/test';
import { ScreenObserver } from 'agent-screen-observer';

test('the save toast appears and self-dismisses', async ({ page }, testInfo) => {
	await page.goto('/apps/toasts/');
	const observer = await ScreenObserver.attach(page, {
		outDir: testInfo.outputPath('observer'),
	});

	const report = await observer.observe('click Save', () =>
		page.getByRole('button', { name: 'Save' }).click(),
	);
	await observer.detach();

	// A toast = something appeared after the action and was gone again.
	const toast = report.events.find((e) => e.type === 'transient_element');
	expect(toast, report.summary).toBeTruthy();
	expect(toast!.appearedAtMs).toBeLessThan(1500);
});
