// Generates tests/fixtures/hello.wav — 1.2s of 440Hz sine, 16-bit PCM mono.
import { writeFileSync, mkdirSync } from 'node:fs';

const RATE = 16000;
const SECONDS = 1.2;
const n = Math.floor(RATE * SECONDS);
const data = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) {
	const v = Math.sin((2 * Math.PI * 440 * i) / RATE) * 0.6;
	data.writeInt16LE(Math.round(v * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

mkdirSync(new URL('../tests/fixtures/', import.meta.url), { recursive: true });
writeFileSync(new URL('../tests/fixtures/hello.wav', import.meta.url), Buffer.concat([header, data]));
console.log('wrote tests/fixtures/hello.wav');
