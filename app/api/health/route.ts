import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getAnonId } from "@/lib/anon";
import { getDb } from "@/lib/db";
import { attempts } from "@/lib/db/schema";

type Health = {
  ok: boolean;
  /** Did the proxy give this request an anonymous identity? */
  anon: boolean;
  db: "up" | "down";
  schema: "ready" | "missing" | "unknown";
};

/**
 * Liveness probe used by production smoke tests: proves the anonymous-identity
 * proxy ran, the deployment can reach Postgres, and the schema has been pushed.
 * Exposes no data.
 */
export async function GET(): Promise<Response> {
  await connection(); // always evaluate at request time, never prerender

  const anon = (await getAnonId()) !== null;

  let db;
  try {
    db = getDb();
    await db.execute(sql`select 1`);
  } catch {
    return json({ ok: false, anon, db: "down", schema: "unknown" });
  }

  try {
    await db.select({ id: attempts.id }).from(attempts).limit(1);
  } catch {
    return json({ ok: false, anon, db: "up", schema: "missing" });
  }

  return json({ ok: anon, anon, db: "up", schema: "ready" });
}

function json(body: Health): Response {
  return Response.json(body, {
    status: body.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
