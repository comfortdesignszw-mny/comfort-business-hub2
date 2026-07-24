import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export interface CountryCode {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: '+263', name: 'Zimbabwe', flag: '🇿🇼' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+254', name: 'Kenya', flag: '🇰🇪' },
  { code: '+234', name: 'Nigeria', flag: '🇳🇬' },
  { code: '+260', name: 'Zambia', flag: '🇿🇲' },
  { code: '+255', name: 'Tanzania', flag: '🇹🇿' },
  { code: '+256', name: 'Uganda', flag: '🇺🇬' },
  { code: '+267', name: 'Botswana', flag: '🇧🇼' },
  { code: '+265', name: 'Malawi', flag: '🇲🇼' },
  { code: '+264', name: 'Namibia', flag: '🇳🇦' },
  { code: '+258', name: 'Mozambique', flag: '🇲🇿' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+1', name: 'USA/Canada', flag: '🇺🇸' },
];

export function normalizePhoneNumber(countryCode: string, phoneInput: string): string {
  const cleanDigits = phoneInput.replace(/\D/g, '');
  const localDigits = cleanDigits.startsWith('0') ? cleanDigits.slice(1) : cleanDigits;
  const codeDigits = countryCode.replace(/\D/g, '');
  return `+${codeDigits}${localDigits}`;
}

export function phoneToSyntheticEmail(e164Phone: string): string {
  const digits = e164Phone.replace(/\D/g, '');
  return `${digits}@comforthub.internal`;
}

export function isSyntheticEmail(email?: string | null): boolean {
  return !!email && email.endsWith('@comforthub.internal');
}

export async function checkPhoneExistsInFirestore(e164Phone: string): Promise<boolean> {
  try {
    const q1 = query(collection(db, 'users'), where('phoneNumber', '==', e164Phone));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) return true;

    const q2 = query(collection(db, 'users'), where('phone', '==', e164Phone));
    const snap2 = await getDocs(q2);
    return !snap2.empty;
  } catch (err) {
    console.warn("Phone uniqueness check error:", err);
    return false;
  }
}

export function getFriendlyAuthErrorMessage(code: string, fallbackMessage?: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account already exists with that email or phone number. Try logging in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect login details or account does not exist. Please check your credentials.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network connectivity issue. Please check your internet connection and try again.';
    case 'auth/popup-blocked':
      return 'Sign in popup was blocked by browser. Please allow popups or open in a new tab.';
    case 'auth/popup-closed-by-user':
      return 'Sign in window was closed before completion. Please try again.';
    default:
      return fallbackMessage || 'Authentication failed. Please verify your details and try again.';
  }
}
