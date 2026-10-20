
-- Champion Celebration: QR wristbands and check-in
-- Safe to run more than once; existing attendee tables are preserved.

CREATE TABLE IF NOT EXISTS wristbands (
  id TEXT PRIMARY KEY,
  attendee_eid TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Assigned'
    CHECK (status IN ('Assigned', 'Unassigned', 'Revoked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attendee_eid) REFERENCES attendees(eid)
);

CREATE INDEX IF NOT EXISTS idx_wristbands_attendee
ON wristbands(attendee_eid);

CREATE INDEX IF NOT EXISTS idx_wristbands_qr_token
ON wristbands(qr_token);

CREATE TABLE IF NOT EXISTS attendee_checkins (
  id TEXT PRIMARY KEY,
  attendee_eid TEXT NOT NULL UNIQUE,
  checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checked_in_by TEXT NOT NULL,
  method TEXT NOT NULL
    CHECK (method IN ('QR', 'EID')),
  FOREIGN KEY (attendee_eid) REFERENCES attendees(eid),
  FOREIGN KEY (checked_in_by) REFERENCES staff_users(id)
);

CREATE INDEX IF NOT EXISTS idx_checkins_time
ON attendee_checkins(checked_in_at);
