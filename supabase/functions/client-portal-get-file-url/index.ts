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
    const { token, file_path, attachment_id } = await req.json()

    // Require token and either file_path (legacy) or attachment_id (new)
    if (!token || (!file_path && !attachment_id)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: token and (file_path or attachment_id)' }),
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
      return new Response(
        JSON.stringify({ error: 'Invalid or expired access token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const portalAccess = accessData[0]
    let actualFilePath: string | null = null

    if (attachment_id) {
      // New flow: get file path from attachment_id
      const { data: attachmentData, error: attachmentError } = await supabase
        .from('document_attachments')
        .select(`
          file_path,
          document_checklist!inner (
            visa_application_id
          )
        `)
        .eq('id', attachment_id)
        .single()

      if (attachmentError || !attachmentData) {
        return new Response(
          JSON.stringify({ error: 'Attachment not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docChecklist = attachmentData.document_checklist as any
      if (docChecklist?.visa_application_id !== portalAccess.visa_application_id) {
        return new Response(
          JSON.stringify({ error: 'Attachment does not belong to this application' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      actualFilePath = attachmentData.file_path
    } else {
      // Legacy flow: use file_path directly
      // First try to find in document_checklist
      const docId = file_path.split('/')[0]
      const { data: docData } = await supabase
        .from('document_checklist')
        .select('id, file_path')
        .eq('id', docId)
        .eq('visa_application_id', portalAccess.visa_application_id)
        .maybeSingle()

      if (docData) {
        actualFilePath = file_path
      } else {
        // Also check in document_attachments
        const { data: attachmentData } = await supabase
          .from('document_attachments')
          .select(`
            file_path,
            document_checklist!inner (
              visa_application_id
            )
          `)
          .eq('file_path', file_path)
          .single()

        if (attachmentData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const docChecklist = attachmentData.document_checklist as any
          if (docChecklist?.visa_application_id === portalAccess.visa_application_id) {
            actualFilePath = attachmentData.file_path
          }
        }
      }

      if (!actualFilePath) {
        return new Response(
          JSON.stringify({ error: 'File not found or access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // TypeScript null check (already handled above, but for type safety)
    if (!actualFilePath) {
      return new Response(
        JSON.stringify({ error: 'File path not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle Google Drive files
    if (actualFilePath.startsWith('drive://')) {
      // For Drive files, we return a special response indicating it's a Drive file
      // The client should use get-drive-file-url for these
      return new Response(
        JSON.stringify({ 
          error: 'Google Drive files require special handling',
          is_drive_file: true,
          drive_file_id: actualFilePath.replace('drive://', '')
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate signed URL for Supabase storage files (valid for 1 hour)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('document-attachments')
      .createSignedUrl(actualFilePath, 3600)

    if (urlError || !signedUrlData?.signedUrl) {
      console.error('Error creating signed URL:', urlError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate file URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ url: signedUrlData.signedUrl }),
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
