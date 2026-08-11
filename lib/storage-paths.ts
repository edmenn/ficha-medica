// Server-only helpers to validate and scope Storage object paths.
// These enforce that a path belongs to a given effective user and cannot
// contain traversal, absolute paths, or unexpected segments.

export function isValidImagePath(path: string | null | undefined, userId: string): boolean {
  if (!path) return false

  // Must be a plain string, no null bytes.
  if (typeof path !== 'string' || path.length === 0 || path.includes('\0')) return false

  // Reject absolute paths and URI forms.
  if (path.startsWith('/')) return false
  if (/^[a-z]+:\/\//i.test(path)) return false
  if (path.includes('://')) return false

  // Reject traversal and backslashes.
  if (path.includes('..')) return false
  if (path.includes('\\')) return false

  // Must start with the exact user prefix `<userId>/`.
  if (!path.startsWith(`${userId}/`)) return false

  // Remaining segments must be non-empty, simple tokens (no weird chars).
  const rest = path.slice(userId.length + 1)
  if (!rest) return false
  const segments = rest.split('/')
  for (const segment of segments) {
    if (!segment) return false
    if (!/^[A-Za-z0-9._-]+$/.test(segment)) return false
  }

  return true
}

export function filterValidImagePaths(paths: (string | null | undefined)[], userId: string): string[] {
  return (paths ?? []).filter(path => isValidImagePath(path, userId)) as string[]
}
