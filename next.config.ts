import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Off on purpose: every page here is per-visitor (cookie + DB), so the
  // classic "dynamic unless told otherwise" model is simpler to reason about.
  // (`partialPrefetching` requires Cache Components, so it is off too.)
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
