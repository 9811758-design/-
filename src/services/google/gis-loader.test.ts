import { describe, expect, it } from "vitest"

import { GoogleIdentityError } from "./gis-browser"
import { type GoogleIdentityHost, loadGoogleIdentityBoundary } from "./gis-loader"

function hostWithGoogle(document: Document): GoogleIdentityHost {
  return {
    document,
    google: {
      accounts: {
        oauth2: {
          initTokenClient: () => ({ requestAccessToken: () => undefined }),
          revoke: (_token: string, done: (response: unknown) => void) => done({ successful: true }),
        },
      },
    },
  }
}

describe("loadGoogleIdentityBoundary", () => {
  it("loads the official GIS script once and returns a callable boundary", async () => {
    // Given
    const appended: Node[] = []
    let google: unknown
    const host: GoogleIdentityHost = {
      document: {
        createElement: document.createElement.bind(document),
        getElementById: document.getElementById.bind(document),
        head: {
          append: (element) => {
            appended.push(element)
            google = hostWithGoogle(document).google
            element.dispatchEvent(new Event("load"))
          },
        },
      },
      get google() {
        return google
      },
    }

    // When
    const [first, second] = await Promise.all([
      loadGoogleIdentityBoundary(host),
      loadGoogleIdentityBoundary(host),
    ])

    // Then
    expect(appended).toHaveLength(1)
    expect(appended[0]).toMatchObject({
      id: "google-identity-services",
      src: "https://accounts.google.com/gsi/client",
    })
    expect(first).toBe(second)
    expect(first.initTokenClient).toBeTypeOf("function")
  })

  it("fails safely when the script loads without the GIS global", async () => {
    // Given
    const host: GoogleIdentityHost = {
      document: {
        createElement: document.createElement.bind(document),
        getElementById: () => null,
        head: { append: (element) => element.dispatchEvent(new Event("load")) },
      },
    }

    // When
    const load = loadGoogleIdentityBoundary(host)

    // Then
    await expect(load).rejects.toMatchObject({ category: "unavailable" })
    await expect(load).rejects.toBeInstanceOf(GoogleIdentityError)
  })

  it("fails safely when the script cannot load", async () => {
    // Given
    const host: GoogleIdentityHost = {
      document: {
        createElement: document.createElement.bind(document),
        getElementById: () => null,
        head: { append: (element) => element.dispatchEvent(new Event("error")) },
      },
    }

    // When
    const load = loadGoogleIdentityBoundary(host)

    // Then
    await expect(load).rejects.toMatchObject({ category: "unavailable" })
  })
})
