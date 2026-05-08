/**
 * Harness preamble injected before each outbound user message to OpenCode.
 *
 * Notes:
 * - OpenCode system prompts remain server-side — `POST /session/:id/message` usually only carries user parts,
 *   so this UI cannot override system directly.
 * - We approximate the same effect via a user-message prefix; stored transcripts include the full string while
 *   `stripHarnessGuidanceForDisplay` shows only the user-authored portion in the chat column.
 *
 * Toggle with `HARNESS_GUIDANCE_ENABLED` or edit the strings below.
 */

/** When false, send the composer text exactly as typed (no preamble). */
export const HARNESS_GUIDANCE_ENABLED = true

/**
 * Preamble prepended to every user turn (edit freely).
 * Keep a plan-then-execute shape so subtask / todo visualizations stay meaningful.
 */
export const HARNESS_USER_GUIDANCE = `[Plan-first] Before answering the user, outline a concise plan, use the todowrite tool to maintain todos, then execute. If todos already exist with in-progress or partially completed work, never wipe them—preserve completed entries verbatim and adjust only unfinished work according to the plan.`

/** Separator between preamble and authentic user content — send + display parsers must agree. */
export const HARNESS_USER_INPUT_MARKER = '\n\n---\nUser input\n'

export function buildUserMessageWithGuidance(rawUserText: string): string {
  const t = rawUserText.trimEnd()
  if (!HARNESS_GUIDANCE_ENABLED) return rawUserText
  return `${HARNESS_USER_GUIDANCE}${HARNESS_USER_INPUT_MARKER}${t}`
}

/** Legacy harness markers (literal Chinese) — retained so older transcripts still strip correctly. */
const LEGACY_USER_INPUT_MARKER = '\n\n---\n【用户输入】\n'
const LEGACY_USER_INPUT_MARKER_TIGHT = '\n---\n【用户输入】\n'

/**
 * Recover the user's visible text from persisted rows — call this everywhere user bubbles render or copy text.
 *
 * Order: strip the active `HARNESS_USER_GUIDANCE + HARNESS_USER_INPUT_MARKER` prefix; else look for `---` +
 * `User input` / legacy `【用户输入】` markers (handles older Chinese harness text).
 */
export function stripHarnessGuidanceForDisplay(storedText: string): string {
  if (!storedText) return storedText
  const normalized = storedText.replace(/\r\n/g, '\n')

  if (HARNESS_GUIDANCE_ENABLED) {
    const exactPrefix = `${HARNESS_USER_GUIDANCE}${HARNESS_USER_INPUT_MARKER}`
    if (normalized.startsWith(exactPrefix)) {
      return normalized.slice(exactPrefix.length).trimStart()
    }
  }

  const markerNeedles = [
    `${HARNESS_USER_INPUT_MARKER}`,
    '\n---\nUser input\n',
    LEGACY_USER_INPUT_MARKER,
    LEGACY_USER_INPUT_MARKER_TIGHT,
  ]
  for (const m of markerNeedles) {
    const idx = normalized.indexOf(m)
    if (idx >= 0) return normalized.slice(idx + m.length).trimStart()
  }

  const relaxed = /\n---\s*\n(?:User input|【用户输入】)\s*\n/
  const match = normalized.match(relaxed)
  if (match?.index !== undefined) {
    return normalized.slice(match.index + match[0].length).trimStart()
  }

  return storedText
}
