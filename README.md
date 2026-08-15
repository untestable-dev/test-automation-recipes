# Test Automation Recipes

Use-case-driven recipes for the hard-to-test parts of the web — microphone input, inertial maps, vanishing toasts, passkeys, flaky-test repair — beyond what Playwright supports out of the box.

**Live at [untestable.dev](https://untestable.dev/).** Built with [Astro Starlight](https://starlight.astro.build/). Deployed to GitHub Pages.

## Development

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static build into dist/
npm run preview
```

Recipes live in `src/content/docs/recipes/<category>/<slug>.md`. The directory is the category (it feeds the sidebar groups in `astro.config.mjs` and the analytics category dimension). Cross-link recipes with **relative** links (`../other-recipe/`, `../../category/recipe/`) so they survive base-path/domain changes.

## Deployment

Pushes to `main` deploy automatically via `.github/workflows/deploy.yml` (GitHub Actions → GitHub Pages).

One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

## Analytics (GA4)

Set `GA_ID` at the top of `astro.config.mjs` to your GA4 measurement ID (`G-…`). While it's the placeholder, no analytics code is emitted at all.

Beyond default page views, two custom events measure *which testing topics people care about*:

| Event | Params | Fired when |
| --- | --- | --- |
| `recipe_view` | `recipe_category`, `recipe_name` | A recipe page loads |
| `library_click` | `library` | Any link to `npmjs.com/package/*` or `github.com/tsuemura/*` is clicked |

To see the params in reports, register them once in GA4 as **event-scoped custom dimensions** (Admin → Custom definitions): `recipe_category`, `recipe_name`, `library`. Then "interest by category" is a standard report on `recipe_view` grouped by `recipe_category`, and library conversion is `library_click` by `library`.

## Custom domain

`untestable.dev` is registered at Cloudflare Registrar. DNS (Cloudflare, **DNS only** — not proxied, so GitHub Pages can provision TLS):

- `untestable.dev` CNAME → `tsuemura.github.io` (apex, CNAME-flattened by Cloudflare)
- `www.untestable.dev` CNAME → `tsuemura.github.io` (GitHub redirects it to the apex)

The custom domain is set in repository **Settings → Pages**, and `site` in `astro.config.mjs` points at `https://untestable.dev` (no `base`).
