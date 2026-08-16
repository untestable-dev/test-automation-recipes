// Serves the demo apps publicly (demo.untestable.dev) with the same APIs as
// the local server.mjs, plus the transcriber's /api/format (Workers AI).
// State is in-memory per isolate — fine for demos.
const sessions = new Map();
const outbox = [];

// --- transcriber LLM formatting (ported from webapp-demos) -----------------
// Primary first; retried once, then fall back — Workers AI occasionally
// throws per-model capacity errors, so one model is not enough.
const MODEL_CHAIN = [
	'@cf/google/gemma-4-26b-a4b-it',
	'@cf/google/gemma-4-26b-a4b-it',
	'@cf/meta/llama-3.3-70b-instruct-fp8-fast',
];

const SYSTEM_PROMPT = [
	'You clean up raw speech-to-text transcripts.',
	'Fix punctuation and casing, and break into paragraphs where natural.',
	'Remove EVERY filler word and hesitation (um, uh, er, like, you know, えー, あのー, えっと, まあ) — none may remain.',
	'Keep the original language of the transcript.',
	'Never add information, never translate, never change the meaning.',
	'Output ONLY the cleaned transcript, with no preamble or explanations.',
].join(' ');

async function handleFormat(request, env) {
	const origin = request.headers.get('origin');
	if (origin && new URL(origin).host !== new URL(request.url).host) {
		return json(403, { error: 'forbidden' });
	}
	let text;
	try {
		({ text } = await request.json());
	} catch {
		return json(400, { error: 'invalid JSON body' });
	}
	if (typeof text !== 'string' || !text.trim()) return json(400, { error: 'text is required' });
	if (text.length > 8000) return json(413, { error: 'text too long' });

	let lastError = 'empty model response';
	for (const model of MODEL_CHAIN) {
		try {
			const result = await env.AI.run(model, {
				messages: [{ role: 'user', content: `${SYSTEM_PROMPT}\n\n--- Transcript ---\n${text}` }],
				max_tokens: 2048,
				temperature: 0.1,
			});
			const formatted = (result.response ?? result.choices?.[0]?.message?.content)?.trim();
			if (formatted) return json(200, { formatted, model });
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
		}
	}
	return json(502, { error: lastError });
}

const json = (status, body) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;

		if (path === '/api/session/create' && request.method === 'POST') {
			const id = Math.random().toString(36).slice(2, 10);
			sessions.set(id, { devices: ['web'], linked: false });
			return json(200, { id });
		}
		if (path.startsWith('/api/session/link/') && request.method === 'POST') {
			const s = sessions.get(path.split('/').pop());
			if (!s) return json(404, { error: 'unknown session' });
			if (!s.devices.includes('phone')) s.devices.push('phone');
			s.linked = true;
			return json(200, s);
		}
		if (path.startsWith('/api/session/') && request.method === 'GET') {
			const s = sessions.get(path.split('/').pop());
			return s ? json(200, s) : json(404, { error: 'unknown session' });
		}
		if (path === '/api/signup' && request.method === 'POST') {
			const { email } = await request.json();
			const token = Math.random().toString(36).slice(2, 10);
			const link = `${url.origin}/apps/signup-email/confirm.html?token=${token}`;
			outbox.push({
				to: email,
				subject: 'Confirm your account',
				html: `<p>Welcome! <a href="${link}">Confirm your account</a></p>`,
			});
			return json(200, { sent: 'outbox' });
		}
		if (path === '/api/outbox' && request.method === 'GET') {
			return json(200, outbox);
		}
		if (path === '/api/format' && request.method === 'POST') {
			try {
				return await handleFormat(request, env);
			} catch (err) {
				return json(502, { error: err instanceof Error ? err.message : 'inference failed' });
			}
		}

		return env.ASSETS.fetch(request);
	},
};
