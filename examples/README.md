# Runnable examples

Every recipe on [recipes.untestable.dev](https://recipes.untestable.dev/) has a working sample here: a small demo app under `apps/` and a Playwright spec under `tests/` that mirrors the recipe slug.

**Play with the demo apps in your browser: [demos.untestable.dev](https://demos.untestable.dev/)** (deployed via `node scripts/build-demos.mjs && npx wrangler deploy -c wrangler-demos.jsonc`). The tests below run against the same apps locally.

## Run everything

```sh
cd examples
npm install
node scripts/make-fixtures.mjs      # generates the audio fixture
npx playwright install chromium
npx playwright test                 # 23 tests, all green
npm run test:unit                   # node:test cases for the E2E→unit recipe
```

Run a single recipe's sample:

```sh
npx playwright test tests/media/mock-microphone-input.spec.ts
```

Poke at the demo apps yourself: `npm run serve` → http://localhost:4173/apps/voice-memo/ etc.

## Recipe → sample map

| Recipe | Spec | Demo app |
| --- | --- | --- |
| Mock microphone input | `tests/media/mock-microphone-input.spec.ts` | `apps/voice-memo/` |
| Mock camera input | `tests/media/mock-camera-input.spec.ts` | `apps/camera-scan/` |
| Test WebRTC calls | `tests/media/test-webrtc-calls.spec.ts` | `apps/call/` |
| Assert sound is playing | `tests/media/assert-sound-is-playing.spec.ts` | `apps/chime/` |
| Test map UIs | `tests/complex-ui/test-map-uis.spec.ts` | `apps/map/` |
| Catch toasts and flicker | `tests/complex-ui/catch-toasts-and-flicker.spec.ts` | `apps/toasts/` |
| Test canvas rendering | `tests/complex-ui/test-canvas-rendering.spec.ts` | `apps/chart/` |
| Test IME composition | `tests/complex-ui/test-ime-composition.spec.ts` | `apps/search-form/` |
| Test passkeys (WebAuthn) | `tests/auth/test-passkeys-webauthn.spec.ts` | `apps/passkeys/` |
| Test TOTP two-factor login | `tests/auth/test-totp-2fa.spec.ts` | `apps/totp/` |
| Test transactional email | `tests/beyond-browser/test-emails.spec.ts` | `apps/signup-email/` |
| Test PDF output | `tests/beyond-browser/test-pdf-output.spec.ts` | `apps/invoice/` |
| Test clipboard interactions | `tests/beyond-browser/test-clipboard.spec.ts` | `apps/clipboard/` |
| Test journeys across web and mobile | `tests/beyond-browser/test-across-web-and-mobile.spec.ts` | `apps/qr-login/` |
| Test Windows native apps | [`windows-flaui/`](windows-flaui/) (Windows only) | `windows-flaui/DemoApp/` |
| Auto-repair flaky tests | `tests/strategy/auto-repair-flaky-tests.spec.ts` + `reporters/flaky-reporter.ts` | `apps/staged-render/` |
| Replace E2E tests with unit tests | `tests/strategy/replace-e2e-with-unit-tests.spec.ts` + `unit/` | `apps/checkout/` |
| Measure use-case coverage | `tests/strategy/measure-use-case-coverage.spec.ts` + `reporters/usecase-reporter.ts` | — |

## Variations

- **Email via a real SMTP capture**: `docker compose up -d` (starts [Mailpit](https://mailpit.axllent.org/)), then `MAILPIT=1 npx playwright test tests/beyond-browser/test-emails.spec.ts`. Without Docker the sample uses the demo server's in-memory outbox.
- **The intentionally flaky test** (auto-repair recipe) is excluded from normal runs. Watch it flake and see the reporter catch it:
  ```sh
  FLAKY_DEMO=1 npx playwright test tests/strategy/auto-repair-flaky-tests.spec.ts \
    --retries=2 --reporter=line,./reporters/flaky-reporter.ts
  cat flaky.json
  ```
- **Use-case coverage report**:
  ```sh
  npx playwright test tests/strategy --reporter=line,./reporters/usecase-reporter.ts
  cat usecase-coverage.md
  ```
- **Windows native**: see [`windows-flaui/README.md`](windows-flaui/README.md) — requires Windows + .NET 8.

Everything is MIT licensed — copy whatever is useful.
