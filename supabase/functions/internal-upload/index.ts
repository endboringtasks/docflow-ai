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

function normalizeDriveName(s: string) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

async function listDriveFolders(accessToken: string, parentFolderId: string) {
  const query = `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`

  const driveResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  const data = await driveResponse.json()
  if (data?.error) {
    console.error('Google Drive list folders error:', data.error)
    return [] as Array<{ id: string; name: string }>
  }

  return Array.isArray(data?.files) ? (data.files as Array<{ id: string; name: string }>) : []
}

async function findDriveFolderId(accessToken: string, parentFolderId: string, folderName: string) {
  const folders = await listDriveFolders(accessToken, parentFolderId)
  const target = normalizeDriveName(folderName)
  const match = folders.find((f) => normalizeDriveName(f.name) === target)

  if (!match) return null

  if (match.name !== folderName) {
    console.log('Matched folder with normalized name', { requested: folderName, actual: match.name, id: match.id })
  }

  return match.id
}

async function createDriveFolder(accessToken: string, parentFolderId: string, folderName: string) {
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  })

  const data = await createResponse.json()
  if (data?.error) {
    console.error('Google Drive create folder error:', data.error)
    return null
  }

  return data?.id ?? null
}

async function ensureDocumentsReceivedFolderId(accessToken: string, clientFolderId: string) {
  const folderName = 'Documents Received'

  const existingId = await findDriveFolderId(accessToken, clientFolderId, folderName)
  if (existingId) {
    console.log('Documents Received folder exists:', existingId)
    return existingId
  }

  console.log('Documents Received folder not found; creating under client folder...')
  const createdId = await createDriveFolder(accessToken, clientFolderId, folderName)
  if (createdId) {
    console.log('Created Documents Received folder:', createdId)
  }
  return createdId
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

    // Get the matter's details including Google Drive folder + client
    const { data: matterData, error: matterError } = await supabase
      .from('matters')
      .select('visa_application_folder_id, company_id, client_id')
      .eq('id', matterId)
      .single()

    if (matterError || !matterData) {
      console.error('Error fetching matter:', matterError)
      return new Response(JSON.stringify({ error: 'Matter not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify user has access to this company
    const { data: memberData, error: memberError } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', matterData.company_id)
      .eq('user_id', user.id)
      .single()

    if (memberError || !memberData) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve client folder IDs
    let documentsReceivedFolderId: string | null = null
    let clientFolderId: string | null = null

    if (matterData.client_id) {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('documents_received_folder_id, client_folder_id')
        .eq('id', matterData.client_id)
        .single()

      if (clientError) {
        console.warn('Failed to fetch client folder ids:', clientError)
      } else {
        documentsReceivedFolderId = clientData?.documents_received_folder_id ?? null
        clientFolderId = clientData?.client_folder_id ?? null
      }
    }

    // Check if the company has save_original_to_documents_received enabled
    let saveOriginalEnabled = true // default to true
    const { data: companyData } = await supabase
      .from('companies')
      .select('save_original_to_documents_received')
      .eq('id', matterData.company_id)
      .single()
    
    if (companyData) {
      saveOriginalEnabled = companyData.save_original_to_documents_received ?? true
    }
    console.log('Save original to documents received enabled:', saveOriginalEnabled)

    console.log('Drive folder IDs:', {
      documentsReceivedFolderId,
      clientFolderId,
      visaApplicationFolderId: matterData.visa_application_folder_id,
    })

    const arrayBuffer = await file.arrayBuffer()
    let filePath: string | null = null
    let driveFileId: string | null = null

    const hasGoogleDriveFolderHint = !!(
      documentsReceivedFolderId ||
      clientFolderId ||
      matterData.visa_application_folder_id
    )

    if (hasGoogleDriveFolderHint) {
      console.log('Attempting Google Drive upload...')

      const accessToken = await getValidAccessToken(supabase, matterData.company_id)

      if (accessToken) {
        // If documents_received_folder_id is missing, try to find/create it under client folder
        if (saveOriginalEnabled && !documentsReceivedFolderId && clientFolderId && matterData.client_id) {
          const ensuredId = await ensureDocumentsReceivedFolderId(accessToken, clientFolderId)
          if (ensuredId) {
            documentsReceivedFolderId = ensuredId

            const { error: persistError } = await supabase
              .from('clients')
              .update({ documents_received_folder_id: ensuredId })
              .eq('id', matterData.client_id)

            if (persistError) {
              console.warn('Failed to persist documents_received_folder_id on client:', persistError)
            } else {
              console.log('Persisted documents_received_folder_id on client:', ensuredId)
            }
          }
        }

        // 1) Upload original file to Documents Received folder (if available and enabled)
        if (saveOriginalEnabled && documentsReceivedFolderId) {
          console.log('Uploading original file to documents_received_folder:', documentsReceivedFolderId)
          const originalResult = await uploadToGoogleDrive(
            accessToken,
            documentsReceivedFolderId,
            file.name,
            arrayBuffer,
            file.type || 'application/octet-stream'
          )

          if (originalResult) {
            driveFileId = originalResult.id
            filePath = `drive://${originalResult.id}`
            console.log('Successfully uploaded to documents_received_folder:', originalResult.id)
          } else {
            console.warn('Failed to upload to documents_received_folder')
          }
        } else if (!saveOriginalEnabled) {
          console.log('Skipping Documents Received upload (disabled by company setting)')
        }

        // 2) Upload renamed file to Visa Application folder (if available)
        if (matterData.visa_application_folder_id) {
          const cleanDocName = (documentName || 'Document').replace(/[^a-zA-Z0-9]/g, '_')
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
