/**
 * WebAuthn Biometric Authentication Service (Touch ID / Face ID / Windows Hello)
 * Handles hardware biometric key creation, storage, and session unlock verification.
 */

export interface BiometricConfig {
  credentialId: string;
  registeredAt: string;
  userEmail: string;
}

const STORAGE_KEY_PREFIX = 'comfort_hub_biometrics_';

export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return isAvailable;
  } catch (err) {
    console.warn('[Biometrics] Support check failed:', err);
    return false;
  }
}

export function isBiometricRegistered(userId: string): boolean {
  if (!userId) return false;
  const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
  return !!data;
}

export function getBiometricConfig(userId: string): BiometricConfig | null {
  if (!userId) return null;
  const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function disableBiometrics(userId: string): void {
  if (userId) {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${userId}`);
  }
}

export async function registerBiometrics(userId: string, userEmail: string): Promise<boolean> {
  if (!(await isBiometricSupported())) {
    throw new Error('Biometric authentication (Touch ID / Face ID) is not supported on this browser or device.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userIdBytes = new TextEncoder().encode(userId || 'user-default');

  const creationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'Comfort Business Hub',
      id: window.location.hostname || 'localhost',
    },
    user: {
      id: userIdBytes,
      name: userEmail || 'user@comforthub.app',
      displayName: userEmail ? userEmail.split('@')[0] : 'Hub User',
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },  // ES256
      { alg: -257, type: 'public-key' } // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Hardware biometrics (TouchID / FaceID)
      userVerification: 'preferred',
      requireResidentKey: false,
    },
    timeout: 60000,
  };

  try {
    const credential = (await navigator.credentials.create({
      publicKey: creationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      throw new Error('Biometric registration canceled.');
    }

    // Convert rawId to string identifier
    const rawIdArray = new Uint8Array(credential.rawId);
    const credentialIdString = btoa(String.fromCharCode(...rawIdArray));

    const config: BiometricConfig = {
      credentialId: credentialIdString,
      registeredAt: new Date().toISOString(),
      userEmail,
    };

    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(config));
    return true;
  } catch (err: any) {
    console.error('[Biometrics] Registration error:', err);
    throw new Error(err?.message || 'Biometric registration failed or was canceled.');
  }
}

export async function verifyBiometrics(userId: string): Promise<boolean> {
  const config = getBiometricConfig(userId);
  
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  let allowCredentials: PublicKeyCredentialDescriptor[] | undefined = undefined;

  if (config?.credentialId) {
    try {
      const binaryId = Uint8Array.from(atob(config.credentialId), c => c.charCodeAt(0));
      allowCredentials = [
        {
          id: binaryId,
          type: 'public-key',
        },
      ];
    } catch {
      // Fall back to general prompt if binary conversion fails
    }
  }

  const requestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: window.location.hostname || 'localhost',
    userVerification: 'preferred',
    allowCredentials,
    timeout: 60000,
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: requestOptions,
    });

    if (assertion) {
      return true;
    }
    return false;
  } catch (err: any) {
    console.error('[Biometrics] Verification error:', err);
    throw new Error(err?.message || 'Biometric scan failed or was canceled.');
  }
}
