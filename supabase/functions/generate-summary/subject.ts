export function normalizeSubject(subject: string): string {
  // Lowercase
  let normalized = subject.toLowerCase()

  // Trim whitespace
  normalized = normalized.trim()

  // Remove "Re:", "Fwd:", "RE:", "FWD:" prefixes
  normalized = normalized.replace(/^(re|fwd):\s*/i, '')

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ')

  return normalized.trim()
}
