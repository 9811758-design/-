import { expect, test } from "@playwright/test"

test("preserves queued local expenses after Google failure and retries them", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.addInitScript(() => {
    Reflect.set(window, "google", {
      accounts: {
        oauth2: {
          initTokenClient: (config: unknown) => ({
            requestAccessToken: () => {
              if (typeof config !== "object" || config === null) return
              const callback = Reflect.get(config, "callback")
              if (typeof callback === "function") callback({ access_token: "e2e-memory-token" })
            },
          }),
          revoke: (_token: string, done: (response: unknown) => void) => done({ successful: true }),
        },
      },
    })
  })

  let failRemoteWrites = true
  await page.route("https://sheets.googleapis.com/**", async (route) => {
    const request = route.request()
    const url = request.url()
    if (request.method() === "POST" && url.endsWith("/v4/spreadsheets")) {
      await route.fulfill({ json: { spreadsheetId: "e2e-sheet" } })
      return
    }
    if (url.includes("values:batchUpdate")) {
      await route.fulfill({ json: {} })
      return
    }
    if (request.method() === "GET" && url.includes("/values/")) {
      await route.fulfill({ json: { values: [] } })
      return
    }
    if (url.includes(":append") && failRemoteWrites) {
      await route.fulfill({ status: 503, json: { error: { message: "temporary" } } })
      return
    }
    await route.fulfill({ json: {} })
  })

  await page.goto("/record")
  await page.getByLabel("재료명").fill("원두")
  await page.getByLabel("수량").fill("1")
  await page.getByLabel("단위").fill("kg")
  await page.getByLabel("구매 금액").fill("30000")
  await page.getByLabel("단가").fill("30000")
  await page.getByRole("button", { name: "재료 구매 저장" }).click()
  await expect(page.getByText("재료 구매를 기기에 저장했습니다.")).toBeVisible()

  await page.getByRole("link", { name: "설정" }).click()
  await expect(page.getByText("동기화 대기 1건")).toBeVisible()
  await page.getByRole("button", { name: "Google 연결" }).click()
  await page.getByRole("button", { name: "새 장부 만들기" }).click()
  await expect(page.getByText("로컬 기록은 이 기기에 그대로 남아 있습니다.")).toBeVisible()
  await expect(page.getByText("동기화 대기 1건")).toBeVisible()

  failRemoteWrites = false
  await page.getByRole("button", { name: "동기화 다시 시도" }).click()
  await expect(page.getByText("동기화 대기 0건")).toBeVisible()
  await expect(page.getByText("연결 문서: e2e-sheet")).toBeVisible()
})
