import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
    server: {
      deps: {
        inline: ["@nairaramp/core", "@stellar/typescript-wallet-sdk"],
      },
    },
  },
});
