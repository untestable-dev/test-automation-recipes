---
title: Auto-repair flaky tests
description: Build a loop that detects flaky tests, diagnoses the visual cause, proposes a fix with an AI agent, and proves the fix by re-running.
sidebar:
  order: 1
  badge:
    text: Featured
    variant: tip
---

**Use case:** your suite is 2% flaky, which is enough to make every red build ambiguous. Retries hide the problem; humans fix the same three flake patterns over and over. You want the *fixing* automated too.

## Why this is hard

A flaky test fails without a code change, so the failure alone doesn't tell you what to change. The cause is usually **timing you can't see in a screenshot**: content that pops in late, a toast that steals a click, staged rendering that moves the button between `locator()` and `click()`. Diagnosis needs evidence of *what the screen did over time* — then a candidate fix, then statistical proof the fix worked.

## Recipe

The loop: **detect → collect evidence → diagnose & patch (agent) → verify by repetition → PR**.

### 1. Detect: retries as a flake sensor

With `retries` enabled, a pass-on-retry *is* the flake signal. Capture them from a custom reporter:

```ts
// flaky-reporter.ts
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

export default class FlakyReporter implements Reporter {
  private flaky: string[] = [];
  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'passed' && result.retry > 0) this.flaky.push(test.id);
  }
  onEnd() {
    require('node:fs').writeFileSync('flaky.json', JSON.stringify(this.flaky));
  }
}
```

### 2. Collect evidence worth diagnosing from

Traces show *what Playwright did*; they don't show what the **screen** did between actions — which is where flakes live. [agent-screen-observer](https://www.npmjs.com/package/agent-screen-observer)'s passive mode records frames with zero overhead and analyzes **only on failure**, attaching visual events (late layout shifts, toasts overlapping the click point, staged rendering bursts) as compact text + crops:

```ts
// playwright.config.ts — on top of your normal trace settings
import { test } from 'agent-screen-observer/playwright';
test.use({
  screenObserverOptions: { mode: 'passive', attach: 'retain-on-failure' },
});
```

A report like *"layout shifted at +1.8s, after the screen appeared settled"* converts "mysterious timeout" into a named, fixable defect.

### 3. Diagnose & patch with an agent

Feed a coding agent (Claude Code or similar in headless mode) a tight, evidence-rich prompt:

```sh
claude -p "Test '$TEST_ID' is flaky (passed on retry).
Evidence:
- failing attempt's error + trace summary: trace.txt
- screen observation report: observer-report.json
Identify the most likely cause and apply the SMALLEST fix to the test
(or a data-testid to the app if the locator is ambiguous).
Rules: no waitForTimeout; prefer web-first assertions; don't weaken the test."
```

Constrain the fix space — the classic repairs are small and mechanical:

| Flake pattern (from evidence) | Mechanical fix |
| --- | --- |
| Late layout shift moves the target | Assert the *cause* first (e.g. image/list loaded), then click |
| Toast overlays the button | Wait for the transient element to clear (its region is in the report) |
| Race on data load | Replace text assert with `expect.poll` / `toPass` on the API state |
| Ambiguous locator matches twice | Tighten to role+name or add a test id |

### 4. Verify by repetition — the non-negotiable step

A flake fix without repetition proof is a superstition:

```sh
npx playwright test $TEST_FILE --repeat-each=30 --workers=4
```

Gate the PR on it. If 30 green repeats pass, open the PR with the evidence attached:

```sh
gh pr create --title "fix(flaky): stabilize $TEST_ID" \
  --body "Cause: late layout shift (+1.8s) per screen-observer report. 30/30 repeats green."
```

A human reviews a *verified, evidenced* one-line diff — that's minutes, not an afternoon of reproduction attempts.

## Caveats

- Cap the loop: if the agent's fix doesn't survive `--repeat-each`, escalate to a human with the collected evidence instead of iterating forever.
- Some "flaky tests" are **real races in the app**. The observer evidence usually tells you which side owns the bug — route those to a bug tracker, don't "stabilize" the test into ignoring them.
- Run repair in CI on a schedule (nightly over `flaky.json`), not inline in PR builds — keep the feedback loop for humans fast.

## Related

- [Catch toasts and flicker](../../complex-ui/catch-toasts-and-flicker/) — the observation layer this recipe leans on.
- [Replace E2E tests with unit tests](../replace-e2e-with-unit-tests/) — the best flaky E2E test is one that no longer needs to be E2E.
