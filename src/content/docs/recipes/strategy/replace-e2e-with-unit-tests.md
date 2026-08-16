---
title: Replace E2E tests with unit tests
description: Identify E2E tests that are really logic tests in disguise, and push them down the pyramid without losing coverage.
sidebar:
  order: 2
---

**Use case:** your E2E suite takes 40 minutes and keeps growing, but many tests boot a browser, log in, and navigate three screens… to check that a *discount is calculated correctly*. You want the confidence without the browser tax.

> ▶ **Runnable sample**: [`replace-e2e-with-unit-tests.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/strategy/replace-e2e-with-unit-tests.spec.ts) — how to run: [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme)

## Why this is hard

Deleting an E2E test feels like deleting coverage. The skill is seeing **which part** of a test actually needs the browser: most E2E tests bundle one journey (needs E2E) with many *decisions* (don't). There's no tool for that judgment — but there is a repeatable procedure.

## Recipe

### 1. Find the demotion candidates

A test is a demotion candidate when its assertions are about **computed values**, not integration:

- The assert is text derived from inputs: prices, validation messages, date formatting, permissions ("admin sees the delete button").
- The test exists N times with different data — same steps, different table row.
- It never fails for the reason it was written; it fails on selectors and timing.

Signals from your runner help: sort by (duration × failure rate ÷ unique-bugs-caught). Tests that are slow, flaky and have never caught a regression are the queue.

### 2. Extract the decision, keep the wiring

The refactor that makes demotion safe: move the logic to a pure function, then test the function.

```ts
// Before: only testable through the UI
async function onCheckout() {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = user.isMember && subtotal > 5000 ? subtotal * 0.05 : 0;
  render(`Total: ${format(subtotal - discount + shippingFor(subtotal))}`);
}

// After: the decision is a unit
export function checkoutTotal(items: Item[], user: User): Money { /* … */ }
```

Ten E2E variants (member/non-member × thresholds × shipping tiers) become a table-driven unit test that runs in milliseconds:

```ts
test.each`
  items            | member   | total
  ${[shirt(5001)]} | ${true}  | ${4750.95}
  ${[shirt(5001)]} | ${false} | ${5001.0}
  ${[shirt(4999)]} | ${true}  | ${4999.0}
`('checkout total', ({ items, member, total }) => {
  expect(checkoutTotal(items, user({ member }))).toEqual(money(total));
});
```

**Keep exactly one** E2E journey through checkout — its job shrinks to "the wiring holds": the function's result actually reaches the screen and the order actually lands in the database.

### 3. Component tests for UI decisions

"Admin sees the delete button" doesn't need a *deployed* system — render the component with both roles (Vitest browser mode / Testing Library). Browser semantics, no backend, no login, no flakes from either.

### 4. Delete with a safety window

Demote in pairs: land the unit/component tests first, keep the old E2E test tagged `@demoted` for a few weeks of runs, then delete. If the lower test misses something the E2E catches in that window, you've learned where the integration risk actually is — that's the knowledge the pyramid is built from.

## Caveats

- Don't demote **journeys**: "sign up → verify email → first purchase" is integration by definition — see [Test transactional email](../../beyond-browser/test-emails/).
- If logic can't be extracted (it's tangled into handlers), that's an app refactor the test debt is pointing at — the test suite is the messenger.
- Track [use-case coverage](../measure-use-case-coverage/) through the demotion: coverage should move *down* the pyramid, not disappear.

## Related

- [Measure use-case coverage](../measure-use-case-coverage/)
- [Auto-repair flaky tests](../auto-repair-flaky-tests/) — for the E2E tests that remain.
