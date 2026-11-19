PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE staff_sessions (
  id_hash TEXT PRIMARY KEY,
  staff_user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id)
    ON DELETE CASCADE
);
INSERT INTO "staff_sessions" ("id_hash","staff_user_id","expires_at","created_at") VALUES('cf3a2fdd40a5538191b04e429cf1184eaa221b4d22c52e0c22b324b471a8519d','f9173fff-fedf-4142-8ee9-dadce444e2a1',1794521261,1794492461);
INSERT INTO "staff_sessions" ("id_hash","staff_user_id","expires_at","created_at") VALUES('4bc56352d4782f15510e70318a91122dfd0b1cc3fec988b9400f49ea3a91ea52','f9173fff-fedf-4142-8ee9-dadce444e2a1',1794524157,1794495357);
CREATE TABLE attendees (
    eid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    status TEXT NOT NULL
        CHECK (status IN ('Registered', 'Pending', 'Cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, full_name TEXT, contact_number TEXT, family_emergency_contact_number TEXT, colleague_emergency_contact_number TEXT, project TEXT, project_lead TEXT, attendance_response TEXT, non_attendance_reason TEXT, bus_required TEXT, residence_drop_required TEXT, residential_address TEXT, family_emergency_contact_name TEXT, family_emergency_contact_relationship TEXT, colleague_enterprise_id TEXT, colleague_role TEXT, attending_colleague_contact_number TEXT, food_preference TEXT, beverage_preference TEXT, registration_source TEXT NOT NULL DEFAULT 'UNKNOWN'
CHECK (registration_source IN ('MANUAL', 'PRE_EVENT_IMPORT', 'UNKNOWN')));
INSERT INTO "attendees" ("eid","name","email","department","status","created_at","full_name","contact_number","family_emergency_contact_number","colleague_emergency_contact_number","project","project_lead","attendance_response","non_attendance_reason","bus_required","residence_drop_required","residential_address","family_emergency_contact_name","family_emergency_contact_relationship","colleague_enterprise_id","colleague_role","attending_colleague_contact_number","food_preference","beverage_preference","registration_source") VALUES('TEST-TRANSPORT-YES','TEST Transportation YES','test-transport-yes@example.invalid','TEST','Registered','2026-11-12 14:54:56',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'YES',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'MANUAL');
INSERT INTO "attendees" ("eid","name","email","department","status","created_at","full_name","contact_number","family_emergency_contact_number","colleague_emergency_contact_number","project","project_lead","attendance_response","non_attendance_reason","bus_required","residence_drop_required","residential_address","family_emergency_contact_name","family_emergency_contact_relationship","colleague_enterprise_id","colleague_role","attending_colleague_contact_number","food_preference","beverage_preference","registration_source") VALUES('TEST-TRANSPORT-NO','TEST Transportation NO','test-transport-no@example.invalid','TEST','Registered','2026-11-12 14:54:56',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'NO',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'MANUAL');
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY NOT NULL,
    staff_user_id TEXT,
    action TEXT NOT NULL,
    attendee_eid TEXT,
    wristband_serial TEXT,
    occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    outcome TEXT NOT NULL DEFAULT 'SUCCESS'
        CHECK (outcome IN ('SUCCESS', 'FAILURE')),
    details TEXT,
    FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
);
CREATE TABLE wristbands (
  id TEXT PRIMARY KEY,
  attendee_eid TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Assigned'
    CHECK (status IN ('Assigned', 'Unassigned', 'Revoked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attendee_eid) REFERENCES attendees(eid)
);
CREATE TABLE attendee_checkins (
  id TEXT PRIMARY KEY,
  attendee_eid TEXT NOT NULL UNIQUE,
  checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checked_in_by TEXT NOT NULL,
  method TEXT NOT NULL
    CHECK (method IN ('QR', 'EID')), residence_drop_availing TEXT
CHECK (residence_drop_availing IN ('YES', 'NO') OR residence_drop_availing IS NULL),
  FOREIGN KEY (attendee_eid) REFERENCES attendees(eid),
  FOREIGN KEY (checked_in_by) REFERENCES staff_users(id)
);
CREATE TABLE wristband_inventory (
 id TEXT PRIMARY KEY, serial TEXT NOT NULL UNIQUE, qr_token TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'Available' CHECK(status IN ('Available','Assigned','Checked In','Revoked')),
 attendee_eid TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, assigned_at TEXT, checked_in_at TEXT, checked_in_by TEXT,
 FOREIGN KEY(attendee_eid) REFERENCES attendees(eid), FOREIGN KEY(checked_in_by) REFERENCES staff_users(id),
 CHECK ((status='Available' AND attendee_eid IS NULL AND assigned_at IS NULL AND checked_in_at IS NULL) OR
 (status='Assigned' AND attendee_eid IS NOT NULL AND assigned_at IS NOT NULL AND checked_in_at IS NULL) OR
 (status='Checked In' AND attendee_eid IS NOT NULL AND assigned_at IS NOT NULL AND checked_in_at IS NOT NULL) OR status='Revoked')
);
INSERT INTO "wristband_inventory" ("id","serial","qr_token","status","attendee_eid","created_at","assigned_at","checked_in_at","checked_in_by") VALUES('test-band-transport-yes','TEST-TR-YES','test-token-transport-yes','Assigned','TEST-TRANSPORT-YES','2026-11-12 14:54:56','2026-11-12 14:54:56',NULL,NULL);
INSERT INTO "wristband_inventory" ("id","serial","qr_token","status","attendee_eid","created_at","assigned_at","checked_in_at","checked_in_by") VALUES('test-band-transport-no','TEST-TR-NO','test-token-transport-no','Assigned','TEST-TRANSPORT-NO','2026-11-12 14:54:56','2026-11-12 14:54:56',NULL,NULL);
CREATE TABLE wristband_inventory_audit (
 id TEXT PRIMARY KEY, wristband_id TEXT NOT NULL, serial TEXT NOT NULL, attendee_eid TEXT,
 action TEXT NOT NULL CHECK(action IN ('GENERATED','ASSIGNED','CHECKED_IN','REVOKED')), performed_by TEXT NOT NULL,
 performed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, details TEXT,
 FOREIGN KEY(wristband_id) REFERENCES wristband_inventory(id), FOREIGN KEY(attendee_eid) REFERENCES attendees(eid), FOREIGN KEY(performed_by) REFERENCES staff_users(id)
);
CREATE TABLE IF NOT EXISTS "staff_users" (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (
    role IN ('admin', 'registration', 'inventory', 'checkin', 'viewer')
  ),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('086628a6-03d0-4b2f-84f2-c9260453ed2e','Shravan','pbkdf2-sha256$100000$i22d2X/+dTTZJERtaUm91A==$9x64+3VPx/BRcGNQyv5aXlMp/3vreo8K7sWSNrlPOAM=','inventory',1,'2026-11-12 14:05:52','2026-11-12 14:05:52');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('7c5ffaf1-31d9-44e5-aa6d-82c7348e9f5f','Anushka','pbkdf2-sha256$100000$KqgobyBNLAhHVri0o+n3Qg==$EGTWR+YryMDqcZGCMsSkLSTsXkQWsuobSNEBPm3pIgo=','inventory',1,'2026-11-12 14:05:52','2026-11-12 14:05:52');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('50005744-0335-499c-937c-7d4cf4e96a4f','Sushma','pbkdf2-sha256$100000$PCGbRwgCSOABty8Vf9y8RA==$I5nTUaewVi4naUckaZ8g04+B6S95Xr81pGq11m7L/WQ=','inventory',1,'2026-11-12 14:05:52','2026-11-12 14:05:52');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('f871eb29-d1a7-4ba9-8db8-72d17710993b','Neelima','pbkdf2-sha256$100000$5yegzfjRHQlkvRKQ0O5B6A==$YCxlDdtoyxBIJ3QxzYD4yM2FSwAZbKqTVsaBWtH8PD0=','registration',1,'2026-11-12 14:05:52','2026-11-12 14:05:52');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('a3f6c3f6-5f07-4796-8b13-a62393e3e471','Siddik','pbkdf2-sha256$100000$9p9aZSQHVML+3UrVG9+2gw==$BdT6cHfY2ARyE/NhymS9KsjMjEK39PaRktMW9CG04Vw=','inventory',1,'2026-11-12 14:05:52','2026-11-12 14:05:52');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('a511456f-e215-48ce-b83b-420ddf7c90b5','Bharath','pbkdf2-sha256$100000$c1iNK4HBKk672JKou8+y0g==$KYGgcYJ5BvJTnWk4HO780+sUrXW1UQrZ10g1ajnsFLI=','inventory',1,'2026-11-12 14:05:52','2026-11-12 14:05:52');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('2c1b95aa-b446-4deb-ac04-d7cdb88b7e08','Sowjanya','pbkdf2-sha256$100000$aBf9UiNC+T5kMSLhPL+XDw==$f916bF5r7JPWDMufij5EjZS1Y6DBkCv4+aUxaHeA79s=','inventory',1,'2026-11-12 14:05:52','2026-11-12 14:05:52');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('e454e481-610a-4091-94e2-1bbe350a9538','Aniruddha','pbkdf2-sha256$100000$h+TU7MpVetjQN+2FWIe66g==$e8Wt1RlKexrSk8kEYkgj/XAiBjqcxjOuM3KfDdF3xZw=','registration',1,'2026-11-12 14:05:52','2026-11-12 14:05:52');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('26f6a41f-9310-4589-a055-75a2bd1212e1','Haarika','pbkdf2-sha256$100000$RrIa8fqZeh7ff3V4BaxSyg==$qyUtZ8kbFJ5w3TLutmxpTiheRR8eaPZCi8arvpiGEHI=','inventory',1,'2026-11-12 14:05:52','2026-11-12 14:05:52');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('db003e40-9ba7-4a30-8961-1d5764a05f1c','EVENT-CHECKIN-1','pbkdf2-sha256$100000$VRoQrVlg71HNHeB5H7avLQ==$RYmamFNdEnONgLedwt43oeTZLbOXRQBVgfcKFq8Y/pc=','checkin',1,'2026-11-12 14:05:52','2026-11-12 14:05:52');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('5207880a-3fc4-42b8-a95b-fce87b16ecdc','EVENT-CHECKIN-2','pbkdf2-sha256$100000$wceRJEJAEM+5oZlaUjgWRQ==$QRmFnimqaGjFp4f/7xk3rnyqR7Km5J7F6zY3xqGvRi0=','checkin',1,'2026-11-12 14:05:52','2026-11-12 14:05:52');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('f9173fff-fedf-4142-8ee9-dadce444e2a1','DEMO-ADMIN','pbkdf2-sha256$100000$wOsbS5xI5UkdLwYp4EggMg==$dPMsHYoDiT0DieNZj5izpdIp8+gTSziqu0pzvtcSAnk=','admin',1,'2026-11-12 14:05:52','2026-11-12 14:05:52');
CREATE INDEX idx_staff_sessions_expiry
ON staff_sessions (expires_at);
CREATE INDEX idx_audit_logs_occurred_at
    ON audit_logs (occurred_at);
CREATE INDEX idx_audit_logs_attendee_eid
    ON audit_logs (attendee_eid);
CREATE INDEX idx_audit_logs_action
    ON audit_logs (action);
CREATE INDEX idx_audit_logs_staff_user_id
    ON audit_logs (staff_user_id);
CREATE INDEX idx_wristbands_attendee
ON wristbands(attendee_eid);
CREATE INDEX idx_wristbands_qr_token
ON wristbands(qr_token);
CREATE INDEX idx_checkins_time
ON attendee_checkins(checked_in_at);
CREATE INDEX idx_inventory_status ON wristband_inventory(status);
CREATE INDEX idx_inventory_attendee ON wristband_inventory(attendee_eid);
CREATE INDEX idx_inventory_qr_token ON wristband_inventory(qr_token);
CREATE INDEX idx_inventory_audit_time ON wristband_inventory_audit(performed_at);
CREATE INDEX idx_staff_users_active ON staff_users (staff_id, is_active);