import { getAuth } from 'firebase-admin/auth';

import { checkAndIncrementRateLimit } from '../utils/rateLimiter';
import { dummyHashOperation } from '../utils/tokenHelper';
import { GENERIC_RESET_RESPONSE } from './requestPasswordReset';

/**
 * Cloud Function: requestPasswordResetPhone
 * 
 * SECURITY REQUIREMENTS:
 * 1. Anti-enumeration: Look up user by phone in Auth/Firestore, always return generic response.
 * 2. Rate limiting per phone number & IP.
 * 3. Client uses Firebase Phone Auth SMS OTP send.
 */

export interface RequestPasswordResetPhoneParams {
  phone: string;
  ipAddress?: string;
}

export async function handleRequestPasswordResetPhone(
  db: FirebaseFirestore.Firestore,
  params: RequestPasswordResetPhoneParams
): Promise<{ success: boolean; message: string; code?: string }> {
  const startTime = Date.now();
  const rawPhone = (params.phone || '').trim().replace(/[\s\-()]/g, '');
  const clientIp = params.ipAddress || 'unknown';

  // 1. Rate limiting per IP and phone number
  const ipLimit = await checkAndIncrementRateLimit(db, `ip:${clientIp}`, 5, 3600000);
  if (!ipLimit.allowed) {
    return {
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this network. Please try again in an hour.',
    };
  }

  if (rawPhone) {
    const phoneLimit = await checkAndIncrementRateLimit(db, `phone:${rawPhone}`, 3, 3600000);
    if (!phoneLimit.allowed) {
      return {
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many reset attempts for this phone number. Please try again later.',
      };
    }
  }

  try {
    // 2. Check if user exists by phone in Firebase Auth
    let userRecord: any = null;
    if (rawPhone.length >= 7) {
      try {
        userRecord = await getAuth().getUserByPhoneNumber(rawPhone);
      } catch (e) {
        userRecord = null;
      }
    }

    if (!userRecord) {
      dummyHashOperation();
      const elapsed = Date.now() - startTime;
      if (elapsed < 250) {
        await new Promise(r => setTimeout(r, 250 - elapsed));
      }
      return GENERIC_RESET_RESPONSE;
    }

    console.log(`[SECURITY AUDIT] Phone reset requested for UID: ${userRecord.uid}`);
    return GENERIC_RESET_RESPONSE;
  } catch (err) {
    console.error('Error in requestPasswordResetPhone:', err);
    return GENERIC_RESET_RESPONSE;
  }
}
