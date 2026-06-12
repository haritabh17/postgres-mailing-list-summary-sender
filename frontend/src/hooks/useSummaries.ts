import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { WeeklySummaryListItem } from '../lib/types'

const DEFAULT_INITIAL_SIZE = 6

export function useSummaries(
  tagFilter?: string | null,
  searchQuery?: string | null,
  initialSize: number = DEFAULT_INITIAL_SIZE
) {
  const [summaries, setSummaries] = useState<WeeklySummaryListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [nextPageSize, setNextPageSize] = useState(initialSize)

  const fetchSummaries = useCallback(async (offset = 0, limit = initialSize, append = false) => {
    try {
      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      if (searchQuery && searchQuery.trim()) {
        const { data, error: rpcError } = await supabase.rpc('search_summaries', {
          search_query: searchQuery.trim(),
          result_limit: limit,
          result_offset: offset,
        })
        if (rpcError) throw rpcError
        const newData = (data || []) as WeeklySummaryListItem[]
        setHasMore(newData.length === limit)
        setSummaries((prev) => (append ? [...prev, ...newData] : newData))
        return
      }

      let query = supabase
        .from('weekly_summaries')
        .select('id, week_start_date, week_end_date, total_posts, total_participants, created_at, top_discussions')
        .order('week_start_date', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      let newData = (data || []) as WeeklySummaryListItem[]

      if (tagFilter) {
        newData = newData.filter((s) =>
          s.top_discussions?.some(
            (d) =>
              d.ai_tags?.includes(tagFilter) ||
              d.commitfest_tags?.some((t) => t.name === tagFilter)
          )
        )
      }

      setHasMore(newData.length === limit)

      if (append) {
        setSummaries((prev) => [...prev, ...newData])
      } else {
        setSummaries(newData)
      }
    } catch (err) {
      console.error('Error fetching summaries:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch summaries')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [tagFilter, searchQuery, initialSize])

  useEffect(() => {
    setNextPageSize(initialSize)
    fetchSummaries(0, initialSize, false)
  }, [fetchSummaries, initialSize])

  const loadMore = useCallback(() => {
    fetchSummaries(summaries.length, nextPageSize, true)
    setNextPageSize((prev) => prev * 2)
  }, [summaries.length, nextPageSize, fetchSummaries])

  return {
    summaries,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch: () => fetchSummaries(0, initialSize, false),
  }
}
