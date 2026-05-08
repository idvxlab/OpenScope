/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override OpenCode HTTP base, e.g. http://127.0.0.1:61830 */
  readonly VITE_OPENCODE_BASE?: string
  /** Mirrors `OPENCODE_SERVER_PASSWORD` from `opencode serve` for HTTP Basic auth */
  readonly VITE_OPENCODE_SERVER_PASSWORD?: string
  /** Optional; defaults to `opencode` (maps to `OPENCODE_SERVER_USERNAME`) */
  readonly VITE_OPENCODE_SERVER_USERNAME?: string
  /** `provider/model` shorthand; outbound requests expand to `{ providerID, modelID }` objects */
  readonly VITE_OPENCODE_DEFAULT_MODEL?: string
  /** Optional `agent` string appended alongside the payload when the server expects it */
  readonly VITE_OPENCODE_DEFAULT_AGENT?: string
}
