/** Same normalization as lists, grouping, and OpenCode directory headers */
export function normalizeSessionDirectory(dir: string | undefined): string {
  if (!dir || dir === 'Unknown') return ''
  return dir.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function folderDisplayName(normalizedDir: string): string {
  if (!normalizedDir) return 'Current workspace'
  const parts = normalizedDir.split('/').filter(Boolean)
  return parts[parts.length - 1] || normalizedDir
}

export function uniqueDirectoriesFromSessions(sessions: { directory?: string }[]): string[] {
  const set = new Set<string>()
  for (const s of sessions) {
    set.add(normalizeSessionDirectory(s.directory))
  }
  return [...set].sort((a, b) => folderDisplayName(a).localeCompare(folderDisplayName(b), 'en'))
}
