import "server-only";
import { cookies } from "next/headers";
import { ANON_COOKIE } from "./anon-cookie";

/**
 * Anonymous identity of the current visitor. There is no login anywhere:
 * `proxy.ts` guarantees this cookie exists on every matched request, and all
 * user data is keyed by it.
 */
export async function getAnonId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ANON_COOKIE)?.value ?? null;
}
