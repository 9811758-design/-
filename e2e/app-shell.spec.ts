import { expect, test } from "@playwright/test"

test("shows the local-first dashboard when the app starts", async ({ page }) => {
  // Given: a cafe owner opens the installed web app.
  await page.goto("/")

  // When: the initial route finishes loading.

  // Then: the app presents the local-first record entry point.
  await expect(page.getByRole("heading", { name: "빠르게 기록해 보세요" })).toBeVisible()
  await expect(page.getByText("입력 내용은 이 기기에 저장됩니다.")).toBeVisible()
})

test("keeps the header and footer fixed when the body receives long content", async ({ page }) => {
  // Given: a long ledger view inside the app shell.
  await page.goto("/")
  await page.locator(".hero-card").evaluate((element) => {
    element.setAttribute("style", "min-block-size: 200dvb")
  })

  // When: the content becomes taller than the viewport.
  const scrollState = await page.locator(".app-shell__body").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    documentHeight: document.documentElement.scrollHeight,
    headerTop: document.querySelector(".app-shell__header")?.getBoundingClientRect().top,
    footerBottom: document.querySelector(".bottom-nav")?.getBoundingClientRect().bottom,
    viewportHeight: window.innerHeight,
  }))

  // Then: the body becomes the scroll owner instead of expanding the whole shell.
  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight)
  expect(scrollState.documentHeight).toBe(scrollState.viewportHeight)
  expect(scrollState.headerTop).toBe(0)
  expect(scrollState.footerBottom).toBe(scrollState.viewportHeight)
})
