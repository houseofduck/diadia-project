import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ['./src/services/__tests__/mocks/setup.ts'],
    globals: true,
    testTimeout: 60000, // 60 seconds for long AI requests
  },
});