// From the recipe: retries as a flake sensor — a pass-on-retry IS the signal.
// Usage: npx playwright test --retries=2 --reporter=line,./reporters/flaky-reporter.ts
import { writeFileSync } from 'node:fs';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

export default class FlakyReporter implements Reporter {
	private flaky: string[] = [];

	onTestEnd(test: TestCase, result: TestResult) {
		if (result.status === 'passed' && result.retry > 0) {
			this.flaky.push(`${test.location.file}:${test.location.line} › ${test.title}`);
		}
	}

	onEnd() {
		writeFileSync('flaky.json', JSON.stringify(this.flaky, null, 2));
		if (this.flaky.length) {
			console.log(`\n⚠ ${this.flaky.length} flaky test(s) written to flaky.json`);
		}
	}
}
