import { z } from "zod"

import {
  type GoogleIdentityBoundary,
  GoogleIdentityBrowser,
  GoogleIdentityError,
  type GoogleTokenClientConfig,
} from "./gis-browser"

type ScriptDocument = {
  readonly head: { append(node: Node): void }
  createElement(tagName: "script"): HTMLScriptElement
  getElementById(id: string): HTMLElement | null
}

export type GoogleIdentityHost = {
  readonly document: ScriptDocument
  readonly google?: unknown
}

const TokenClientSchema = z.object({
  requestAccessToken: z.function({ input: [], output: z.void() }),
})
const TokenClientConfigSchema = z.object({
  client_id: z.string(),
  scope: z.string(),
  callback: z.function({ input: [z.unknown()], output: z.void() }),
  error_callback: z.function({ input: [z.unknown()], output: z.void() }),
})
const OAuthBoundarySchema = z.object({
  accounts: z.object({
    oauth2: z.object({
      initTokenClient: z.function({
        input: [TokenClientConfigSchema],
        output: TokenClientSchema,
      }),
      revoke: z.function({
        input: [z.string(), z.function({ input: [z.unknown()], output: z.void() })],
        output: z.void(),
      }),
    }),
  }),
})

const SCRIPT_ID = "google-identity-services"
const SCRIPT_URL = "https://accounts.google.com/gsi/client"
const pendingLoads = new WeakMap<GoogleIdentityHost, Promise<GoogleIdentityBoundary>>()

export function loadGoogleIdentityBoundary(
  host: GoogleIdentityHost = defaultGoogleIdentityHost(),
): Promise<GoogleIdentityBoundary> {
  const loaded = parseBoundary(host.google)
  if (loaded !== null) return Promise.resolve(loaded)

  const pending = pendingLoads.get(host)
  if (pending !== undefined) return pending

  const load = new Promise<GoogleIdentityBoundary>((resolve, reject) => {
    queueMicrotask(() => {
      const script =
        host.document.getElementById(SCRIPT_ID) ?? host.document.createElement("script")
      const onLoad = () => {
        const boundary = parseBoundary(host.google)
        if (boundary === null) {
          reject(new GoogleIdentityError("unavailable"))
          return
        }
        resolve(boundary)
      }
      const onError = () => reject(new GoogleIdentityError("unavailable"))
      script.addEventListener("load", onLoad, { once: true })
      script.addEventListener("error", onError, { once: true })

      if (script.id !== SCRIPT_ID) {
        script.id = SCRIPT_ID
        script.setAttribute("src", SCRIPT_URL)
        script.setAttribute("async", "")
        script.setAttribute("defer", "")
        host.document.head.append(script)
      }
    })
  })
  pendingLoads.set(host, load)
  return load
}

export async function loadGoogleIdentityBrowser(
  clientId: string,
  host: GoogleIdentityHost = defaultGoogleIdentityHost(),
): Promise<GoogleIdentityBrowser> {
  return new GoogleIdentityBrowser(clientId, await loadGoogleIdentityBoundary(host))
}

export function createGoogleIdentityBoundary(rawGoogle: unknown): GoogleIdentityBoundary {
  const parsed = OAuthBoundarySchema.safeParse(rawGoogle)
  if (!parsed.success) throw new GoogleIdentityError("unavailable")
  const oauth2 = parsed.data.accounts.oauth2
  return {
    initTokenClient: (config: GoogleTokenClientConfig) => oauth2.initTokenClient(config),
    revoke: (token, done) => oauth2.revoke(token, done),
  }
}

function parseBoundary(rawGoogle: unknown): GoogleIdentityBoundary | null {
  try {
    return createGoogleIdentityBoundary(rawGoogle)
  } catch (error) {
    if (error instanceof GoogleIdentityError) return null
    throw error
  }
}

function defaultGoogleIdentityHost(): GoogleIdentityHost {
  if (typeof window === "undefined") throw new GoogleIdentityError("unavailable")
  return {
    document: window.document,
    get google(): unknown {
      return Reflect.get(window, "google")
    },
  }
}
