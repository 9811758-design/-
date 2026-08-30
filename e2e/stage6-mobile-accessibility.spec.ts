import { expect, test } from "@playwright/test"

test("supports skip navigation, keyboard entry, and 44px touch targets", async ({ page }) => {
  await page.goto("/")
  await page.keyboard.press("Tab")
  await expect(page.getByRole("link", { name: "본문으로 건너뛰기" })).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("main")).toBeFocused()

  const undersizedTargets = await page
    .locator(".app-shell a, .app-shell button, .app-shell input, .app-shell select")
    .evaluateAll((items) =>
      items.flatMap((item) => {
        const style = window.getComputedStyle(item)
        if (style.display === "none" || style.visibility === "hidden") return []
        const ownBox = item.getBoundingClientRect()
        const candidate =
          item instanceof HTMLInputElement && item.type === "checkbox"
            ? item.closest("label")
            : item
        const box = candidate?.getBoundingClientRect() ?? ownBox
        return box.width < 44 || box.height < 44
          ? [item.getAttribute("aria-label") ?? item.textContent ?? item.tagName]
          : []
      }),
    )
  expect(undersizedTargets).toEqual([])
})

test("offers aggregate revenue, purchase, and operating-expense entry without menu sales", async ({
  page,
}) => {
  await page.goto("/record")
  await expect(page.getByRole("button", { name: "매출", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "재료 구매", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "운영비", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "판매", exact: true })).toHaveCount(0)
  await expect(page.getByText("메뉴")).toHaveCount(0)
})

test("focuses a runtime validation error without losing purchase input", async ({ page }) => {
  await page.goto("/record")
  await page.getByLabel("재료명").fill("원두")
  await page.getByLabel("수량").fill("0")
  await page.getByLabel("단위").fill("kg")
  await page.getByLabel("구매 금액").fill("30000")
  await page.getByLabel("단가").fill("30000")
  await page.getByRole("button", { name: "재료 구매 저장" }).click()
  const alert = page.getByRole("alert")
  await expect(alert).toBeFocused()
  await expect(page.getByLabel("재료명")).toHaveValue("원두")
})

test("moves between calendar dates with the keyboard and announces full amounts", async ({ page }) => {
  await page.goto("/analytics")
  const selected = page.locator('.calendar-day[aria-pressed="true"]')
  await selected.focus()
  await page.keyboard.press("Home")
  await expect(page.locator('.calendar-day[aria-pressed="true"]')).toContainText("1")
  await page.keyboard.press("ArrowRight")
  const secondDay = page.locator('.calendar-day[aria-pressed="true"]')
  await expect(secondDay).toContainText("2")
  await expect(secondDay).toHaveAttribute("aria-label", /매출 0원, 총지출 0원/)
})

test("keeps local purchase entry available while the network is offline", async ({
  context,
  page,
}) => {
  await page.goto("/record")
  await context.setOffline(true)
  await expect(page.getByText("오프라인 · 기기에 저장")).toBeVisible()
  await page.getByLabel("재료명").fill("우유")
  await page.getByLabel("수량").fill("12")
  await page.getByLabel("단위").fill("개")
  await page.getByLabel("구매 금액").fill("24000")
  await page.getByLabel("단가").fill("2000")
  await page.getByRole("button", { name: "재료 구매 저장" }).click()
  await expect(page.getByText("재료 구매를 기기에 저장했습니다.")).toBeVisible()
})

test("keeps every active route accessible and inside its scroll container", async ({ page }) => {
  const viewports = [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1280, height: 900 },
  ]
  const routes = ["/", "/record", "/history", "/analytics", "/settings"]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const route of routes) {
      await page.goto(route)
      await expect(page.getByRole("main")).toBeVisible()
      const audit = await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>("#main-content")
        const controls = [
          ...document.querySelectorAll<HTMLElement>("a, button, input, select"),
        ].filter((element) => window.getComputedStyle(element).visibility !== "hidden")
        const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id)
        const unnamed = controls.filter((element) => {
          const labels =
            element instanceof HTMLInputElement || element instanceof HTMLSelectElement
              ? [...element.labels].map((label) => label.textContent?.trim() ?? "").join(" ")
              : ""
          return (
            (
              element.getAttribute("aria-label") ||
              labels ||
              element.textContent?.trim() ||
              ""
            ).trim() === ""
          )
        })
        return {
          duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
          mainOverflow: main === null ? true : main.scrollWidth > main.clientWidth,
          mainCount: document.querySelectorAll("main").length,
          unnamedCount: unnamed.length,
        }
      })
      expect(audit).toEqual({
        duplicateIds: [],
        mainOverflow: false,
        mainCount: 1,
        unnamedCount: 0,
      })
    }
  }
})
