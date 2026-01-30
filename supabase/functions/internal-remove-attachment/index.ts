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

  // Get usable tokens (decrypt if needed)
  let accessToken = conn.access_token
  let refreshToken = conn.refresh_token
  let tokensNeedReencrypt = false

  if (conn.tokens_encrypted === true) {
    console.log('Decrypting stored tokens...')
    try {
      accessToken = await decryptToken(conn.access_token)
      refreshToken = await decryptToken(conn.refresh_token)
    } catch (decryptError) {
      console.error('Failed to decrypt tokens:', decryptError)
      const errName = decryptError instanceof Error ? decryptError.name : ''
      const errMsg = decryptError instanceof Error ? decryptError.message : String(decryptError)
      const looksLikePlaintext = errName === 'InvalidCharacterError' || /base64/i.test(errMsg)

      if (!looksLikePlaintext) {
        return null
      }

      console.warn('Tokens marked encrypted but not valid base64; treating as plaintext.')
      tokensNeedReencrypt = true
    }
  } else {
    console.log('Using unencrypted tokens (tokens_encrypted:', conn.tokens_encrypted, ')')

    const accessLooksEncrypted = isEncrypted(conn.access_token)
    const refreshLooksEncrypted = isEncrypted(conn.refresh_token)

    if (accessLooksEncrypted || refreshLooksEncrypted) {
      console.log('Tokens look encrypted; attempting decrypt.')
      try {
        if (accessLooksEncrypted) accessToken = await decryptToken(conn.access_token)
        if (refreshLooksEncrypted) refreshToken = await decryptToken(conn.refresh_token)
      } catch (guessDecryptError) {
        console.warn('Token decrypt attempt failed; proceeding with plaintext tokens.', guessDecryptError)
        accessToken = conn.access_token
        refreshToken = conn.refresh_token
      }
    }

    tokensNeedReencrypt = true
  }

  // Persist encrypted tokens if needed
  if (tokensNeedReencrypt) {
    try {
      const encryptedAccessToken = await encryptToken(accessToken)
      const encryptedRefreshToken = await encryptToken(refreshToken)

      await supabase
        .from('google_drive_connections')
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          tokens_encrypted: true,
        })
        .eq('company_id', companyId)

      console.log('Re-saved Drive tokens in encrypted form')
    } catch (encryptError) {
      console.warn('Failed to re-encrypt tokens:', encryptError)
    }
  }

  // Check if token needs refresh
  const expiresAt = new Date(conn.token_expires_at)

  if (expiresAt <= new Date()) {
    console.log('Token expired, refreshing...')

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

    // Encrypt and update tokens in database
    const encryptedAccessToken = await encryptToken(accessToken)
    const encryptedRefreshToken = await encryptToken(refreshToken)

    await supabase
      .from('google_drive_connections')
      .update({
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: newExpiresAt,
        tokens_encrypted: true,
      })
      .eq('company_id', companyId)
  }

  return accessToken
}

async function deleteFromGoogleDrive(accessToken: string, fileId: string): Promise<boolean> {
  console.log(`Deleting file from Google Drive: ${fileId}`)

  const deleteResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  // 204 No Content = success, 404 = already deleted (treat as success)
  if (deleteResponse.status === 204 || deleteResponse.status === 404) {
    console.log('File deleted from Google Drive (or already gone):', fileId)
    return true
  }

  const errorData = await deleteResponse.json().catch(() => null)
  console.error('Google Drive delete error:', deleteResponse.status, errorData)
  return false
}

Deno.serve(async (req) => {
  console.log('Internal remove attachment request received')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwt)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { attachment_id, doc_id, file_path } = await req.json()

    console.log('Remove attachment request:', { attachment_id, doc_id, file_path })

    if (!attachment_id || !doc_id || !file_path) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: attachment_id, doc_id, file_path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get attachment and verify access
    const { data: attachmentData, error: attachmentError } = await supabase
      .from('document_attachments')
      .select(`
        id,
        file_path,
        document_checklist_id,
        document_checklist!inner (
          id,
          visa_application_id,
          company_id,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docChecklist = attachmentData.document_checklist as any
    const companyId = docChecklist?.company_id

    // Verify user has access to this company
    const { data: memberData, error: memberError } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !memberData) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete the attachment record
    const { error: deleteError } = await supabase
      .from('document_attachments')
      .delete()
      .eq('id', attachment_id)

    if (deleteError) {
      console.error('Failed to delete attachment record:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete attachment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Remove file from storage
    if (file_path.startsWith('drive://')) {
      // Extract Google Drive file ID and delete from Drive
      const driveFileId = file_path.replace('drive://', '')
      console.log('Deleting from Google Drive:', driveFileId)

      const accessToken = await getValidAccessToken(supabase, companyId)

      if (accessToken) {
        const deleted = await deleteFromGoogleDrive(accessToken, driveFileId)
        if (!deleted) {
          console.warn('Failed to delete file from Google Drive, but attachment record was removed')
        }
      } else {
        console.warn('No valid access token, skipping Google Drive deletion')
      }
    } else {
      // Delete from Supabase storage
      const { error: removeError } = await supabase.storage
        .from('document-attachments')
        .remove([file_path])

      if (removeError) {
        console.error('Failed to remove file from storage:', removeError)
        // Continue anyway since the record is already deleted
      }
    }

    // Count remaining attachments
    const { count: remainingCount } = await supabase
      .from('document_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('document_checklist_id', doc_id)

    const minFiles = docChecklist?.min_files ?? 1
    const isCompleted = (remainingCount || 0) >= minFiles

    // Get the first remaining attachment's file_path for backward compatibility
    let newFilePath: string | null = null
    if (remainingCount && remainingCount > 0) {
      const { data: firstAttachment } = await supabase
        .from('document_attachments')
        .select('file_path')
        .eq('document_checklist_id', doc_id)
        .order('uploaded_at', { ascending: true })
        .limit(1)
        .single()

      newFilePath = firstAttachment?.file_path || null
    }

    // Update document checklist
    const { error: updateError } = await supabase
      .from('document_checklist')
      .update({
        file_path: newFilePath,
        is_completed: isCompleted,
      })
      .eq('id', doc_id)

    if (updateError) {
      console.error('Failed to update document checklist:', updateError)
      // Don't fail - attachment is already deleted
    }

    console.log('Attachment removed successfully:', {
      attachmentId: attachment_id,
      remainingCount,
      isCompleted,
    })

    return new Response(
      JSON.stringify({
        success: true,
        attachment_count: remainingCount || 0,
        is_completed: isCompleted,
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
