import { randomBytes, randomUUID, webcrypto } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const staff = [
  ["Shravan", "registration"],
  ["Anushka", "registration"],
  ["Sushma", "registration"],
  ["Neelima", "registration"],
  ["Siddik", "registration"],
  ["Bharath", "registration"],
  ["Sowjanya", "registration"],
  ["Aniruddha", "registration"],
  ["Haarika", "registration"],
  ["EVENT-CHECKIN-10", "checkin"],
];

const sqlEscape = (value) => value.replace(/'/g, "''");

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await webcrypto.subtle.importKey(
    "raw",
    Buffer.from(password, "utf8"),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 },
    key,
    256
  );
  return `pbkdf2-sha256$100000$${salt.toString("base64")}$${Buffer.from(bits).toString("base64")}`;
}

async function main() {
  const sqlPath = join(tmpdir(), `cc-staff-${randomUUID()}.sql`);
  const credentialPath = join(process.cwd(), "event-staff-remote-temporary-passwords.txt");
  const statements = [];
  const credentials = [];

  for (const [staffId, role] of staff) {
    const password = `${randomBytes(18).toString("base64url")}!a7`;
    const passwordHash = await hashPassword(password);
    const id = randomUUID();

    statements.push(
      `INSERT INTO staff_users (id, staff_id, password_hash, role, is_active) ` +
      `VALUES ('${id}', '${sqlEscape(staffId)}', '${sqlEscape(passwordHash)}', '${role}', 1) ` +
      `ON CONFLICT(staff_id) DO NOTHING;`
    );

    credentials.push(`${staffId}\t${role}\t${password}`);
  }

  writeFileSync(sqlPath, statements.join("\n") + "\n", { encoding: "utf8", flag: "wx" });

  try {
    execFileSync("npx.cmd", [
      "wrangler@4.152.0", "d1", "execute", "champion-celebration-demo",
      "--remote", "--file", sqlPath
    ], { stdio: "inherit", shell: true });

    writeFileSync(
      credentialPath,
      "REMOTE DEMO EVENT STAFF — TEMPORARY PASSWORDS\nKeep this file private and distribute credentials securely.\n\n" +
      credentials.join("\n") + "\n",
      { encoding: "utf8", flag: "wx" }
    );

    console.log("Provisioning SQL submitted.");
    console.log("Credentials saved locally to event-staff-remote-temporary-passwords.txt");
    console.log("Existing accounts were preserved by ON CONFLICT DO NOTHING.");
  } finally {
    try { await import("node:fs/promises").then(fs => fs.unlink(sqlPath)); } catch {}
  }
}

main().catch(() => {
  console.error("Provisioning failed. Check the Wrangler output and do not share credentials.");
  process.exitCode = 1;
});
