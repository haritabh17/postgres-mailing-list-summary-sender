import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceRole } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { normalizeSubject } from '../_shared/subject.ts'
import { getLastFriday } from './date-utils.ts'
import { generateAISummary } from './orchestrator.ts'
import { sendPipelineAlert } from '../_shared/pipeline-alert.ts'

function getDiscussionGroupKey(thread: { subject?: string }): string {
  return `subj:${normalizeSubject(thread.subject || 'unknown')}`
}

serve(async (req) => {
  console.log(`🚀 INFO: Generate summary function called - Method: ${req.method}`)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authError = requireServiceRole(req)
  if (authError) return authError

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let actualWeekStart: Date
  let actualWeekEnd: Date

  try {
    const { weekStart, weekEnd } = await req.json().catch(() => ({ weekStart: null, weekEnd: null }))

    if (weekStart && weekEnd) {
      actualWeekStart = new Date(weekStart)
      actualWeekEnd = new Date(weekEnd)
    } else if (weekEnd) {
      actualWeekEnd = new Date(weekEnd)
      actualWeekStart = getLastFriday(actualWeekEnd)
    } else {
      const today = new Date()
      actualWeekStart = getLastFriday(today)
      actualWeekEnd = new Date()
    }

    actualWeekStart.setHours(0, 0, 0, 0)
    actualWeekEnd.setHours(23, 59, 59, 999)

    const startDateStr = actualWeekStart.toISOString().split('T')[0]
    const endDateStr = actualWeekEnd.toISOString().split('T')[0]

    await supabaseClient.from('processing_logs').insert([{
      process_type: 'summary_generation',
      status: 'in_progress',
      message: `Generating summary for ${startDateStr} to ${endDateStr}`,
      started_at: new Date().toISOString(),
    }])

    const { data: mailThreads, error: threadsError } = await supabaseClient
      .from('mail_threads')
      .select('*, mail_thread_contents(content)')
      .gte('post_date', startDateStr)
      .lte('post_date', endDateStr)
      .order('post_date', { ascending: false })

    if (threadsError) {
      throw new Error(`Failed to get mail threads: ${threadsError.message}`)
    }

    if (!mailThreads || mailThreads.length === 0) {
      const msg = `No mail threads found for ${startDateStr} to ${endDateStr}. Skipping summary generation.`
      console.log(`⚠️ INFO: ${msg}`)

      await supabaseClient.from('processing_logs').insert([{
        process_type: 'summary_generation',
        status: 'success',
        message: msg,
        completed_at: new Date().toISOString(),
      }])

      return new Response(
        JSON.stringify({ success: true, skipped: true, message: msg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PostgreSQL.org archive URLs expose per-message IDs, not conversation IDs.
    // Group by subject so replies collapse into the same discussion.
    const threadGroups = new Map<string, any[]>()
    mailThreads.forEach((thread) => {
      const key = getDiscussionGroupKey(thread)
      if (!threadGroups.has(key)) threadGroups.set(key, [])
      threadGroups.get(key)!.push(thread)
    })

    console.log(`🧵 INFO: Grouped ${mailThreads.length} posts into ${threadGroups.size} discussions`)

    const allDiscussions = Array.from(threadGroups.entries())
      .map(([, threads]) => {
        const sortedThreads = threads.sort((a, b) => new Date(a.post_date).getTime() - new Date(b.post_date).getTime())
        const uniqueAuthors = new Set(threads.map((t) => t.author_name || 'Unknown'))
        const displaySubject = sortedThreads[0].subject || 'Unknown discussion'

        return {
          thread_id: sortedThreads[0].thread_id || sortedThreads[0].id,
          subject: displaySubject,
          post_count: threads.length,
          participants: uniqueAuthors.size,
          first_post_at: sortedThreads[0].post_date,
          last_post_at: sortedThreads[sortedThreads.length - 1].post_date,
          full_content: threads,
        }
      })
      .sort((a, b) => b.post_count - a.post_count)

    const topDiscussions = allDiscussions.slice(0, 10)

    const uniqueParticipants = new Set(mailThreads.map((t) => t.author_name || 'Unknown'))
    const stats = {
      total_posts: mailThreads.length,
      total_participants: uniqueParticipants.size,
      total_subscribers: 0,
      date_range: { start: startDateStr, end: endDateStr },
    }

    try {
      const { data: subscriberStats } = await supabaseClient.rpc('get_public_stats')
      if (subscriberStats?.[0]) {
        stats.total_subscribers = subscriberStats[0].total_subscribers || 0
      }
    } catch {
      // non-fatal
    }

    const actualStartDate = new Date(stats.date_range.start)
    const actualEndDate = new Date(stats.date_range.end)
    const { content: summaryContent, enrichedDiscussions } = await generateAISummary(
      topDiscussions, stats, actualStartDate, actualEndDate, supabaseClient
    )

    const { data: summary, error: summaryError } = await supabaseClient
      .from('weekly_summaries')
      .upsert({
        week_start_date: actualStartDate.toISOString().split('T')[0],
        week_end_date: actualEndDate.toISOString().split('T')[0],
        summary_content: summaryContent,
        top_discussions: enrichedDiscussions,
        total_posts: stats.total_posts,
        total_participants: stats.total_participants,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'week_start_date,week_end_date', ignoreDuplicates: false })
      .select()
      .single()

    if (summaryError) {
      throw new Error(`Failed to create summary: ${summaryError.message}`)
    }

    await supabaseClient.from('processing_logs').insert([{
      process_type: 'summary_generation',
      status: 'success',
      message: `Generated summary for ${startDateStr} to ${endDateStr}`,
      completed_at: new Date().toISOString(),
    }])

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Summary generated successfully',
        summary_id: summary.id,
        week_start: startDateStr,
        week_end: endDateStr,
        discussions_count: topDiscussions.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error generating summary:', error)

    try {
      await supabaseClient.from('processing_logs').insert([{
        process_type: 'summary_generation',
        status: 'error',
        message,
        completed_at: new Date().toISOString(),
      }])
      await sendPipelineAlert('summary_generation', message)
    } catch (logError) {
      console.error('Failed to log/alert error:', logError)
    }

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
