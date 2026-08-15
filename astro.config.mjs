// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Google Analytics 4 measurement ID. Replace with your own (e.g. 'G-ABC1234567')
// to enable analytics. Left as the placeholder, no analytics code is emitted.
const GA_ID = 'G-XXXXXXXXXX';

const gaHead = GA_ID.includes('XXXX')
	? []
	: [
			{
				tag: 'script',
				attrs: {
					src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`,
					async: true,
				},
			},
			{
				tag: 'script',
				content: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');
(function () {
	// Which recipe category/page is being read (register both params as
	// event-scoped custom dimensions in GA4 — see README).
	var m = location.pathname.match(/\\/recipes\\/([^\\/]+)\\/([^\\/]+)/);
	if (m) {
		gtag('event', 'recipe_view', {
			recipe_category: m[1],
			recipe_name: m[2],
		});
	}
	// Clicks through to the featured libraries (npm or GitHub).
	document.addEventListener('click', function (e) {
		var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
		if (!a) return;
		var lib = null;
		if (a.href.indexOf('npmjs.com/package/') !== -1) {
			lib = a.href.split('/package/')[1];
		} else if (a.href.indexOf('github.com/tsuemura/') !== -1) {
			lib = a.href.split('github.com/tsuemura/')[1];
		}
		if (lib) {
			gtag('event', 'library_click', { library: lib.split(/[\\/?#]/)[0] });
		}
	});
})();
`,
			},
		];

// https://astro.build/config
export default defineConfig({
	site: 'https://untestable.dev',
	integrations: [
		starlight({
			title: 'Test Automation Recipes',
			description:
				'Hands-on recipes for the hard-to-test parts of the web: microphone input, maps, toasts, WebAuthn, flaky-test repair and more — beyond what Playwright supports out of the box.',
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/tsuemura/test-automation-recipes',
				},
			],
			editLink: {
				baseUrl:
					'https://github.com/tsuemura/test-automation-recipes/edit/main/',
			},
			head: gaHead,
			sidebar: [
				{
					label: 'Start Here',
					items: [{ label: 'Featured libraries', slug: 'libraries' }],
				},
				{
					label: 'Media & Devices',
					items: [{ autogenerate: { directory: 'recipes/media' } }],
				},
				{
					label: 'Complex UI',
					items: [{ autogenerate: { directory: 'recipes/complex-ui' } }],
				},
				{
					label: 'Auth & Identity',
					items: [{ autogenerate: { directory: 'recipes/auth' } }],
				},
				{
					label: 'Beyond the Browser',
					items: [{ autogenerate: { directory: 'recipes/beyond-browser' } }],
				},
				{
					label: 'Strategy & Maintenance',
					items: [{ autogenerate: { directory: 'recipes/strategy' } }],
				},
			],
		}),
	],
});
