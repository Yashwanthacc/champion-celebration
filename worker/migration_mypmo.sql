-- MyPMO employee lookup table
-- Separate from event registrations and wristband/check-in records.

CREATE TABLE IF NOT EXISTS mypmo_resources (
    enterprise_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    contact_number TEXT,
    project TEXT,
    project_lead TEXT,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);