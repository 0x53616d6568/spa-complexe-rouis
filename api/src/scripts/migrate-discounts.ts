import path from "node:path";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to migrate service discounts.");

const client = new Client({
  connectionString: databaseUrl,
  ssl: /localhost|127\.0\.0\.1/.test(databaseUrl)
    ? undefined
    : { rejectUnauthorized: false, checkServerIdentity: () => undefined },
});

try {
  await client.connect();
  await client.query(`
    ALTER TABLE services
      ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE services
      DROP CONSTRAINT IF EXISTS services_discount_percent_check;
    ALTER TABLE services
      ADD CONSTRAINT services_discount_percent_check
      CHECK (discount_percent BETWEEN 0 AND 100);
  `);
  console.log("Service discount column and constraint are ready.");
} finally {
  await client.end();
}
