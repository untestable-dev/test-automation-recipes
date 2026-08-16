// Aggregates @uc:<id> tags into a use-case coverage report.
// Usage: npx playwright test tests/strategy --reporter=line,./reporters/usecase-reporter.ts
import { writeFileSync } from 'node:fs';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { USECASES } from '../usecases';

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
			const state = !h ? '🔴 UNCOVERED' : h.failed ? '🟡 failing' : `🟢 ${h.passed} test(s)`;
			return `| ${id} | ${title} | ${state} |`;
		});
		writeFileSync(
			'usecase-coverage.md',
			`| Use case | Description | Status |\n|---|---|---|\n${rows.join('\n')}\n`,
		);
		console.log('\nuse-case coverage written to usecase-coverage.md');
	}
}
