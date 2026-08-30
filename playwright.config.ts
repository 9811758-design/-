import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "stage7-pwa.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4174",
    env: { VITE_GOOGLE_CLIENT_ID: "e2e-public-client-id" },
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
})
