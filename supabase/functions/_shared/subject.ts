// Normalize a mailing-list subject for matching across sources:
// lowercase, trim whitespace, strip Re:/Fwd: prefixes, collapse whitespace.
// Used to match commitfest-scraped subjects against pgsql-hackers archive
// subjects and against weekly summary subjects.
export function normalizeSubject(subject: string): string {
  let normalized = subject.toLowerCase()
  normalized = normalized.trim()
  normalized = normalized.replace(/^(re|fwd):\s*/i, '')
  normalized = normalized.replace(/\s+/g, ' ')
  return normalized.trim()
}
