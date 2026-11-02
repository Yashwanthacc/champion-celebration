import { hashPassword } from './passwords.ts'
import { execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

async function main() {
  const staffId = 'TEST-REGISTRATION'
  const password = 'Local-Registration-2026!'
  const passwordHash = await hashPassword(password)
  const id = randomUUID()
  const sqlFile = join(tmpdir(), `cc-test-registration-${id}.sql`)
  const escapeSql = (v: string) => v.replace(/'/g, "''")

  const sql = `
INSERT INTO staff_users (id, staff_id, password_hash, role, is_active)
VALUES ('${id}', '${escapeSql(staffId)}', '${escapeSql(passwordHash)}', 'registration', 1)
ON CONFLICT(staff_id) DO UPDATE SET
  password_hash = excluded.password_hash,
  role = excluded.role,
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;
`
  writeFileSync(sqlFile, sql, { encoding: 'utf8', flag: 'wx' })
  try {
    execFileSync('npx.cmd', [
      'wrangler', 'd1', 'execute', 'champion-celebration-local',
      '--local', '--file', sqlFile
    ], { stdio: 'inherit', shell: true })
    console.log('Local Registration test account created.')
    console.log('Staff ID:', staffId)
  } finally {
    unlinkSync(sqlFile)
  }
}

main().catch(e => {
  console.error('Account creation failed:', e)
  process.exitCode = 1
})
