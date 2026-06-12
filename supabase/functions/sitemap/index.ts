import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SITE_URL = 'https://www.postgreshackersdigest.dev'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: summaries, error } = await supabase
      .from('weekly_summaries')
      .select('id, created_at, updated_at')
      .order('week_start_date', { ascending: false })

    if (error) throw error

    const staticPages = ['/', '/archive']
    const staticUrls = staticPages.map((path) => `  <url>
    <loc>${SITE_URL}${path}</loc>
    <changefreq>weekly</changefreq>
    <priority>${path === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')

    const summaryUrls = (summaries || []).map((s) => `  <url>
    <loc>${SITE_URL}/summary/${s.id}</loc>
    <lastmod>${(s.updated_at || s.created_at).split('T')[0]}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${summaryUrls}
</urlset>`

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Sitemap error:', error)
    return new Response('Error generating sitemap', { status: 500 })
  }
})
