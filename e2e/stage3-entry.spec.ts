import { expect, test } from "@playwright/test"

test("persists one daily revenue, purchase, and operating-expense record after reload", async ({
  page,
}) => {
  await page.goto("/record")

  await page.getByLabel("재료명").fill("원두")
  await page.getByLabel("수량").fill("2")
  await page.getByLabel("단위").fill("kg")
  await page.getByLabel("구매 금액").fill("60000")
  await page.getByLabel("단가").fill("30000")
  await page.getByRole("button", { name: "재료 구매 저장" }).click()
  await expect(page.getByText("재료 구매를 기기에 저장했습니다.")).toBeVisible()

  await page.getByRole("button", { name: "운영비", exact: true }).click()
  await page.getByLabel("분류").selectOption({ label: "월세" })
  await page.getByLabel("금액").fill("500000")
  await page.getByRole("button", { name: "운영비 저장" }).click()
  await expect(page.getByText("운영비를 기기에 저장했습니다.")).toBeVisible()

  await page.getByRole("button", { name: "매출", exact: true }).click()
  await page.getByLabel("총매출액").fill("300000")
  await page.getByRole("button", { name: "매출 저장" }).click()
  await expect(page.getByText("매출을 기기에 저장했습니다.")).toBeVisible()
  await page.getByLabel("총매출액").fill("350000")
  await page.getByRole("button", { name: "매출 저장" }).click()
  await expect(page.getByText("해당 영업일의 매출을 수정했습니다.")).toBeVisible()

  await page.reload()
  await page.getByRole("link", { name: "내역" }).click()
  await expect(page.getByText("재료 구매 · 원두")).toBeVisible()
  await expect(
    page.getByRole("region", { name: "기록" }).getByText("운영비", { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "매출 수정" })).toHaveCount(1)
  await expect(page.getByText("350,000원")).toBeVisible()
  await expect(page.getByText("3건")).toBeVisible()
})

test("edits and soft deletes a daily revenue from history", async ({ page }) => {
  await page.goto("/record?type=revenue")
  await page.getByLabel("총매출액").fill("100000")
  await page.getByRole("button", { name: "매출 저장" }).click()
  await expect(page.getByText("매출을 기기에 저장했습니다.")).toBeVisible()

  await page.goto("/history")
  await page.getByLabel("거래 종류").selectOption("revenue")
  await page.getByRole("button", { name: "매출 수정" }).click()
  await page.getByLabel("총매출액").fill("120000")
  await page.getByRole("button", { name: "수정 저장" }).click()
  await expect(page.getByText("120,000원")).toBeVisible()

  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "매출 삭제" }).click()
  await expect(page.getByText("조건에 맞는 거래가 없습니다.")).toBeVisible()
})
