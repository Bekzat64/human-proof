import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so load the local env file ourselves.
// On CI/Vercel the file is absent and DATABASE_URL comes from the environment.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — fall through to process.env
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
});
