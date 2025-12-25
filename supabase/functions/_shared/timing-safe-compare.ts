/**
 * Constant-time string comparison to prevent timing attacks.
 * This compares strings in a way that takes the same amount of time
 * regardless of where the first difference occurs.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  // If lengths differ, we still need to do the comparison to maintain constant time
  // We use the longer length to ensure we always compare the same number of bytes
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  
  // Use the longer length, but track if lengths differ
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let result = aBytes.length === bBytes.length ? 0 : 1;
  
  for (let i = 0; i < maxLen; i++) {
    // Use 0 for out-of-bounds access, XOR will still work
    const aByte = i < aBytes.length ? aBytes[i] : 0;
    const bByte = i < bBytes.length ? bBytes[i] : 0;
    result |= aByte ^ bByte;
  }
  
  return result === 0;
}

/**
 * Validates a webhook secret in a timing-safe manner.
 * Returns true if the secret is valid, false otherwise.
 */
export function validateWebhookSecret(
  providedSecret: string | null,
  expectedSecret: string | undefined
): boolean {
  // If no expected secret is configured, allow the request
  if (!expectedSecret) {
    return true;
  }
  
  // If expected secret exists but none provided, reject
  if (!providedSecret) {
    return false;
  }
  
  return timingSafeEqual(providedSecret, expectedSecret);
}
