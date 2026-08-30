import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
      },
      manifest: {
        id: "/",
        name: "쿠크봉 지출 장부",
        short_name: "쿠크봉 장부",
        description: "재료 구매와 운영비를 기록하는 오프라인 우선 지출 장부",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#1e4037",
        background_color: "#f2f0eb",
        lang: "ko",
        categories: ["business", "finance", "productivity"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
})
