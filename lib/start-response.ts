import "server-only";
import { NextResponse } from "next/server";

/**
 * Responses for the "start a simulation / drill" endpoints, which serve two
 * callers: the StartButton (fetch, asks for JSON) and a plain HTML form
 * POST when JavaScript is off.
 */

const wantsJson = (request: Request) => request.headers.get("accept")?.includes("application/json") ?? false;

/** Where to go next: JSON for the button, a 303 for a plain form. */
export function startRedirect(request: Request, path: string): Response {
  if (wantsJson(request)) {
    return Response.json({ redirectTo: path }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.redirect(new URL(path, request.url), 303);
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** HTTP 429 with a friendly message: JSON for the button, a small styled page for a plain form. */
export function tooManyRequests(request: Request, message: string): Response {
  const headers = { "Cache-Control": "no-store", "Retry-After": "3600" };
  if (wantsJson(request)) {
    return Response.json({ error: { code: "rate_limited", message } }, { status: 429, headers });
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Slow down a little · HUMAN PROOF</title>
<style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0b1124;color:#f1f3f9;font:16px/1.6 system-ui,sans-serif;padding:24px}main{max-width:32rem}p.k{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#9aa3bd}h1{font:400 40px/1.1 Georgia,serif;margin:.4em 0}a{color:#b8a4fb}</style></head>
<body><main><p class="k">HUMAN PROOF</p><h1>Slow down a little</h1><p>${escape(message)}</p><p><a href="/me">My proofs</a> · <a href="/">Home</a></p></main></body></html>`;
  return new Response(html, { status: 429, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}
