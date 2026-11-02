
import { hashPassword } from './passwords.ts'
import { execFileSync } from 'node:child_process'
import { randomUUID, randomBytes } from 'node:crypto'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const staff = [
  ['Shravan', 'registration'],
  ['Anushka', 'registration'],
  ['Sushma', 'registration'],
  ['Neelima', 'registration'],
  ['Siddik', 'registration'],
  ['Bharath', 'registration'],
  ['Sowjanya', 'registration'],
  ['Aniruddha', 'registration'],
  ['Haarika', 'registration'],
  ['EVENT-CHECKIN-10', 'checkin'],
]

function makePassword(staffId) {
  const name = staffId === 'EVENT-CHECKIN-10'
    ? 'EventCheckin'
    : staffId
  return `${name}@CC26-${randomBytes(4).toString('hex')}`
}

async function main() {
  const sqlFile = join(tmpdir(), `cc-event-staff-${randomUUID()}.sql`)
  const credentials = []
  const statements = []
  const escapeSql = value => value.replace(/'/g, "''")

  for (const [staffId, role] of staff) {
    const password = makePassword(staffId)
    const passwordHash = await hashPassword(password)
    const id = randomUUID()

    statements.push(`
INSERT INTO staff_users (id, staff_id, password_hash, role, is_active)
VALUES ('${id}', '${escapeSql(staffId)}', '${escapeSql(passwordHash)}', '${role}', 1)
ON CONFLICT(staff_id) DO UPDATE SET
  password_hash = excluded.password_hash,
  role = excluded.role,
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;
`)
    credentials.push({ staffId, role, password })
  }

  writeFileSync(sqlFile, statements.join('\n'), {
    encoding: 'utf8',
    flag: 'wx',
  })

  try {
    execFileSync('npx.cmd', [
      'wrangler', 'd1', 'execute', 'champion-celebration-local',
      '--local', '--file', sqlFile,
    ], { stdio: 'inherit', shell: true })

    const outputFile = join(process.cwd(), 'event-staff-temporary-passwords.txt')
    writeFileSync(
      outputFile,
      'LOCAL TEST STAFF ACCOUNTS — TEMPORARY PASSWORDS\n' +
      'Keep this file private. Change passwords before real event use.\n\n' +
      credentials.map(c => `${c.staffId}\t${c.role}\t${c.password}`).join('\n') + '\n',
      { encoding: 'utf8', flag: 'w' }
    )

    console.log('Local staff passwords reset successfully.')
    console.log('Credentials saved to:', outputFile)
    console.log('Only the 10 listed staff accounts were changed.')
  } finally {
    unlinkSync(sqlFile)
  }
}

main().catch(error => {
  console.error('Staff setup failed:', error)
  process.exitCode = 1
})
