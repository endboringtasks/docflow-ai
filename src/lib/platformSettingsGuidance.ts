/**
 * Detailed tuning guidance for known platform settings keys.
 *
 * Each entry explains, in plain language:
 *  - purpose: what the setting controls
 *  - whenToChange: symptoms / scenarios that justify changing it
 *  - tuning: how to pick a value, the trade-off in each direction, and a sweet spot
 *
 * This is presentation-only knowledge consumed by the admin Settings UI.
 */
export interface SettingGuidance {
  purpose: string;
  whenToChange: string;
  tuning: string;
}

export const PLATFORM_SETTINGS_GUIDANCE: Record<string, SettingGuidance> = {
  upload_max_file_size_mb: {
    purpose:
      "The largest single file (in megabytes) a user or client can upload to a document checklist.",
    whenToChange:
      "Raise it if legitimate documents (scanned passports, multi-page PDFs, high-res photos) are being rejected for being too large. Lower it if users are uploading unnecessarily heavy files that slow down sync and inflate storage.",
    tuning:
      "Higher = fewer rejected uploads, but more storage cost, slower uploads on poor connections, and longer Drive sync times. Lower = leaner storage but more friction. Sweet spot: 10–25 MB for typical document workflows; only go above 50 MB if you genuinely accept large scans.",
  },
  upload_signed_url_expiry_seconds: {
    purpose:
      "How long a generated signed upload URL stays valid before it expires (in seconds).",
    whenToChange:
      "Increase it if users on slow connections or large uploads see 'URL expired' failures mid-upload. Decrease it to tighten security so leaked links can't be reused for long.",
    tuning:
      "Longer = more forgiving for slow uploads but a wider window if a link leaks. Shorter = more secure but risks expiring before a big upload finishes. Sweet spot: 300–900 seconds (5–15 min). 600 (10 min) is a safe default.",
  },
  upload_rate_limit_ip: {
    purpose:
      "Maximum number of upload requests allowed from a single IP address per 5-minute window.",
    whenToChange:
      "Lower it if you see abuse or scripted flooding from one source. Raise it if a legitimate shared office network (many users behind one IP) is hitting the limit.",
    tuning:
      "Lower = stronger abuse protection but risk of blocking shared-network users. Higher = friendlier for offices but weaker flood protection. Sweet spot: 150–300. Estimate peak legitimate uploads per office in 5 min, then add ~50% headroom.",
  },
  upload_rate_limit_token: {
    purpose:
      "Maximum number of upload requests allowed per client portal access token per 5-minute window.",
    whenToChange:
      "Lower it if a single compromised token is being abused. Raise it if a client legitimately uploads many documents at once and gets throttled.",
    tuning:
      "This is per-client, so it can be tighter than the IP limit. Lower = better protection against a single leaked token; Higher = smoother bulk uploads. Sweet spot: 50–120. Base it on how many files one client realistically submits in a sitting plus headroom.",
  },
  sync_batch_size: {
    purpose:
      "How many document attachments each background sync run pushes from Storage to Google Drive.",
    whenToChange:
      "Raise it if files queue up and sync feels slow. Lower it if you see Google Drive rate-limit errors or the sync function timing out.",
    tuning:
      "Higher = faster throughput but more risk of hitting Drive API limits or function timeouts. Lower = slower but safer and steadier. Sweet spot: 10–15 for most workloads; drop to 5 if you observe errors, raise gradually only while sync stays healthy.",
  },
  sync_max_attempts: {
    purpose:
      "How many times a failed attachment sync is retried before it is marked as failed and given up on.",
    whenToChange:
      "Raise it if transient Drive/network blips cause files to give up too early. Lower it if broken items keep retrying forever and clog the queue.",
    tuning:
      "Higher = more resilient to temporary outages but slower to surface genuinely broken items. Lower = fails fast but may abandon files that would have succeeded on a later retry. Sweet spot: 3–7. 5 balances resilience against noise.",
  },
  storage_retention_days: {
    purpose:
      "How many days a file is kept in Supabase Storage after it has been successfully synced to Google Drive (the source of truth).",
    whenToChange:
      "Lower it to cut storage costs once you trust Drive as the source of truth. Raise it if you want a longer local safety buffer before files are cleaned up.",
    tuning:
      "Higher = bigger recovery window if a Drive issue is found late, but more storage cost. Lower = cheaper but less local fallback. Sweet spot: 7–30 days. 30 gives a comfortable buffer; reduce toward 7 if storage cost matters and Drive sync is reliable.",
  },
};
