import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get retention period from platform_settings (default 30 days)
    let retentionDays = 30
    const { data: settingData } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'storage_retention_days')
      .maybeSingle()

    if (settingData?.value) {
      const parsed = typeof settingData.value === 'number' 
        ? settingData.value 
        : parseInt(String(settingData.value), 10)
      if (!isNaN(parsed) && parsed > 0) retentionDays = parsed
    }

    console.log(`Cleanup: retention period = ${retentionDays} days`)

    // Find synced attachments past retention period that still have storage objects
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

    const { data: candidates, error: queryError } = await supabase
      .from('document_attachments')
      .select('id, storage_object_path, drive_file_id')
      .eq('sync_status', 'synced')
      .not('storage_object_path', 'is', null)
      .not('drive_file_id', 'is', null)
      .lt('synced_at', cutoffDate)
      .limit(50)

    if (queryError) {
      console.error('Query error:', queryError)
      return new Response(JSON.stringify({ error: 'Query failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ message: 'No candidates for cleanup', cleaned: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let cleaned = 0
    let skipped = 0

    for (const att of candidates) {
      try {
        // Delete storage object
        const { error: deleteError } = await supabase.storage
          .from('document-attachments')
          .remove([att.storage_object_path!])

        if (deleteError) {
          console.error(`Failed to delete storage object ${att.storage_object_path}:`, deleteError)
          skipped++
          continue
        }

        // Clear storage_object_path
        await supabase
          .from('document_attachments')
          .update({ storage_object_path: null })
          .eq('id', att.id)

        cleaned++
        console.log(`Cleaned storage for attachment ${att.id}`)
      } catch (err) {
        console.error(`Error cleaning attachment ${att.id}:`, err)
        skipped++
      }
    }

    return new Response(
      JSON.stringify({ cleaned, skipped, total_candidates: candidates.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Cleanup error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
