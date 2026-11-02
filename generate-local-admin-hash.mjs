import { webcrypto } from 'node:crypto';

const password = 'LocalAdmin!2026-Test';
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const key = await webcrypto.subtle.importKey(
  'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
);
const bits = await webcrypto.subtle.deriveBits(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256
);
const b64 = b => Buffer.from(b).toString('base64');
const hash = `pbkdf2-sha256$100000$${b64(salt)}$${b64(bits)}`;
console.log(hash);
console.log('Length:', hash.length);
