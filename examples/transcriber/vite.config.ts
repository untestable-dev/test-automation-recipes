import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Built to be served under /apps/transcriber/ on the demos site.
export default defineConfig({
	base: '/apps/transcriber/',
	build: {
		rollupOptions: {
			input: fileURLToPath(new URL('./transcriber/index.html', import.meta.url)),
		},
	},
});
