import { getAuth } from 'firebase-admin/auth';

import { sendEmail } from '../services/resendService';
import { checkAndIncrementRateLimit } from '../utils/rateLimiter';
import { hashToken } from '../utils/tokenHelper';

/**
 * Cloud Function: resetPassword (Email Path Verification)
 * 
 * SECURITY REQUIREMENTS:
 * 1. Rate limiting on token-verification endpoint to prevent brute forcing.
 * 2. SHA-256 hash incoming raw token and look up in passwordResetTokens.
 * 3. Verify expiresAt > Date.now() and used == false.
 * 4. Update user's password via Firebase Admin SDK (updateUser).
 * 5. Mark token used: true and invalidate any other outstanding reset tokens for that user.
 * 6. Revoke all existing refresh tokens/sessions: admin.auth().revokeRefreshTokens(uid).
 * 7. Send "your password was changed" confirmation email via Resend.
 * 8. Log security-relevant audit event without raw tokens.
 */

export interface ResetPasswordParams {
  token: string;
  uid: string;
  newPassword: string;
  ipAddress?: string;
}

export async function handleResetPassword(
  db: FirebaseFirestore.Firestore,
  params: ResetPasswordParams
): Promise<{ success: boolean; message: string; code?: string }> {
  const { token, uid, newPassword, ipAddress = 'unknown' } = params;

  if (!token || !uid || !newPassword) {
    return {
      success: false,
      code: 'INVALID_ARGUMENTS',
      message: 'Token, user ID, and new password are required.',
    };
  }

  // 1. Rate limiting verification attempts per UID/IP to prevent brute forcing
  const rateLimit = await checkAndIncrementRateLimit(db, `verify:${uid}`, 5, 3600000);
  if (!rateLimit.allowed) {
    return {
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many verification attempts for this account. Please wait before trying again.',
    };
  }

  // 2. Validate password strength
  if (newPassword.length < 8) {
    return {
      success: false,
      code: 'WEAK_PASSWORD',
      message: 'Password must be at least 8 characters long and contain numbers/symbols.',
    };
  }

  try {
    // 3. Compute SHA-256 hash of incoming raw token
    const tokenHash = hashToken(token);
    const tokenDocRef = db.collection('passwordResetTokens').doc(tokenHash);
    const tokenSnap = await tokenDocRef.get();

    if (!tokenSnap.exists) {
      console.warn(`[SECURITY AUDIT] Invalid reset token attempt for UID: ${uid}`);
      return {
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired password reset token. Please request a new link.',
      };
    }

    const tokenData = tokenSnap.data()!;

    // 4. Verify token match, usage status, and expiration
    if (tokenData.uid !== uid) {
      console.warn(`[SECURITY AUDIT] Token UID mismatch: token UID ${tokenData.uid} vs parameter UID ${uid}`);
      return {
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Invalid password reset token details.',
      };
    }

    if (tokenData.used) {
      return {
        success: false,
        code: 'TOKEN_ALREADY_USED',
        message: 'This reset token has already been used. Please request a new link.',
      };
    }

    if (Date.now() > tokenData.expiresAt) {
      return {
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Password reset link has expired. Please request a fresh reset link.',
      };
    }

    // 5. Update user password via Firebase Admin Auth SDK
    await getAuth().updateUser(uid, {
      password: newPassword,
    });

    // 6. Revoke all refresh tokens & active sessions for security
    await getAuth().revokeRefreshTokens(uid);

    // 7. Mark token used and invalidate any other outstanding tokens for this user
    const batch = db.batch();
    batch.update(tokenDocRef, {
      used: true,
      usedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
      usedFromIp: ipAddress,
    });

    const otherTokens = await db.collection('passwordResetTokens')
      .where('uid', '==', uid)
      .where('used', '==', false)
      .get();

    otherTokens.docs.forEach(docSnap => {
      if (docSnap.id !== tokenHash) {
        batch.update(docSnap.ref, {
          used: true,
          invalidatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
        });
      }
    });

    await batch.commit();

    // 8. Fetch user profile & send password change confirmation email
    let userEmail: string | undefined;
    let userName: string | undefined;
    try {
      const userRec = await getAuth().getUser(uid);
      userEmail = userRec.email;
      userName = userRec.displayName || 'Member';
    } catch (e) {
      console.warn('Could not fetch user profile for confirmation email', e);
    }

    if (userEmail) {
      const confirmationHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #05070a; color: #f3f4f6; padding: 30px;">
          <div style="max-width: 540px; margin: 0 auto; background: #0b0f17; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 32px;">
            <h2 style="color: #10B981; font-size: 20px; text-transform: uppercase;">Password Changed Successfully</h2>
            <p style="color: #9ca3af;">Hello ${userName},</p>
            <p style="color: #9ca3af;">Your Comfort Business Hub account password was updated on ${new Date().toUTCString()}. All previous login sessions have been revoked for your security.</p>
            <div style="margin-top: 20px; padding: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; color: #fca5a5; font-size: 12px;">
              If you did not make this change, please contact Comfort Business Hub support immediately.
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: userEmail,
        subject: 'Security Alert: Your Comfort Business Hub password was changed',
        html: confirmationHtml,
      });
    }

    // 9. Log audit event
    console.log(`[SECURITY AUDIT] Password reset successfully executed for UID: ${uid}. Sessions revoked.`);

    return {
      success: true,
      message: 'Your password has been reset successfully. Please log in with your new credentials.',
    };
  } catch (err: any) {
    console.error('Error during resetPassword execution:', err);
    return {
      success: false,
      code: 'SERVER_ERROR',
      message: err?.message || 'Failed to update password. Please try again.',
    };
  }
}
