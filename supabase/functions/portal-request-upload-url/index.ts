import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { checkRateLimit, getClientIdentifier, createRateLimitResponse } from '../_shared/rate-limiter.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Defaults (overridden by platform_settings at runtime)
const DEFAULT_MAX_FILE_SIZE_MB = 25
const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 600
const DEFAULT_RATE_LIMIT_IP = 50
const DEFAULT_RATE_LIMIT_TOKEN = 10

async function getUploadSettings(supabase: any) {
  const keys = ['upload_max_file_size_mb', 'upload_signed_url_expiry_seconds', 'upload_rate_limit_ip', 'upload_rate_limit_token']
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', keys)
  const settings: Record<string, number> = {}
  for (const row of data || []) {
    const val = (row.value as any)?.value
    if (val !== undefined) settings[row.key] = Number(val)
  }
  return {
    maxFileSize: (settings['upload_max_file_size_mb'] || DEFAULT_MAX_FILE_SIZE_MB) * 1024 * 1024,
    maxFileSizeMb: settings['upload_max_file_size_mb'] || DEFAULT_MAX_FILE_SIZE_MB,
    signedUrlExpiry: settings['upload_signed_url_expiry_seconds'] || DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
    rateLimitIp: settings['upload_rate_limit_ip'] || DEFAULT_RATE_LIMIT_IP,
    rateLimitToken: settings['upload_rate_limit_token'] || DEFAULT_RATE_LIMIT_TOKEN,
  }
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 200)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { token, document_checklist_id, file_name, file_type, file_size } = await req.json()

    if (!token || !document_checklist_id || !file_name || !file_type || !file_size) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Load configurable settings
    const uploadSettings = await getUploadSettings(supabase)

    // Validate file size
    if (file_size > uploadSettings.maxFileSize) {
      return new Response(
        JSON.stringify({ error: `File size exceeds ${uploadSettings.maxFileSizeMb}MB limit` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file_type)) {
      return new Response(
        JSON.stringify({ error: 'File type not allowed. Accepted: PDF, images, Word, Excel' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limit by IP
    const clientIp = getClientIdentifier(req)
    const ipRateLimit = await checkRateLimit(supabase, clientIp, 'portal-request-upload-url', {
      maxRequests: uploadSettings.rateLimitIp,
      windowSeconds: 300,
    })
    if (!ipRateLimit.allowed) {
      return createRateLimitResponse(ipRateLimit, uploadSettings.rateLimitIp, corsHeaders)
    }

    // Rate limit by token (hash to avoid logging token)
    const tokenHash = `token_${token.substring(0, 8)}`
    const tokenRateLimit = await checkRateLimit(supabase, tokenHash, 'portal-request-upload-url', {
      maxRequests: uploadSettings.rateLimitToken,
      windowSeconds: 300,
    })
    if (!tokenRateLimit.allowed) {
      return createRateLimitResponse(tokenRateLimit, uploadSettings.rateLimitToken, corsHeaders)
    }

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

    // Check if already submitted
    if (portalAccess.is_submitted) {
      return new Response(
        JSON.stringify({ error: 'Application already submitted' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify document_checklist belongs to this visa application
    const { data: docData, error: docError } = await supabase
      .from('document_checklist')
      .select('id, visa_application_id, max_files, review_status')
      .eq('id', document_checklist_id)
      .eq('visa_application_id', portalAccess.visa_application_id)
      .single()

    if (docError || !docData) {
      return new Response(
        JSON.stringify({ error: 'Document not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check attachment count against max_files (skip for rejected docs — finalize archives old ones)
    if (docData.review_status !== 'rejected') {
      const { count: currentCount } = await supabase
        .from('document_attachments')
        .select('id', { count: 'exact', head: true })
        .eq('document_checklist_id', document_checklist_id)

      const maxFiles = docData.max_files || 1
      if ((currentCount || 0) >= maxFiles) {
        return new Response(
          JSON.stringify({ error: `Maximum ${maxFiles} file(s) allowed for this document` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Generate storage path
    const timestamp = Date.now()
    const sanitizedName = sanitizeFilename(file_name)
    const storagePath = `${document_checklist_id}/${timestamp}_${sanitizedName}`

    // Generate signed upload URL
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('document-attachments')
      .createSignedUploadUrl(storagePath)

    if (urlError || !signedUrlData) {
      console.error('Failed to create signed upload URL:', urlError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate upload URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        upload_url: signedUrlData.signedUrl,
        upload_token: signedUrlData.token,
        storage_path: storagePath,
        expires_in: uploadSettings.signedUrlExpiry,
        max_file_size: uploadSettings.maxFileSize,
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
