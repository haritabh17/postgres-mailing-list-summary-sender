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


export function createSummaryPrompt(discussions: any[], stats: any): string {
  console.log(`📝 INFO: Creating detailed prompt with ${discussions.length} discussions and full email content`)

  // Create detailed discussions text with reference links and full content
  const discussionsWithLinks = discussions.map((disc, index) => {
    let discussionText = `\n## Discussion ${index + 1}: ${disc.subject}\n`
    discussionText += `- Posts: ${disc.post_count}\n`
    discussionText += `- Participants: ${disc.participants}\n`
    discussionText += `- Duration: ${new Date(disc.first_post_at).toLocaleDateString()} - ${new Date(disc.last_post_at).toLocaleDateString()}\n`

    // Do not include reference links in the prompt - we want pure narrative summaries

    // Add full email content for each post in this discussion
    if (disc.full_content && disc.full_content.length > 0) {
      discussionText += `### Email Content:\n`
      disc.full_content.forEach((post: any, postIndex: number) => {
        discussionText += `\n**Email ${postIndex + 1}** (${new Date(post.post_date).toLocaleString()}):\n`
        discussionText += `From: ${post.author_name || 'Unknown'}\n`
        discussionText += `Subject: ${post.subject}\n\n`

        // Content is stored in mail_thread_contents table (joined relation)
        discussionText += `Content: ${getThreadContent(post) || '[No content available]'}\n`
        discussionText += `---\n`
      })
    }

    return discussionText
  }).join('\n')

  console.log(`📝 INFO: Detailed discussions text with links created (${discussionsWithLinks.length} chars)`)

  const prompt = `Create a comprehensive weekly summary for the PostgreSQL hackers mailing list based on the following detailed email discussions from the last 7 days:

${discussionsWithLinks}

Weekly Statistics:
- Total posts: ${stats.total_posts}
- Total participants: ${stats.total_participants}
- Total subscribers: ${stats.total_subscribers}
- Date range: ${stats.date_range?.start || 'Unknown'} to ${stats.date_range?.end || 'Unknown'}

Please analyze the full email content above and create a comprehensive narrative summary that:
1. Highlights the most important technical discussions and their key points in a flowing narrative style
2. Explains the significance of each discussion based on the actual email content
3. Mentions key decisions, proposals, or consensus reached
4. Identifies any controversial topics or ongoing debates
5. Summarizes technical solutions or approaches discussed
6. Is written in a professional but accessible narrative tone for PostgreSQL developers
7. Is approximately 800-1200 words given the rich content available
8. DO NOT include any conclusion, summary, or "next steps" section - end with the last discussion
9. Write in narrative paragraph form with smooth transitions - avoid bullet points, numbered lists, or fragmented sentences
10. Do NOT include any references to mail threads, links, authors, thread URLs, or source material - write only pure narrative text summarizing the technical discussions

Format the summary with clear headings and narrative paragraphs. Write in a flowing narrative style that reads like a technical article, connecting ideas with smooth transitions. Focus on the technical substance of the discussions in paragraph form rather than listing topics. The summary should be pure narrative text without any references to the source material, links, or authors.`

  console.log(`📝 INFO: Final detailed prompt created (${prompt})`)
  console.log(`📝 INFO: Sending this COMPLETE prompt to AI:`)
  console.log(`=== FULL PROMPT START ===`)
  console.log(prompt)
  console.log(`=== FULL PROMPT END ===`)

  return prompt
}
