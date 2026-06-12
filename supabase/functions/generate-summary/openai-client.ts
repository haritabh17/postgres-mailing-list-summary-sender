import { createIndividualDiscussionPrompt } from './prompts.ts'
import { restoreBackslashCommands } from './backslash-fix.ts'

const DISCUSSION_SCHEMA = {
  type: 'object',
  properties: {
    summary_brief: { type: 'string', description: '~200 word narrative summary' },
    summary_detailed: { type: 'string', description: '~400 word narrative summary with more technical depth' },
    summary_deep: { type: 'string', description: '~800 word deep dive with full technical details' },
    tags: { type: 'array', items: { type: 'string' }, description: '0-3 tags from the provided list' },
    why_it_matters: { type: 'string', description: 'One sentence explaining why this discussion matters to PostgreSQL developers' },
    status: {
      type: 'string',
      enum: ['proposal', 'patch_review', 'committed', 'debate', 'unknown'],
      description: 'Current status of the discussion',
    },
    key_people: {
      type: 'array',
      items: { type: 'string' },
      description: 'Up to 3 key participants mentioned in the discussion',
    },
  },
  required: ['summary_brief', 'summary_detailed', 'summary_deep', 'tags', 'why_it_matters', 'status', 'key_people'],
  additionalProperties: false,
}

export async function generateIndividualDiscussionSummary(
  discussion: any,
  openaiApiKey: string,
  availableTags: string[]
): Promise<{
  summary_brief: string
  summary_detailed: string
  summary_deep: string
  tags: string[]
  why_it_matters: string
  status: string
  key_people: string[]
}> {
  const prompt = createIndividualDiscussionPrompt(discussion, availableTags)

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

          IMPORTANT: Use markdown inline code formatting (backticks) around all code identifiers.
          CRITICAL: Preserve all backslash characters in identifiers (e.g. \\dRp+, \\dt).

          Also provide:
          - why_it_matters: one sentence on why developers should care
          - status: one of proposal, patch_review, committed, debate, unknown
          - key_people: up to 3 names of key participants mentioned`,
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4000,
    temperature: 0.7,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'discussion_summary',
        strict: true,
        schema: DISCUSSION_SCHEMA,
      },
    },
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  const responseContent = data.choices[0].message.content

  try {
    const parsed = JSON.parse(responseContent)
    const summary_brief = parsed.summary_brief || ''
    const summary_detailed = parsed.summary_detailed || summary_brief
    const summary_deep = parsed.summary_deep || summary_detailed
    const why_it_matters = parsed.why_it_matters || ''
    const status = parsed.status || 'unknown'
    let key_people: string[] = Array.isArray(parsed.key_people) ? parsed.key_people.slice(0, 3) : []

    let tags: string[] = []
    if (Array.isArray(parsed.tags)) {
      tags = parsed.tags
        .filter((tag: unknown) => typeof tag === 'string' && availableTags.includes(tag))
        .slice(0, 3)
    }

    const restored = [summary_brief, summary_detailed, summary_deep].map(
      (text: string) => restoreBackslashCommands(text, discussion.subject)
    )

    return {
      summary_brief: restored[0],
      summary_detailed: restored[1],
      summary_deep: restored[2],
      tags,
      why_it_matters,
      status,
      key_people,
    }
  } catch (parseError) {
    console.log(`⚠️ WARN: Failed to parse JSON response: ${parseError}`)
    return {
      summary_brief: responseContent,
      summary_detailed: responseContent,
      summary_deep: responseContent,
      tags: [],
      why_it_matters: '',
      status: 'unknown',
      key_people: [],
    }
  }
}
