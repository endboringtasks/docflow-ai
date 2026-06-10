/**
 * Open-redirect protection for post-authentication deep links (DOC-8 / BR-9).
 *
 * Validates a `returnTo` value and only accepts same-app relative paths.
 * Anything that could navigate to another origin (absolute URLs,
 * protocol-relative `//host`, backslash tricks, embedded `://`) is rejected.
 */
export function getSafeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let value = raw.trim();
  if (!value) return null;

  // Decode once so percent-encoded payloads are evaluated.
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }

  value = value.trim();

  // Must be a root-relative path.
  if (!value.startsWith("/")) return null;

  // Reject protocol-relative ("//evil.com") and backslash variants ("/\evil.com").
  if (value.startsWith("//") || value.startsWith("/\\")) return null;

  // Reject anything that smuggles a scheme/host.
  if (value.includes("://")) return null;

  // Avoid redirect loops back to the auth page.
  if (value === "/auth" || value.startsWith("/auth?") || value.startsWith("/auth/")) {
    return null;
  }

  return value;
}
