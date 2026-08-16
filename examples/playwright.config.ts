import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	// The intentionally-flaky demo (strategy/auto-repair) only runs when asked.
	grepInvert: process.env.FLAKY_DEMO ? undefined : /@flaky-demo/,
	timeout: 30_000,
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'retain-on-failure',
	},
	webServer: {
		command: 'node server.mjs',
		port: 4173,
		reuseExistingServer: true,
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: {
					args: [
						'--autoplay-policy=no-user-gesture-required',
						'--use-fake-ui-for-media-stream',
					],
				},
			},
		},
	],
});
