-- Champion Celebration: local pre-registration repair

ALTER TABLE attendees ADD COLUMN full_name TEXT;
ALTER TABLE attendees ADD COLUMN contact_number TEXT;
ALTER TABLE attendees ADD COLUMN family_emergency_contact_number TEXT;
ALTER TABLE attendees ADD COLUMN colleague_emergency_contact_number TEXT;
ALTER TABLE attendees ADD COLUMN project TEXT;
ALTER TABLE attendees ADD COLUMN project_lead TEXT;

ALTER TABLE attendees ADD COLUMN residential_address TEXT;
ALTER TABLE attendees ADD COLUMN colleague_enterprise_id TEXT;
ALTER TABLE attendees ADD COLUMN family_emergency_contact_name TEXT;
ALTER TABLE attendees ADD COLUMN family_emergency_contact_relation TEXT;

ALTER TABLE attendees ADD COLUMN attendance_response TEXT;
ALTER TABLE attendees ADD COLUMN non_attendance_reason TEXT;
ALTER TABLE attendees ADD COLUMN bus_required TEXT;
ALTER TABLE attendees ADD COLUMN residence_drop_required TEXT;
ALTER TABLE attendees ADD COLUMN family_emergency_contact_relationship TEXT;
ALTER TABLE attendees ADD COLUMN colleague_role TEXT;
ALTER TABLE attendees ADD COLUMN attending_colleague_contact_number TEXT;
ALTER TABLE attendees ADD COLUMN food_preference TEXT;
ALTER TABLE attendees ADD COLUMN beverage_preference TEXT;

ALTER TABLE attendees
ADD COLUMN registration_source TEXT NOT NULL DEFAULT 'UNKNOWN'
CHECK (registration_source IN ('MANUAL', 'PRE_EVENT_IMPORT', 'UNKNOWN'));

CREATE TABLE IF NOT EXISTS mypmo_resources (
    enterprise_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    contact_number TEXT,
    project TEXT,
    project_lead TEXT,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mypmo_resources_v2 (
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

CREATE INDEX IF NOT EXISTS idx_mypmo_resources_v2_eid
ON mypmo_resources_v2(enterprise_id);
