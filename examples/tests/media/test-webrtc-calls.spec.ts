// Recipe: https://recipes.untestable.dev/recipes/media/test-webrtc-calls/
import { test, expect, type Page } from '@playwright/test';
import { mockMicrophone } from 'playwright-audio-mocking';

// Chromium hides host ICE candidates behind mDNS names, which never resolve
// in headless CI — the call would stay stuck in 'new'. Disable that for
// the loopback call. (Keep the base flags from playwright.config.ts.)
test.use({
	launchOptions: {
		args: [
			'--autoplay-policy=no-user-gesture-required',
			'--use-fake-ui-for-media-stream',
			'--disable-features=WebRtcHideLocalIpsWithMdns',
		],
	},
});

function remoteAudioLevel(page: Page) {
	return page.evaluate(async () => {
		const el = document.querySelector('#remote') as HTMLMediaElement;
		if (!el?.srcObject) return 0;
		const w = window as any;
		if (!w.__analyser) {
			const ctx = new AudioContext();
			const analyser = ctx.createAnalyser();
			ctx.createMediaStreamSource(el.srcObject as MediaStream).connect(analyser);
			w.__analyser = analyser;
		}
		await new Promise((r) => setTimeout(r, 150));
		const data = new Float32Array(w.__analyser.fftSize);
		w.__analyser.getFloatTimeDomainData(data);
		return Math.sqrt(data.reduce((s: number, v: number) => s + v * v, 0) / data.length);
	});
}

test('the callee hears the caller', async ({ page: callee, context }) => {
	const room = `r${Date.now()}`;
	const caller = await context.newPage();
	const mic = await mockMicrophone(caller); // BEFORE goto

	// The callee must be listening before the caller sends its offer.
	await callee.goto(`/apps/call/?room=${room}&role=callee`);
	await callee.getByRole('button', { name: 'Join' }).click();
	await caller.goto(`/apps/call/?room=${room}&role=caller`);
	await caller.getByRole('button', { name: 'Join' }).click();

	await expect(caller.locator('#state')).toHaveText('connected', { timeout: 15_000 });
	await expect(callee.locator('#state')).toHaveText('connected', { timeout: 15_000 });

	// The caller speaks — and the callee's remote stream carries real energy.
	await mic.play('tests/fixtures/hello.wav', { loop: true });
	await expect.poll(() => remoteAudioLevel(callee), { timeout: 10_000 }).toBeGreaterThan(0.01);
	await mic.stop();
});
