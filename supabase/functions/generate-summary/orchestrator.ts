import type { TopDiscussion } from './types.ts'
import { getAllCommitfestTags, getCommitfestTagsForSubject } from './commitfest-tags.ts'
import { generateIndividualDiscussionSummary } from './openai-client.ts'
import { resolveDiscussionLinks } from './links.ts'
import { combineSummariesIntoWeekly } from './weekly-markdown.ts'

export async function generateAISummary(discussions: TopDiscussion[], stats: any, startDate: Date, endDate: Date, supabaseClient: any): Promise<{content: string, enrichedDiscussions: any[]}> {
  console.log(`🤖 INFO: generateAISummary called with:`)
  console.log(`  Discussions count: ${discussions.length}`)
  console.log(`  Stats:`, stats)

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

  console.log(`🔑 INFO: OpenAI API key configured: ${openaiApiKey ? 'YES' : 'NO'}`)

  if (!openaiApiKey) {
    console.log('❌ ERROR: OpenAI API key not configured')
    throw new Error('OpenAI API key not configured')
  }

  try {
    // Fetch all available tags once at the start
    console.log(`🏷️  INFO: Fetching all available commitfest tags...`)
    const availableTags = await getAllCommitfestTags(supabaseClient)
    console.log(`🏷️  INFO: Found ${availableTags.length} available tags for AI selection`)

    console.log(`🔄 INFO: Generating individual summaries for each discussion...`)

    // Generate individual summaries for each discussion
    const individualSummaries: any[] = []

    // Process all discussions in parallel for speed (avoid edge function timeout)
    console.log(`🚀 INFO: Processing all ${discussions.length} discussions in parallel...`)

    const results = await Promise.all(discussions.map(async (discussion, i) => {
      console.log(`📝 INFO: Starting discussion ${i + 1}/${discussions.length}: "${discussion.subject}"`)

      const [{summary_brief, summary_detailed, summary_deep, tags: aiTags}, { threadUrl, redirectSlug }, commitfestTags] = await Promise.all([
        generateIndividualDiscussionSummary(discussion, openaiApiKey, availableTags),
        Promise.resolve(resolveDiscussionLinks(discussion)),
        getCommitfestTagsForSubject(discussion.subject, supabaseClient)
      ])

      if (commitfestTags.length > 0) {
        console.log(`🏷️  INFO: Found ${commitfestTags.length} commitfest tags for "${discussion.subject}"`)
      }
      if (aiTags.length > 0) {
        console.log(`🤖 INFO: AI generated ${aiTags.length} tags: ${aiTags.join(', ')}`)
      }
      console.log(`✅ INFO: Summary generated for discussion ${i + 1} (${summary_brief.length} chars brief, ${summary_detailed.length} chars detailed, ${summary_deep.length} chars deep)`)

      return {
        subject: discussion.subject,
        summary: summary_brief,
        summary_brief,
        summary_detailed,
        summary_deep,
        post_count: discussion.post_count,
        participants: discussion.participants,
        first_post_at: discussion.first_post_at,
        last_post_at: discussion.last_post_at,
        thread_url: threadUrl,
        redirect_slug: redirectSlug,
        commitfest_tags: commitfestTags,
        ai_tags: aiTags
      }
    }))

    individualSummaries.push(...results)

    console.log(`✅ INFO: Generated ${individualSummaries.length} individual summaries`)

    // Now combine all individual summaries into a final weekly summary
    console.log(`🔄 INFO: Combining individual summaries into final weekly summary...`)
    const finalSummary = combineSummariesIntoWeekly(individualSummaries, stats, startDate, endDate)

    // Build enriched discussions for top_discussions JSON (includes multi-level summaries)
    const enrichedDiscussions = individualSummaries.map(s => ({
      thread_id: discussions.find(d => d.subject === s.subject)?.thread_id || s.subject,
      subject: s.subject,
      post_count: s.post_count,
      participants: s.participants,
      first_post_at: s.first_post_at,
      last_post_at: s.last_post_at,
      thread_url: s.thread_url,
      redirect_slug: s.redirect_slug,
      commitfest_tags: s.commitfest_tags,
      ai_tags: s.ai_tags,
      summary_brief: s.summary_brief,
      summary_detailed: s.summary_detailed,
      summary_deep: s.summary_deep,
    }))

    console.log(`✅ INFO: Final weekly summary generated (${finalSummary.length} chars)`)
    return { content: finalSummary, enrichedDiscussions }

  } catch (error) {
    console.log('❌ ERROR: Failed to generate AI summary:', error)
    throw error
  }
}
