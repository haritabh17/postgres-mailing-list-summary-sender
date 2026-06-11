import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import he from 'https://esm.sh/he@1.2.0'
import { requireServiceRole } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'

const ARCHIVE_BASE_URL = 'https://www.postgresql.org'
const ARCHIVE_LIST = `${ARCHIVE_BASE_URL}/list/pgsql-hackers`

const MONTH_NAMES: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
}

interface MailThread {
  url: string
  subject: string
  post_date: Date
  thread_id: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authError = requireServiceRole(req)
  if (authError) return authError

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Last 7 days, normalized to whole-day boundaries
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)
    startDate.setHours(0, 0, 0, 0)

    console.log(`Fetching mail threads from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Create or update weekly discussion record
    const weekStart = getWeekStart(startDate)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    // First, try to get existing record
    let { data: weeklyDiscussion, error: selectError } = await supabaseClient
      .from('weekly_discussions')
      .select('*')
      .eq('week_start_date', weekStartStr)
      .eq('week_end_date', weekEndStr)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is fine
      console.error('Error checking existing weekly discussion:', selectError)
    }

    if (weeklyDiscussion) {
      // Update existing record
      const { data: updatedRecord, error: updateError } = await supabaseClient
        .from('weekly_discussions')
        .update({
          processing_status: 'fetching',
          fetch_started_at: new Date().toISOString()
        })
        .eq('id', weeklyDiscussion.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating weekly discussion:', updateError)
      } else {
        weeklyDiscussion = updatedRecord
      }
    } else {
      // Create new record
      const { data: newRecord, error: insertError } = await supabaseClient
        .from('weekly_discussions')
        .insert({
          week_start_date: weekStartStr,
          week_end_date: weekEndStr,
          processing_status: 'fetching',
          fetch_started_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating weekly discussion:', insertError)
      } else {
        weeklyDiscussion = newRecord
      }
    }

    // Fetch mail threads for the date range
    const threads = await fetchMailThreadsForDateRange(startDate, endDate)
    
    console.log(`Found ${threads.length} mail threads`)

    // Store threads in database with proper upsert handling
    let insertedCount = 0
    let updatedCount = 0
    
    for (const thread of threads) {
      try {
        // Use upsert with proper conflict resolution
        const { data, error: upsertError } = await supabaseClient
          .from('mail_threads')
          .upsert({
            thread_url: thread.url,
            subject: thread.subject,
            post_date: thread.post_date.toISOString(),
            thread_id: thread.thread_id,
            first_message_url: thread.url,
            last_activity: thread.post_date.toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'thread_url',
            ignoreDuplicates: false,
            defaultToNull: false
          })
          .select()

        if (!upsertError) {
          if (data && data.length > 0) {
            // Check if this was an insert or update based on created_at vs updated_at
            const record = data[0]
            const createdAt = new Date(record.created_at)
            const updatedAt = new Date(record.updated_at)
            
            if (Math.abs(createdAt.getTime() - updatedAt.getTime()) < 1000) {
              insertedCount++ // New record
              console.log(`Inserted new thread: ${thread.subject}`)
            } else {
              updatedCount++ // Updated existing record
              console.log(`Updated existing thread: ${thread.subject}`)
            }
          }
        } else {
          console.error('Error upserting thread:', upsertError)
        }
      } catch (error) {
        console.error('Error processing thread:', error)
      }
    }

    // Update weekly discussion with results
    if (weeklyDiscussion) {
      await supabaseClient
        .from('weekly_discussions')
        .update({
          total_threads: insertedCount + updatedCount,
          total_messages: threads.length,
          processing_status: 'completed',
          fetch_completed_at: new Date().toISOString()
        })
        .eq('id', weeklyDiscussion.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully processed ${threads.length} mail threads (${insertedCount} new, ${updatedCount} updated)`,
        threads_found: threads.length,
        threads_stored: insertedCount,
        threads_updated: updatedCount,
        date_range: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error fetching mail threads:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

const MAX_ARCHIVE_PAGES = 15
const PAGE_FETCH_TIMEOUT_MS = 30000
const TOTAL_FETCH_TIMEOUT_MS = 120000

async function fetchMailThreadsForDateRange(startDate: Date, endDate: Date): Promise<MailThread[]> {
  const sinceStamp = formatSinceTimestamp(startDate)
  let pageUrl: string | null = `${ARCHIVE_LIST}/since/${sinceStamp}/`

  const threadsByUrl = new Map<string, MailThread>()
  const visitedUrls = new Set<string>()
  let pageNum = 0

  const controller = new AbortController()
  const totalTimeoutId = setTimeout(() => controller.abort(), TOTAL_FETCH_TIMEOUT_MS)

  try {
    while (pageUrl && pageNum < MAX_ARCHIVE_PAGES) {
      const normalizedUrl = normalizeArchivePageUrl(pageUrl)
      if (visitedUrls.has(normalizedUrl)) {
        console.log(`Stopping pagination: already visited ${normalizedUrl}`)
        break
      }
      visitedUrls.add(normalizedUrl)
      pageNum++

      console.log(`Fetching archive page ${pageNum}: ${normalizedUrl}`)
      const html = await fetchArchivePage(normalizedUrl, controller.signal)
      console.log(`Received HTML content (${html.length} characters)`)

      const pageThreads = parsePostgresqlOrgArchivePage(html, startDate, endDate)
      for (const thread of pageThreads) {
        threadsByUrl.set(thread.url, thread)
      }
      console.log(`Parsed ${pageThreads.length} threads on page ${pageNum} (${threadsByUrl.size} unique total)`)

      const dayRange = getArchivePageDayRange(html)
      if (dayRange?.min && dayRange.min > endDate) {
        console.log(`Stopping pagination: page starts at ${dayRange.min.toISOString()}, after window end`)
        break
      }

      const nextPath = extractNextSincePath(html)
      if (!nextPath) {
        console.log('Stopping pagination: no Next link')
        break
      }

      const nextUrl = `${ARCHIVE_BASE_URL}${nextPath}/`
      if (normalizeArchivePageUrl(nextUrl) === normalizedUrl) {
        console.log('Stopping pagination: Next link points to current page')
        break
      }

      pageUrl = nextUrl
    }

    if (pageNum >= MAX_ARCHIVE_PAGES) {
      console.warn(`Stopped pagination after ${MAX_ARCHIVE_PAGES} pages (safety limit)`)
    }

    const threads = Array.from(threadsByUrl.values())
    console.log(`Fetched ${threads.length} unique threads across ${pageNum} page(s)`)
    return threads
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Archive fetch timed out after ${TOTAL_FETCH_TIMEOUT_MS / 1000} seconds`)
    }
    throw error
  } finally {
    clearTimeout(totalTimeoutId)
  }
}

async function fetchArchivePage(url: string, parentSignal: AbortSignal): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS)

  const onParentAbort = () => controller.abort()
  parentSignal.addEventListener('abort', onParentAbort)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`)
    }
    return await response.text()
  } finally {
    clearTimeout(timeoutId)
    parentSignal.removeEventListener('abort', onParentAbort)
  }
}

function normalizeArchivePageUrl(url: string): string {
  const parsed = new URL(url)
  parsed.pathname = parsed.pathname.replace(/\/$/, '')
  return parsed.toString()
}

function extractNextSincePath(html: string): string | null {
  const match = html.match(
    /<a href="(\/list\/pgsql-hackers\/since\/\d+)"[^>]*>\s*Next\s*<\/a>/i,
  )
  return match ? match[1] : null
}

function getArchivePageDayRange(html: string): { min: Date; max: Date } | null {
  const h2Pattern = /<h2>([^<]+)<\/h2>/g
  const days: Date[] = []
  let h2Match

  while ((h2Match = h2Pattern.exec(html)) !== null) {
    if (h2Match[1] === 'Quick Links') continue
    const day = parseArchiveDayHeader(h2Match[1])
    if (day) days.push(day)
  }

  if (days.length === 0) return null
  return {
    min: new Date(Math.min(...days.map((d) => d.getTime()))),
    max: new Date(Math.max(...days.map((d) => d.getTime()))),
  }
}

function formatSinceTimestamp(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}0000`
}

function parsePostgresqlOrgArchivePage(html: string, startDate: Date, endDate: Date): MailThread[] {
  const threads: MailThread[] = []
  const sections: Array<{ label: string; index: number }> = []

  const h2Pattern = /<h2>([^<]+)<\/h2>/g
  let h2Match
  while ((h2Match = h2Pattern.exec(html)) !== null) {
    if (h2Match[1] === 'Quick Links') continue
    sections.push({ label: h2Match[1], index: h2Match.index })
  }

  console.log(`Found ${sections.length} day sections`)

  const rowPattern =
    /<tr>\s*<th scope="row">\s*<a href="(\/message-id\/[^"]+)">([\s\S]*?)<\/a>\s*<\/th>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<\/tr>/g

  for (let i = 0; i < sections.length; i++) {
    const sectionStart = sections[i].index
    const sectionEnd = i + 1 < sections.length ? sections[i + 1].index : html.length
    const chunk = html.slice(sectionStart, sectionEnd)
    const dayDate = parseArchiveDayHeader(sections[i].label)
    if (!dayDate) {
      console.warn(`Could not parse day header: ${sections[i].label}`)
      continue
    }

    let rowMatch
    while ((rowMatch = rowPattern.exec(chunk)) !== null) {
      const [, href, rawSubject, , timeText] = rowMatch
      const [hours, minutes] = timeText.trim().split(':').map(Number)
      const postDate = new Date(dayDate)
      postDate.setHours(hours || 0, minutes || 0, 0, 0)

      if (postDate < startDate || postDate > endDate) {
        continue
      }

      const fullUrl = `${ARCHIVE_BASE_URL}${href}`
      const subject = he.decode(rawSubject.replace(/\s+/g, ' ').trim())

      threads.push({
        url: fullUrl,
        subject,
        post_date: postDate,
        thread_id: threadIdFromArchiveUrl(href),
      })
    }
  }

  return threads
}

function parseArchiveDayHeader(label: string): Date | null {
  const match = label.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/)
  if (!match) return null

  const month = MONTH_NAMES[match[1]]
  if (month === undefined) return null

  return new Date(parseInt(match[3], 10), month, parseInt(match[2], 10))
}

function threadIdFromArchiveUrl(href: string): string {
  const match = href.match(/\/message-id\/(.+)$/)
  return match ? decodeURIComponent(match[1]) : `thread-${Date.now()}`
}

function getWeekStart(date: Date): Date {
  const weekStart = new Date(date)
  const day = weekStart.getDay()
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  weekStart.setDate(diff)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}
