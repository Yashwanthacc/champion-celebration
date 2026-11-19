import { randomUUID, webcrypto } from "node:crypto";
import { writeFileSync, unlinkSync, existsSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const accounts = [
  ["Shravan", "inventory", "5RZ7Bij6hxri3X79KI8M2edR1HnN6LcX!a7"],
  ["Anushka", "inventory", "F55bAkQOVpTB6ST6uLeiXgoh9EK4uHFX!a7"],
  ["Sushma", "inventory", "RAvayVwuG0mpFKeuCj5ZJRhUc2xLkiEv!a7"],
  ["Neelima", "registration", "fzW-lqYwM7Ls-BL8_zaENBIOFdoX5TJs!a7"],
  ["Siddik", "inventory", "PN9p08q7vblOgm4KQd2DxAy22hw5h4NJ!a7"],
  ["Bharath", "inventory", "-S0ntj70-N2f4_zBwFr2t0UYwuXU_Hdu!a7"],
  ["Sowjanya", "inventory", "_QN1HiFqn86lAYbju_S3ru3n4aQiIUo6!a7"],
  ["Aniruddha", "registration", "AOnIcPboCMcp87DEIJGdDnV6PKIEIj51!a7"],
  ["Haarika", "inventory", "k1ohziQNcNbDtY42Qyi3GXFCypRliTKi!a7"],
  ["EVENT-CHECKIN-1", "checkin", "zNnjaJmtzodjTgBgnKS3c7HrfEcEp2uC!a7"],
  ["EVENT-CHECKIN-2", "checkin", "i6h0TG-N9SK_vKudVGDRpp5I0wJiPofN!a7"],
  ["DEMO-ADMIN", "admin", "WH_RcwZ05sBRgKPSU9dr3f1TfSI3bgDw!a7"]
];

const esc = s => s.replace(/'/g, "''");

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey(
    "raw", Buffer.from(password, "utf8"),
    "PBKDF2", false, ["deriveBits"]
  );
  const bits = await webcrypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000
  }, key, 256);

  return `pbkdf2-sha256$100000$${Buffer.from(salt).toString("base64")}$${Buffer.from(bits).toString("base64")}`;
}

async function main() {
  const sqlFile = join(tmpdir(), `cc-set-passwords-${randomUUID()}.sql`);
  const credentialFile = join(process.cwd(), "local-staff-credentials.txt");
  const statements = [];

  for (const [staffId, role, password] of accounts) {
    const hash = await hashPassword(password);
    statements.push(
      `INSERT INTO staff_users (id,staff_id,password_hash,role,is_active)
       VALUES ('${randomUUID()}','${esc(staffId)}','${hash}','${role}',1)
       ON CONFLICT(staff_id) DO UPDATE SET
       password_hash=excluded.password_hash,
       role=excluded.role,
       is_active=1,
       updated_at=CURRENT_TIMESTAMP;`
    );
  }

  const credentials = [
    "CHAMPION CELEBRATION - LOCAL STAFF CREDENTIALS",
    "Database: champion-celebration-local",
    "Keep this file private.",
    "",
    "USERNAME\tROLE\tPASSWORD",
    ...accounts.map(([id, role, password]) => `${id}\t${role}\t${password}`)
  ].join("\n") + "\n";

  writeFileSync(sqlFile, statements.join("\n"), { flag: "wx" });

  try {
    execFileSync("npx.cmd", [
      "wrangler", "d1", "execute", "champion-celebration-local",
      "--config", "wrangler.local.toml", "--local", "--file", sqlFile
    ], { stdio: "inherit", shell: true });

    writeFileSync(credentialFile, credentials, { flag: "w" });

    const ignoreFile = join(process.cwd(), ".gitignore");
    const current = existsSync(ignoreFile) ? readFileSync(ignoreFile, "utf8") : "";
    if (!current.split(/\r?\n/).includes("local-staff-credentials.txt")) {
      appendFileSync(ignoreFile, "\nlocal-staff-credentials.txt\n");
    }

    console.log("\nSUCCESS: 12 accounts and passwords configured.");
    console.log("Credential file: local-staff-credentials.txt");
  } finally {
    try { unlinkSync(sqlFile); } catch {}
  }
}

main().catch(error => {
  console.error("SETUP FAILED:", error.message);
  process.exitCode = 1;
});
