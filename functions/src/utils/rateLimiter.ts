import * as admin from 'firebase-admin';

/**
 * Rate Limiter for Comfort Business Hub Cloud Functions
 * 
 * SECURITY REQUIREMENT 3:
 * Limit /forgot-password requests per IP and per email/phone (e.g. 5 requests / hour per IP, 3 / hour per identifier)
 * using Firestore counters. Apply same per-identifier limiting to token-verification endpoint.
 */

export interface RateLimitConfig {
  maxRequestsPerIp: number;
  maxRequestsPerIdentifier: number;
  windowMs: number; // e.g. 3600000 for 1 hour
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequestsPerIp: 5,
  maxRequestsPerIdentifier: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
};

export async function checkAndIncrementRateLimit(
  db: FirebaseFirestore.Firestore,
  key: string, // e.g. "ip:192.168.1.1" or "id:user@example.com"
  maxLimit: number,
  windowMs: number = 3600000
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  // Sanitize key for Firestore document ID
  const docId = `rl_${key.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 120)}`;
  const ref = db.collection('rateLimits').doc(docId);
  const now = Date.now();

  try {
    const res = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      
      if (!snap.exists) {
        transaction.set(ref, {
          count: 1,
          firstRequestTime: now,
          lastRequestTime: now,
        });
        return { allowed: true, remaining: maxLimit - 1, resetTime: now + windowMs };
      }

      const data = snap.data()!;
      const firstRequestTime = data.firstRequestTime || now;

      // Reset window if expired
      if (now - firstRequestTime > windowMs) {
        transaction.set(ref, {
          count: 1,
          firstRequestTime: now,
          lastRequestTime: now,
        });
        return { allowed: true, remaining: maxLimit - 1, resetTime: now + windowMs };
      }

      const currentCount = data.count || 0;
      if (currentCount >= maxLimit) {
        return { allowed: false, remaining: 0, resetTime: firstRequestTime + windowMs };
      }

      transaction.update(ref, {
        count: currentCount + 1,
        lastRequestTime: now,
      });

      return { allowed: true, remaining: maxLimit - (currentCount + 1), resetTime: firstRequestTime + windowMs };
    });

    return res;
  } catch (err) {
    console.error('Rate limiting transaction failed:', err);
    // In case of database error, fail-open with warning or fail-closed based on security posture
    return { allowed: true, remaining: 1, resetTime: now + windowMs };
  }
}
