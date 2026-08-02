import * as functions from 'firebase-functions';
import { getAdminServices } from './lib/admin';

import { handleRequestPasswordReset } from './handlers/requestPasswordReset';
import { handleRequestPasswordResetPhone } from './handlers/requestPasswordResetPhone';
import { handleResetPassword } from './handlers/resetPassword';
import { handleResetPasswordAfterPhoneVerification } from './handlers/resetPasswordAfterPhoneVerification';

const { db } = getAdminServices();

/**
 * 1. requestPasswordReset
 * Triggered by email password reset requests.
 * Generates CSPRNG 32-byte token, SHA-256 hashes for storage, sends email via Resend.
 */
export const requestPasswordReset = functions.https.onCall(async (data: any, context: any) => {
  const email = data?.email;
  const ipAddress = context?.rawRequest ? context.rawRequest.ip : 'unknown';
  const appDomain = data?.appDomain;

  return handleRequestPasswordReset(db, {
    email,
    ipAddress,
    appDomain,
  });
});

/**
 * 2. resetPassword
 * Triggered by reset password page when user submits new password with raw token & uid.
 * Verifies SHA-256 hash in Firestore, updates user password, revokes sessions, sends confirmation email.
 */
export const resetPassword = functions.https.onCall(async (data: any, context: any) => {
  const { token, uid, newPassword } = data || {};
  const ipAddress = context?.rawRequest ? context.rawRequest.ip : 'unknown';

  return handleResetPassword(db, {
    token,
    uid,
    newPassword,
    ipAddress,
  });
});

/**
 * 3. requestPasswordResetPhone
 * Anti-enumeration phone reset initiator.
 */
export const requestPasswordResetPhone = functions.https.onCall(async (data: any, context: any) => {
  const { phone } = data || {};
  const ipAddress = context?.rawRequest ? context.rawRequest.ip : 'unknown';

  return handleRequestPasswordResetPhone(db, {
    phone,
    ipAddress,
  });
});

/**
 * 4. resetPasswordAfterPhoneVerification
 * Verifies phone Auth ID token and updates user password with session revocation.
 */
export const resetPasswordAfterPhoneVerification = functions.https.onCall(async (data: any, context: any) => {
  const { idToken, newPassword } = data || {};
  const ipAddress = context?.rawRequest ? context.rawRequest.ip : 'unknown';

  return handleResetPasswordAfterPhoneVerification(db, {
    idToken,
    newPassword,
    ipAddress,
  });
});
