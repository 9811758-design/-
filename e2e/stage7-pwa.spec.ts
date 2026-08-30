import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { expect, type Page, test } from "@playwright/test"
import { z } from "zod"

const webManifestSchema = z.object({
  display: z.string().optional(),
  icons: z
    .array(
      z.object({
        purpose: z.string().optional(),
        sizes: z.string().optional(),
        src: z.string().optional(),
        type: z.string().optional(),
      }),
    )
    .optional(),
  id: z.string().optional(),
  scope: z.string().optional(),
  start_url: z.string().optional(),
})

const installabilitySchema = z.object({
  installabilityErrors: z.array(z.unknown()),
})

async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
}

test("ships an installable manifest and starts offline after first load", async ({
  context,
  page,
}) => {
  // Given: the production build is opened once while online.
  await page.goto("/")
  const manifestText = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (link === null) throw new Error("Web App Manifest 링크가 없습니다.")
    const response = await fetch(link.href)
    return response.text()
  })
  const manifestJson: unknown = JSON.parse(manifestText)
  const manifest = webManifestSchema.parse(manifestJson)

  // When: the browser registers and activates the generated service worker.
  await waitForServiceWorker(page)
  await expect(page.getByText("오프라인 사용 준비가 끝났습니다.")).toBeVisible()
  for (const viewport of [
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.screenshot({
      path: `.omo/evidence/stage7-visual/${viewport.name}-pwa-offline-ready.png`,
      scale: "css",
    })
  }
  await page.getByRole("button", { name: "확인" }).click()
  await page.reload()

  // Then: install metadata and required icon purposes are present.
  expect(manifest).toMatchObject({
    display: "standalone",
    id: "/",
    scope: "/",
    start_url: "/",
  })
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ sizes: "512x512", type: "image/png" }),
      expect.objectContaining({ purpose: "maskable", sizes: "512x512" }),
    ]),
  )
  const cdp = await page.context().newCDPSession(page)
  const installability = installabilitySchema.parse(await cdp.send("Page.getInstallabilityErrors"))
  expect(installability.installabilityErrors).toEqual([])
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

  // And: the cached application shell opens with the network disabled.
  await context.setOffline(true)
  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "빠르게 기록해 보세요" })).toBeVisible()
})

test("detects a changed service worker and lets the owner postpone it", async ({ page }) => {
  // Given: the current production service worker controls the application.
  await page.goto("/")
  await waitForServiceWorker(page)
  await page.getByRole("button", { name: "확인" }).click()
  await page.reload()
  const serviceWorkerPath = path.resolve("dist/sw.js")
  const originalServiceWorker = await readFile(serviceWorkerPath, "utf8")

  try {
    // When: a byte-different service worker is deployed and checked.
    await writeFile(serviceWorkerPath, `${originalServiceWorker}\n// postponed-release`, "utf8")
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration === undefined) throw new Error("Service Worker 등록을 찾지 못했습니다.")
      await registration.update()
    })
    await expect(page.getByText("새 버전을 사용할 수 있습니다.")).toBeVisible()
    await page.getByRole("button", { name: "나중에" }).click()

    // Then: the current screen remains and the new worker keeps waiting.
    await expect(page.getByText("새 버전을 사용할 수 있습니다.")).toBeHidden()
    await expect(page.getByRole("heading", { name: "빠르게 기록해 보세요" })).toBeVisible()
    expect(
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        return registration !== undefined && registration.waiting !== null
      }),
    ).toBe(true)
  } finally {
    await writeFile(serviceWorkerPath, originalServiceWorker, "utf8")
  }
})

test("activates a changed service worker after the owner accepts", async ({ page }) => {
  // Given: a byte-different service worker is waiting to update the application.
  await page.goto("/")
  await waitForServiceWorker(page)
  await page.getByRole("button", { name: "확인" }).click()
  await page.reload()
  const serviceWorkerPath = path.resolve("dist/sw.js")
  const originalServiceWorker = await readFile(serviceWorkerPath, "utf8")

  try {
    await writeFile(serviceWorkerPath, `${originalServiceWorker}\n// accepted-release`, "utf8")
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration === undefined) throw new Error("Service Worker 등록을 찾지 못했습니다.")
      await registration.update()
    })
    await expect(page.getByText("새 버전을 사용할 수 있습니다.")).toBeVisible()

    // When: the owner accepts the prompt.
    await Promise.all([
      page.waitForEvent("framenavigated"),
      page.getByRole("button", { name: "지금 업데이트" }).click(),
    ])

    // Then: the waiting worker activates and the application reloads successfully.
    await page.waitForLoadState("domcontentloaded")
    await waitForServiceWorker(page)
    await expect(page.getByRole("heading", { name: "빠르게 기록해 보세요" })).toBeVisible()
    expect(
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        return registration?.waiting === null
      }),
    ).toBe(true)
  } finally {
    await writeFile(serviceWorkerPath, originalServiceWorker, "utf8")
  }
})
