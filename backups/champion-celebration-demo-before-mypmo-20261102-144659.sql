PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE staff_users (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (
    role IN ('admin', 'registration', 'checkin', 'viewer')
  ),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (
    is_active IN (0, 1)
  ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('e3dcf687-c6d5-49c2-ba5e-0cdabba8716a','DEMO-ADMIN','pbkdf2-sha256$100000$U/W2uNnAFnyrwqml0ZAuGA==$mGMvzwquHFNN/7zd/YFU/7cYcJqwcgmOcc7W4sv9n6M=','admin',1,'2026-10-22 13:08:13','2026-10-22 13:08:13');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('f82f42a2-5d5e-408e-a462-3d05ff45c7f6','Shravan','pbkdf2-sha256$100000$/0hlMZYNWAMZBf5vPKphNg==$b1me8PSlvrduDnQjUy2qtoQOmT5dbBfB/eeKKd0NOdk=','registration',1,'2026-10-25 13:23:29','2026-10-25 13:23:29');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('de34dcb6-221b-4e28-ac76-e92fab0d6829','Anushka','pbkdf2-sha256$100000$XJa1SbHTNsd/IZxS0erLlA==$OZdReEupIEmxPMlTrg/lD2KOp6I1XI5bzvzfgc/+hR4=','registration',1,'2026-10-25 13:23:29','2026-10-25 13:23:29');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('d7c9d81d-9b5a-42ec-bed1-be1b540372a4','Sushma','pbkdf2-sha256$100000$X5P2WC9f6CoiK1hgJzkCAw==$dDFCPB4cLbOergkBY6QYC/EqWzA1MO9c8wO8B8pDpvA=','registration',1,'2026-10-25 13:23:29','2026-10-25 13:23:29');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('79961da7-c7f4-4fbe-857f-d0de9849106c','Neelima','pbkdf2-sha256$100000$pZGQG38UVkwfQ9cE2+etOg==$ELUdI9cSBrH6fvAHSuXV51ggZUMLB/3tybUgAj8Yo/0=','registration',1,'2026-10-25 13:23:29','2026-10-25 13:23:29');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('7d05e952-7e90-4bb3-bdd6-d47e7d517638','Siddik','pbkdf2-sha256$100000$DceBYdY8zzVXEG9s8ZGB9A==$QGM+fF2oNVd+yer/1xYCOXbJXTFKU8sMtusO/Ypp9Os=','registration',1,'2026-10-25 13:23:29','2026-10-25 13:23:29');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('b2ce4ef9-a3ee-4a67-8d8a-d8d80340322c','Bharath','pbkdf2-sha256$100000$TFUyC5rzzgEF2LdQzizgtQ==$owFrXAuzB6PQlifp3+5kOJBH9bjkNR4VCLNuxYH4S94=','registration',1,'2026-10-25 13:23:29','2026-10-25 13:23:29');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('0bb0d5f7-0503-49ca-b489-e93f2dc792c3','Sowjanya','pbkdf2-sha256$100000$E8rVZx6uWH/Hz6xNnyluLg==$CRhusm+0bLYHoVhEnPh5hikEhRrp2kxta/lifj+KdWQ=','registration',1,'2026-10-25 13:23:29','2026-10-25 13:23:29');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('1258d202-be9c-423c-8634-33cb1199d82f','Aniruddha','pbkdf2-sha256$100000$8gzbrQHD4ViDlJkGYLtFfQ==$20sUz+UmsCm3YRQAdQpDzcpej8mmhoEFdaSpO9Y/Bqw=','registration',1,'2026-10-25 13:23:29','2026-10-25 13:23:29');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('54e44499-0e25-4811-b804-ce0af65b1f64','Haarika','pbkdf2-sha256$100000$b6UTPEg+TJ5rjWmQC2tr6A==$RM4iVH8AqhgGo3N15azaAQYDErisApM8ZlibmILvztY=','registration',1,'2026-10-25 13:23:29','2026-10-25 13:23:29');
INSERT INTO "staff_users" ("id","staff_id","password_hash","role","is_active","created_at","updated_at") VALUES('57fdc56e-a083-4558-b228-97fb8aec9d2a','EVENT-CHECKIN-10','pbkdf2-sha256$100000$A2baZkk1x5mcSVCE0vp60g==$AyejPHMgCTUWRN6UzlkOJHrFiBkSIHDWnv+jFoU2/MA=','checkin',1,'2026-10-25 13:23:29','2026-10-25 13:23:29');
CREATE TABLE staff_sessions (
  id_hash TEXT PRIMARY KEY,
  staff_user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id)
    ON DELETE CASCADE
);
INSERT INTO "staff_sessions" ("id_hash","staff_user_id","expires_at","created_at") VALUES('e2d0cfd9d144b0b615281480eaa4768dd42aaf76dc7fcd7172e704938f4a94bb','f82f42a2-5d5e-408e-a462-3d05ff45c7f6',1793296176,1793267376);
INSERT INTO "staff_sessions" ("id_hash","staff_user_id","expires_at","created_at") VALUES('7f39d434f2cb9bbc873ede65a6b93f62cf91ba965ecd7b167538459a9f460aee','e3dcf687-c6d5-49c2-ba5e-0cdabba8716a',1793630396,1793601596);
CREATE TABLE attendees (
    eid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    status TEXT NOT NULL
        CHECK (status IN ('Registered', 'Pending', 'Cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, contact_number TEXT, family_emergency_contact_number TEXT, colleague_emergency_contact_number TEXT, project TEXT, project_lead TEXT, registration_source TEXT NOT NULL DEFAULT 'UNKNOWN'
CHECK (registration_source IN ('MANUAL', 'PRE_EVENT_IMPORT', 'UNKNOWN')), residential_address TEXT, colleague_enterprise_id TEXT, family_emergency_contact_name TEXT, family_emergency_contact_relation TEXT);
INSERT INTO "attendees" ("eid","name","email","department","status","created_at","contact_number","family_emergency_contact_number","colleague_emergency_contact_number","project","project_lead","registration_source","residential_address","colleague_enterprise_id","family_emergency_contact_name","family_emergency_contact_relation") VALUES('yaswanth.kondramutla','yash','yaswanth.kondramutla@accenture.com','aspire','Registered','2026-11-02 07:01:27','8555044338','4465463542','4556634234','aspire','sweta','MANUAL','sdegf','gzgnbvnb','dsfgvs','dsagfv');
INSERT INTO "attendees" ("eid","name","email","department","status","created_at","contact_number","family_emergency_contact_number","colleague_emergency_contact_number","project","project_lead","registration_source","residential_address","colleague_enterprise_id","family_emergency_contact_name","family_emergency_contact_relation") VALUES('yaswanth.kondramutle','yash','yaswanth.kondramutle@accenyure.com','aspire','Registered','2026-11-02 07:02:43','8555044338','4465463542','4556634234','aspire','sweta','MANUAL','fvgbSD','fsdvgsdf','dsfgvs','adfsgfd');
CREATE TABLE wristband_inventory (
 id TEXT PRIMARY KEY, serial TEXT NOT NULL UNIQUE, qr_token TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'Available' CHECK(status IN ('Available','Assigned','Checked In','Revoked')),
 attendee_eid TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, assigned_at TEXT, checked_in_at TEXT, checked_in_by TEXT,
 FOREIGN KEY(attendee_eid) REFERENCES attendees(eid), FOREIGN KEY(checked_in_by) REFERENCES staff_users(id),
 CHECK ((status='Available' AND attendee_eid IS NULL AND assigned_at IS NULL AND checked_in_at IS NULL) OR
 (status='Assigned' AND attendee_eid IS NOT NULL AND assigned_at IS NOT NULL AND checked_in_at IS NULL) OR
 (status='Checked In' AND attendee_eid IS NOT NULL AND assigned_at IS NOT NULL AND checked_in_at IS NOT NULL) OR status='Revoked')
);
INSERT INTO "wristband_inventory" ("id","serial","qr_token","status","attendee_eid","created_at","assigned_at","checked_in_at","checked_in_by") VALUES('a7823ba3-a935-4925-b1bf-4fdd682e8f8a','ACC001','937a0d142f84fab357a7b31d0c6e6ac531f057e37e296fc7eaece340475f2fa1','Assigned','yaswanth.kondramutle','2026-11-02 07:53:31','2026-11-02 07:53:56',NULL,NULL);
INSERT INTO "wristband_inventory" ("id","serial","qr_token","status","attendee_eid","created_at","assigned_at","checked_in_at","checked_in_by") VALUES('4cffed14-5a01-45b8-b419-c45055025e00','ACC002','2c28e6784a71cae88925453d687ab93d9ac81c518d4025654e40fb38a651cc4e','Assigned','yaswanth.kondramutla','2026-11-02 07:53:31','2026-11-02 08:07:46',NULL,NULL);
CREATE TABLE wristband_inventory_audit (
 id TEXT PRIMARY KEY, wristband_id TEXT NOT NULL, serial TEXT NOT NULL, attendee_eid TEXT,
 action TEXT NOT NULL CHECK(action IN ('GENERATED','ASSIGNED','CHECKED_IN','REVOKED')), performed_by TEXT NOT NULL,
 performed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, details TEXT,
 FOREIGN KEY(wristband_id) REFERENCES wristband_inventory(id), FOREIGN KEY(attendee_eid) REFERENCES attendees(eid), FOREIGN KEY(performed_by) REFERENCES staff_users(id)
);
INSERT INTO "wristband_inventory_audit" ("id","wristband_id","serial","attendee_eid","action","performed_by","performed_at","details") VALUES('9369a64b-d6a6-46b9-adca-3ad9ad13eed6','a7823ba3-a935-4925-b1bf-4fdd682e8f8a','ACC001',NULL,'GENERATED','e3dcf687-c6d5-49c2-ba5e-0cdabba8716a','2026-11-02 07:53:31','Option 2 inventory generation');
INSERT INTO "wristband_inventory_audit" ("id","wristband_id","serial","attendee_eid","action","performed_by","performed_at","details") VALUES('f3820006-d5c2-4721-afa0-b5892ba7bd30','4cffed14-5a01-45b8-b419-c45055025e00','ACC002',NULL,'GENERATED','e3dcf687-c6d5-49c2-ba5e-0cdabba8716a','2026-11-02 07:53:31','Option 2 inventory generation');
INSERT INTO "wristband_inventory_audit" ("id","wristband_id","serial","attendee_eid","action","performed_by","performed_at","details") VALUES('15edbe4d-2849-4661-9516-340cec603ed6','a7823ba3-a935-4925-b1bf-4fdd682e8f8a','ACC001','yaswanth.kondramutle','ASSIGNED','e3dcf687-c6d5-49c2-ba5e-0cdabba8716a','2026-11-02 07:53:56',NULL);
INSERT INTO "wristband_inventory_audit" ("id","wristband_id","serial","attendee_eid","action","performed_by","performed_at","details") VALUES('513a5d9a-7a88-4ea7-9ba5-5b7276e8f92a','4cffed14-5a01-45b8-b419-c45055025e00','ACC002','yaswanth.kondramutla','ASSIGNED','e3dcf687-c6d5-49c2-ba5e-0cdabba8716a','2026-11-02 08:07:46',NULL);
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
    CHECK (method IN ('QR', 'EID')),
  FOREIGN KEY (attendee_eid) REFERENCES attendees(eid),
  FOREIGN KEY (checked_in_by) REFERENCES staff_users(id)
);
INSERT INTO "attendee_checkins" ("id","attendee_eid","checked_in_at","checked_in_by","method") VALUES('15f0a330-d52e-46ec-9ea9-fc004ce73992','yaswanth.kondramutle','2026-11-02 07:54:47','e3dcf687-c6d5-49c2-ba5e-0cdabba8716a','EID');
INSERT INTO "attendee_checkins" ("id","attendee_eid","checked_in_at","checked_in_by","method") VALUES('640774c1-d04b-4dcb-b9e3-8ee49dfc4b78','yaswanth.kondramutla','2026-11-02 08:07:58','e3dcf687-c6d5-49c2-ba5e-0cdabba8716a','EID');
CREATE TABLE mypmo_resources (
  enterprise_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact_number TEXT,
  project TEXT,
  project_lead TEXT,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE mypmo_resources_v2 (
  roster_type TEXT NOT NULL CHECK (roster_type IN ('ASPIRE', 'IX')),
  enterprise_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact_number TEXT,
  project TEXT,
  project_lead TEXT,
  resource_status TEXT,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (roster_type, enterprise_id)
);
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
CREATE INDEX idx_staff_users_active
ON staff_users (staff_id, is_active);
CREATE INDEX idx_staff_sessions_expiry
ON staff_sessions (expires_at);
CREATE INDEX idx_inventory_status ON wristband_inventory(status);
CREATE INDEX idx_inventory_attendee ON wristband_inventory(attendee_eid);
CREATE INDEX idx_inventory_qr_token ON wristband_inventory(qr_token);
CREATE INDEX idx_inventory_audit_time ON wristband_inventory_audit(performed_at);
CREATE INDEX idx_wristbands_attendee
ON wristbands(attendee_eid);
CREATE INDEX idx_wristbands_qr_token
ON wristbands(qr_token);
CREATE INDEX idx_checkins_time
ON attendee_checkins(checked_in_at);
CREATE INDEX idx_mypmo_resources_v2_eid
  ON mypmo_resources_v2(enterprise_id);
CREATE INDEX idx_audit_logs_occurred_at
    ON audit_logs (occurred_at);
CREATE INDEX idx_audit_logs_attendee_eid
    ON audit_logs (attendee_eid);
CREATE INDEX idx_audit_logs_action
    ON audit_logs (action);
CREATE INDEX idx_audit_logs_staff_user_id
    ON audit_logs (staff_user_id);
