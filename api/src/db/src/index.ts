import path from "node:path";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../../.env") });

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isRemoteDatabase = !/localhost|127\.0\.0\.1/.test(databaseUrl);

export const pool = new Pool({
  connectionString: databaseUrl,
  ...(isRemoteDatabase
    ? {
        ssl: {
          rejectUnauthorized: false,
          checkServerIdentity: () => undefined,
        },
      }
    : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
