import * as React from 'react';

/**
 * React Email Template: Password Reset Email for Comfort Business Hub
 * 
 * Branded for Comfort Business Hub: clean, mobile-responsive, works in Gmail/Outlook/Apple Mail.
 */

export interface PasswordResetEmailProps {
  userName?: string;
  resetUrl: string;
  expiresInMinutes?: number;
  ipAddress?: string;
}

export const PasswordResetEmail: React.FC<PasswordResetEmailProps> = ({
  userName = 'Member',
  resetUrl,
  expiresInMinutes = 20,
  ipAddress,
}) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Reset Your Comfort Business Hub Password</title>
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #05070a;
            color: #f3f4f6;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 580px;
            margin: 0 auto;
            background-color: #0b0f17;
            border: 1px solid rgba(0, 242, 254, 0.2);
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          .header {
            text-align: center;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            padding-bottom: 20px;
            margin-bottom: 24px;
          }
          .logo-badge {
            display: inline-block;
            background: linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%);
            color: #05070a;
            font-weight: 900;
            font-size: 14px;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            padding: 8px 16px;
            border-radius: 8px;
            margin-bottom: 12px;
          }
          .title {
            color: #ffffff;
            font-size: 22px;
            font-weight: 800;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: -0.5px;
          }
          .content {
            font-size: 14px;
            line-height: 1.6;
            color: #9ca3af;
          }
          .btn-container {
            text-align: center;
            margin: 32px 0;
          }
          .btn {
            display: inline-block;
            background: #00F2FE;
            color: #05070a !important;
            font-weight: 800;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            padding: 14px 28px;
            border-radius: 10px;
            text-decoration: none;
            box-shadow: 0 4px 15px rgba(0, 242, 254, 0.3);
          }
          .warning-box {
            background-color: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 10px;
            padding: 14px;
            font-size: 12px;
            color: #fca5a5;
            margin-top: 24px;
          }
          .footer {
            margin-top: 32px;
            padding-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.08);
            font-size: 11px;
            color: #6b7280;
            text-align: center;
          }
          .link-text {
            word-break: break-all;
            color: #00F2FE;
            font-size: 11px;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <div className="logo-badge">Comfort Business Hub</div>
            <h1 className="title">Security Password Reset</h1>
          </div>
          <div className="content">
            <p>Hello {userName},</p>
            <p>
              We received a request to reset your password for your Comfort Business Hub account. Click the button below to establish a new password:
            </p>
            <div className="btn-container">
              <a href={resetUrl} className="btn" target="_blank" rel="noreferrer">
                Reset My Password
              </a>
            </div>
            <p>
              This link is valid for <strong>{expiresInMinutes} minutes</strong> and can only be used once.
            </p>
            <p>If you cannot click the button above, copy and paste this URL into your browser:</p>
            <p className="link-text">{resetUrl}</p>
            
            <div className="warning-box">
              <strong>Security Notice:</strong> If you did not request this password reset, no action is needed. Your account remains secure and your password has not been changed.
            </div>
          </div>
          <div className="footer">
            <p>Comfort Business Hub • Dual-Sided Offline-First Marketplace</p>
            {ipAddress && <p>Request IP: {ipAddress}</p>}
            <p>© {new Date().getFullYear()} Comfort Business Hub. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  );
};

export default PasswordResetEmail;
