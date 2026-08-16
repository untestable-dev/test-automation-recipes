// Recipe: https://recipes.untestable.dev/recipes/beyond-browser/test-emails/
import { test, expect, type APIRequestContext } from '@playwright/test';

// With MAILPIT=1 (docker compose up) the mail really goes over SMTP and is
// read back through Mailpit's REST API — exactly as in the recipe. Without
// it, the demo server keeps sent mail in an in-memory outbox instead.
type Message = { to: string; subject: string; html: string };

async function getInbox(request: APIRequestContext, to: string): Promise<Message[]> {
	if (process.env.MAILPIT === '1') {
		const res = await request.get(`http://localhost:8025/api/v1/search?query=to:${to}`);
		const { messages } = await res.json();
		const out: Message[] = [];
		for (const m of messages ?? []) {
			const detail = await (await request.get(`http://localhost:8025/api/v1/message/${m.ID}`)).json();
			out.push({ to, subject: detail.Subject, html: detail.HTML });
		}
		return out;
	}
	const res = await request.get('/api/outbox');
	const all: Message[] = await res.json();
	return all.filter((m) => m.to === to);
}

test('signup confirmation link arrives and works', async ({ page, request }) => {
	const email = `user-${Date.now()}@example.test`;

	await page.goto('/apps/signup-email/');
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Sign up' }).click();
	await expect(page.locator('#status')).toHaveText('Check your inbox');

	// Find the message…
	await expect
		.poll(async () => (await getInbox(request, email)).length, { timeout: 15_000 })
		.toBeGreaterThan(0);
	const [msg] = await getInbox(request, email);
	expect(msg.subject).toMatch(/confirm your account/i);

	// …extract the link from the HTML body…
	const link = msg.html.match(/href="([^"]*confirm[^"]*)"/)?.[1];
	expect(link).toBeTruthy();

	// …and complete the journey in the browser.
	await page.goto(link!);
	await expect(page.locator('#result')).toHaveText('Account confirmed');
});
