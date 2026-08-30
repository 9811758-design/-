import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SettingsPage } from "./SettingsPage"
import type { SyncSettingsService, SyncSettingsSnapshot } from "./sync-settings-service"

afterEach(cleanup)

function snapshot(overrides: Partial<SyncSettingsSnapshot> = {}): SyncSettingsSnapshot {
  return {
    clientConfigured: true,
    connected: false,
    pendingCount: 2,
    failedCount: 0,
    status: "needs_connection",
    ...overrides,
  }
}

describe("SettingsPage", () => {
  it("connects Google, creates a template, and reports queued local records", async () => {
    // Given: local work exists and Google authorization is not connected yet.
    const initial = snapshot()
    const connected = snapshot({ connected: true, status: "ready" })
    const linked = snapshot({
      connected: true,
      spreadsheetId: "sheet-123",
      pendingCount: 0,
      status: "ready",
    })
    let snapshotIndex = 0
    const service: SyncSettingsService = {
      getSnapshot: vi.fn(async () => {
        if (snapshotIndex === 0) return initial
        if (snapshotIndex === 1) return connected
        return linked
      }),
      connectGoogle: vi.fn(async () => {
        snapshotIndex = 1
      }),
      createTemplate: vi.fn(async () => {
        snapshotIndex = 2
      }),
      connectExisting: vi.fn(async () => undefined),
      retry: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
    }
    render(<SettingsPage service={service} />)
    await screen.findByText("동기화 대기 2건")

    // When: the owner connects and chooses an app-owned template.
    fireEvent.click(screen.getByRole("button", { name: "Google 연결" }))
    await screen.findByRole("button", { name: "새 장부 만들기" })
    fireEvent.click(screen.getByRole("button", { name: "새 장부 만들기" }))

    // Then: the linked sheet is shown and the queued local records are retained until sync succeeds.
    await waitFor(() => expect(service.createTemplate).toHaveBeenCalledOnce())
    expect(await screen.findByText("연결 문서: sheet-123")).toBeTruthy()
    expect(screen.getByText("동기화 대기 0건")).toBeTruthy()
  })

  it("keeps a retry action visible after a sync failure", async () => {
    // Given: Google failed while one local operation remains queued.
    const service: SyncSettingsService = {
      getSnapshot: vi.fn(async () =>
        snapshot({
          connected: true,
          spreadsheetId: "sheet-123",
          pendingCount: 1,
          failedCount: 1,
          status: "failed",
          lastError: "Google API 요청을 완료하지 못했습니다.",
        }),
      ),
      connectGoogle: vi.fn(async () => undefined),
      createTemplate: vi.fn(async () => undefined),
      connectExisting: vi.fn(async () => undefined),
      retry: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
    }
    render(<SettingsPage service={service} />)

    // When: the failed state is rendered.
    const retry = await screen.findByRole("button", { name: "동기화 다시 시도" })

    // Then: failure and local preservation are explicit, and retry is actionable.
    expect(screen.getByRole("alert").textContent).toContain(
      "Google API 요청을 완료하지 못했습니다.",
    )
    expect(screen.getByText("로컬 기록은 이 기기에 그대로 남아 있습니다.")).toBeTruthy()
    fireEvent.click(retry)
    await waitFor(() => expect(service.retry).toHaveBeenCalledOnce())
  })

  it("explains local backup, recovery, and reconnect boundaries", async () => {
    // Given: the settings page is available before Google is connected.
    const service: SyncSettingsService = {
      getSnapshot: vi.fn(async () => snapshot()),
      connectGoogle: vi.fn(async () => undefined),
      createTemplate: vi.fn(async () => undefined),
      connectExisting: vi.fn(async () => undefined),
      retry: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
    }
    render(<SettingsPage service={service} />)

    // When: the guidance finishes loading.
    await screen.findByRole("heading", { name: "로컬 백업과 복구" })

    // Then: destructive browser clearing and P0 restore limits are explicit.
    expect(
      screen.getByText(/브라우저 데이터를 지우면 이 기기의 로컬 장부도 삭제됩니다/),
    ).toBeTruthy()
    expect(screen.getByText(/Google Sheets에서 앱으로 자동 복구하지 않습니다/)).toBeTruthy()
    expect(screen.getByText(/연결을 해제해도 로컬 기록은 유지됩니다/)).toBeTruthy()
  })
})
