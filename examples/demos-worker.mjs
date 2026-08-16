// Serves the demo apps publicly (demos.untestable.dev) with the same APIs as
// the local server.mjs. State is in-memory per isolate — fine for demos.
const sessions = new Map();
const outbox = [];

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

		return env.ASSETS.fetch(request);
	},
};
