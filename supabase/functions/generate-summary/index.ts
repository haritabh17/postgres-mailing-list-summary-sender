import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { getLastFriday } from './date-utils.ts'
import { generateAISummary } from './orchestrator.ts'

serve(async (req) => {
  console.log(`🚀 INFO: Generate summary function called - Method: ${req.method}`)

  if (req.method === 'OPTIONS') {
    console.log(`✅ INFO: Handling OPTIONS request`)
    return new Response('ok', { headers: corsHeaders })
  }

  console.log(`🔧 INFO: Starting summary generation process...`)

  try {
    console.log(`🔗 INFO: Initializing Supabase client...`)
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    console.log(`✅ INFO: Supabase client initialized successfully`)

    console.log(`📅 INFO: Parsing request body...`)
    // Get the week start and end dates (support custom date ranges)
    const { weekStart, weekEnd } = await req.json().catch((e) => {
      console.log(`⚠️ INFO: Could not parse request body, using defaults:`, e.message)
      return { weekStart: null, weekEnd: null }
    })

    console.log(`📅 INFO: Request params - weekStart: ${weekStart}, weekEnd: ${weekEnd}`)

    // Calculate the actual week range
    let actualWeekStart: Date
    let actualWeekEnd: Date

    if (weekStart && weekEnd) {
      // Custom date range provided
      console.log(`📅 INFO: Using custom date range from request`)
      actualWeekStart = new Date(weekStart)
      actualWeekEnd = new Date(weekEnd)
    } else if (weekEnd) {
      // Only end date provided, calculate start as last Friday
      console.log(`📅 INFO: Only end date provided, calculating start as last Friday`)
      actualWeekEnd = new Date(weekEnd)
      actualWeekStart = getLastFriday(actualWeekEnd)
    } else {
      // No custom dates, use default (last Friday to today)
      console.log(`📅 INFO: No custom dates provided, using default (last Friday to today)`)
      const today = new Date()
      actualWeekStart = getLastFriday(today)
      actualWeekEnd = new Date()
    }

    // Normalize times
    actualWeekStart.setHours(0, 0, 0, 0)
    actualWeekEnd.setHours(23, 59, 59, 999)

    console.log(`📅 INFO: Final date range - Start: ${actualWeekStart.toISOString()}, End: ${actualWeekEnd.toISOString()}`)

    console.log(`📝 INFO: Logging processing start to database...`)
    // Log processing start
    const { error: logStartError } = await supabaseClient
      .from('processing_logs')
      .insert([{
        process_type: 'summary_generation',
        status: 'in_progress',
        message: `Generating summary for ${actualWeekStart.toISOString().split('T')[0]} to ${actualWeekEnd.toISOString().split('T')[0]}`,
        started_at: new Date().toISOString()
      }])

    if (logStartError) {
      console.log(`⚠️ INFO: Could not log processing start:`, logStartError)
    } else {
      console.log(`✅ INFO: Processing start logged successfully`)
    }

    console.log(`🔄 INFO: Will generate new summary (overwriting existing if present)...`)

    console.log(`🔍 INFO: Searching for mailing list posts for week:`)
    console.log(`  Week Start (Last Friday): ${actualWeekStart.toISOString()}`)
    console.log(`  Week End (Today): ${actualWeekEnd.toISOString()}`)

    // Format dates as YYYY-MM-DD for date comparison (post_date is a DATE column)
    const startDateStr = actualWeekStart.toISOString().split('T')[0]
    const endDateStr = actualWeekEnd.toISOString().split('T')[0]

    console.log(`📅 INFO: Querying with date strings: ${startDateStr} to ${endDateStr}`)

    const { data: mailThreads, error: threadsError } = await supabaseClient
      .from('mail_threads')
      .select('*, mail_thread_contents(content)')
      .gte('post_date', startDateStr)
      .lte('post_date', endDateStr)
      .order('post_date', { ascending: false })

    if (threadsError) {
      console.log(`❌ INFO: Error fetching mail threads:`, threadsError)
      throw new Error(`Failed to get mail threads: ${threadsError.message}`)
    }

    console.log(`📊 INFO: Found ${mailThreads?.length || 0} mail threads for the specified date range`)

    if (mailThreads && mailThreads.length > 0) {
      console.log(`📧 INFO: Sample threads:`)
      mailThreads.slice(0, 5).forEach((thread, index) => {
        console.log(`  ${index + 1}. ${thread.post_date}: "${thread.subject}"`)
        console.log(`     Thread URL: ${thread.thread_url}`)
      })
    }

    if (!mailThreads || mailThreads.length === 0) {
      console.log(`❌ INFO: No mail threads found for the specified date range`)
      throw new Error(`No mail threads found for the specified date range (${actualWeekStart.toISOString().split('T')[0]} to ${actualWeekEnd.toISOString().split('T')[0]}). Try fetching mail threads first using "Fetch Mail Threads" button.`)
    }

    // Group threads by subject to create discussions
    const threadGroups = new Map<string, any[]>()
    mailThreads.forEach(thread => {
      const threadSubject = thread.subject
      if (!threadGroups.has(threadSubject)) {
        threadGroups.set(threadSubject, [])
      }
      threadGroups.get(threadSubject)!.push(thread)
    })

    console.log(`🧵 INFO: Grouped posts into ${threadGroups.size} discussion threads`)

    // Create all discussions with thread metadata
    const allDiscussions = Array.from(threadGroups.entries())
      .map(([threadSubject, threads]) => {
        const sortedThreads = threads.sort((a, b) => new Date(a.post_date).getTime() - new Date(b.post_date).getTime())
        // Count unique participants (authors)
        const uniqueAuthors = new Set(threads.map(thread => thread.author_name || thread.author_email || 'Unknown'))

        return {
          thread_id: sortedThreads[0].thread_id || sortedThreads[0].id || threadSubject,
          subject: threadSubject,
          post_count: threads.length, // Count of threads as posts
          participants: uniqueAuthors.size, // Count of unique authors/participants
          first_post_at: sortedThreads[0].post_date,
          last_post_at: sortedThreads[sortedThreads.length - 1].post_date,
          full_content: threads // Include thread metadata for AI processing
        }
      })
      .sort((a, b) => b.post_count - a.post_count) // Sort by post count

    // Get top 5 discussions with highest thread count
    const top5ByCount = allDiscussions.slice(0, 5)

    // Get 5 other discussions (excluding the top 5)
    const otherDiscussions = allDiscussions.slice(5, 10)

    // Combine both sets
    const topDiscussions = [...top5ByCount, ...otherDiscussions]

    console.log(`🎯 INFO: Created ${topDiscussions.length} top discussions with full content:`)
    console.log(`  Top 5 by thread count: ${top5ByCount.length} discussions`)
    console.log(`  Other 5 discussions: ${otherDiscussions.length} discussions`)
    topDiscussions.forEach((disc, index) => {
      const category = index < 5 ? '[TOP 5]' : '[OTHER 5]'
      console.log(`  ${index + 1}. ${category} "${disc.subject}" (${disc.post_count} posts, ${disc.participants} participants)`)
      const totalContentLength = disc.full_content.length
      console.log(`     Total content length: ${totalContentLength} threads`)
    })

    // Create stats from mail threads
    const uniqueParticipants = new Set(mailThreads.map(thread => thread.author_name || thread.author_email || 'Unknown'))

    const stats = {
      total_posts: mailThreads.length, // Count of threads as posts
      total_participants: uniqueParticipants.size, // Count of unique authors/participants
      total_subscribers: 0,
      date_range: {
        start: actualWeekStart.toISOString().split('T')[0],
        end: actualWeekEnd.toISOString().split('T')[0]
      }
    }

    // Try to get subscriber count
    try {
      const { data: subscriberStats } = await supabaseClient.rpc('get_public_stats')
      if (subscriberStats && subscriberStats.length > 0) {
        stats.total_subscribers = subscriberStats[0].total_subscribers || 0
      }
    } catch (error) {
      console.log('Could not get subscriber stats:', error)
    }

    console.log(`📈 INFO: Weekly stats:`)
    console.log(`  Total posts: ${stats.total_posts}`)
    console.log(`  Total participants: ${stats.total_participants}`)
    console.log(`  Total subscribers: ${stats.total_subscribers}`)
    console.log(`  Date range: ${stats.date_range.start} to ${stats.date_range.end}`)

    // Generate AI summary
    console.log(`🤖 INFO: Starting AI summary generation...`)
    const actualStartDate = new Date(stats.date_range.start)
    const actualEndDate = new Date(stats.date_range.end)
    const { content: summaryContent, enrichedDiscussions } = await generateAISummary(topDiscussions, stats, actualStartDate, actualEndDate, supabaseClient)
    console.log(`📝 INFO: Generated summary length: ${summaryContent.length} characters`)
    console.log(`📝 INFO: Summary preview: ${summaryContent.substring(0, 200)}...`)

    console.log(`💾 INFO: Storing weekly summary in database...`)
    console.log(`📅 DEBUG: actualStartDate before storage: ${actualStartDate.toISOString()}`)
    console.log(`📅 DEBUG: actualEndDate before storage: ${actualEndDate.toISOString()}`)
    console.log(`📅 DEBUG: week_start_date to be stored: ${actualStartDate.toISOString().split('T')[0]}`)
    console.log(`📅 DEBUG: week_end_date to be stored: ${actualEndDate.toISOString().split('T')[0]}`)

    // Create weekly summary (use upsert to overwrite existing)
    // Use the actual date range from the data, not artificial week calculation
    const { data: summary, error: summaryError } = await supabaseClient
      .from('weekly_summaries')
      .upsert({
        week_start_date: actualStartDate.toISOString().split('T')[0],
        week_end_date: actualEndDate.toISOString().split('T')[0],
        summary_content: summaryContent,
        top_discussions: enrichedDiscussions,
        total_posts: stats.total_posts,
        total_participants: stats.total_participants,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'week_start_date,week_end_date',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (summaryError) {
      console.log(`❌ INFO: Error storing summary:`, summaryError)
      throw new Error(`Failed to create summary: ${summaryError.message}`)
    }

    console.log(`✅ INFO: Weekly summary stored successfully with ID: ${summary.id}`)

    console.log(`📊 INFO: Logging success to processing_logs...`)
    // Log success
    const { error: logSuccessError } = await supabaseClient
      .from('processing_logs')
      .insert([{
        process_type: 'summary_generation',
        status: 'success',
        message: `Generated summary for ${actualWeekStart.toISOString().split('T')[0]} to ${actualWeekEnd.toISOString().split('T')[0]}`,
        completed_at: new Date().toISOString()
      }])

    if (logSuccessError) {
      console.log(`⚠️ INFO: Could not log success:`, logSuccessError)
    } else {
      console.log(`✅ INFO: Success logged to processing_logs`)
    }

    console.log(`🎉 INFO: Summary generation completed successfully!`)
    console.log(`📋 INFO: Summary ID: ${summary.id}`)
    console.log(`📅 INFO: Week: ${actualWeekStart.toISOString().split('T')[0]} to ${actualWeekEnd.toISOString().split('T')[0]}`)
    console.log(`🧵 INFO: Discussions: ${topDiscussions.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Summary generated successfully',
        summary_id: summary.id,
        week_start: actualWeekStart.toISOString().split('T')[0],
        week_end: actualWeekEnd.toISOString().split('T')[0],
        discussions_count: topDiscussions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error generating summary:', error)

    // Log error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      await supabaseClient
        .from('processing_logs')
        .insert([{
          process_type: 'summary_generation',
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
        status: 500
      }
    )
  }
})
