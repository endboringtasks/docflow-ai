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

  // Get usable tokens (decrypt if needed) and self-heal inconsistent encryption state
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

      // If the tokens were stored as plaintext but marked encrypted, atob() throws InvalidCharacterError
      const errName = decryptError instanceof Error ? decryptError.name : ''
      const errMsg = decryptError instanceof Error ? decryptError.message : String(decryptError)
      const looksLikePlaintext = errName === 'InvalidCharacterError' || /base64/i.test(errMsg)

      if (!looksLikePlaintext) {
        return null
      }

      console.warn('Tokens marked encrypted but not valid base64; treating as plaintext and re-encrypting.')
      tokensNeedReencrypt = true
      // Keep accessToken/refreshToken as the stored plaintext values
    }
  } else {
    console.log('Using unencrypted tokens (tokens_encrypted:', conn.tokens_encrypted, ')')

    // If a legacy row has encrypted tokens but tokens_encrypted is false, attempt decrypt (safe fallback if guess is wrong)
    const accessLooksEncrypted = isEncrypted(conn.access_token)
    const refreshLooksEncrypted = isEncrypted(conn.refresh_token)

    if (accessLooksEncrypted || refreshLooksEncrypted) {
      console.log('Tokens look encrypted; attempting decrypt (self-heal).', {
        accessLooksEncrypted,
        refreshLooksEncrypted,
      })

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

  // Persist encrypted tokens so uploads consistently work with tokens_encrypted=true
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

      console.log('Re-saved Drive tokens in encrypted form (self-heal)')
    } catch (encryptError) {
      console.warn('Failed to re-encrypt tokens (continuing with plaintext tokens):', encryptError)
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

    // Encrypt and update tokens in database (keep refresh token encrypted too)
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

  // Use multipart upload for metadata + content
  const boundary = '-------314159265358979323846'
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const metadata = {
    name: fileName,
    parents: [folderId],
  }

  // Create multipart body
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

  // Combine all parts
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
  console.log('Client portal upload request received')
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const token = formData.get('token') as string
    const docId = formData.get('doc_id') as string
    const file = formData.get('file') as File

    console.log('Upload request:', { 
      hasToken: !!token, 
      docId, 
      fileName: file?.name, 
      fileSize: file?.size,
      fileType: file?.type 
    })

    if (!token || !docId || !file) {
      console.error('Missing required fields:', { hasToken: !!token, hasDocId: !!docId, hasFile: !!file })
      return new Response(
        JSON.stringify({ error: 'Missing required fields: token, doc_id, or file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validate the portal access token
    const { data: accessData, error: accessError } = await supabase
      .rpc('validate_portal_access_token', { p_token: token })

    if (accessError || !accessData || accessData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired access token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const portalAccess = accessData[0]

    // Check if already submitted
    if (portalAccess.is_submitted) {
      return new Response(
        JSON.stringify({ error: 'Application already submitted, cannot upload new documents' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the document belongs to this matter and get matter details
    const { data: docData, error: docError } = await supabase
      .from('document_checklist')
      .select('id, matter_id, company_id, document_name')
      .eq('id', docId)
      .eq('matter_id', portalAccess.matter_id)
      .single()

    if (docError || !docData) {
      return new Response(
        JSON.stringify({ error: 'Document not found or does not belong to this application' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the matter's Google Drive folder ID and client's documents_received_folder_id
    const { data: matterData, error: matterError } = await supabase
      .from('matters')
      .select('visa_application_folder_id, company_id, client_id')
      .eq('id', portalAccess.matter_id)
      .single()

    if (matterError) {
      console.error('Error fetching matter:', matterError)
    }

    // Get the client's documents_received_folder_id for storing original files
    let documentsReceivedFolderId: string | null = null
    if (matterData?.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('documents_received_folder_id')
        .eq('id', matterData.client_id)
        .single()
      
      if (clientData?.documents_received_folder_id) {
        documentsReceivedFolderId = clientData.documents_received_folder_id
        console.log('Found documents_received_folder_id:', documentsReceivedFolderId)
      }
    }

    const arrayBuffer = await file.arrayBuffer()
    let filePath: string | null = null
    let driveFileId: string | null = null

    // Try to upload to Google Drive if we have a documents_received_folder_id
    const hasGoogleDriveFolder = documentsReceivedFolderId || matterData?.visa_application_folder_id
    
    if (hasGoogleDriveFolder && matterData?.company_id) {
      console.log('Attempting Google Drive upload...')
      
      const accessToken = await getValidAccessToken(supabase, matterData.company_id)
      
      if (accessToken) {
        // Primary upload: Documents Received folder (original filename)
        if (documentsReceivedFolderId) {
          console.log('Uploading original file to documents_received_folder:', documentsReceivedFolderId)
          const originalResult = await uploadToGoogleDrive(
            accessToken,
            documentsReceivedFolderId,
            file.name, // Original filename
            arrayBuffer,
            file.type || 'application/octet-stream'
          )
          
          if (originalResult) {
            driveFileId = originalResult.id
            filePath = `drive://${originalResult.id}` // Store Drive file reference
            console.log('Successfully uploaded to documents_received_folder:', originalResult.id)
          } else {
            console.warn('Failed to upload to documents_received_folder')
          }
        }
        
        // Secondary upload: Visa Application folder (renamed file)
        if (matterData.visa_application_folder_id) {
          // Create a descriptive filename: DocumentName_OriginalFilename
          const cleanDocName = docData.document_name.replace(/[^a-zA-Z0-9]/g, '_')
          const driveFileName = `${cleanDocName}_${file.name}`
          
          console.log('Uploading renamed file to visa_application_folder:', matterData.visa_application_folder_id)
          const renamedResult = await uploadToGoogleDrive(
            accessToken,
            matterData.visa_application_folder_id,
            driveFileName,
            arrayBuffer,
            file.type || 'application/octet-stream'
          )
          
          if (renamedResult) {
            // If we didn't upload to documents_received, use this as primary
            if (!driveFileId) {
              driveFileId = renamedResult.id
              filePath = `drive://${renamedResult.id}`
            }
            console.log('Successfully uploaded to visa_application_folder:', renamedResult.id)
          } else {
            console.warn('Failed to upload to visa_application_folder')
          }
        }
        
        if (!driveFileId) {
          console.log('All Google Drive uploads failed, falling back to Supabase storage')
        }
      } else {
        console.log('No valid Google Drive access token, falling back to Supabase storage')
      }
    } else {
      console.log('No Google Drive folders configured, using Supabase storage')
    }

    // Fallback to Supabase storage if Google Drive upload failed or not available
    if (!filePath) {
      const fileExt = file.name.split('.').pop()
      filePath = `${docId}/${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('document-attachments')
        .upload(filePath, arrayBuffer, {
          contentType: file.type,
          upsert: false
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

    // Update the document checklist - track client upload source
    const { error: updateError } = await supabase
      .from('document_checklist')
      .update({ 
        file_path: filePath, 
        is_completed: true, 
        uploaded_at: new Date().toISOString(),
        uploaded_by_client: portalAccess.client_id
      })
      .eq('id', docId)

    if (updateError) {
      console.error('Update error:', updateError)
      // Try to clean up if we used Supabase storage
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
        uploaded_to: driveFileId ? 'google_drive' : 'supabase_storage'
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
