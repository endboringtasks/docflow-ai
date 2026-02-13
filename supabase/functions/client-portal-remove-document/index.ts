import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { decryptToken, isEncrypted, encryptToken } from '../_shared/token-encryption.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

interface DriveConnection {
  access_token: string
  refresh_token: string
  token_expires_at: string
  tokens_encrypted: boolean | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getValidAccessToken(
  supabase: any,
  companyId: string
): Promise<string | null> {
  const { data: connection, error: connError } = await supabase
    .from('google_drive_connections')
    .select('access_token, refresh_token, token_expires_at, tokens_encrypted')
    .eq('company_id', companyId)
    .single()

  if (connError || !connection) {
    console.log('No Google Drive connection found for company:', companyId)
    return null
  }

  const conn = connection as DriveConnection

  let accessToken = conn.access_token
  let refreshToken = conn.refresh_token
  let tokensNeedReencrypt = false

  if (conn.tokens_encrypted === true) {
    try {
      accessToken = await decryptToken(conn.access_token)
      refreshToken = await decryptToken(conn.refresh_token)
    } catch (decryptError) {
      const errName = decryptError instanceof Error ? decryptError.name : ''
      const errMsg = decryptError instanceof Error ? decryptError.message : String(decryptError)
      const looksLikePlaintext = errName === 'InvalidCharacterError' || /base64/i.test(errMsg)
      if (!looksLikePlaintext) return null
      tokensNeedReencrypt = true
    }
  } else {
    const accessLooksEncrypted = isEncrypted(conn.access_token)
    const refreshLooksEncrypted = isEncrypted(conn.refresh_token)
    if (accessLooksEncrypted || refreshLooksEncrypted) {
      try {
        if (accessLooksEncrypted) accessToken = await decryptToken(conn.access_token)
        if (refreshLooksEncrypted) refreshToken = await decryptToken(conn.refresh_token)
      } catch {
        accessToken = conn.access_token
        refreshToken = conn.refresh_token
      }
    }
    tokensNeedReencrypt = true
  }

  if (tokensNeedReencrypt) {
    try {
      const encryptedAccessToken = await encryptToken(accessToken)
      const encryptedRefreshToken = await encryptToken(refreshToken)
      await supabase
        .from('google_drive_connections')
        .update({ access_token: encryptedAccessToken, refresh_token: encryptedRefreshToken, tokens_encrypted: true })
        .eq('company_id', companyId)
    } catch { /* continue */ }
  }

  const expiresAt = new Date(conn.token_expires_at)
  if (expiresAt <= new Date()) {
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const refreshData = await refreshResponse.json()
    if (refreshData.error) {
      console.error('Token refresh failed:', refreshData)
      return null
    }
    accessToken = refreshData.access_token
    const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
    const encryptedAccessToken = await encryptToken(accessToken)
    const encryptedRefreshToken = await encryptToken(refreshToken)
    await supabase
      .from('google_drive_connections')
      .update({ access_token: encryptedAccessToken, refresh_token: encryptedRefreshToken, token_expires_at: newExpiresAt, tokens_encrypted: true })
      .eq('company_id', companyId)
  }

  return accessToken
}

async function renameGoogleDriveFile(
  accessToken: string,
  fileId: string,
  newName: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      }
    )
    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      console.error('Google Drive rename error:', response.status, errorData)
    }
    return response.ok
  } catch (error) {
    console.error('Failed to rename Drive file:', error)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { token, doc_id, attachment_id } = await req.json()

    if (!token || (!doc_id && !attachment_id)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: token and (doc_id or attachment_id)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    if (portalAccess.is_submitted) {
      return new Response(
        JSON.stringify({ error: 'Application already submitted, cannot remove documents' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (attachment_id) {
      // New multi-file flow: remove specific attachment
      console.log('Removing attachment:', attachment_id)

      const { data: attachmentData, error: attachmentError } = await supabase
        .from('document_attachments')
        .select(`
          id, 
          file_path,
          file_name,
          file_type,
          file_size,
          uploaded_at,
          uploaded_by,
          uploaded_by_client,
          document_checklist_id,
          document_checklist!inner (
            id,
            visa_application_id,
            min_files,
            review_status,
            company_id
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docChecklist = attachmentData.document_checklist as any
      
      if (docChecklist?.visa_application_id !== portalAccess.visa_application_id) {
        return new Response(
          JSON.stringify({ error: 'Attachment does not belong to this application' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (docChecklist?.review_status === 'rejected') {
        console.log('Blocking deletion of rejected document attachment')
        return new Response(
          JSON.stringify({ 
            error: 'Cannot delete rejected documents. Please upload a replacement document instead.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const documentChecklistId = attachmentData.document_checklist_id
      const filePath = attachmentData.file_path
      const companyId = docChecklist?.company_id

      // Archive to history before deleting
      const { error: archiveError } = await supabase
        .from('document_attachment_history')
        .insert({
          document_checklist_id: documentChecklistId,
          file_path: attachmentData.file_path,
          file_name: attachmentData.file_name,
          file_type: attachmentData.file_type,
          file_size: attachmentData.file_size,
          uploaded_at: attachmentData.uploaded_at,
          uploaded_by: attachmentData.uploaded_by,
          uploaded_by_client: attachmentData.uploaded_by_client,
          archived_reason: 'client_deleted',
          review_status_at_archive: docChecklist?.review_status || null,
        })

      if (archiveError) {
        console.error('Failed to archive attachment to history:', archiveError)
      } else {
        console.log('Attachment archived to history before deletion')
      }

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

      // Handle file: rename Drive files with DELETED_ prefix, remove Supabase storage files
      if (filePath && filePath.startsWith('drive://') && companyId) {
        const driveFileId = filePath.replace('drive://', '')
        const accessToken = await getValidAccessToken(supabase, companyId)
        if (accessToken) {
          const deletedName = `DELETED_${attachmentData.file_name}`
          console.log(`Renaming deleted Drive file ${driveFileId} to ${deletedName}`)
          await renameGoogleDriveFile(accessToken, driveFileId, deletedName)
        } else {
          console.warn('No valid access token for renaming deleted Drive file, skipping rename')
        }
      } else if (filePath && !filePath.startsWith('drive://')) {
        const { error: removeError } = await supabase.storage
          .from('document-attachments')
          .remove([filePath])
        if (removeError) {
          console.error('Failed to remove file from storage:', removeError)
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

      // Preserve pending_client status
      const previousStatus = docChecklist?.review_status
      let newReviewStatus: string
      if (previousStatus === 'pending_client') {
        newReviewStatus = 'pending_client'
      } else {
        newReviewStatus = isCompleted ? 'in_review' : 'pending'
      }

      // Update the document checklist
      const { error: updateError } = await supabase
        .from('document_checklist')
        .update({ 
          file_path: newFilePath, 
          is_completed: isCompleted,
          review_status: newReviewStatus
        })
        .eq('id', documentChecklistId)

      if (updateError) {
        console.error('Failed to update document:', updateError)
      }

      console.log('Attachment removed successfully:', { 
        attachmentId: attachment_id, 
        remainingCount, 
        isCompleted,
        newReviewStatus
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

      const { data: docData, error: docError } = await supabase
        .from('document_checklist')
        .select('id, visa_application_id, file_path, review_status, company_id')
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
        .select('id, file_path, file_name, file_type, file_size, uploaded_at, uploaded_by, uploaded_by_client')
        .eq('document_checklist_id', doc_id)

      // Archive and delete all attachments
      if (attachments && attachments.length > 0) {
        // Archive to history
        const historyRecords = attachments.map(a => ({
          document_checklist_id: doc_id,
          file_path: a.file_path,
          file_name: a.file_name,
          file_type: a.file_type,
          file_size: a.file_size,
          uploaded_at: a.uploaded_at,
          uploaded_by: a.uploaded_by,
          uploaded_by_client: a.uploaded_by_client,
          archived_reason: 'client_deleted',
          review_status_at_archive: docData.review_status || null,
        }))

        const { error: archiveError } = await supabase
          .from('document_attachment_history')
          .insert(historyRecords)

        if (archiveError) {
          console.error('Failed to archive attachments to history:', archiveError)
        } else {
          console.log('Archived', attachments.length, 'attachments to history')
        }

        // Rename Drive files with DELETED_ prefix
        const driveAttachments = attachments.filter(a => a.file_path && a.file_path.startsWith('drive://'))
        if (driveAttachments.length > 0 && docData.company_id) {
          const accessToken = await getValidAccessToken(supabase, docData.company_id)
          if (accessToken) {
            for (const att of driveAttachments) {
              const driveFileId = att.file_path.replace('drive://', '')
              const deletedName = `DELETED_${att.file_name}`
              console.log(`Renaming deleted Drive file ${driveFileId} to ${deletedName}`)
              await renameGoogleDriveFile(accessToken, driveFileId, deletedName)
            }
          } else {
            console.warn('No valid access token for renaming deleted Drive files, skipping rename')
          }
        }

        // Remove Supabase storage files
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

      // Also remove legacy file if it exists
      if (docData.file_path && !docData.file_path.startsWith('drive://')) {
        const { error: removeError } = await supabase.storage
          .from('document-attachments')
          .remove([docData.file_path])

        if (removeError) {
          console.error('Failed to remove legacy file from storage:', removeError)
        }
      } else if (docData.file_path && docData.file_path.startsWith('drive://') && docData.company_id) {
        // Rename legacy Drive file too
        const driveFileId = docData.file_path.replace('drive://', '')
        const accessToken = await getValidAccessToken(supabase, docData.company_id)
        if (accessToken) {
          await renameGoogleDriveFile(accessToken, driveFileId, `DELETED_legacy_file`)
        }
      }

      // Preserve pending_client status
      const previousStatus = docData.review_status
      let newReviewStatus: string
      if (previousStatus === 'pending_client') {
        newReviewStatus = 'pending_client'
      } else {
        newReviewStatus = 'pending'
      }

      // Update the document checklist
      const { error: updateError } = await supabase
        .from('document_checklist')
        .update({ file_path: null, is_completed: false, review_status: newReviewStatus })
        .eq('id', doc_id)

      if (updateError) {
        console.error('Failed to update document:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update document status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Document removed successfully:', doc_id, 'new status:', newReviewStatus)
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
