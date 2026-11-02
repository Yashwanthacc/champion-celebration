import { webcrypto } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const password = 'V7!qR2#nL9@xT4$k';
const salt = webcrypto.getRandomValues(new Uint8Array(16));

const key = await webcrypto.subtle.importKey(
  'raw', new TextEncoder().encode(password),
  'PBKDF2', false, ['deriveBits']
);

const bits = await webcrypto.subtle.deriveBits(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
  key, 256
);

const b64 = bytes => Buffer.from(bytes).toString('base64');
const hash = `pbkdf2-sha256$100000$${b64(salt)}$${b64(bits)}`;

if (hash.length !== 90) throw new Error('Unexpected hash length');

const sql =
  `UPDATE staff_users SET password_hash = '${hash}' ` +
  `WHERE staff_id = 'DEMO-ADMIN' AND role = 'admin';\n`;

await writeFile('./reset-local-admin.sql', sql, 'utf8');
console.log('Reset file created. Hash format validated; length:', hash.length);
