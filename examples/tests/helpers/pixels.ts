// Pixel-level observation helpers: visual stability waiting and image-shift
// measurement. Deliberately simple stand-ins for the techniques described in
// the map recipe (phase correlation → here: coarse template matching).
import { PNG } from 'pngjs';
import type { Locator, Page } from '@playwright/test';

export function decode(buf: Buffer): PNG {
	return PNG.sync.read(buf);
}

function diffRatio(a: PNG, b: PNG): number {
	if (a.width !== b.width || a.height !== b.height) return 1;
	let diff = 0;
	const total = a.width * a.height;
	for (let i = 0; i < a.data.length; i += 4) {
		if (
			Math.abs(a.data[i] - b.data[i]) > 8 ||
			Math.abs(a.data[i + 1] - b.data[i + 1]) > 8 ||
			Math.abs(a.data[i + 2] - b.data[i + 2]) > 8
		) diff++;
	}
	return diff / total;
}

/** Resolve when two consecutive screenshots are (near-)identical. */
export async function waitForVisualStability(
	target: Locator | Page,
	{ intervalMs = 120, threshold = 0.001, timeoutMs = 10_000 } = {},
): Promise<Buffer> {
	let prev = await target.screenshot();
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, intervalMs));
		const next = await target.screenshot();
		if (diffRatio(decode(prev), decode(next)) < threshold) return next;
		prev = next;
	}
	throw new Error('screen never settled');
}

function toGray(png: PNG): { w: number; h: number; g: Float32Array } {
	const g = new Float32Array(png.width * png.height);
	for (let i = 0, p = 0; i < png.data.length; i += 4, p++) {
		g[p] = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
	}
	return { w: png.width, h: png.height, g };
}

/**
 * How far did the image content move between `before` and `after`?
 * Template matching: a central patch of `after` is searched for in `before`.
 * Returns the shift in CSS-ish pixels (positive dx = content moved right).
 */
export function measureShift(
	before: Buffer,
	after: Buffer,
	{ rangeX = 520, rangeY = 80 } = {},
): { dx: number; dy: number } {
	const A = toGray(decode(before));
	const B = toGray(decode(after));
	const pw = 240, ph = 160, stride = 4;
	const px = Math.floor(B.w / 2 - pw / 2), py = Math.floor(B.h / 2 - ph / 2);

	const sad = (dx: number, dy: number): number => {
		let s = 0, n = 0;
		for (let y = 0; y < ph; y += stride) {
			for (let x = 0; x < pw; x += stride) {
				const bx = px + x, by = py + y;
				const ax = bx + dx, ay = by + dy;
				if (ax < 0 || ay < 0 || ax >= A.w || ay >= A.h) return Infinity;
				s += Math.abs(B.g[by * B.w + bx] - A.g[ay * A.w + ax]);
				n++;
			}
		}
		return s / n;
	};

	let best = { dx: 0, dy: 0, s: Infinity };
	const consider = (dx: number, dy: number) => {
		const s = sad(dx, dy);
		if (s < best.s) best = { dx, dy, s };
	};
	for (let dy = -rangeY; dy <= rangeY; dy += 8)
		for (let dx = -rangeX; dx <= rangeX; dx += 8) consider(dx, dy);
	const c = { ...best };
	for (let dy = c.dy - 8; dy <= c.dy + 8; dy++)
		for (let dx = c.dx - 8; dx <= c.dx + 8; dx++) consider(dx, dy);

	// The patch from `after` was found at +d in `before`, meaning the content
	// moved by -d from before to after.
	return { dx: -best.dx, dy: -best.dy };
}
