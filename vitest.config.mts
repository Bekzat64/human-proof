import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: fromRoot("./") },
      // The real `server-only` package throws unless bundled for a React Server
      // environment. Unit tests exercise server code directly, so stub it.
      { find: /^server-only$/, replacement: fromRoot("./test/server-only.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
