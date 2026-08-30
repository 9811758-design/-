import { expect, test } from "@playwright/test"

async function seedSpending(page: import("@playwright/test").Page) {
  await page.goto("/record")
  await page.getByLabel("재료명").fill("원두")
  await page.getByLabel("수량").fill("1")
  await page.getByLabel("단위").fill("kg")
  await page.getByLabel("구매 금액").fill("30000")
  await page.getByLabel("단가").fill("30000")
  await page.getByRole("button", { name: "재료 구매 저장" }).click()
  await expect(page.getByText("재료 구매를 기기에 저장했습니다.")).toBeVisible()

  await page.getByRole("button", { name: "운영비", exact: true }).click()
  await page.getByLabel("분류").selectOption({ label: "소모품" })
  await page.getByLabel("금액").fill("20000")
  await page.getByRole("button", { name: "운영비 저장" }).click()
  await expect(page.getByText("운영비를 기기에 저장했습니다.")).toBeVisible()

  await page.getByRole("button", { name: "매출", exact: true }).click()
  await page.getByLabel("총매출액").fill("200000")
  await page.getByRole("button", { name: "매출 저장" }).click()
  await expect(page.getByText("매출을 기기에 저장했습니다.")).toBeVisible()
}

test("filters, edits, soft deletes, and recalculates revenue calendar analytics", async ({
  page,
}) => {
  await seedSpending(page)

  await page.getByRole("link", { name: "통계" }).click()
  await expect(
    page.locator(".metric-card").filter({ hasText: "총지출" }).getByText("50,000원"),
  ).toBeVisible()
  await expect(
    page.locator(".metric-card").filter({ hasText: "총매출" }).getByText("200,000원"),
  ).toBeVisible()
  await expect(page.locator(".metric-grid").getByText("15.00%", { exact: true })).toBeVisible()
  const revenueDay = page.getByRole("button", { name: /매출 200,000원, 총지출 50,000원/ })
  await expect(revenueDay).toBeVisible()
  await revenueDay.click()
  await expect(page.getByRole("heading", { name: /2026년 8월/ })).toBeVisible()
  await expect(page.getByRole("heading", { name: "운영비 분류" })).toBeVisible()
  await expect(page.getByText("소모품")).toBeVisible()

  await page.goto("/history")
  await page.getByLabel("거래 종류").selectOption("purchase")
  await page.getByRole("button", { name: "재료 구매 · 원두 수정" }).click()
  await page.getByLabel("구매 금액").fill("60000")
  await page.getByRole("button", { name: "수정 저장" }).click()
  await expect(page.getByRole("button", { name: "재료 구매 · 원두 수정" })).toBeVisible()

  await page.goto("/history")
  await page.getByLabel("거래 종류").selectOption("expense")
  await expect(page.getByRole("button", { name: "운영비 삭제" })).toBeVisible()
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "운영비 삭제" }).click()

  await page.goto("/analytics")
  const metrics = page.locator(".metric-grid")
  await expect(metrics.getByText("60,000원")).toHaveCount(2)
  await expect(metrics.getByText("0원", { exact: true })).toBeVisible()
  await expect(metrics.getByText("30.00%", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /매출 200,000원, 총지출 60,000원/ })).toBeVisible()
  await expect(page.getByText("이 달에는 운영비 기록이 없습니다.")).toBeVisible()
})
