// Assembles demos-dist/ for the public demos site: the apps, the vendored
// browser libs, and a small index page listing everything.
import { cpSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'demos-dist');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'vendor'), { recursive: true });
cpSync(join(ROOT, 'apps'), join(OUT, 'apps'), { recursive: true });
cpSync(join(ROOT, 'node_modules/jsqr/dist/jsQR.js'), join(OUT, 'vendor/jsqr.js'));
cpSync(join(ROOT, 'node_modules/pdf-lib/dist/pdf-lib.min.js'), join(OUT, 'vendor/pdf-lib.js'));

const apps = readdirSync(join(ROOT, 'apps'), { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name)
	.sort();

writeFileSync(
	join(OUT, 'index.html'),
	`<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>untestable demo apps</title>
	<style>
		:root { color-scheme: light dark; }
		body { font-family: system-ui; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.7; }
		a { color: light-dark(#dc2626, #f87171); }
	</style>
</head>
<body>
	<h1>Demo apps</h1>
	<p>The apps the <a href="https://recipes.untestable.dev/">recipes</a> are tested against.
	Source &amp; runnable tests: <a href="https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme">examples/</a>.</p>
	<ul>
${apps.map((a) => `\t\t<li><a href="/apps/${a}/">${a}</a></li>`).join('\n')}
	</ul>
</body>
</html>
`,
);
console.log(`demos-dist ready (${apps.length} apps)`);
