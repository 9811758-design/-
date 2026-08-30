import { expect, type Page, test } from "@playwright/test"

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
] as const

const routes = [
  { name: "dashboard", path: "/" },
  { name: "record-purchase", path: "/record" },
  { name: "history", path: "/history" },
  { name: "analytics", path: "/analytics" },
  { name: "settings", path: "/settings" },
] as const

async function prepareCapture(page: Page) {
  await expect(page.locator(".app-shell__header")).toBeVisible()
  const navigation = page.getByRole("navigation", { name: "주요 메뉴" })
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole("link")).toHaveCount(5)
  await page.evaluate(async () => {
    await document.fonts.ready
    document.querySelector(".app-shell__body")?.scrollTo(0, 0)
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false)
}

test("captures every expense-ledger page at required viewports", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const route of routes) {
      await page.goto(route.path)
      await prepareCapture(page)
      if (route.name === "dashboard") {
        await expect(page.locator(".dashboard-metrics .metric-card")).toHaveCount(8)
        await expect(page.getByRole("img", { name: "쿠크봉 로고" })).toBeVisible()
      }
      if (route.name === "analytics") {
        await expect(page.locator(".metric-grid .metric-card")).toHaveCount(6)
        await expect(page.getByLabel("통계 월 선택")).toBeVisible()
      }
      if (route.name === "history") {
        await expect(page.getByText("조건에 맞는 거래가 없습니다.")).toBeVisible()
      }
      await page.screenshot({
        path: `.omo/evidence/expense-ledger/${viewport.name}-${route.name}.png`,
        scale: "css",
      })
      if (route.name === "analytics") {
        await page.locator(".calendar-card").scrollIntoViewIfNeeded()
        await page.screenshot({
          path: `.omo/evidence/expense-ledger/${viewport.name}-analytics-calendar.png`,
          scale: "css",
        })
      }
    }

    await page.goto("/record")
    await page.getByRole("button", { name: "매출", exact: true }).click()
    await prepareCapture(page)
    await page.screenshot({
      path: `.omo/evidence/expense-ledger/${viewport.name}-record-revenue.png`,
      scale: "css",
    })

    await page.goto("/record")
    await page.getByRole("button", { name: "운영비", exact: true }).click()
    await prepareCapture(page)
    await page.screenshot({
      path: `.omo/evidence/expense-ledger/${viewport.name}-record-expense.png`,
      scale: "css",
    })
  }
})
