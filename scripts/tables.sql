-- SQL script to directly create tables when ORM-based approaches fail
-- This is a fallback for deployment when drizzle-kit push fails

CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "email" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "care_recipients" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "color" TEXT DEFAULT '#4F46E5' NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "created_by" INTEGER REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "medications" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "dose" TEXT,
  "instructions" TEXT,
  "color" TEXT DEFAULT '#4F46E5',
  "icon" TEXT DEFAULT 'pill',
  "time_of_day" TEXT DEFAULT 'morning',
  "active" BOOLEAN DEFAULT true,
  "rxcui" TEXT,
  "current_quantity" INTEGER,
  "reorder_threshold" INTEGER,
  "days_to_reorder" INTEGER,
  "original_quantity" INTEGER,
  "refills_remaining" INTEGER,
  "last_refill_date" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "medication_schedules" (
  "id" SERIAL PRIMARY KEY,
  "medication_id" INTEGER NOT NULL REFERENCES "medications"("id") ON DELETE CASCADE,
  "sunday" BOOLEAN DEFAULT false NOT NULL,
  "monday" BOOLEAN DEFAULT false NOT NULL,
  "tuesday" BOOLEAN DEFAULT false NOT NULL,
  "wednesday" BOOLEAN DEFAULT false NOT NULL,
  "thursday" BOOLEAN DEFAULT false NOT NULL,
  "friday" BOOLEAN DEFAULT false NOT NULL,
  "saturday" BOOLEAN DEFAULT false NOT NULL,
  "time" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "medication_logs" (
  "id" SERIAL PRIMARY KEY,
  "medication_id" INTEGER NOT NULL REFERENCES "medications"("id") ON DELETE CASCADE,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "taken_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "scheduled_time" TEXT,
  "dose" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "appointments" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "date" TIMESTAMP WITH TIME ZONE NOT NULL,
  "location" TEXT,
  "notes" TEXT,
  "doctor_id" INTEGER,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "meals" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "meal_type" TEXT NOT NULL,
  "food_items" TEXT NOT NULL,
  "time" TIMESTAMP WITH TIME ZONE NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bowel_movements" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "time" TIMESTAMP WITH TIME ZONE NOT NULL,
  "consistency" INTEGER NOT NULL,
  "color" INTEGER NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "supplies" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reorder_threshold" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "supply_usages" (
  "id" SERIAL PRIMARY KEY,
  "supply_id" INTEGER NOT NULL REFERENCES "supplies"("id") ON DELETE CASCADE,
  "quantity_used" INTEGER NOT NULL,
  "used_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sleep" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "start_time" TIMESTAMP WITH TIME ZONE NOT NULL,
  "end_time" TIMESTAMP WITH TIME ZONE,
  "quality" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notes" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "inspiration_messages" (
  "id" SERIAL PRIMARY KEY,
  "message" TEXT NOT NULL,
  "author" TEXT,
  "active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "doctors" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "specialty" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "emergency_info" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "full_name" TEXT NOT NULL,
  "date_of_birth" TEXT,
  "blood_type" TEXT,
  "allergies" TEXT,
  "conditions" TEXT,
  "medications" TEXT,
  "insurance_info" TEXT,
  "emergency_contacts" TEXT,
  "doctors" TEXT,
  "hospital_preference" TEXT,
  "advanced_directives" TEXT,
  "notes" TEXT,
  "pin" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pharmacies" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "fax" TEXT,
  "hours" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "medication_pharmacies" (
  "id" SERIAL PRIMARY KEY,
  "medication_id" INTEGER NOT NULL REFERENCES "medications"("id") ON DELETE CASCADE,
  "pharmacy_id" INTEGER NOT NULL REFERENCES "pharmacies"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "blood_pressure" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "systolic" INTEGER NOT NULL,
  "diastolic" INTEGER NOT NULL,
  "pulse" INTEGER,
  "oxygen" INTEGER,
  "time_of_reading" TIMESTAMP WITH TIME ZONE NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "glucose" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "level" NUMERIC(5, 2) NOT NULL,
  "time_of_reading" TIMESTAMP WITH TIME ZONE NOT NULL,
  "reading_type" TEXT NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "insulin" (
  "id" SERIAL PRIMARY KEY,
  "care_recipient_id" INTEGER NOT NULL REFERENCES "care_recipients"("id") ON DELETE CASCADE,
  "units" INTEGER NOT NULL,
  "insulin_type" TEXT NOT NULL,
  "time_administered" TIMESTAMP WITH TIME ZONE NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "webauthn_credentials" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "credential_id" TEXT NOT NULL,
  "public_key" TEXT NOT NULL,
  "counter" INTEGER NOT NULL,
  "device_type" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);

-- Create default user for foreign key references
INSERT INTO "users" ("username", "password", "email", "created_at", "updated_at") VALUES
('default_admin', '$2b$10$K.8SV73w7FjKLCvuHX1gUehhwTTxlQAp.J4B9UHaIHGcTY5FJcX/m', 'admin@example.com', NOW(), NOW())
ON CONFLICT (username) DO NOTHING;

-- Basic seed data for inspiration messages
INSERT INTO "inspiration_messages" ("message", "author") VALUES
('Caregiving often calls us to lean into love we didn''t know possible.', 'Tia Walker'),
('To care for those who once cared for us is one of the highest honors.', 'Tia Walker'),
('Being a caregiver is a work of heart.', 'Anonymous'),
('We rise by lifting others.', 'Robert Ingersoll'),
('Sometimes the smallest step in the right direction ends up being the biggest step of your life.', 'Unknown')
ON CONFLICT DO NOTHING;