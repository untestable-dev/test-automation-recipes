// Recipe: https://recipes.untestable.dev/recipes/strategy/measure-use-case-coverage/
// Tests claim use cases via typed tags; the reporter turns claims into a report:
//   npx playwright test tests/strategy --reporter=line,./reporters/usecase-reporter.ts
// → usecase-coverage.md ('auth.password-reset' shows as 🔴 UNCOVERED on purpose).
import { test, expect } from '@playwright/test';
import { USECASES, type UseCaseId } from '../../usecases';

// A renamed use case becomes a compile error here, not a silently orphaned tag.
const uc = (id: UseCaseId) => `@uc:${id}`;

test('the registry defines every claimed use case', { tag: uc('checkout.journey') }, async () => {
	expect(Object.keys(USECASES).length).toBeGreaterThan(0);
	for (const [id, title] of Object.entries(USECASES)) {
		expect(id).toMatch(/^[a-z-]+(\.[a-z-]+)+$/);
		expect(title.length).toBeGreaterThan(5);
	}
});
