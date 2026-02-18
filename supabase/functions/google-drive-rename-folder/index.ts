import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { decryptToken, isEncrypted, encryptToken } from '../_shared/token-encryption.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

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
      console.error('Failed to decrypt tokens:', decryptError)
      const errName = decryptError instanceof Error ? decryptError.name : ''
      const errMsg = decryptError instanceof Error ? decryptError.message : String(decryptError)
      const looksLikePlaintext = errName === 'InvalidCharacterError' || /base64/i.test(errMsg)
      if (!looksLikePlaintext) return null
      console.warn('Tokens marked encrypted but not valid base64; treating as plaintext.')
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
    } catch (encryptError) {
      console.warn('Failed to re-encrypt tokens:', encryptError)
    }
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { companyId, folderId, newPrefix } = await req.json()
    if (!companyId || !folderId || !newPrefix) {
      return new Response(JSON.stringify({ error: 'Missing required fields: companyId, folderId, newPrefix' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify company membership
    const { data: memberData, error: memberError } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !memberData) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accessToken = await getValidAccessToken(supabase, companyId)
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No valid Google Drive access token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get current folder name
    const getResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!getResponse.ok) {
      const errData = await getResponse.json().catch(() => null)
      console.error('Failed to get folder name:', getResponse.status, errData)
      return new Response(JSON.stringify({ error: 'Failed to get folder from Google Drive', details: errData }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const folderData = await getResponse.json()
    const currentName = folderData.name as string

    // Skip if already prefixed
    if (currentName.startsWith(newPrefix)) {
      console.log('Folder already has prefix:', currentName)
      return new Response(JSON.stringify({ success: true, newName: currentName }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rename folder
    const newName = `${newPrefix}${currentName}`
    const patchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      }
    )

    if (!patchResponse.ok) {
      const errData = await patchResponse.json().catch(() => null)
      console.error('Failed to rename folder:', patchResponse.status, errData)
      return new Response(JSON.stringify({ error: 'Failed to rename folder', details: errData }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Renamed folder ${folderId}: "${currentName}" -> "${newName}"`)

    return new Response(JSON.stringify({ success: true, newName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
