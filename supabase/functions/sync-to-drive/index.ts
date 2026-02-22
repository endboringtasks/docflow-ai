import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { decryptToken, isEncrypted, encryptToken } from '../_shared/token-encryption.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_MAX_ATTEMPTS = 5

// Backoff windows in minutes for each attempt
const BACKOFF_MINUTES = [0, 2, 5, 15, 60]

interface DriveConnection {
  access_token: string
  refresh_token: string
  token_expires_at: string
  tokens_encrypted: boolean | null
}

async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  companyId: string
): Promise<string | null> {
  const { data: connection, error: connError } = await supabase
    .from('google_drive_connections')
    .select('access_token, refresh_token, token_expires_at, tokens_encrypted')
    .eq('company_id', companyId)
    .is('disconnected_at', null)
    .single()

  if (connError || !connection) return null

  const conn = connection as DriveConnection
  let accessToken = conn.access_token
  let refreshToken = conn.refresh_token

  // Decrypt tokens if needed
  if (conn.tokens_encrypted === true) {
    try {
      accessToken = await decryptToken(conn.access_token)
      refreshToken = await decryptToken(conn.refresh_token)
    } catch {
      // Try plaintext if decrypt fails
      const looksEncrypted = isEncrypted(conn.access_token)
      if (looksEncrypted) return null
    }
  } else {
    if (isEncrypted(conn.access_token)) {
      try {
        accessToken = await decryptToken(conn.access_token)
        refreshToken = await decryptToken(conn.refresh_token)
      } catch {
        // Use as-is
      }
    }
  }

  // Refresh if expired
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
    if (refreshData.error) return null

    accessToken = refreshData.access_token
    const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()

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
): Promise<{ id: string } | null> {
  const boundary = '-------314159265358979323846'
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const metadata = { name: fileName, parents: [folderId] }

  const multipartBody = new TextEncoder().encode(
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n'
  )

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
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullBody,
    }
  )

  const result = await uploadResponse.json()
  if (result.error) return null
  return { id: result.id }
}

async function findDriveFolderId(
  accessToken: string,
  parentFolderId: string,
  folderName: string
): Promise<string | null> {
  const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  const query = `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  const data = await response.json()
  if (data?.error) return null

  const files: Array<{ id: string; name: string }> = Array.isArray(data?.files) ? data.files : []
  const target = normalize(folderName)
  const match = files.find((f) => normalize(f.name) === target)
  return match?.id ?? null
}

async function createDriveFolder(
  accessToken: string,
  parentFolderId: string,
  folderName: string
): Promise<string | null> {
  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
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

  const data = await response.json()
  return data?.id ?? null
}

async function ensureDocumentsReceivedFolderId(
  accessToken: string,
  clientFolderId: string
): Promise<string | null> {
  const existingId = await findDriveFolderId(accessToken, clientFolderId, 'Documents Received')
  if (existingId) return existingId
  return await createDriveFolder(accessToken, clientFolderId, 'Documents Received')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Load configurable settings
    let batchSize = DEFAULT_BATCH_SIZE
    let maxAttempts = DEFAULT_MAX_ATTEMPTS
    {
      const { data: settingsRows } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['sync_batch_size', 'sync_max_attempts'])
      for (const row of settingsRows || []) {
        const val = Number((row.value as any)?.value)
        if (!isNaN(val) && val > 0) {
          if (row.key === 'sync_batch_size') batchSize = val
          if (row.key === 'sync_max_attempts') maxAttempts = val
        }
      }
    }

    // Query pending/failed attachments that are within retry limits and past backoff window
    const { data: pendingAttachments, error: queryError } = await supabase
      .from('document_attachments')
      .select(`
        id, storage_object_path, file_name, file_type, file_size, drive_file_id, 
        sync_status, sync_attempts, last_sync_attempt_at,
        document_checklist_id
      `)
      .in('sync_status', ['pending', 'failed'])
      .lt('sync_attempts', maxAttempts)
      .not('storage_object_path', 'is', null)
      .order('created_at', { ascending: true })
      .limit(batchSize)

    if (queryError) {
      console.error('Error querying pending attachments:', queryError)
      return new Response(JSON.stringify({ error: 'Query failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!pendingAttachments || pendingAttachments.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending attachments', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Filter out items still in backoff window
    const now = Date.now()
    const eligible = pendingAttachments.filter((att) => {
      if (att.sync_status === 'pending' && att.sync_attempts === 0) return true
      if (!att.last_sync_attempt_at) return true
      const backoffMinutes = BACKOFF_MINUTES[Math.min(att.sync_attempts, BACKOFF_MINUTES.length - 1)]
      const backoffMs = backoffMinutes * 60 * 1000
      return now - new Date(att.last_sync_attempt_at).getTime() >= backoffMs
    })

    if (eligible.length === 0) {
      return new Response(JSON.stringify({ message: 'All pending items in backoff window', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mark as processing
    const eligibleIds = eligible.map((a) => a.id)
    await supabase
      .from('document_attachments')
      .update({
        sync_status: 'processing',
        sync_attempts: supabase.rpc ? undefined : undefined, // handled per-item below
        last_sync_attempt_at: new Date().toISOString(),
      })
      .in('id', eligibleIds)

    let processed = 0
    let synced = 0
    let failed = 0

    for (const att of eligible) {
      const correlationId = att.id
      console.log(`[${correlationId}] Processing attachment: ${att.file_name}`)

      try {
        // Idempotency: skip if already synced
        if (att.drive_file_id) {
          console.log(`[${correlationId}] Already has drive_file_id, marking synced`)
          await supabase
            .from('document_attachments')
            .update({ sync_status: 'synced', synced_at: new Date().toISOString() })
            .eq('id', att.id)
          synced++
          processed++
          continue
        }

        // Increment sync_attempts
        await supabase
          .from('document_attachments')
          .update({
            sync_attempts: (att.sync_attempts || 0) + 1,
            last_sync_attempt_at: new Date().toISOString(),
          })
          .eq('id', att.id)

        // Look up document_checklist -> visa_application -> client -> company
        const { data: docChecklist } = await supabase
          .from('document_checklist')
          .select('visa_application_id, company_id, document_name')
          .eq('id', att.document_checklist_id)
          .single()

        if (!docChecklist) {
          console.error(`[${correlationId}] Document checklist not found`)
          await supabase
            .from('document_attachments')
            .update({ sync_status: 'failed', sync_error: 'Document checklist not found' })
            .eq('id', att.id)
          failed++
          processed++
          continue
        }

        const { data: visaApp } = await supabase
          .from('visa_applications')
          .select('visa_application_folder_id, client_id, company_id')
          .eq('id', docChecklist.visa_application_id)
          .single()

        if (!visaApp) {
          await supabase
            .from('document_attachments')
            .update({ sync_status: 'failed', sync_error: 'Visa application not found' })
            .eq('id', att.id)
          failed++
          processed++
          continue
        }

        // Check company Drive connection
        const accessToken = await getValidAccessToken(supabase, visaApp.company_id)
        if (!accessToken) {
          console.log(`[${correlationId}] No Drive connection, setting waiting_for_drive`)
          await supabase
            .from('document_attachments')
            .update({ sync_status: 'waiting_for_drive', sync_error: 'Google Drive not connected' })
            .eq('id', att.id)
          processed++
          continue
        }

        // Get client info for file naming
        const { data: clientData } = await supabase
          .from('clients')
          .select('documents_received_folder_id, client_folder_id, first_name, last_name, company_name, client_type')
          .eq('id', visaApp.client_id)
          .single()

        // Check company setting for save_original
        const { data: companyData } = await supabase
          .from('companies')
          .select('save_original_to_documents_received')
          .eq('id', visaApp.company_id)
          .single()

        const saveOriginalEnabled = companyData?.save_original_to_documents_received ?? true

        // Download file from Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('document-attachments')
          .download(att.storage_object_path!)

        if (downloadError || !fileData) {
          console.error(`[${correlationId}] Failed to download from storage:`, downloadError)
          await supabase
            .from('document_attachments')
            .update({ sync_status: 'failed', sync_error: `Storage download failed: ${downloadError?.message}` })
            .eq('id', att.id)
          failed++
          processed++
          continue
        }

        const arrayBuffer = await fileData.arrayBuffer()
        const mimeType = att.file_type || 'application/octet-stream'
        let driveFileId: string | null = null
        let driveAppFolderFileId: string | null = null

        // Upload to Documents Received folder
        let documentsReceivedFolderId = clientData?.documents_received_folder_id || null
        const clientFolderId = clientData?.client_folder_id || null

        if (saveOriginalEnabled) {
          if (!documentsReceivedFolderId && clientFolderId) {
            const ensuredId = await ensureDocumentsReceivedFolderId(accessToken, clientFolderId)
            if (ensuredId) {
              documentsReceivedFolderId = ensuredId
              await supabase
                .from('clients')
                .update({ documents_received_folder_id: ensuredId })
                .eq('id', visaApp.client_id)
            }
          }

          if (documentsReceivedFolderId) {
            const result = await uploadToGoogleDrive(
              accessToken,
              documentsReceivedFolderId,
              att.file_name,
              arrayBuffer,
              mimeType
            )
            if (result) {
              driveFileId = result.id
              console.log(`[${correlationId}] Uploaded to Documents Received: ${result.id}`)
            }
          }
        }

        // Upload renamed copy to application folder
        if (visaApp.visa_application_folder_id) {
          const clientType = clientData?.client_type || 'personal'
          let clientPrefix = ''
          if (clientType === 'corporate' && clientData?.company_name) {
            clientPrefix = clientData.company_name.replace(/[^a-zA-Z0-9]/g, '_')
          } else {
            const lastName = clientData?.last_name || 'Unknown'
            const firstName = clientData?.first_name || 'Client'
            const lastNameParts = lastName.trim().split(/\s+/)
            const primaryLastName = lastNameParts[lastNameParts.length - 1].toUpperCase()
            const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
            clientPrefix = `${primaryLastName}_${formattedFirstName}`
          }

          const rawDocName = docChecklist.document_name
            .replace(/^\[[^\]]+:(required|optional)\]\s*/i, '')
            .replace(/^\[Custom\]\s*/i, '')
          const cleanDocName = rawDocName
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
          const fileExt = att.file_name.includes('.') ? att.file_name.split('.').pop() : ''
          const driveFileName = `${clientPrefix}_${cleanDocName}.${fileExt}`

          const result = await uploadToGoogleDrive(
            accessToken,
            visaApp.visa_application_folder_id,
            driveFileName,
            arrayBuffer,
            mimeType
          )
          if (result) {
            driveAppFolderFileId = result.id
            if (!driveFileId) driveFileId = result.id
            console.log(`[${correlationId}] Uploaded to application folder: ${result.id}`)
          }
        }

        if (!driveFileId) {
          await supabase
            .from('document_attachments')
            .update({ sync_status: 'failed', sync_error: 'All Drive uploads failed' })
            .eq('id', att.id)
          failed++
          processed++
          continue
        }

        // Update attachment with Drive info
        await supabase
          .from('document_attachments')
          .update({
            drive_file_id: driveFileId,
            drive_app_folder_file_id: driveAppFolderFileId,
            file_path: `drive://${driveFileId}`,
            sync_status: 'synced',
            synced_at: new Date().toISOString(),
            sync_error: null,
          })
          .eq('id', att.id)

        // Also update document_checklist file_path for backward compatibility
        await supabase
          .from('document_checklist')
          .update({ file_path: `drive://${driveFileId}` })
          .eq('id', att.document_checklist_id)

        synced++
        processed++
        console.log(`[${correlationId}] Sync complete`)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error(`[${correlationId}] Sync error:`, errorMessage)
        await supabase
          .from('document_attachments')
          .update({ sync_status: 'failed', sync_error: errorMessage })
          .eq('id', att.id)
        failed++
        processed++
      }
    }

    return new Response(
      JSON.stringify({ processed, synced, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Sync-to-drive error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
