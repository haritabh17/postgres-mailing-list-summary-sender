import { normalizeSubject } from '../_shared/subject.ts'
import type { CommitfestTag } from './types.ts'

export async function getAllCommitfestTags(supabaseClient: any): Promise<string[]> {
  try {
    const { data: tags, error } = await supabaseClient
      .rpc('get_all_commitfest_tags')

    if (error) {
      console.log(`⚠️  WARN: Error fetching all commitfest tags: ${error.message}`)
      return []
    }

    if (tags && Array.isArray(tags)) {
      return tags.filter((tag: string) => tag && tag.trim().length > 0)
    }

    return []
  } catch (error) {
    console.log(`⚠️  WARN: Exception fetching all commitfest tags:`, error)
    return []
  }
}

export async function getCommitfestTagsForSubject(subject: string, supabaseClient: any): Promise<CommitfestTag[]> {
  try {
    // Normalize the subject for matching
    const normalizedSubject = normalizeSubject(subject)

    if (!normalizedSubject) {
      return []
    }

    // Use RPC function to get tags with colors (more reliable than direct queries across schemas)
    const { data: tagsJson, error } = await supabaseClient
      .rpc('get_commitfest_tags_with_colors_for_subject', {
        p_subject_normalized: normalizedSubject
      })

    if (error) {
      console.log(`⚠️  WARN: Error fetching commitfest tags for subject "${subject}":`, error.message)
      return []
    }

    // Parse JSONB response and return as array of tag objects
    if (tagsJson && Array.isArray(tagsJson)) {
      return tagsJson
        .filter((tag: any) => tag && tag.name && tag.name.trim().length > 0)
        .sort((a: CommitfestTag, b: CommitfestTag) => a.name.localeCompare(b.name))
        .map((tag: any) => ({
          name: tag.name,
          color: tag.color || null
        }))
    }

    return []
  } catch (error) {
    console.log(`⚠️  WARN: Exception fetching commitfest tags for subject "${subject}":`, error)
    return []
  }
}
