import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";
import { adminConfig } from "./config";
import type { Db } from "./types";

let db: Db | null = null;

/** Runtime connection (least-privilege role). Migrations use a separate URL. */
export function getDb(): Db {
  if (db) return db;
  const cfg = adminConfig();
  if (!cfg) throw new Error("Administration is not configured.");
  db = drizzle({
    client: new Pool({ connectionString: cfg.databaseUrl }),
    schema,
  }) as unknown as Db;
  return db;
}
