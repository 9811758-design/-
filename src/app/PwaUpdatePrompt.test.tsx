import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PwaUpdatePrompt } from "./PwaUpdatePrompt"

const promptState = vi.hoisted(() => ({
  needRefresh: true,
  offlineReady: false,
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  updateServiceWorker: vi.fn(async () => undefined),
}))

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [promptState.needRefresh, promptState.setNeedRefresh],
    offlineReady: [promptState.offlineReady, promptState.setOfflineReady],
    updateServiceWorker: promptState.updateServiceWorker,
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("PwaUpdatePrompt", () => {
  it("asks before activating a new service worker", async () => {
    // Given: a new application shell has finished downloading.
    render(<PwaUpdatePrompt />)

    // When: the owner accepts the visible update prompt.
    fireEvent.click(screen.getByRole("button", { name: "지금 업데이트" }))

    // Then: the waiting service worker is activated with a page reload.
    await waitFor(() => expect(promptState.updateServiceWorker).toHaveBeenCalledWith(true))
  })

  it("allows the owner to postpone an update without reloading", () => {
    // Given: the update prompt is visible.
    render(<PwaUpdatePrompt />)

    // When: the owner postpones it.
    fireEvent.click(screen.getByRole("button", { name: "나중에" }))

    // Then: only the prompt state closes.
    expect(promptState.setNeedRefresh).toHaveBeenCalledWith(false)
    expect(promptState.updateServiceWorker).not.toHaveBeenCalled()
  })
})
