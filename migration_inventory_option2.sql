-- Option 2 inventory-first wristbands. Additive only; does not alter legacy tables.
CREATE TABLE IF NOT EXISTS wristband_inventory (
 id TEXT PRIMARY KEY, serial TEXT NOT NULL UNIQUE, qr_token TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'Available' CHECK(status IN ('Available','Assigned','Checked In','Revoked')),
 attendee_eid TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, assigned_at TEXT, checked_in_at TEXT, checked_in_by TEXT,
 FOREIGN KEY(attendee_eid) REFERENCES attendees(eid), FOREIGN KEY(checked_in_by) REFERENCES staff_users(id),
 CHECK ((status='Available' AND attendee_eid IS NULL AND assigned_at IS NULL AND checked_in_at IS NULL) OR
 (status='Assigned' AND attendee_eid IS NOT NULL AND assigned_at IS NOT NULL AND checked_in_at IS NULL) OR
 (status='Checked In' AND attendee_eid IS NOT NULL AND assigned_at IS NOT NULL AND checked_in_at IS NOT NULL) OR status='Revoked')
);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON wristband_inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_attendee ON wristband_inventory(attendee_eid);
CREATE INDEX IF NOT EXISTS idx_inventory_qr_token ON wristband_inventory(qr_token);
CREATE TABLE IF NOT EXISTS wristband_inventory_audit (
 id TEXT PRIMARY KEY, wristband_id TEXT NOT NULL, serial TEXT NOT NULL, attendee_eid TEXT,
 action TEXT NOT NULL CHECK(action IN ('GENERATED','ASSIGNED','CHECKED_IN','REVOKED')), performed_by TEXT NOT NULL,
 performed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, details TEXT,
 FOREIGN KEY(wristband_id) REFERENCES wristband_inventory(id), FOREIGN KEY(attendee_eid) REFERENCES attendees(eid), FOREIGN KEY(performed_by) REFERENCES staff_users(id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_time ON wristband_inventory_audit(performed_at);
