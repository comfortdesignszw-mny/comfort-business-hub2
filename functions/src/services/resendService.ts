import { Resend } from 'resend';

/**
 * Resend Email Service for Comfort Business Hub
 * 
 * Configured via process.env.RESEND_API_KEY.
 * Sends HTML rendered emails with fallback support.
 */

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY is missing in environment variables. Email delivery in dry-run mode.');
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getResendClient();
  const fromAddress = options.from || process.env.RESEND_FROM_EMAIL || 'Comfort Business Hub Security <security@comfortbusinesshub.co.zw>';

  if (!client) {
    console.log(`[DRY RUN EMAIL] To: ${options.to} | Subject: ${options.subject}`);
    return { success: true, messageId: `dry_run_${Date.now()}` };
  }

  try {
    const data = await client.emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (data.error) {
      console.error('Resend API returned error:', data.error);
      return { success: false, error: data.error.message };
    }

    return { success: true, messageId: data.data?.id };
  } catch (err: any) {
    console.error('Failed to send email via Resend:', err);
    return { success: false, error: err?.message || 'Email transport failure' };
  }
}
