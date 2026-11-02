
import { hashPassword } from './passwords.ts'
import { execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function main() {
  const staffId = 'DEMO-ADMIN'
  const password = 'Local-Demo-Admin-2026!'
  const passwordHash = await hashPassword(password)
  const id = crypto.randomUUID()
  const sqlFile = join(tmpdir(), `cc-demo-admin-${id}.sql`)

  const escapeSql = (value: string) => value.replace(/'/g, "''")

  const sql = `
INSERT INTO staff_users (id, staff_id, password_hash, role, is_active)
VALUES ('${id}', '${escapeSql(staffId)}', '${escapeSql(passwordHash)}', 'admin', 1)
ON CONFLICT(staff_id) DO UPDATE SET
  password_hash = excluded.password_hash,
  role = excluded.role,
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;
`

  writeFileSync(sqlFile, sql, { encoding: 'utf8', flag: 'wx' })

  try {
    execFileSync(
      'npx.cmd',
      [
        'wrangler',
        'd1',
        'execute',
        'champion-celebration-local',
        '--local',
        '--file',
        sqlFile,
      ],
      { stdio: 'inherit', shell: true },
    )
    console.log('Local demo admin created or updated.')
    console.log('Staff ID:', staffId)
  } finally {
    unlinkSync(sqlFile)
  }
}

main().catch((error) => {
  console.error('Failed to create local demo admin:', error)
})





