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
    const body = await req.json()
    const token = body.token as string | undefined

    // Legacy explicit fields (backward compatibility)
    let portal_access_id = body.portal_access_id as string | undefined
    let visa_application_id = (body.visa_application_id || body.matter_id) as string | undefined
    let client_id = body.client_id as string | undefined
    let company_id = body.company_id as string | undefined

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Preferred path: resolve everything from the token
    if (token) {
      const { data: portalAccess, error: portalError } = await supabase
        .from('client_portal_access')
        .select('id, visa_application_id, client_id, company_id')
        .eq('access_token', token)
        .single()

      if (portalError || !portalAccess) {
        return new Response(
          JSON.stringify({ error: 'Portal access not found for token' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      portal_access_id = portalAccess.id
      visa_application_id = portalAccess.visa_application_id
      client_id = portalAccess.client_id
      company_id = portalAccess.company_id
    }

    if (!portal_access_id || !visa_application_id || !client_id || !company_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ensure portal access is marked as submitted (idempotent; RPC may have already done this)
    const { error: updateError } = await supabase
      .from('client_portal_access')
      .update({
        is_submitted: true,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', portal_access_id)

    if (updateError) {
      console.error('Failed to mark submitted:', updateError)
    }

    // Get visa application details for the notification
    const { data: visaApplication } = await supabase
      .from('visa_applications')
      .select('application_name')
      .eq('id', visa_application_id)
      .single()

    // Get client details for the notification
    const { data: client } = await supabase
      .from('clients')
      .select('first_name, last_name, company_name, client_type')
      .eq('id', client_id)
      .single()

    const clientName = client?.client_type === 'corporate'
      ? client?.company_name
      : `${client?.first_name || ''} ${client?.last_name || ''}`.trim()

    // Get all company members to notify
    const { data: members } = await supabase
      .from('company_members')
      .select('user_id')
      .eq('company_id', company_id)

    if (members && members.length > 0) {
      const notifications = members.map(member => ({
        user_id: member.user_id,
        company_id: company_id,
        type: 'client_submission',
        title: 'Client Submitted Documents',
        message: `${clientName || 'A client'} has submitted their documents for ${visaApplication?.application_name || 'a visa application'}.`,
        metadata: {
          visa_application_id,
          client_id,
          portal_access_id,
        },
      }))

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications)

      if (notifError) {
        console.error('Failed to create notifications:', notifError)
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
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
