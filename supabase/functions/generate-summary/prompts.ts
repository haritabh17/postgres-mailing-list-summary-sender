import { getThreadContent } from './thread-content.ts'
import { countTokens, truncateToLastTokens } from './token-utils.ts'

export function createIndividualDiscussionPrompt(discussion: any, availableTags: string[]): string {
  console.log(`📝 INFO: Creating individual discussion prompt for: "${discussion.subject}"`)

  let discussionText = `## Discussion: ${discussion.subject}\n`
  discussionText += `- Posts: ${discussion.post_count}\n`
  discussionText += `- Participants: ${discussion.participants}\n`
  discussionText += `- Duration: ${new Date(discussion.first_post_at).toLocaleDateString()} - ${new Date(discussion.last_post_at).toLocaleDateString()}\n`

  // Do not include reference links in the prompt - we want pure narrative summaries

  discussionText += `\n### Email Content:\n`

  // Build email content first
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

  // Truncate email content to keep last ~12000 tokens (leaving room for system message, headers, and prompt)
  const truncatedEmailContent = truncateToLastTokens(emailContent, 12000)
  discussionText += truncatedEmailContent

  const prompt = `Analyze this PostgreSQL mailing list discussion and create a detailed narrative summary:

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

Focus on the technical substance, specific implementation details, and exact technical decisions. Write in a flowing narrative style that reads like a technical article, not a list. Avoid high-level descriptions - include concrete technical information that would be valuable to PostgreSQL developers working on the codebase. The summary should be pure narrative text without any references to the source material.

## Available Tags

You may select up to 3 relevant tags from the following list to categorize this discussion. Only use tags from this list - do not invent new tags. If no tags are relevant, use an empty array.

Available tags: ${availableTags.join(', ')}

Return your response as a JSON object with this exact structure:
{
  "summary_brief": "[~200 word narrative summary]",
  "summary_detailed": "[~400 word narrative summary with more technical depth]",
  "summary_deep": "[~800 word deep dive with full technical details, code paths, and design decisions]",
  "tags": ["tag1", "tag2", "tag3"]
}

Each summary level should be self-contained (not additive). The brief is a concise overview, the detailed adds more technical context, and the deep dive covers the full technical substance.
The tags array should contain 0-3 tags from the available tags list above. Select only the most relevant tags that best categorize this discussion.`

  const finalTokenCount = countTokens(prompt)
  console.log(`📊 INFO: Final prompt contains ${finalTokenCount} tokens`)

  return prompt
}
