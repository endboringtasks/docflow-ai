import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { token, doc_id } = await req.json()

    if (!token || !doc_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: token or doc_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validate the portal access token
    const { data: accessData, error: accessError } = await supabase
      .rpc("validate_portal_access_token", { p_token: token })

    if (accessError || !accessData || accessData.length === 0) {
      console.error('Token validation failed:', accessError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired access token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const portalAccess = accessData[0]

    // Check if already submitted
    if (portalAccess.is_submitted) {
      return new Response(
        JSON.stringify({ error: 'Application already submitted, cannot remove documents' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the document to find the file path
    const { data: docData, error: docError } = await supabase
      .from('document_checklist')
      .select('id, matter_id, file_path')
      .eq('id', doc_id)
      .eq('matter_id', portalAccess.matter_id)
      .single()

    if (docError || !docData) {
      console.error('Document not found:', docError)
      return new Response(
        JSON.stringify({ error: 'Document not found or does not belong to this application' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Remove file from storage if it exists
    if (docData.file_path) {
      const { error: removeError } = await supabase.storage
        .from('document-attachments')
        .remove([docData.file_path])

      if (removeError) {
        console.error('Failed to remove file from storage:', removeError)
        // Continue anyway to update the checklist
      }
    }

    // Update the document checklist to clear the file
    const { error: updateError } = await supabase
      .from('document_checklist')
      .update({ file_path: null, is_completed: false })
      .eq('id', doc_id)

    if (updateError) {
      console.error('Failed to update document:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update document status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Document removed successfully:', doc_id)
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
