import * as crypto from 'crypto';

/**
 * Token Helper for Comfort Business Hub Password Reset Flow
 * 
 * SECURITY REQUIREMENT 2:
 * Generate tokens with crypto.randomBytes(32).toString('hex') (Node) - never Math.random().
 * Store only a SHA-256 hash of the token in Firestore.
 * The raw token is only ever emailed/texted to the user - never persisted in plaintext, never logged.
 */

export interface GeneratedTokenInfo {
  rawToken: string;
  tokenHash: string;
}

/**
 * Generates a 32-byte cryptographically secure random hexadecimal token
 * and returns both the raw token and its SHA-256 hash.
 */
export function generateResetToken(): GeneratedTokenInfo {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Computes a SHA-256 hash of the provided raw token string.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Performs a constant-time execution dummy hashing operation
 * to prevent response timing leaks on the anti-enumeration non-found paths.
 */
export function dummyHashOperation(): void {
  const dummy = crypto.randomBytes(32).toString('hex');
  crypto.createHash('sha256').update(dummy).digest('hex');
}
