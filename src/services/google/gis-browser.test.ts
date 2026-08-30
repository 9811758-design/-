import { describe, expect, it } from "vitest"

import {
  type GoogleIdentityBoundary,
  GoogleIdentityBrowser,
  GoogleIdentityError,
} from "./gis-browser"

describe("GoogleIdentityBrowser", () => {
  it("requests an access token and keeps it only in memory", async () => {
    // Given
    const boundary: GoogleIdentityBoundary = {
      initTokenClient: (config) => ({
        requestAccessToken: () => config.callback({ access_token: "memory-token" }),
      }),
      revoke: (_token, done) => done({ successful: true }),
    }
    const identity = new GoogleIdentityBrowser("client-id.apps.googleusercontent.com", boundary)

    // When
    const token = await identity.requestAccessToken()

    // Then
    expect(token).toBe("memory-token")
    expect(identity.getAccessToken()).toBe("memory-token")
    expect(JSON.stringify(identity)).not.toContain("memory-token")
  })

  it("revokes the in-memory token and clears it", async () => {
    // Given
    let revokedToken = ""
    const boundary: GoogleIdentityBoundary = {
      initTokenClient: (config) => ({
        requestAccessToken: () => config.callback({ access_token: "memory-token" }),
      }),
      revoke: (token, done) => {
        revokedToken = token
        done({ successful: true })
      },
    }
    const identity = new GoogleIdentityBrowser("client-id.apps.googleusercontent.com", boundary)
    await identity.requestAccessToken()

    // When
    await identity.revoke()

    // Then
    expect(revokedToken).toBe("memory-token")
    expect(identity.getAccessToken()).toBeNull()
  })

  it("returns a typed safe error when GIS denies the request", async () => {
    // Given
    const secret = "secret-from-provider"
    const boundary: GoogleIdentityBoundary = {
      initTokenClient: (config) => ({
        requestAccessToken: () => config.callback({ error: secret }),
      }),
      revoke: (_token, done) => done({ successful: true }),
    }
    const identity = new GoogleIdentityBrowser("client-id.apps.googleusercontent.com", boundary)

    // When
    const request = identity.requestAccessToken()

    // Then
    await expect(request).rejects.toBeInstanceOf(GoogleIdentityError)
    await expect(request).rejects.not.toThrow(secret)
  })
})
