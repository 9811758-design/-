import { defineConfig, devices } from "@playwright/test"

// biome-ignore lint/style/noDefaultExport: Playwright loads this configuration as a default export.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "stage7-pwa.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "pwa-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 4175",
    env: { VITE_GOOGLE_CLIENT_ID: "e2e-public-client-id" },
    reuseExistingServer: false,
    url: "http://127.0.0.1:4175",
  },
})
