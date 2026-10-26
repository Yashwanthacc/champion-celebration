-- Additive migration for Champion Celebration attendee fields.
-- Keeps the existing name column and preserves all existing records.
ALTER TABLE attendees ADD COLUMN contact_number TEXT;
ALTER TABLE attendees ADD COLUMN family_emergency_contact_number TEXT;
ALTER TABLE attendees ADD COLUMN colleague_emergency_contact_number TEXT;
ALTER TABLE attendees ADD COLUMN project TEXT;
ALTER TABLE attendees ADD COLUMN project_lead TEXT;
