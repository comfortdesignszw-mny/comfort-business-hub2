import { getAuth } from 'firebase-admin/auth';

import { checkAndIncrementRateLimit } from '../utils/rateLimiter';

/**
 * Cloud Function: resetPasswordAfterPhoneVerification
 * 
 * SECURITY REQUIREMENTS:
 * 1. Verify the Firebase ID token server-side (admin.auth().verifyIdToken(idToken)).
 * 2. Confirms it matches the phone number/user that verified SMS OTP.
 * 3. Enforce password strength.
 * 4. Update user password via admin.auth().updateUser(uid, { password: newPassword }).
 * 5. Revoke existing refresh tokens & active sessions (admin.auth().revokeRefreshTokens(uid)).
 * 6. Audit log.
 */

export interface ResetPasswordAfterPhoneParams {
  idToken: string;
  newPassword: string;
  ipAddress?: string;
}

export async function handleResetPasswordAfterPhoneVerification(
  db: FirebaseFirestore.Firestore,
  params: ResetPasswordAfterPhoneParams
): Promise<{ success: boolean; message: string; code?: string }> {
  const { idToken, newPassword, ipAddress = 'unknown' } = params;

  if (!idToken || !newPassword) {
    return {
      success: false,
      code: 'INVALID_ARGUMENTS',
      message: 'ID token and new password are required.',
    };
  }

  if (newPassword.length < 8) {
    return {
      success: false,
      code: 'WEAK_PASSWORD',
      message: 'Password must be at least 8 characters long.',
    };
  }

  try {
    // 1. Verify Firebase ID Token server-side
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    if (!uid) {
      return {
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Failed to verify phone authentication token.',
      };
    }

    // 2. Rate limit updates per UID
    const limit = await checkAndIncrementRateLimit(db, `phone_reset:${uid}`, 5, 3600000);
    if (!limit.allowed) {
      return {
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many password reset attempts for this account. Please wait.',
      };
    }

    // 3. Update user password via Firebase Admin SDK
    await getAuth().updateUser(uid, {
      password: newPassword,
    });

    // 4. Revoke all refresh tokens & sessions
    await getAuth().revokeRefreshTokens(uid);

    // 5. Security log
    console.log(`[SECURITY AUDIT] Password updated via Phone OTP verification for UID: ${uid} from IP: ${ipAddress}`);

    return {
      success: true,
      message: 'Password reset successful. Please log in with your new password.',
    };
  } catch (err: any) {
    console.error('Error in resetPasswordAfterPhoneVerification:', err);
    return {
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Verification token invalid or expired. Please re-verify your phone number.',
    };
  }
}
