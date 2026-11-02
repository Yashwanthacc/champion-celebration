import { readFile, writeFile } from 'node:fs/promises';

const resetSql = await readFile('./reset-local-admin.sql', 'utf8');
const match = resetSql.match(/password_hash = '([^']+)'/);

if (!match) throw new Error('Reset hash not found');

const hash = match[1].replace(/'/g, "''");
const sql = `
SELECT staff_id,
       CASE
         WHEN password_hash = '${hash}' THEN 'MATCH'
         ELSE 'MISMATCH'
       END AS hash_comparison
FROM staff_users
WHERE staff_id = 'DEMO-ADMIN';
`;

await writeFile('./verify-local-admin-db.sql', sql, 'utf8');
console.log('Verification query created.');
