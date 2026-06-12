import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { WeeklySummary } from '../lib/types'

export function useSummary(id: string) {
  const [summary, setSummary] = useState<WeeklySummary | null>(null)
  const [adjacent, setAdjacent] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSummary() {
      if (!id) return
      try {
        setIsLoading(true)
        const { data, error: fetchError } = await supabase
          .from('weekly_summaries')
          .select('*')
          .eq('id', id)
          .single()

        if (fetchError) throw fetchError
        setSummary(data)

        const { data: allSummaries } = await supabase
          .from('weekly_summaries')
          .select('id, week_start_date')
          .order('week_start_date', { ascending: false })

        if (allSummaries) {
          const idx = allSummaries.findIndex((s) => s.id === id)
          setAdjacent({
            prev: idx > 0 ? allSummaries[idx - 1].id : null,
            next: idx < allSummaries.length - 1 ? allSummaries[idx + 1].id : null,
          })
        }
      } catch (err) {
        console.error('Error fetching summary:', err)
        setError('Failed to load summary. Please try again later.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSummary()
  }, [id])

  return { summary, adjacent, isLoading, error }
}
