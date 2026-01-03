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
    const { token, doc_id, attachment_id } = await req.json()

    // Require token and either doc_id (legacy) or attachment_id (new multi-file)
    if (!token || (!doc_id && !attachment_id)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: token and (doc_id or attachment_id)' }),
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

    let documentChecklistId: string
    let filePath: string | null = null

    if (attachment_id) {
      // New multi-file flow: remove specific attachment
      console.log('Removing attachment:', attachment_id)

      // Get the attachment and verify it belongs to this application
      const { data: attachmentData, error: attachmentError } = await supabase
        .from('document_attachments')
        .select(`
          id, 
          file_path, 
          document_checklist_id,
          document_checklist!inner (
            id,
            visa_application_id,
            min_files
          )
        `)
        .eq('id', attachment_id)
        .single()

      if (attachmentError || !attachmentData) {
        console.error('Attachment not found:', attachmentError)
        return new Response(
          JSON.stringify({ error: 'Attachment not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify the document belongs to this visa application
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docChecklist = attachmentData.document_checklist as any
      
      if (docChecklist?.visa_application_id !== portalAccess.visa_application_id) {
        return new Response(
          JSON.stringify({ error: 'Attachment does not belong to this application' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      documentChecklistId = attachmentData.document_checklist_id
      filePath = attachmentData.file_path

      // Delete the attachment record
      const { error: deleteError } = await supabase
        .from('document_attachments')
        .delete()
        .eq('id', attachment_id)

      if (deleteError) {
        console.error('Failed to delete attachment:', deleteError)
        return new Response(
          JSON.stringify({ error: 'Failed to delete attachment' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Remove file from storage if it's a Supabase storage file (not Drive)
      if (filePath && !filePath.startsWith('drive://')) {
        const { error: removeError } = await supabase.storage
          .from('document-attachments')
          .remove([filePath])

        if (removeError) {
          console.error('Failed to remove file from storage:', removeError)
          // Continue anyway since the record is already deleted
        }
      }

      // Count remaining attachments
      const { count: remainingCount } = await supabase
        .from('document_attachments')
        .select('id', { count: 'exact', head: true })
        .eq('document_checklist_id', documentChecklistId)

      const minFiles = docChecklist?.min_files ?? 1
      const isCompleted = (remainingCount || 0) >= minFiles

      // Get the first remaining attachment's file_path for backward compatibility
      let newFilePath: string | null = null
      if (remainingCount && remainingCount > 0) {
        const { data: firstAttachment } = await supabase
          .from('document_attachments')
          .select('file_path')
          .eq('document_checklist_id', documentChecklistId)
          .order('uploaded_at', { ascending: true })
          .limit(1)
          .single()
        
        newFilePath = firstAttachment?.file_path || null
      }

      // Update the document checklist
      const { error: updateError } = await supabase
        .from('document_checklist')
        .update({ 
          file_path: newFilePath, 
          is_completed: isCompleted,
          review_status: isCompleted ? 'in_review' : 'pending'
        })
        .eq('id', documentChecklistId)

      if (updateError) {
        console.error('Failed to update document:', updateError)
        // Don't fail - attachment is already deleted
      }

      console.log('Attachment removed successfully:', { 
        attachmentId: attachment_id, 
        remainingCount, 
        isCompleted 
      })

      return new Response(
        JSON.stringify({ 
          success: true,
          attachment_count: remainingCount || 0,
          is_completed: isCompleted
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Legacy flow: remove document by doc_id (removes all attachments)
      console.log('Legacy remove for doc_id:', doc_id)

      // Get the document to find the file path
      const { data: docData, error: docError } = await supabase
        .from('document_checklist')
        .select('id, visa_application_id, file_path')
        .eq('id', doc_id)
        .eq('visa_application_id', portalAccess.visa_application_id)
        .single()

      if (docError || !docData) {
        console.error('Document not found:', docError)
        return new Response(
          JSON.stringify({ error: 'Document not found or does not belong to this application' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get all attachments for this document
      const { data: attachments } = await supabase
        .from('document_attachments')
        .select('id, file_path')
        .eq('document_checklist_id', doc_id)

      // Delete all attachments
      if (attachments && attachments.length > 0) {
        // Remove files from storage
        const supabaseFiles = attachments
          .filter(a => a.file_path && !a.file_path.startsWith('drive://'))
          .map(a => a.file_path!)

        if (supabaseFiles.length > 0) {
          const { error: removeError } = await supabase.storage
            .from('document-attachments')
            .remove(supabaseFiles)

          if (removeError) {
            console.error('Failed to remove files from storage:', removeError)
          }
        }

        // Delete attachment records
        const { error: deleteAttachmentsError } = await supabase
          .from('document_attachments')
          .delete()
          .eq('document_checklist_id', doc_id)

        if (deleteAttachmentsError) {
          console.error('Failed to delete attachments:', deleteAttachmentsError)
        }
      }

      // Also remove legacy file if it exists (backward compatibility)
      if (docData.file_path && !docData.file_path.startsWith('drive://')) {
        const { error: removeError } = await supabase.storage
          .from('document-attachments')
          .remove([docData.file_path])

        if (removeError) {
          console.error('Failed to remove legacy file from storage:', removeError)
        }
      }

      // Update the document checklist to clear the file
      const { error: updateError } = await supabase
        .from('document_checklist')
        .update({ file_path: null, is_completed: false, review_status: 'pending' })
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
        JSON.stringify({ success: true, attachment_count: 0, is_completed: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
