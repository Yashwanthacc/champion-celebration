-- Persistent audit events for attendee registration and wristband operations.
-- This migration creates a new table and preserves all existing application data.

CREATE TABLE IF NOT EXISTS audit_logs (
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at
    ON audit_logs (occurred_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_attendee_eid
    ON audit_logs (attendee_eid);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_staff_user_id
    ON audit_logs (staff_user_id);
