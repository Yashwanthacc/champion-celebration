-- Safe additive migration for MyPMO lookup data.
-- Apply only to the D1 database champion-celebration-demo after reviewing this SQL.
-- Does not alter or delete attendee, wristband, or check-in records.
-- Department remains only as a legacy NOT NULL storage column in attendees;
-- the application does not expose or use it. Engagement is not part of this model.

CREATE TABLE IF NOT EXISTS mypmo_resources (
  enterprise_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact_number TEXT,
  project TEXT,
  project_lead TEXT,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
