import path from "node:path";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to migrate booking items.");
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,
  },
});

try {
  await client.connect();
  await client.query(`
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
  `);
  const result = await client.query(
    "SELECT to_regclass('public.booking_service_items') AS table_name;",
  );
  if (!result.rows[0]?.table_name) {
    throw new Error("booking_service_items table was not found after migration.");
  }
  console.log("booking_service_items table and index applied successfully.");
} finally {
  await client.end();
}
