import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, appendFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const db = 'champion-celebration-demo';
const accounts = [
  ['Shravan','inventory'], ['Anushka','inventory'],
  ['Sushma','inventory'], ['Neelima','registration'],
  ['Siddik','inventory'], ['Bharath','inventory'],
  ['Sowjanya','inventory'], ['Aniruddha','registration'],
  ['Haarika','inventory'], ['EVENT-CHECKIN-1','checkin'],
  ['EVENT-CHECKIN-2','checkin'], ['DEMO-ADMIN','admin']
];

const b64 = b => Buffer.from(b).toString('base64');
async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await webcrypto.subtle.importKey(
    'raw', Buffer.from(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await webcrypto.subtle.deriveBits({
    name:'PBKDF2', hash:'SHA-256', salt, iterations:100000
  }, key, 256);
  return `pbkdf2-sha256$100000$${b64(salt)}$${b64(Buffer.from(bits))}`;
}
const esc = s => s.replace(/'/g, "''");
const credentials = [];
const statements = [];

for (const [staffId, role] of accounts) {
  const password = randomBytes(24).toString('base64url') + '!a7';
  const passwordHash = await hashPassword(password);
  statements.push(
    `INSERT INTO staff_users (id,staff_id,password_hash,role,is_active) VALUES ('${randomUUID()}','${esc(staffId)}','${passwordHash}','${role}',1);`
  );
  credentials.push({ staffId, role, password });
}

const sqlPath = join(tmpdir(), `cc-local-staff-${randomUUID()}.sql`);
const credentialPath = join(process.cwd(), 'local-staff-credentials.txt');

try {
  if (existsSync(credentialPath)) {
    throw new Error('Safety stop: local-staff-credentials.txt already exists. No accounts inserted.');
  }

  writeFileSync(sqlPath, statements.join('\n'), { flag:'wx' });
  execFileSync('npx.cmd', [
    'wrangler','d1','execute',db,'--local','--file',sqlPath
  ], { stdio:'inherit', shell:true });

  const output = [
    'CHAMPION CELEBRATION — LOCAL ONLY CREDENTIALS',
    'Database: champion-celebration-demo',
    'These passwords are not production passwords.',
    '',
    ...credentials.map((c,i) =>
      `${i+1}. ${c.staffId}\nRole: ${c.role}\nPassword: ${c.password}\n`
    )
  ].join('\n');

  writeFileSync(credentialPath, output, { flag:'wx' });
  const ignorePath = join(process.cwd(), '.gitignore');
  const ignore = existsSync(ignorePath) ? readFileSync(ignorePath,'utf8') : '';
  if (!ignore.split(/\r?\n/).includes('local-staff-credentials.txt')) {
    appendFileSync(ignorePath, `${ignore.endsWith('\n') || !ignore ? '' : '\n'}local-staff-credentials.txt\n`);
  }

  console.log(`SUCCESS: Created ${credentials.length} local accounts.`);
  console.log(`Credentials saved to: ${credentialPath}`);
  console.log(output);
} finally {
  if (existsSync(sqlPath)) unlinkSync(sqlPath);
}


