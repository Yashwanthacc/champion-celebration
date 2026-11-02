-- Additive fields for the Roche event registration form.
-- Existing attendee records and status constraints are preserved.

ALTER TABLE attendees ADD COLUMN attendance_response TEXT;
ALTER TABLE attendees ADD COLUMN non_attendance_reason TEXT;
ALTER TABLE attendees ADD COLUMN bus_required TEXT;
ALTER TABLE attendees ADD COLUMN residence_drop_required TEXT;
ALTER TABLE attendees ADD COLUMN residential_address TEXT;
ALTER TABLE attendees ADD COLUMN family_emergency_contact_name TEXT;
ALTER TABLE attendees ADD COLUMN family_emergency_contact_relationship TEXT;
ALTER TABLE attendees ADD COLUMN colleague_enterprise_id TEXT;
ALTER TABLE attendees ADD COLUMN colleague_role TEXT;
ALTER TABLE attendees ADD COLUMN attending_colleague_contact_number TEXT;
ALTER TABLE attendees ADD COLUMN food_preference TEXT;
ALTER TABLE attendees ADD COLUMN beverage_preference TEXT;
