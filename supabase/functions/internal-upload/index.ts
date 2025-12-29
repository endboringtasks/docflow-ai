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

  if (conn.tokens_encrypted === true) {
    console.log('Decrypting stored tokens...')
    try {
      accessToken = await decryptToken(conn.access_token)
      refreshToken = await decryptToken(conn.refresh_token)
    } catch (decryptError) {
      console.error('Failed to decrypt tokens:', decryptError)
      return null
    }
  } else {
    console.log('Using unencrypted tokens (tokens_encrypted:', conn.tokens_encrypted, ')')

    // If tokens look encrypted but flag is false, attempt decrypt
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

async function uploadToGoogleDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileContent: ArrayBuffer,
  mimeType: string
): Promise<{ id: string; webViewLink: string } | null> {
  console.log(`Uploading file "${fileName}" to Google Drive folder: ${folderId}`)

  const boundary = '-------314159265358979323846'
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const metadata = {
    name: fileName,
    parents: [folderId],
  }

  const multipartBody = new TextEncoder().encode(
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n'
  )

  // Convert file content to base64 in chunks to avoid stack overflow
  const uint8Array = new Uint8Array(fileContent)
  const chunkSize = 8192
  let base64Content = ''
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize)
    base64Content += String.fromCharCode.apply(null, Array.from(chunk))
  }
  base64Content = btoa(base64Content)

  const base64Bytes = new TextEncoder().encode(base64Content)
  const closeBytes = new TextEncoder().encode(closeDelimiter)

  const fullBody = new Uint8Array(multipartBody.length + base64Bytes.length + closeBytes.length)
  fullBody.set(multipartBody, 0)
  fullBody.set(base64Bytes, multipartBody.length)
  fullBody.set(closeBytes, multipartBody.length + base64Bytes.length)

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullBody,
    }
  )

  const uploadResult = await uploadResponse.json()

  if (uploadResult.error) {
    console.error('Google Drive upload error:', uploadResult.error)
    return null
  }

  console.log('File uploaded to Google Drive:', uploadResult.id)
  return { id: uploadResult.id, webViewLink: uploadResult.webViewLink }
}

Deno.serve(async (req) => {
  console.log('Internal upload request received')

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

    // Verify the JWT token
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const formData = await req.formData()
    const matterId = formData.get('matter_id') as string
    const docId = formData.get('doc_id') as string
    const file = formData.get('file') as File
    const documentName = formData.get('document_name') as string

    console.log('Upload request:', {
      matterId,
      docId,
      fileName: file?.name,
      fileSize: file?.size,
      documentName,
    })

    if (!matterId || !docId || !file) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: matter_id, doc_id, or file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the matter's details including Google Drive folder
    const { data: matterData, error: matterError } = await supabase
      .from('matters')
      .select('visa_application_folder_id, company_id')
      .eq('id', matterId)
      .single()

    if (matterError || !matterData) {
      console.error('Error fetching matter:', matterError)
      return new Response(
        JSON.stringify({ error: 'Matter not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user has access to this company
    const { data: memberData, error: memberError } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', matterData.company_id)
      .eq('user_id', user.id)
      .single()

    if (memberError || !memberData) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    let filePath: string | null = null
    let driveFileId: string | null = null

    // Try to upload to Google Drive if folder exists
    if (matterData.visa_application_folder_id) {
      console.log('Matter has Drive folder, attempting Google Drive upload...')

      const accessToken = await getValidAccessToken(supabase, matterData.company_id)

      if (accessToken) {
        // Create a descriptive filename
        const cleanDocName = (documentName || 'Document').replace(/[^a-zA-Z0-9]/g, '_')
        const driveFileName = `${cleanDocName}_${file.name}`

        const driveResult = await uploadToGoogleDrive(
          accessToken,
          matterData.visa_application_folder_id,
          driveFileName,
          arrayBuffer,
          file.type || 'application/octet-stream'
        )

        if (driveResult) {
          driveFileId = driveResult.id
          filePath = `drive://${driveResult.id}`
          console.log('Successfully uploaded to Google Drive:', driveFileId)
        } else {
          console.log('Google Drive upload failed, falling back to Supabase storage')
        }
      } else {
        console.log('No valid Google Drive access token, falling back to Supabase storage')
      }
    } else {
      console.log('Matter has no Drive folder, using Supabase storage')
    }

    // Fallback to Supabase storage if Google Drive upload failed or not available
    if (!filePath) {
      const fileExt = file.name.split('.').pop()
      filePath = `${docId}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('document-attachments')
        .upload(filePath, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('Supabase storage upload error:', uploadError)
        return new Response(
          JSON.stringify({ error: 'Failed to upload file' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('File uploaded to Supabase storage:', filePath)
    }

    // Update the document checklist
    const { error: updateError } = await supabase
      .from('document_checklist')
      .update({
        file_path: filePath,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user.id,
      })
      .eq('id', docId)

    if (updateError) {
      console.error('Update error:', updateError)
      // Clean up if we used Supabase storage
      if (!driveFileId) {
        await supabase.storage.from('document-attachments').remove([filePath])
      }
      return new Response(
        JSON.stringify({ error: 'Failed to update document status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        file_path: filePath,
        uploaded_to: driveFileId ? 'google_drive' : 'supabase_storage',
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
