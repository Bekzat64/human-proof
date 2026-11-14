// Shared by proxy.ts and server code. Kept free of imports because Proxy is
// bundled separately from the app and should not pull in app modules.
export const ANON_COOKIE = "hp_anon";
export const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, in seconds
