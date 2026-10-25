// Applies database migrations during the Vercel build.
// Uses DATABASE_MIGRATION_URL (owner role) so the runtime DATABASE_URL can stay
// least-privilege. Skipped when no migration URL is configured, which keeps
// analyzer-only and self-hosted builds working without a database.
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { fileURLToPath } from "node:url";
import ws from "ws";

// DATABASE_URL_UNPOOLED is the owner connection set by the Vercel Neon integration.
const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.log("[migrate] No migration database URL set, skipping migrations.");
  process.exit(0);
}
neonConfig.webSocketConstructor = globalThis.WebSocket ?? ws;
const pool = new Pool({ connectionString: url });
try {
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: fileURLToPath(new URL("../db/migrations", import.meta.url)),
  });
  console.log("[migrate] Database is up to date.");
} catch (e) {
  // Do not print the connection string or query parameters.
  console.error(
    "[migrate] Migration failed:",
    e instanceof Error ? e.message.split("\n")[0] : "unknown error",
  );
  process.exit(1);
} finally {
  await pool.end();
}
