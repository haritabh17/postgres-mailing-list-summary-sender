// Restore backslashes for psql meta-commands that the LLM drops from its JSON output.
// The model often writes "dRp+" instead of "\dRp+" — we cross-reference with the thread
// subject (which always has the correct form) and fix the summary text.
export function restoreBackslashCommands(text: string, subject: string): string {
  // Extract psql meta-commands like \dRp+, \dRs+, \dt from the subject
  const metaCmds = (subject.match(/\\d\w*\+?/g) || [])
  if (metaCmds.length === 0) return text

  for (const cmd of metaCmds) {
    const afterD = cmd.slice(2) // e.g. "Rp+" from "\dRp+"
    if (!afterD) continue
    const withoutBackslash = cmd.slice(1) // e.g. "dRp+"

    // Replace any backtick-wrapped variation with the correct form:
    // Handles: `Rp+`, `dRp+`, `\bRp+`, `\dRp+` (with corrupted escapes), etc.
    // Use a pattern that matches backtick + optional garbage prefix + the suffix + backtick
    const escapedAfterD = escapeRegex(afterD)
    const escapedWithoutBackslash = escapeRegex(withoutBackslash)

    // Match: `<any-single-char-or-nothing>Rp+` or `dRp+` inside backticks
    text = text.replace(new RegExp('`[^`]{0,2}' + escapedAfterD + '`', 'g'), '`' + cmd + '`')

    // Also match standalone (not in backticks) references like "the dRp+ command"
    text = text.replace(new RegExp('(?<=\\s|^)' + escapedWithoutBackslash + '(?=\\s|[,.]|$)', 'g'), cmd)
  }

  // Fix empty backticks `` that result from \d being completely stripped
  text = text.replace(/``/g, '')

  return text
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
