-- Independent employee Project and Lead mapping
-- Separate from MyPMO, event registrations, and attendee records.

CREATE TABLE IF NOT EXISTS employee_project_leads (
    enterprise_id TEXT PRIMARY KEY COLLATE NOCASE,
    project TEXT NOT NULL,
    lead TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_project_leads_project
ON employee_project_leads (project);

CREATE INDEX IF NOT EXISTS idx_employee_project_leads_lead
ON employee_project_leads (lead);
