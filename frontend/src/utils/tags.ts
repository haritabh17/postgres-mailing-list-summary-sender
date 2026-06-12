import type { CommitfestTag } from '../lib/types'

/**
 * AI tags often repeat the commitfest tag names ("Logical Replication",
 * "Bugfix", "CI"...). Drop AI tags that duplicate a commitfest tag or
 * each other, case-insensitively.
 */
export function dedupeAiTags(
  commitfestTags: CommitfestTag[] | undefined,
  aiTags: string[] | undefined
): string[] {
  const seen = new Set((commitfestTags || []).map((t) => t.name.trim().toLowerCase()))
  const result: string[] = []
  for (const tag of aiTags || []) {
    const key = tag.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  return result
}
