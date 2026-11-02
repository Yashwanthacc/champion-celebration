import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const password = 'V7!qR2#nL9@xT4$k';
const sql = await readFile('./reset-local-admin.sql', 'utf8');
const match = sql.match(/password_hash = '([^']+)'/);

if (!match) throw new Error('Could not find hash in reset SQL file');

const [, algorithm, iterations, saltB64, hashB64] = match[1].match(/^([^$]+)\$(\d+)\$([^$]+)\$([^$]+)$/) ?? [];

if (algorithm !== 'pbkdf2-sha256') throw new Error('Unexpected hash format');

const key = await webcrypto.subtle.importKey(
  'raw', new TextEncoder().encode(password),
  'PBKDF2', false, ['deriveBits']
);

const bits = await webcrypto.subtle.deriveBits(
  {
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: Buffer.from(saltB64, 'base64'),
    iterations: Number(iterations)
  },
  key, 256
);

const actual = Buffer.from(bits).toString('base64');
console.log('Password matches reset file:', actual === hashB64);
