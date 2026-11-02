-- Additive migration for Champion Celebration attendee fields.
-- Run only when these columns are not already present in the local D1 attendees table.
-- This migration adds columns only; it does not delete or rewrite attendee, QR, wristband, or check-in records.
ALTER TABLE attendees ADD COLUMN full_name TEXT;
ALTER TABLE attendees ADD COLUMN contact_number TEXT;
ALTER TABLE attendees ADD COLUMN family_emergency_contact_number TEXT;
ALTER TABLE attendees ADD COLUMN colleague_emergency_contact_number TEXT;
ALTER TABLE attendees ADD COLUMN project TEXT;
ALTER TABLE attendees ADD COLUMN project_lead TEXT;
