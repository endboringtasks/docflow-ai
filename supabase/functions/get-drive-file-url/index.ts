import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { decryptToken, isEncrypted } from '../_shared/token-encryption.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    console.error('Google OAuth credentials not configured')
    return null
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text())
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { file_id, company_id } = await req.json()

    if (!file_id || !company_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file_id or company_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is authenticated and has access to the company
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is a member of the company
    const { data: membership, error: memberError } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', company_id)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Google Drive connection for the company
    const { data: driveConnection, error: driveError } = await supabase
      .from('google_drive_connections')
      .select('access_token, refresh_token, token_expires_at, tokens_encrypted')
      .eq('company_id', company_id)
      .single()

    if (driveError || !driveConnection) {
      return new Response(
        JSON.stringify({ error: 'Google Drive not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decrypt tokens if encrypted
    let accessToken = driveConnection.access_token
    let refreshToken = driveConnection.refresh_token

    if (driveConnection.tokens_encrypted) {
      try {
        if (isEncrypted(accessToken)) {
          accessToken = await decryptToken(accessToken)
        }
        if (isEncrypted(refreshToken)) {
          refreshToken = await decryptToken(refreshToken)
        }
      } catch (decryptError) {
        console.error('Error decrypting tokens:', decryptError)
        return new Response(
          JSON.stringify({ error: 'Failed to decrypt tokens' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check if token is expired and refresh if needed
    const tokenExpiry = new Date(driveConnection.token_expires_at)
    if (tokenExpiry < new Date()) {
      console.log('Token expired, refreshing...')
      const newTokens = await refreshAccessToken(refreshToken)
      if (!newTokens) {
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Google Drive token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      accessToken = newTokens.access_token
    }

    // Get the file metadata and download URL from Google Drive
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file_id}?fields=id,name,mimeType,webContentLink,webViewLink,thumbnailLink`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )

    if (!driveResponse.ok) {
      const errorText = await driveResponse.text()
      console.error('Google Drive API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch file from Google Drive' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const fileData = await driveResponse.json()

    // For images and PDFs, we can use webContentLink for direct download
    // For preview, we'll generate a temporary access URL
    const isImage = fileData.mimeType?.startsWith('image/')
    const isPdf = fileData.mimeType === 'application/pdf'

    let previewUrl: string | null = null

    if (isImage || isPdf) {
      // Get a direct download link with auth
      const downloadResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      )

      if (downloadResponse.ok) {
        const blob = await downloadResponse.blob()
        const base64 = await blobToBase64(blob)
        previewUrl = `data:${fileData.mimeType};base64,${base64}`
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        file: {
          id: fileData.id,
          name: fileData.name,
          mimeType: fileData.mimeType,
          webViewLink: fileData.webViewLink,
          webContentLink: fileData.webContentLink,
          thumbnailLink: fileData.thumbnailLink,
          previewUrl,
        }
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

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
