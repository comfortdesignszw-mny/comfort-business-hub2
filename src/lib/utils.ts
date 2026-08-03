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

/**
 * Intelligent WhatsApp redirection that triggers native WhatsApp (Regular or Business) protocol on mobile devices,
 * falling back to web WhatsApp link if the app scheme does not open.
 */
export function openWhatsApp(phone: string, text: string) {
  const cleanNumber = phone ? phone.replace(/[^0-9]/g, '') : '';
  if (!cleanNumber) return false;

  const encodedText = encodeURIComponent(text);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    // Regular WhatsApp & Business WhatsApp register the whatsapp:// protocol scheme on iOS & Android.
    // The OS automatically launches the installed/default WhatsApp app (Business or Regular).
    const nativeUrl = `whatsapp://send?phone=${cleanNumber}&text=${encodedText}`;
    const fallbackUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodedText}`;

    const start = Date.now();
    window.location.href = nativeUrl;

    setTimeout(() => {
      if (!document.hidden && Date.now() - start < 2000) {
        window.open(fallbackUrl, '_blank');
      }
    }, 1200);
  } else {
    // Desktop browser: api.whatsapp.com automatically routes to WhatsApp Web or Desktop App
    const webUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodedText}`;
    window.open(webUrl, '_blank');
  }
  return true;
}

/**
 * Formats any timestamp or date input into a comprehensive auditable date and time stamp.
 * Output format: "03 Aug 2026 • 10:20:51 AM"
 */
export function formatAuditableStamp(timestamp: any): string {
  if (timestamp === undefined || timestamp === null) return 'TIMESTAMP UNSTAMPED';

  let date: Date | null = null;

  try {
    if (typeof timestamp?.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp?.seconds !== undefined) {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'number') {
      date = timestamp < 10000000000 ? new Date(timestamp * 1000) : new Date(timestamp);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    }
  } catch (e) {
    return 'TIMESTAMP UNSTAMPED';
  }

  if (!date || isNaN(date.getTime())) {
    return 'TIMESTAMP UNSTAMPED';
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = hours.toString().padStart(2, '0');

  return `${day} ${month} ${year} • ${strHours}:${minutes}:${seconds} ${ampm}`;
}
