import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TopDiscussion {
  thread_id?: string;
  subject: string;
  post_count: number;
  participants: number;
  first_post_at: string;
  last_post_at: string;
  thread_url?: string;
  redirect_slug?: string;
  commitfest_tags?: { name: string; color: string | null }[];
  ai_tags?: string[];
  summary_brief?: string;
  summary_detailed?: string;
  summary_deep?: string;
}

interface WeeklySummary {
  id: string;
  week_start_date: string;
  week_end_date: string;
  summary_content: string;
  top_discussions?: TopDiscussion[];
  total_posts: number;
  total_participants: number;
  created_at: string;
}

export function useSummary(id: string) {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('weekly_summaries')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          throw error;
        }

        setSummary(data);
      } catch (err: any) {
        console.error('Error fetching summary:', err.message);
        setError('Failed to load summary. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      fetchSummary();
    }
  }, [id]);

  return { summary, isLoading, error };
}
