---
title: Measure use-case coverage
description: Tag tests with the user scenarios they prove, and report coverage of what the product does — not lines of code.
sidebar:
  order: 3
---

**Use case:** the release question is never "is line coverage ≥ 80%?" — it's "**can a customer still check out?**" You want a report that maps *user-facing use cases* to the tests that prove them, and flags the use cases nothing proves.

## Why this is hard

Code coverage tools measure lines executed, which says nothing about scenarios proven: 90% line coverage can coexist with "password reset is untested". Use cases live in specs and heads, not in any artifact a tool can count — until you make them one.

## Recipe

### 1. Make use cases first-class: a registry

One file, owned like code, reviewed like code:

```ts
// usecases.ts — the product's testable surface
export const USECASES = {
  'checkout.guest': 'Guest completes a purchase',
  'checkout.member.discount': 'Member discount applies at checkout',
  'auth.password-reset': 'User resets a forgotten password',
  'auth.passkey.login': 'User signs in with a passkey',
  'billing.invoice.pdf': 'User downloads a correct invoice PDF',
} as const;
export type UseCaseId = keyof typeof USECASES;
```

### 2. Tag tests with the use cases they prove

Playwright's tags carry the link (and `--grep` gives you scenario-scoped runs for free):

```ts
test('guest can buy a shirt', { tag: '@uc:checkout.guest' }, async ({ page }) => {
  // …
});

// Unit tests prove use cases too — a type-checked annotation:
describeUseCase('checkout.member.discount', () => { /* table-driven cases */ });
```

The typed ID matters: a renamed use case becomes a compile error, not a silently orphaned tag.

### 3. Aggregate with a custom reporter

```ts
// usecase-reporter.ts
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { USECASES } from './usecases';

export default class UseCaseReporter implements Reporter {
  private hits = new Map<string, { passed: number; failed: number }>();

  onTestEnd(test: TestCase, result: TestResult) {
    for (const tag of test.tags.filter((t) => t.startsWith('@uc:'))) {
      const id = tag.slice(4);
      const h = this.hits.get(id) ?? { passed: 0, failed: 0 };
      h[result.status === 'passed' ? 'passed' : 'failed']++;
      this.hits.set(id, h);
    }
  }

  onEnd() {
    const rows = Object.entries(USECASES).map(([id, title]) => {
      const h = this.hits.get(id);
      const state = !h ? '🔴 UNCOVERED' : h.failed ? `🟡 failing` : `🟢 ${h.passed} test(s)`;
      return `| ${id} | ${title} | ${state} |`;
    });
    require('node:fs').writeFileSync(
      'usecase-coverage.md',
      `| Use case | Description | Status |\n|---|---|---|\n${rows.join('\n')}`,
    );
  }
}
```

The output is the report stakeholders actually wanted from "coverage":

| Use case | Description | Status |
|---|---|---|
| checkout.guest | Guest completes a purchase | 🟢 3 test(s) |
| auth.password-reset | User resets a forgotten password | 🔴 UNCOVERED |

### 4. Enforce the interesting direction

Failing CI on "uncovered use case" invites tag-spam. Enforce the honest subset instead: new entries in `USECASES` must gain a test within a sprint; **deleting a test that is a use case's *only* prover fails CI immediately**. That's the regression that matters.

## Caveats

- A tag is a *claim*. Periodically audit that the test would actually fail if the use case broke (mutation testing on the app, or targeted sabotage on a branch).
- Keep the registry at *user-intent* granularity ("resets password"), not click-path granularity — paths churn, intents don't.
- This composes with [demoting E2E tests](../replace-e2e-with-unit-tests/): coverage stays visible while the proving test moves down the pyramid.

## Related

- [Replace E2E tests with unit tests](../replace-e2e-with-unit-tests/)
- [Auto-repair flaky tests](../auto-repair-flaky-tests/)
