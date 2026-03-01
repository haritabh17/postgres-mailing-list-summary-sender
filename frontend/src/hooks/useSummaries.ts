import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface WeeklySummary {
  id: string
  week_start_date: string
  week_end_date: string
  summary_content: string
  total_posts: number
  total_participants: number
  created_at: string
  updated_at: string
}

const INITIAL_SIZE = 3

export function useSummaries() {
  const [summaries, setSummaries] = useState<WeeklySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [nextPageSize, setNextPageSize] = useState(INITIAL_SIZE)

  const fetchSummaries = useCallback(async (offset = 0, limit = INITIAL_SIZE, append = false) => {
    try {
      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('weekly_summaries')
        .select('id, week_start_date, week_end_date, total_posts, total_participants, created_at')
        .order('week_start_date', { ascending: false })
        .range(offset, offset + limit - 1)

      if (fetchError) {
        throw fetchError
      }

      const newData = (data || []) as WeeklySummary[]
      setHasMore(newData.length === limit)

      if (append) {
        setSummaries(prev => [...prev, ...newData])
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
  }, [])

  useEffect(() => {
    fetchSummaries()
  }, [fetchSummaries])

  const loadMore = useCallback(() => {
    fetchSummaries(summaries.length, nextPageSize, true)
    setNextPageSize(prev => prev * 2) // 3 → 6 → 12 → 24 → ...
  }, [summaries.length, nextPageSize, fetchSummaries])

  return {
    summaries,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch: () => fetchSummaries(0, INITIAL_SIZE, false)
  }
}
