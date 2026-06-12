import type { TopDiscussion } from './types.ts'
import { getAllCommitfestTags, getCommitfestTagsForSubject } from './commitfest-tags.ts'
import { generateIndividualDiscussionSummary } from './openai-client.ts'
import { resolveDiscussionLinks } from './links.ts'
import { combineSummariesIntoWeekly } from './weekly-markdown.ts'

export async function generateAISummary(
  discussions: TopDiscussion[],
  stats: any,
  startDate: Date,
  endDate: Date,
  supabaseClient: any
): Promise<{ content: string; enrichedDiscussions: any[] }> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiApiKey) throw new Error('OpenAI API key not configured')

  const availableTags = await getAllCommitfestTags(supabaseClient)

  const results = await Promise.all(discussions.map(async (discussion) => {
    const [
      { summary_brief, summary_detailed, summary_deep, tags: aiTags, why_it_matters, status, key_people },
      { threadUrl, redirectSlug },
      commitfestTags,
    ] = await Promise.all([
      generateIndividualDiscussionSummary(discussion, openaiApiKey, availableTags),
      Promise.resolve(resolveDiscussionLinks(discussion)),
      getCommitfestTagsForSubject(discussion.subject, supabaseClient),
    ])

    return {
      subject: discussion.subject,
      summary: summary_brief,
      summary_brief,
      summary_detailed,
      summary_deep,
      why_it_matters,
      status,
      key_people,
      post_count: discussion.post_count,
      participants: discussion.participants,
      first_post_at: discussion.first_post_at,
      last_post_at: discussion.last_post_at,
      thread_url: threadUrl,
      redirect_slug: redirectSlug,
      commitfest_tags: commitfestTags,
      ai_tags: aiTags,
    }
  }))

  const finalSummary = combineSummariesIntoWeekly(results, stats, startDate, endDate)

  const enrichedDiscussions = results.map((s) => ({
    thread_id: discussions.find((d) => d.subject === s.subject)?.thread_id || s.subject,
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
    why_it_matters: s.why_it_matters,
    status: s.status,
    key_people: s.key_people,
  }))

  return { content: finalSummary, enrichedDiscussions }
}
