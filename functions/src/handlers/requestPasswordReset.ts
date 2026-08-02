import { getAuth } from 'firebase-admin/auth';

import { sendEmail } from '../services/resendService';
import { checkAndIncrementRateLimit } from '../utils/rateLimiter';
import { dummyHashOperation, generateResetToken } from '../utils/tokenHelper';

/**
 * Cloud Function: requestPasswordReset (Email Path)
 * 
 * SECURITY REQUIREMENTS:
 * 1. Anti-enumeration: Always return generic message "If that email/phone number is registered, we've sent you a reset link/code."
 *    Constant-ish execution time (always hash/compute something) even on not found path.
 * 2. Rate limiting: 5 req/hr per IP, 3 req/hr per email identifier.
 * 3. Token generation: crypto.randomBytes(32).toString('hex'). SHA-256 stored in Firestore, expiry 20 mins.
 * 4. Raw token emailed via Resend with URL: https://[app-domain]/reset-password?token=RAW_TOKEN&uid=USER_ID
 */

export interface RequestPasswordResetParams {
  email: string;
  ipAddress?: string;
  appDomain?: string;
}

export const GENERIC_RESET_RESPONSE = {
  success: true,
  message: "If that email/phone number is registered, we've sent you a reset link/code.",
};

export async function handleRequestPasswordReset(
  db: FirebaseFirestore.Firestore,
  params: RequestPasswordResetParams
): Promise<{ success: boolean; message: string; code?: string }> {
  const startTime = Date.now();
  const rawEmail = (params.email || '').trim().toLowerCase();
  const clientIp = params.ipAddress || 'unknown';
  const domain = params.appDomain || process.env.APP_DOMAIN || 'comfortbusinesshub.co.zw';

  // 1. Rate Limiting Checks
  const ipLimit = await checkAndIncrementRateLimit(db, `ip:${clientIp}`, 5, 3600000);
  if (!ipLimit.allowed) {
    return {
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this network. Please try again in an hour.',
    };
  }

  if (rawEmail) {
    const emailLimit = await checkAndIncrementRateLimit(db, `email:${rawEmail}`, 3, 3600000);
    if (!emailLimit.allowed) {
      return {
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many reset attempts for this email. Please check your inbox or try again later.',
      };
    }
  }

  // Basic email pattern guard
  if (!rawEmail || !rawEmail.includes('@')) {
    dummyHashOperation();
    return GENERIC_RESET_RESPONSE;
  }

  try {
    // 2. Look up user by email in Firebase Auth
    let userRecord: any = null;
    try {
      userRecord = await getAuth().getUserByEmail(rawEmail);
    } catch (err) {
      // User not found in Auth
      userRecord = null;
    }

    if (!userRecord) {
      // Execute dummy hashing to keep timing constant
      dummyHashOperation();
      
      // Artificial delay so duration matches user-found path
      const elapsed = Date.now() - startTime;
      if (elapsed < 300) {
        await new Promise(r => setTimeout(r, 300 - elapsed));
      }
      return GENERIC_RESET_RESPONSE;
    }

    const uid = userRecord.uid;

    // 3. Generate token & hash
    const { rawToken, tokenHash } = generateResetToken();
    const expiresInMinutes = 20;
    const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;

    // Invalidate existing active tokens for this user first
    const existingTokens = await db.collection('passwordResetTokens')
      .where('uid', '==', uid)
      .where('used', '==', false)
      .get();
    
    const batch = db.batch();
    existingTokens.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { used: true, invalidatedAt: FirebaseFirestore.FieldValue.serverTimestamp() });
    });

    // Store new token SHA-256 hash doc in Firestore
    const tokenDocRef = db.collection('passwordResetTokens').doc(tokenHash);
    batch.set(tokenDocRef, {
      uid,
      tokenHash,
      identifier: rawEmail,
      type: 'email',
      used: false,
      expiresAt,
      createdAt: FirebaseFirestore.FieldValue.serverTimestamp(),
      createdFromIp: clientIp,
    });

    await batch.commit();

    // 4. Construct reset link and render HTML email
    const protocol = domain.startsWith('localhost') ? 'http' : 'https';
    const resetUrl = `${protocol}://${domain}/reset-password?token=${rawToken}&uid=${uid}`;

    // Static HTML rendering fallback or React Email template string
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Password - Comfort Business Hub</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #05070a; color: #f3f4f6; padding: 30px; margin: 0;">
        <div style="max-width: 540px; margin: 0 auto; background: #0b0f17; border: 1px solid rgba(0,242,254,0.3); border-radius: 16px; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="background: #00F2FE; color: #05070a; font-weight: 900; font-size: 12px; padding: 6px 14px; border-radius: 6px; text-transform: uppercase; letter-spacing: 1px;">Comfort Business Hub</span>
            <h2 style="color: #ffffff; font-size: 20px; margin-top: 16px; text-transform: uppercase;">Password Reset Request</h2>
          </div>
          <p style="color: #9ca3af; font-size: 14px; line-height: 1.6;">Hello ${userRecord.displayName || 'Member'},</p>
          <p style="color: #9ca3af; font-size: 14px; line-height: 1.6;">We received a request to reset your password for your Comfort Business Hub account. Click the button below to specify a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #00F2FE; color: #05070a; font-weight: 800; font-size: 13px; text-decoration: none; padding: 14px 28px; border-radius: 10px; display: inline-block; text-transform: uppercase; letter-spacing: 1px;">Reset Password</a>
          </div>
          <p style="color: #9ca3af; font-size: 13px;">This link is valid for <strong>${expiresInMinutes} minutes</strong>.</p>
          <p style="color: #6b7280; font-size: 11px; word-break: break-all;">URL: ${resetUrl}</p>
          <div style="margin-top: 24px; padding: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; color: #fca5a5; font-size: 12px;">
            If you did not request this reset, you can safely ignore this email.
          </div>
        </div>
      </body>
      </html>
    `;

    // 5. Send email via Resend
    await sendEmail({
      to: rawEmail,
      subject: 'Reset your Comfort Business Hub password',
      html: emailHtml,
    });

    // 6. Log security audit event
    console.log(`[SECURITY AUDIT] Password reset requested for UID: ${uid} (Email: ${rawEmail.substring(0, 3)}***) from IP: ${clientIp}`);

    return GENERIC_RESET_RESPONSE;
  } catch (err) {
    console.error('Error handling requestPasswordReset:', err);
    return GENERIC_RESET_RESPONSE;
  }
}
