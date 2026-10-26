-- Add a source marker for attendee registrations.
-- Existing rows are retained and marked UNKNOWN until reviewed.
ALTER TABLE attendees
ADD COLUMN registration_source TEXT NOT NULL DEFAULT 'UNKNOWN'
CHECK (registration_source IN ('MANUAL', 'PRE_EVENT_IMPORT', 'UNKNOWN'));
