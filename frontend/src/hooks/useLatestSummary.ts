import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { WeeklySummary } from '../lib/types'

export function useLatestSummary() {
  const [summary, setSummary] = useState<WeeklySummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchLatest() {
      try {
        const { data } = await supabase
          .from('weekly_summaries')
          .select('*')
          .order('week_start_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        setSummary(data)
      } catch (err) {
        console.error('Error fetching latest summary:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchLatest()
  }, [])

  return { summary, isLoading }
}
