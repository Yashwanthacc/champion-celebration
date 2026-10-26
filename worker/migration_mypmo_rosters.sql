-- MyPMO roster separation migration. Apply to champion-celebration-demo only.
-- Preserves legacy MyPMO records and does not change attendee, wristband, or check-in tables.
-- The legacy mypmo_resources table has no resource_status column, so legacy Aspire status is unknown.
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

INSERT OR IGNORE INTO mypmo_resources_v2
  (roster_type, enterprise_id, full_name, email, contact_number, project, project_lead, resource_status, imported_at)
SELECT
  'ASPIRE',
  enterprise_id,
  full_name,
  email,
  contact_number,
  project,
  project_lead,
  NULL,
  imported_at
FROM mypmo_resources;

CREATE INDEX IF NOT EXISTS idx_mypmo_resources_v2_eid
  ON mypmo_resources_v2(enterprise_id);
