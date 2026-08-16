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
		var gh = a.href.match(/github\\.com\\/(?:tsuemura|untestable-dev)\\/([^\\/?#]+)/);
		if (a.href.indexOf('npmjs.com/package/') !== -1) {
			lib = a.href.split('/package/')[1];
		} else if (gh) {
			lib = gh[1];
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
	site: 'https://recipes.untestable.dev',
	integrations: [
		starlight({
			title: 'Test Automation Recipes',
			description: 'Recipes for the hard-to-test apps.',
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
				ja: { label: '日本語', lang: 'ja' },
			},
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/untestable-dev/test-automation-recipes',
				},
			],
			editLink: {
				baseUrl:
					'https://github.com/untestable-dev/test-automation-recipes/edit/main/',
			},
			head: gaHead,
			sidebar: [
				{
					label: 'Media & Devices',
					translations: { ja: 'メディアとデバイス' },
					items: [{ autogenerate: { directory: 'recipes/media' } }],
				},
				{
					label: 'Complex UI',
					translations: { ja: '複雑なUI' },
					items: [{ autogenerate: { directory: 'recipes/complex-ui' } }],
				},
				{
					label: 'Auth & Identity',
					translations: { ja: '認証とアイデンティティ' },
					items: [{ autogenerate: { directory: 'recipes/auth' } }],
				},
				{
					label: 'Beyond the Browser',
					translations: { ja: 'ブラウザの外側' },
					items: [{ autogenerate: { directory: 'recipes/beyond-browser' } }],
				},
				{
					label: 'Strategy & Maintenance',
					translations: { ja: '戦略とメンテナンス' },
					items: [{ autogenerate: { directory: 'recipes/strategy' } }],
				},
			],
		}),
	],
});
