import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Preserve an explicit local-development opt-out; otherwise enforce SSL.
const connectionUrl = new URL(process.env.DATABASE_URL);
const sslDisabled = connectionUrl.searchParams.get("sslmode") === "disable";
// URL SSL flags otherwise override pg's explicit rejectUnauthorized setting.
for (const option of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
  connectionUrl.searchParams.delete(option);
}
export const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: sslDisabled ? false : { rejectUnauthorized: false },
  max: 3,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
