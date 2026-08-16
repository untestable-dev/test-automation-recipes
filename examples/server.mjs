// Tiny server for the demo apps: static files, vendored browser libs from
// node_modules, and a couple of JSON APIs used by individual recipes.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT ?? 4173;

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.css': 'text/css',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.wav': 'audio/wav',
	'.json': 'application/json',
};

// Browser libraries served straight out of node_modules.
const VENDOR = {
	'/vendor/jsqr.js': 'node_modules/jsqr/dist/jsQR.js',
	'/vendor/pdf-lib.js': 'node_modules/pdf-lib/dist/pdf-lib.min.js',
};

// In-memory state for the cross-device (web↔mobile) session demo.
const sessions = new Map();
// In-memory outbox for the email demo when Mailpit isn't running.
export const outbox = [];

const json = (res, status, body) => {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
};

const server = createServer(async (req, res) => {
	const url = new URL(req.url, `http://localhost:${PORT}`);
	const path = url.pathname;

	// --- APIs ---------------------------------------------------------------
	if (path === '/api/session/create' && req.method === 'POST') {
		const id = Math.random().toString(36).slice(2, 10);
		sessions.set(id, { devices: ['web'], linked: false });
		return json(res, 200, { id });
	}
	if (path.startsWith('/api/session/link/') && req.method === 'POST') {
		const id = path.split('/').pop();
		const s = sessions.get(id);
		if (!s) return json(res, 404, { error: 'unknown session' });
		if (!s.devices.includes('phone')) s.devices.push('phone');
		s.linked = true;
		return json(res, 200, s);
	}
	if (path.startsWith('/api/session/') && req.method === 'GET') {
		const id = path.split('/').pop();
		const s = sessions.get(id);
		return s ? json(res, 200, s) : json(res, 404, { error: 'unknown session' });
	}
	if (path === '/api/signup' && req.method === 'POST') {
		let body = '';
		for await (const chunk of req) body += chunk;
		const { email } = JSON.parse(body);
		const token = Math.random().toString(36).slice(2, 10);
		const link = `http://localhost:${PORT}/apps/signup-email/confirm.html?token=${token}`;
		const message = {
			to: email,
			subject: 'Confirm your account',
			html: `<p>Welcome! <a href="${link}">Confirm your account</a></p>`,
		};
		try {
			// Send through Mailpit when it's up (docker compose up); otherwise
			// keep it in the in-memory outbox so the demo still works.
			const { createTransport } = await import('nodemailer');
			const t = createTransport({ host: 'localhost', port: 1025 });
			await t.sendMail({ from: 'noreply@example.test', ...message });
			return json(res, 200, { sent: 'mailpit' });
		} catch {
			outbox.push(message);
			return json(res, 200, { sent: 'outbox' });
		}
	}
	if (path === '/api/outbox' && req.method === 'GET') {
		return json(res, 200, outbox);
	}

	// --- static -------------------------------------------------------------
	try {
		const file = VENDOR[path] ?? (normalize(path).replace(/^\/+/, '') || 'index.html');
		let target = join(ROOT, file);
		if (!target.startsWith(ROOT)) throw new Error('traversal');
		let data;
		try {
			data = await readFile(target);
		} catch {
			target = join(target, 'index.html');
			data = await readFile(target);
		}
		res.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
		res.end(data);
	} catch {
		res.writeHead(404);
		res.end('not found');
	}
});

server.listen(PORT, () => console.log(`demo apps on http://localhost:${PORT}`));
