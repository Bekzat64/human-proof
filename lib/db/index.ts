import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  return drizzle(neon(url), { schema });
}

let cached: ReturnType<typeof createDb> | undefined;

/**
 * Drizzle client over Neon's HTTP driver. Created lazily so that importing
 * this module (e.g. during `next build`) never requires DATABASE_URL.
 */
export function getDb() {
  return (cached ??= createDb());
}

export { schema };
