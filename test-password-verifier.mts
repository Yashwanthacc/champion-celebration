import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { verifyPassword } from './worker/passwords.ts';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const sql = await readFile('./reset-local-admin.sql', 'utf8');
const hash = sql.match(/password_hash = '([^']+)'/)?.[1];

if (!hash) throw new Error('Hash not found in reset SQL file');

console.log(
  'Application verifier accepts password:',
  await verifyPassword('V7!qR2#nL9@xT4$k', hash)
);
