import { createIndividualDiscussionPrompt } from './prompts.ts'
import { restoreBackslashCommands } from './backslash-fix.ts'

export async function generateIndividualDiscussionSummary(discussion: any, openaiApiKey: string, availableTags: string[]): Promise<{summary_brief: string, summary_detailed: string, summary_deep: string, tags: string[]}> {
  console.log(`📝 INFO: Generating multi-level summaries for: "${discussion.subject}"`)

  const prompt = createIndividualDiscussionPrompt(discussion, availableTags)
  console.log(`📝 INFO: Individual prompt created (${prompt.length} characters)`)

  const requestBody = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert PostgreSQL core developer who creates detailed narrative summaries
          of individual mailing list discussions. Write comprehensive summaries in a flowing narrative
          style (not bullet points) that include specific technical details, exact function names,
          data structures, algorithms, performance metrics, and implementation approaches discussed.
          Focus on concrete technical decisions, code changes, and PostgreSQL internals mentioned.
          Avoid high-level descriptions - include specific technical information that would be
          valuable to PostgreSQL developers working on the codebase. Write in paragraph form with
          smooth transitions between ideas.

          IMPORTANT: Use markdown inline code formatting (backticks) around all code identifiers in your summaries. This includes function names, variable names, constants, macros, struct names, SQL commands, GUC parameters, file names, and any code-related terms.

          CRITICAL: Preserve all backslash characters in identifiers. PostgreSQL uses backslash-prefixed meta-commands like \\dRp+, \\dRs+, \\dt, \\d, etc. You MUST include the backslash. In your JSON output, use double backslashes (e.g. "\\\\dRp+" in the JSON string) so they are preserved after parsing.

          You must return your response as a valid JSON object with the following structure:
          {
            "summary_brief": "[~200 word narrative summary]",
            "summary_detailed": "[~400 word narrative summary with more technical depth]",
            "summary_deep": "[~800 word deep dive narrative summary with full technical details]",
            "tags": ["tag1", "tag2", "tag3"]
          }

          Each summary level should be self-contained (not additive). The brief is a concise overview,
          the detailed adds more technical context and nuance, and the deep dive covers the full
          technical substance including specific implementation details, code paths, and design decisions.

          The tags array must contain 0-3 tags selected from the available tags list provided in the prompt.
          Use only tags from the provided list - do not invent new tags. If no tags are relevant, use an empty array.`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 4000,
    temperature: 0.7,
    response_format: { type: "json_object" }
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.log(`❌ INFO: OpenAI API error for individual summary: ${errorText}`)
    throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  const responseContent = data.choices[0].message.content

  try {
    // Parse JSON response
    const parsed = JSON.parse(responseContent)
    const summary_brief = parsed.summary_brief || parsed.summary || responseContent
    const summary_detailed = parsed.summary_detailed || summary_brief
    const summary_deep = parsed.summary_deep || summary_detailed
    let tags = parsed.tags || []

    // Validate tags against available tags list
    if (Array.isArray(tags)) {
      const validTags = tags
        .filter((tag: any) => typeof tag === 'string' && availableTags.includes(tag))
        .slice(0, 3)

      const invalidTags = tags.filter((tag: any) => typeof tag === 'string' && !availableTags.includes(tag))
      if (invalidTags.length > 0) {
        console.log(`⚠️  WARN: Invalid tags filtered out: ${invalidTags.join(', ')}`)
      }

      if (tags.length > 3) {
        console.log(`⚠️  WARN: More than 3 tags provided, using first 3: ${validTags.join(', ')}`)
      }

      tags = validTags
    } else {
      console.log(`⚠️  WARN: Tags field is not an array, using empty array`)
      tags = []
    }

    // Post-process: restore backslashes for psql meta-commands that the model drops.
    // Cross-reference with the discussion subject which has the correct \d prefixes.
    const restored = [summary_brief, summary_detailed, summary_deep].map(
      text => restoreBackslashCommands(text, discussion.subject)
    )

    return { summary_brief: restored[0], summary_detailed: restored[1], summary_deep: restored[2], tags }
  } catch (parseError) {
    console.log(`⚠️  WARN: Failed to parse JSON response, using entire response as summary: ${parseError}`)
    return { summary_brief: responseContent, summary_detailed: responseContent, summary_deep: responseContent, tags: [] }
  }
}
