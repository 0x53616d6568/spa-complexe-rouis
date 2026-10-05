import path from "node:path";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize the database.");
}

const sql = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM (
      'pending',
      'confirmed',
      'checked_in',
      'completed',
      'cancelled',
      'no_show'
    );
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    CREATE TYPE notification_status AS ENUM (
      'queued',
      'sending',
      'sent',
      'failed'
    );
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;

  CREATE TABLE IF NOT EXISTS spa_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tagline TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    region TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
    currency TEXT NOT NULL DEFAULT 'NGN',
    cancellation_policy TEXT NOT NULL,
    booking_window_days INTEGER NOT NULL DEFAULT 60,
    minimum_notice_hours INTEGER NOT NULL DEFAULT 2,
    is_demo BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES service_categories(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    short_description TEXT NOT NULL,
    description TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
    buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
    price_amount INTEGER NOT NULL,
    discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
    currency TEXT NOT NULL DEFAULT 'NGN',
    image_url TEXT,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE services ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE services DROP CONSTRAINT IF EXISTS services_discount_percent_check;
  ALTER TABLE services ADD CONSTRAINT services_discount_percent_check CHECK (discount_percent BETWEEN 0 AND 100);

  CREATE TABLE IF NOT EXISTS staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT UNIQUE,
    display_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    is_bookable BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS staff_profiles_active_idx
    ON staff_profiles (is_active, is_bookable);

  CREATE TABLE IF NOT EXISTS staff_services (
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (staff_id, service_id)
  );

  CREATE INDEX IF NOT EXISTS staff_services_service_idx
    ON staff_services (service_id);

  CREATE TABLE IF NOT EXISTS working_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL UNIQUE,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS customers_name_idx ON customers (name);
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS customers_clerk_user_id_uq
    ON customers (clerk_user_id);

  CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_reference TEXT NOT NULL UNIQUE,
    idempotency_key UUID NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    service_id UUID NOT NULL REFERENCES services(id),
    staff_id UUID REFERENCES staff_profiles(id),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL,
    status booking_status NOT NULL DEFAULT 'pending',
    customer_note TEXT,
    cancellation_reason TEXT,
    duration_minutes INTEGER NOT NULL,
    price_amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS bookings_start_status_idx
    ON bookings (starts_at, status);

  CREATE INDEX IF NOT EXISTS bookings_customer_idx
    ON bookings (customer_id, starts_at);

  CREATE INDEX IF NOT EXISTS bookings_staff_idx
    ON bookings (staff_id, starts_at);

  CREATE TABLE IF NOT EXISTS booking_service_items (
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    service_id UUID NOT NULL REFERENCES services(id),
    service_name TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL,
    price_amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    PRIMARY KEY (booking_id, position)
  );

  CREATE INDEX IF NOT EXISTS booking_service_items_service_idx
    ON booking_service_items (service_id);

  CREATE TABLE IF NOT EXISTS booking_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    from_status booking_status,
    to_status booking_status NOT NULL,
    changed_by TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS booking_status_history_booking_idx
    ON booking_status_history (booking_id);

  CREATE TABLE IF NOT EXISTS booking_slot_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    slot_starts_at TIMESTAMPTZ NOT NULL UNIQUE
  );

  CREATE INDEX IF NOT EXISTS booking_slot_claims_booking_idx
    ON booking_slot_claims (booking_id);

  CREATE TABLE IF NOT EXISTS guest_booking_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS guest_booking_tokens_booking_idx
    ON guest_booking_tokens (booking_id);
  CREATE INDEX IF NOT EXISTS guest_booking_tokens_expiry_idx
    ON guest_booking_tokens (expires_at);

  CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'email',
    template_key TEXT NOT NULL,
    recipient TEXT NOT NULL,
    payload JSONB NOT NULL,
    status notification_status NOT NULL DEFAULT 'queued',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS notifications_status_created_idx
    ON notifications (status, created_at);

  CREATE INDEX IF NOT EXISTS notifications_booking_idx
    ON notifications (booking_id);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id TEXT,
    actor_label TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    request_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS audit_logs_created_idx
    ON audit_logs (created_at);

  CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
    ON audit_logs (entity_type, entity_id);
`;

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    },
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log("Database schema initialized successfully.");
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error("Database initialization failed:", error);
  process.exit(1);
});
