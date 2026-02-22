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
    const { token, document_checklist_id, storage_path, file_name, file_type, file_size } = await req.json()

    if (!token || !document_checklist_id || !storage_path || !file_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validate portal access token
    const { data: accessData, error: accessError } = await supabase.rpc('validate_portal_access_token', {
      p_token: token,
    })

    if (accessError || !accessData || accessData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired access token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const portalAccess = accessData[0]

    if (portalAccess.is_submitted) {
      return new Response(
        JSON.stringify({ error: 'Application already submitted' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify document belongs to this application
    const { data: docData, error: docError } = await supabase
      .from('document_checklist')
      .select('id, visa_application_id, company_id, document_name, review_status, review_comment, reviewed_by')
      .eq('id', document_checklist_id)
      .eq('visa_application_id', portalAccess.visa_application_id)
      .single()

    if (docError || !docData) {
      return new Response(
        JSON.stringify({ error: 'Document not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify storage object exists
    const { data: objectData, error: objectError } = await supabase.storage
      .from('document-attachments')
      .list(document_checklist_id, {
        search: storage_path.split('/').pop(),
      })

    const objectExists = objectData && objectData.length > 0
    if (!objectExists) {
      console.error('Storage object not found at path:', storage_path, 'list error:', objectError)
      return new Response(
        JSON.stringify({ error: 'Uploaded file not found in storage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If document is rejected, archive existing attachments before creating new one
    if (docData.review_status === 'rejected') {
      console.log('Document is rejected, archiving existing attachments before new upload')

      const { data: existingAttachments } = await supabase
        .from('document_attachments')
        .select('*')
        .eq('document_checklist_id', document_checklist_id)

      if (existingAttachments && existingAttachments.length > 0) {
        // Insert into history
        const historyRecords = existingAttachments.map((att) => ({
          document_checklist_id: document_checklist_id,
          file_path: att.file_path,
          file_name: att.file_name,
          file_type: att.file_type,
          file_size: att.file_size,
          uploaded_at: att.uploaded_at,
          uploaded_by: att.uploaded_by,
          uploaded_by_client: att.uploaded_by_client,
          archived_reason: 'rejected',
          review_status_at_archive: docData.review_status,
          review_comment_at_archive: docData.review_comment,
          reviewed_by_at_archive: docData.reviewed_by,
          // Carry over sync metadata
          storage_object_path: att.storage_object_path,
          drive_file_id: att.drive_file_id,
          drive_app_folder_file_id: att.drive_app_folder_file_id,
          sync_status: att.sync_status,
          sync_error: att.sync_error,
          sync_attempts: att.sync_attempts,
          synced_at: att.synced_at,
          source: att.source,
        }))

        const { error: historyError } = await supabase
          .from('document_attachment_history')
          .insert(historyRecords)

        if (historyError) {
          console.error('Failed to archive attachments:', historyError)
        } else {
          // Delete old attachments
          await supabase
            .from('document_attachments')
            .delete()
            .eq('document_checklist_id', document_checklist_id)
        }
      }
    }

    // Create document_attachment record
    const { data: attachment, error: insertError } = await supabase
      .from('document_attachments')
      .insert({
        document_checklist_id: document_checklist_id,
        file_path: storage_path, // backward compatible
        file_name: file_name,
        file_type: file_type || null,
        file_size: file_size || null,
        uploaded_by_client: portalAccess.id,
        storage_object_path: storage_path,
        sync_status: 'pending',
        source: 'storage',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create attachment record:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save file metadata' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update document_checklist status
    // Smart status: if was rejected, reset to pending; otherwise mark completed
    const newReviewStatus = docData.review_status === 'rejected' ? 'pending' : docData.review_status
    
    await supabase
      .from('document_checklist')
      .update({
        is_completed: true,
        file_path: storage_path,
        uploaded_at: new Date().toISOString(),
        uploaded_by_client: portalAccess.client_id,
        review_status: newReviewStatus,
        // Clear review comment if re-uploading after rejection
        ...(docData.review_status === 'rejected' ? { review_comment: null } : {}),
      })
      .eq('id', document_checklist_id)

    return new Response(
      JSON.stringify({
        success: true,
        attachment: {
          id: attachment.id,
          file_name: attachment.file_name,
          file_type: attachment.file_type,
          file_size: attachment.file_size,
          uploaded_at: attachment.uploaded_at,
          storage_object_path: attachment.storage_object_path,
        },
      }),
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
