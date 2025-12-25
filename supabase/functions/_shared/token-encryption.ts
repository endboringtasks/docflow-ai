// Token encryption utilities using AES-GCM with Web Crypto API

const ENCRYPTION_KEY_NAME = "TOKEN_ENCRYPTION_KEY";

// Derive a crypto key from the secret
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyMaterial = Deno.env.get(ENCRYPTION_KEY_NAME);
  if (!keyMaterial) {
    throw new Error("TOKEN_ENCRYPTION_KEY not configured");
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyMaterial);
  
  // Use SHA-256 hash to get consistent 256-bit key
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
  
  return crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt a token - returns base64 encoded string with IV prepended
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Decrypt a token - expects base64 encoded string with IV prepended
export async function decryptToken(encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  
  // Decode base64
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Check if a token appears to be encrypted (base64 with expected length)
export function isEncrypted(token: string): boolean {
  // Encrypted tokens are base64 and have IV (12 bytes) + ciphertext + auth tag (16 bytes)
  // Minimum length check: base64 of at least 28 bytes = ~38+ characters
  // Also check it's valid base64
  if (!token || token.length < 38) return false;
  
  try {
    const decoded = atob(token);
    // Should have at least IV (12) + some ciphertext + auth tag (16)
    return decoded.length >= 28;
  } catch {
    return false;
  }
}
