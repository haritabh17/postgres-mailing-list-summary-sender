import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { marked } from 'https://esm.sh/marked@11.1.1'
import { requireServiceRole } from '../_shared/auth.ts'
import { sanitizeHtml } from '../_shared/sanitize-html.ts'
import { makeUnsubscribeToken, normalizeEmail } from '../_shared/unsubscribe-token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Subscriber {
  id: string
  email: string
  subscribed_at: string
  is_active: boolean
  confirmation_status: string
}

interface WeeklySummary {
  id: string
  week_start_date: string
  week_end_date: string
  summary_content: string
  top_discussions: any[]
  total_posts: number
  total_participants: number
  created_at: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Internal-only: this function emails confirmed subscribers. Without this
  // gate any caller with the public anon key could trigger sends to anyone.
  const authError = requireServiceRole(req)
  if (authError) return authError

  try {
    console.log(`🚀 INFO: Send summary to users function called - Method: ${req.method}`)
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the emails from request body (support both single email and array)
    const body = await req.json().catch(() => ({}))
    const { email, emails } = body
    
    // Convert to array format
    let emailList: string[] = []
    if (emails && Array.isArray(emails)) {
      emailList = emails
    } else if (email) {
      emailList = [email]
    } else {
      throw new Error('Email or emails parameter is required')
    }

    if (emailList.length === 0) {
      throw new Error('At least one email is required')
    }

    console.log(`📧 INFO: Request to send summary to ${emailList.length} user(s)`)

    // Get the most recent weekly summary
    const { data: summary, error: summaryError } = await supabaseClient
      .from('weekly_summaries')
      .select('*')
      .order('week_end_date', { ascending: false })
      .limit(1)
      .single()

    if (summaryError || !summary) {
      console.log(`❌ INFO: No summary found in database`)
      throw new Error('No weekly summary found. Please generate a summary first.')
    }

    console.log(`📄 INFO: Found summary for week ending: ${summary.week_end_date}`)

    // Log batch start
    await supabaseClient
      .from('processing_logs')
      .insert([{
        process_type: 'email_send_batch',
        status: 'in_progress',
        message: `Processing ${emailList.length} email(s) with 1s delay between each`,
        metadata: {
          total_emails: emailList.length,
          summary_id: summary.id,
          week_end_date: summary.week_end_date
        },
        started_at: new Date().toISOString()
      }])

    // Process each email sequentially with 1 second delay
    const results: any[] = []
    let successful = 0
    let failed = 0
    let skipped = 0

    for (let i = 0; i < emailList.length; i++) {
      const currentEmail = emailList[i].trim()
      
      try {
        console.log(`\n📧 INFO: Processing ${i + 1}/${emailList.length}: ${currentEmail}`)

        // Verify subscriber exists and is active/confirmed
        const { data: subscriber, error: subscriberError } = await supabaseClient
          .from('subscribers')
          .select('id, email, subscribed_at, is_active, confirmation_status')
          .eq('email', currentEmail)
          .eq('is_active', true)
          .eq('confirmation_status', 'confirmed')
          .single()

        if (subscriberError || !subscriber) {
          console.log(`⚠️ INFO: Subscriber not found or not eligible: ${currentEmail}`)
          skipped++
          results.push({
            email: currentEmail,
            success: false,
            error: 'Subscriber not found, not active, or not confirmed'
          })
          continue
        }

        console.log(`✅ INFO: Subscriber verified: ${subscriber.email}`)

        // Send email to the subscriber
        const emailContent = await createEmailContent(subscriber, summary)
        const subject = `PostgreSQL Weekly Summary - Week of ${formatDateWithOrdinal(summary.week_end_date)}`
        
        const emailSent = await sendSummaryEmail(subscriber.email, subject, emailContent)
        
        if (!emailSent) {
          failed++
          results.push({
            email: currentEmail,
            success: false,
            error: 'Failed to send email via Resend API'
          })
          
          // Log individual failure
          await supabaseClient
            .from('processing_logs')
            .insert([{
              process_type: 'email_send_individual',
              status: 'error',
              message: `Failed to send email to ${currentEmail}`,
              metadata: {
                email: currentEmail,
                summary_id: summary.id
              },
              completed_at: new Date().toISOString()
            }])
        } else {
          successful++
          results.push({
            email: currentEmail,
            success: true,
            message: 'Email sent successfully'
          })
          
          console.log(`✅ INFO: Email sent successfully to ${currentEmail}`)
          
          // Log individual success
          await supabaseClient
            .from('processing_logs')
            .insert([{
              process_type: 'email_send_individual',
              status: 'success',
              message: `Successfully sent summary to ${currentEmail}`,
              metadata: {
                email: currentEmail,
                summary_id: summary.id,
                week_end_date: summary.week_end_date
              },
              completed_at: new Date().toISOString()
            }])
        }

        // Wait 1 second before processing next email (except for the last one)
        if (i < emailList.length - 1) {
          console.log(`⏳ INFO: Waiting 1 second before next email...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (error) {
        console.error(`❌ ERROR: Error processing ${currentEmail}:`, error)
        failed++
        results.push({
          email: currentEmail,
          success: false,
          error: error.message || 'Unexpected error'
        })
        
        // Log individual error
        await supabaseClient
          .from('processing_logs')
          .insert([{
            process_type: 'email_send_individual',
            status: 'error',
            message: `Error sending to ${currentEmail}: ${error.message}`,
            metadata: {
              email: currentEmail,
              error_detail: error.message
            },
            completed_at: new Date().toISOString()
          }])
        
        // Continue processing other emails
        if (i < emailList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    // Log batch completion
    const batchStatus = failed === 0 && skipped === 0 ? 'success' : 
                       successful > 0 ? 'partial_success' : 'error'
    
    await supabaseClient
      .from('processing_logs')
      .insert([{
        process_type: 'email_send_batch',
        status: batchStatus,
        message: `Batch completed: ${successful} sent, ${failed} failed, ${skipped} skipped`,
        metadata: {
          total_emails: emailList.length,
          successful,
          failed,
          skipped,
          summary_id: summary.id
        },
        completed_at: new Date().toISOString()
      }])

    console.log(`\n✅ INFO: Batch processing complete - ${successful} sent, ${failed} failed, ${skipped} skipped`)

    return new Response(
      JSON.stringify({ 
        success: successful > 0,
        summary: {
          total_emails: emailList.length,
          sent: successful,
          failed: failed,
          skipped: skipped,
          summary_id: summary.id,
          week_end_date: summary.week_end_date
        },
        results: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ ERROR: Error in send summary to users:', error)
    
    // Log error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabaseClient
        .from('processing_logs')
        .insert([{
          process_type: 'email_send_batch',
          status: 'error',
          message: error.message,
          completed_at: new Date().toISOString()
        }])
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400
      }
    )
  }
})

async function sendSummaryEmail(email: string, subject: string, htmlContent: string): Promise<boolean> {
  console.log(`📤 Attempting to send email to ${email}`)
  
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  
  if (!resendApiKey) {
    console.error('❌ RESEND_API_KEY not configured')
    return false
  }
  
  try {
    console.log(`📧 Sending via Resend to ${email}`)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PostgreSQL Hackers Digest <digest@postgreshackersdigest.dev>',
        to: [email],
        subject: subject,
        html: htmlContent
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Resend API error for ${email}: ${response.status} - ${errorText}`)
      return false
    }
    
    const result = await response.json()
    console.log(`✅ Email sent successfully to ${email}`, result)
    return true
  } catch (error) {
    console.error(`❌ Failed to send email to ${email}:`, error)
    return false
  }
}

async function createEmailContent(subscriber: Subscriber, summary: WeeklySummary): Promise<string> {
  // Convert markdown summary to HTML, with per-discussion detail links if multi-level data exists
  const hasMultiLevel = summary.top_discussions?.some((d: any) => d.summary_brief || d.summary_detailed || d.summary_deep)
  let htmlSummary: string

  if (hasMultiLevel && summary.top_discussions) {
    // Build custom HTML with brief summaries + links to the detailed web version
    htmlSummary = buildMultiLevelEmailHtml(summary)
  } else {
    htmlSummary = convertMarkdownToHtml(summary.summary_content)
  }

  // Per-recipient HMAC unsubscribe token; one-click and binding to this address.
  const normalizedEmail = normalizeEmail(subscriber.email)
  const unsubscribeToken = await makeUnsubscribeToken(normalizedEmail)
  const unsubscribeUrl = `https://postgreshackersdigest.dev/unsubscribe?email=${encodeURIComponent(normalizedEmail)}&token=${unsubscribeToken}`

  // Layout mirrors the website's light theme (frontend/tailwind.config.js pg
  // palette). The multi-level path is fully inline-styled; the <style> block
  // below only covers the markdown-fallback path, which has no inline styles.
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PostgreSQL Weekly Summary</title>
  <style>
    body { margin: 0; padding: 24px 12px; background: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }
    .summary-content h1 { color: #102a43; font-size: 24px; font-weight: 700; margin: 0 0 16px; }
    .summary-content h2 { color: #102a43; font-size: 19px; font-weight: 600; margin: 28px 0 14px; }
    .summary-content h3 { color: #102a43; font-size: 16.5px; font-weight: 600; margin: 24px 0 10px; }
    .summary-content h4 { color: #243b53; font-size: 15px; font-weight: 600; margin: 20px 0 8px; }
    .summary-content p { color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 14px; }
    .summary-content strong { color: #102a43; font-weight: 600; }
    .summary-content ul, .summary-content ol { margin: 0 0 14px; padding-left: 24px; }
    .summary-content li { color: #334155; font-size: 15px; line-height: 1.6; margin: 6px 0; }
    .summary-content a { color: #336791; text-decoration: none; }
    .summary-content a:hover { text-decoration: underline; }
    .summary-content blockquote { border-left: 4px solid #bcccdc; margin: 16px 0; padding: 10px 16px; background: #f0f4f8; border-radius: 4px; font-style: italic; color: #486581; }
    .summary-content code { background: #f0f4f8; color: #243b53; padding: 1px 5px; border-radius: 4px; font-family: ui-monospace, 'Menlo', 'Courier New', monospace; font-size: 13px; }
    .summary-content pre { background: #102a43; color: #d9e2ec; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 16px 0; }
    .summary-content pre code { background: none; padding: 0; color: inherit; }
    .summary-content table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .summary-content th, .summary-content td { border: 1px solid #d9e2ec; padding: 10px; text-align: left; font-size: 14px; color: #334155; }
    .summary-content th { background: #f0f4f8; font-weight: 600; color: #102a43; }
    .summary-content hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    .tags-container { margin: 12px 0; font-size: 13px; color: #334155; }
    .tag { display: inline-block; padding: 2px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; border: 1px solid #bcccdc; background: #f0f4f8; color: #243b53; }
  </style>
</head>
<body>
  <table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
    <tr><td style="padding: 28px 32px 0;">
      <p style="margin: 0 0 4px; font-family: ui-monospace, 'Menlo', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #336791;">PostgreSQL Hackers Digest</p>
      <h1 style="margin: 0 0 6px; font-size: 26px; line-height: 1.2; color: #102a43;">Week of ${formatDateWithOrdinal(summary.week_end_date)}</h1>
      <p style="margin: 0 0 20px; font-size: 13.5px; color: #627d98;">${summary.total_posts} posts &nbsp;&middot;&nbsp; ${summary.total_participants} participants &nbsp;&middot;&nbsp; Generated ${formatDate(summary.created_at)}</p>
    </td></tr>
    <tr><td style="padding: 0 32px 24px;">
      <div class="summary-content">
        ${htmlSummary}
      </div>
    </td></tr>
    <tr><td style="background: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 12px 12px; padding: 18px 32px;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #829ab1; text-align: center;">This summary was generated using AI &middot; Source: PostgreSQL Hackers Mailing List</p>
      <p style="margin: 0; font-size: 12px; text-align: center;">
        <a href="${unsubscribeUrl}" style="color: #336791;">Unsubscribe</a> &nbsp;&middot;&nbsp;
        <a href="https://postgreshackersdigest.dev" style="color: #336791;">Manage subscription</a> &nbsp;&middot;&nbsp;
        <a href="https://www.postgreshackersdigest.dev/summary/${summary.id}" style="color: #336791;">Read on the web</a>
      </p>
    </td></tr>
  </table>
</body>
</html>
  `
}

// Status badge colors mirror the website's StatusBadge component (light theme).
const STATUS_BADGES: Record<string, { label: string; fg: string; bg: string; border: string }> = {
  proposal: { label: 'Proposal', fg: '#1e40af', bg: '#dbeafe', border: '#bfdbfe' },
  patch_review: { label: 'Patch Review', fg: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  committed: { label: 'Committed', fg: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
  debate: { label: 'Debate', fg: '#6b21a8', bg: '#f3e8ff', border: '#e9d5ff' },
}

function statusBadgeHtml(status?: string): string {
  const badge = status ? STATUS_BADGES[status] : undefined
  if (!badge) return ''
  return ` <span style="display: inline-block; font-size: 11px; font-weight: 600; color: ${badge.fg}; background: ${badge.bg}; border: 1px solid ${badge.border}; border-radius: 99px; padding: 1px 9px; vertical-align: 2px;">${badge.label}</span>`
}

// Same brightness heuristic as the website's TagChip: readable text on the
// commitfest color, light-blue fallback when the tag has no color.
function commitfestChipHtml(tag: any): string {
  let bg = '#e0f2fe'
  let fg = '#0369a1'
  if (tag.color) {
    const hex = String(tag.color).replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    bg = tag.color
    fg = (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#000000' : '#ffffff'
  }
  return `<span style="display: inline-block; font-size: 12px; font-weight: 500; color: ${fg}; background: ${bg}; border-radius: 6px; padding: 3px 10px;">${escapeHtmlForEmail(tag.name)}</span>`
}

function aiChipHtml(tag: string): string {
  return `<span style="display: inline-block; font-size: 12px; font-weight: 500; color: #243b53; background: #f0f4f8; border: 1px solid #bcccdc; border-radius: 6px; padding: 2px 10px;">${escapeHtmlForEmail(tag)}</span>`
}

// Same as the website's dedupeAiTags: AI tags often repeat commitfest tag
// names; drop duplicates case-insensitively.
function dedupeAiTags(commitfestTags: any[] | undefined, aiTags: string[] | undefined): string[] {
  const seen = new Set((commitfestTags || []).map((t) => String(t.name).trim().toLowerCase()))
  const result: string[] = []
  for (const tag of aiTags || []) {
    const key = tag.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  return result
}

// Escape, then render `backticks` as styled code — same treatment as the site.
function briefSummaryHtml(text: string): string {
  return escapeHtmlForEmail(text).replace(
    /`([^`]+)`/g,
    '<code style="font-family: ui-monospace, \'Menlo\', monospace; font-size: 13px; background: #f0f4f8; color: #243b53; border-radius: 4px; padding: 1px 5px;">$1</code>'
  )
}

function buildMultiLevelEmailHtml(summary: WeeklySummary): string {
  const discussions = summary.top_discussions || []

  // Extract overview from summary_content (everything before "## Top Discussions")
  let overview = ''
  const topDiscIdx = summary.summary_content.indexOf('## Top Discussions')
  if (topDiscIdx !== -1) {
    overview = summary.summary_content.substring(0, topDiscIdx).trim()
    // Remove H1 title and ## Overview heading
    overview = overview.replace(/^#\s+.*$/m, '').replace(/^##\s+Overview\s*/m, '').trim()
  }

  let html = ''
  if (overview) {
    html += `${convertMarkdownToHtml(overview)}\n`
  }
  html += `<h2 style="margin: 0 0 18px; font-size: 19px; color: #102a43;">This week's most active discussions</h2>\n`

  discussions.forEach((disc: any, index: number) => {
    const num = index + 1

    if (index > 0) {
      html += `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">\n`
    }

    html += `<h3 style="margin: 0 0 10px; font-size: 16.5px; line-height: 1.35; color: #102a43;">${num}. ${escapeHtmlForEmail(disc.subject)}${statusBadgeHtml(disc.status)}</h3>\n`

    const threadLink = disc.thread_url
      ? ` &nbsp;&middot;&nbsp; <a href="${disc.thread_url}" target="_blank" rel="noopener noreferrer" style="color: #336791; text-decoration: none; font-weight: 500;">View thread &#8599;</a>`
      : ''
    html += `<p style="margin: 0 0 12px; font-size: 13px; color: #627d98;"><strong style="color: #334155;">Posts</strong>: ${disc.post_count} &nbsp; <strong style="color: #334155;">Participants</strong>: ${disc.participants}${threadLink}</p>\n`

    const chips = [
      ...(disc.commitfest_tags || []).map(commitfestChipHtml),
      ...dedupeAiTags(disc.commitfest_tags, disc.ai_tags).map(aiChipHtml),
    ]
    if (chips.length > 0) {
      html += `<p style="margin: 0 0 14px;">${chips.join('&nbsp; ')}</p>\n`
    }

    html += `<p style="margin: 0 0 14px; font-size: 15px; line-height: 1.7; color: #334155;">${briefSummaryHtml(disc.summary_brief || '')}</p>\n`

    const discShareUrl = `https://www.postgreshackersdigest.dev/summary/${summary.id}?expand=${num}#discussion-${num}`
    html += `<p style="margin: 0; font-size: 13.5px;"><a href="${discShareUrl}" style="display: inline-block; color: #336791; font-weight: 600; text-decoration: none; border: 1px solid #bcccdc; border-radius: 8px; padding: 5px 14px;">Read the detailed version &rarr;</a> &nbsp;&nbsp;<a href="${discShareUrl}" style="color: #829ab1; text-decoration: none;">Share</a></p>\n`
  })

  return html
}

function escapeHtmlForEmail(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Configure marked for email-friendly output
marked.setOptions({
  gfm: true,          // GitHub Flavored Markdown
  breaks: true,       // Convert line breaks to <br> tags
  smartLists: true,   // Better list handling
  smartypants: true,  // Smart quotes and typography
})

// Allowlist used to sanitize AI-generated markdown HTML before it ends up in
// recipients' inboxes. The summary text comes from an LLM that is summarizing
// untrusted mailing-list content, so it must never be trusted to be safe HTML.
const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: [
    'a', 'p', 'br', 'hr', 'div', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class', 'data-tag-source', 'style', 'src', 'alt', 'width', 'height'],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
  ALLOW_DATA_ATTR: false,
}

function convertMarkdownToHtml(markdown: string): string {
  if (!markdown) return ''

  // Protect tags container before markdown processing (same as website)
  const tagsContainerRegex = /<div class="tags-container">[\s\S]*?<\/div>/gi
  const tagsContainers: string[] = []
  let tagsIndex = 0
  let protectedMarkdown = markdown.replace(tagsContainerRegex, (match) => {
    tagsContainers.push(match)
    return `<!--TAGS_CONTAINER_PLACEHOLDER_${tagsIndex++}-->`
  })

  // Use marked library for reliable markdown conversion
  let html = marked(protectedMarkdown) as string

  // Restore protected tags containers (these are server-built, safe to inline)
  tagsContainers.forEach((tags, index) => {
    const placeholder = `<!--TAGS_CONTAINER_PLACEHOLDER_${index}-->`
    html = html.split(placeholder).join(tags)
  })

  // Sanitize the combined HTML before it leaves the function.
  html = sanitizeHtml(html, SANITIZE_OPTIONS)

  // Add target="_blank" + rel for safer external link behavior.
  html = html.replace(/<a href="([^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"')

  return html
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatDateWithOrdinal(dateString: string): string {
  const date = new Date(dateString)
  const day = date.getDate()
  const ordinal = (day: number) => {
    const s = ["th", "st", "nd", "rd"]
    const v = day % 100
    return day + (s[(v - 20) % 10] || s[v] || s[0])
  }
  return `${ordinal(day)} ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

