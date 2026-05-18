import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-ZW', {
    style: 'currency',
    currency,
  }).format(amount);
}

export async function safeShare(data: ShareData) {
  if (!navigator.share) {
    throw new Error('Share API not supported');
  }
  try {
    await navigator.share(data);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log('Share canceled by user');
      return;
    }
    // For other errors, we might want to let the caller handle them or log them
    console.error('Share failed:', err);
    throw err;
  }
}
