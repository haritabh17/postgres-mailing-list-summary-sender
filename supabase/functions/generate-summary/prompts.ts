import { getThreadContent } from './thread-content.ts'
import { countTokens, truncateToLastTokens } from './token-utils.ts'

export function createIndividualDiscussionPrompt(discussion: any, availableTags: string[]): string {
  let discussionText = `## Discussion: ${discussion.subject}\n`
  discussionText += `- Posts: ${discussion.post_count}\n`
  discussionText += `- Participants: ${discussion.participants}\n`
  discussionText += `- Duration: ${new Date(discussion.first_post_at).toLocaleDateString()} - ${new Date(discussion.last_post_at).toLocaleDateString()}\n`

  discussionText += `\n### Email Content:\n`

  let emailContent = ''
  if (discussion.full_content && discussion.full_content.length > 0) {
    discussion.full_content.forEach((post: any, postIndex: number) => {
      emailContent += `\n**Email ${postIndex + 1}** (${new Date(post.post_date).toLocaleString()}):\n`
      emailContent += `From: ${post.author_name || 'Unknown'}\n`
      emailContent += `Subject: ${post.subject}\n\n`
      emailContent += `Content: ${getThreadContent(post) || '[No content available]'}\n`
      emailContent += `---\n`
    })
  }

  const truncatedEmailContent = truncateToLastTokens(emailContent, 12000)
  discussionText += truncatedEmailContent

  return `Analyze this PostgreSQL mailing list discussion and create a detailed narrative summary:

${discussionText}

Please create a comprehensive summary in narrative paragraph form (NOT bullet points) that:
1. Explains the main technical topic or problem being discussed in a flowing narrative style
2. Includes specific technical details, code changes, algorithms, or implementation approaches mentioned
3. Mentions exact function names, data structures, performance metrics, or configuration changes discussed
4. Highlights specific technical decisions, trade-offs, or implementation choices made
5. Identifies any consensus reached or ongoing debates with technical reasoning
6. Includes any specific PostgreSQL internals, APIs, or system behavior discussed
7. Is written for PostgreSQL core developers who need technical depth
8. Write in a narrative style with complete sentences and paragraphs - avoid bullet points, numbered lists, or fragmented sentences
9. Do NOT include any references to mail threads, links, authors, or thread URLs - write only pure narrative text summarizing the technical discussion

Also provide:
- why_it_matters: one sentence explaining why PostgreSQL developers should care about this discussion
- status: classify as one of: proposal, patch_review, committed, debate, unknown
- key_people: up to 3 names of key participants mentioned in the discussion

## Available Tags

You may select up to 3 relevant tags from the following list. Only use tags from this list.

Available tags: ${availableTags.join(', ')}

Each summary level should be self-contained (not additive). The brief is a concise overview, the detailed adds more technical context, and the deep dive covers the full technical substance.`
}
