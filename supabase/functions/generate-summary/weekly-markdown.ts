import { SHORT_LINK_DOMAIN } from './constants.ts'
import { escapeHtmlTagsInText } from './html-safety.ts'

export function combineSummariesIntoWeekly(individualSummaries: any[], stats: any, weekStartDate: Date, weekEndDate: Date): string {
  console.log(`📝 INFO: Combining ${individualSummaries.length} individual summaries into weekly summary`)

  // Format the date with ordinal suffix (1st, 2nd, 3rd, etc.)
  const formatDateWithOrdinal = (date: Date): string => {
    const day = date.getDate()
    const ordinal = (day: number) => {
      const s = ["th", "st", "nd", "rd"]
      const v = day % 100
      return day + (s[(v - 20) % 10] || s[v] || s[0])
    }
    return `${ordinal(day)} ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
  }

  // Use week end date (Sunday) from the database
  let weeklySummary = `# PostgreSQL Weekly Summary - Week of ${formatDateWithOrdinal(weekEndDate)}

## Overview
This week saw ${stats.total_posts} posts from ${stats.total_participants} participants in the PostgreSQL mailing list, covering a range of important topics and technical discussions.

## Top Discussions

`

  // Add each individual summary as a section
  individualSummaries.forEach((summary, index) => {
    weeklySummary += `### ${index + 1}. ${summary.subject}

**Posts**: ${summary.post_count}
**Participants**: ${summary.participants}
**Duration**: ${new Date(summary.first_post_at).toLocaleDateString()} - ${new Date(summary.last_post_at).toLocaleDateString()}
`

    const link = summary.redirect_slug
      ? `${SHORT_LINK_DOMAIN}/t/${summary.redirect_slug}`
      : summary.thread_url

    if (link) {
      weeklySummary += `**Reference Link**: [View Thread](${link})
`
    }

    // Escape HTML in tag names to prevent XSS
    const escapeHtml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    }

    // Helper function to generate color styles for commitfest tags
    const getCommitfestTagStyle = (color: string | null) => {
      if (!color) {
        // Default colors if no color is specified
        return 'background-color: #e0f2fe; color: #0369a1; border-color: #bae6fd;'
      }
      // Convert hex color to RGB for better contrast calculation
      const hex = color.replace('#', '')
      const r = parseInt(hex.substr(0, 2), 16)
      const g = parseInt(hex.substr(2, 2), 16)
      const b = parseInt(hex.substr(4, 2), 16)
      // Calculate brightness (relative luminance)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      const textColor = brightness > 128 ? '#000000' : '#ffffff'
      const borderColor = brightness > 128 ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.3)'

      return `background-color: ${color}; color: ${textColor}; border-color: ${borderColor};`
    }

    // Add commitfest tags in separate section if available
    const hasCommitfestTags = summary.commitfest_tags && summary.commitfest_tags.length > 0
    if (hasCommitfestTags) {
      const commitfestTagsHtml = summary.commitfest_tags
        .map(tag => {
          const style = getCommitfestTagStyle(tag.color)
          return `<span class="tag" data-tag-source="commitfest" style="${style}" title="Commitfest tag">${escapeHtml(tag.name)}</span>`
        })
        .join('<span class="tag-separator">,</span> ')
      weeklySummary += `<div class="tags-container"><strong>Commitfest Tags:</strong> ${commitfestTagsHtml}</div>
`
    }

    // Add AI-generated tags in separate section if available
    const hasAiTags = summary.ai_tags && summary.ai_tags.length > 0
    if (hasAiTags) {
      const aiTagsHtml = summary.ai_tags
        .map((tag: string) => {
          return `<span class="tag" data-tag-source="ai" title="AI-generated tag">${escapeHtml(tag)}</span>`
        })
        .join('<span class="tag-separator">,</span> ')
      weeklySummary += `<div class="tags-container"><strong>AI-Generated Discussion Tags:</strong> ${aiTagsHtml}</div>
`
    }

    // Escape HTML/XML tags in the summary text to prevent them from being interpreted as HTML
    // Only escape the summary body, not the tags container (which is already added above)
    const escapedSummary = escapeHtmlTagsInText(summary.summary)

    weeklySummary += `
${escapedSummary}

`
  })

  console.log(`📝 INFO: Weekly summary created (${weeklySummary.length} characters)`)
  return weeklySummary
}
