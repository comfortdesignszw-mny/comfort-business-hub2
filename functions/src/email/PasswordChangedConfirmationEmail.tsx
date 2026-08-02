import * as React from 'react';

/**
 * React Email Template: Password Changed Confirmation Email for Comfort Business Hub
 * 
 * SECURITY REQUIREMENT 4:
 * Send a "your password was changed" confirmation email (via Resend)
 * so the user notices unauthorized resets.
 */

export interface PasswordChangedConfirmationEmailProps {
  userName?: string;
  userEmail: string;
  changeTimestamp?: string;
  ipAddress?: string;
}

export const PasswordChangedConfirmationEmail: React.FC<PasswordChangedConfirmationEmailProps> = ({
  userName = 'Member',
  userEmail,
  changeTimestamp = new Date().toUTCString(),
  ipAddress = 'Unknown',
}) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Password Changed - Comfort Business Hub</title>
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
            border: 1px solid rgba(16, 185, 129, 0.3);
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
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: #ffffff;
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
            font-size: 20px;
            font-weight: 800;
            margin: 0;
            text-transform: uppercase;
          }
          .content {
            font-size: 14px;
            line-height: 1.6;
            color: #9ca3af;
          }
          .info-box {
            background-color: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 16px;
            margin: 20px 0;
            font-size: 13px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .info-label {
            color: #6b7280;
            font-weight: 600;
          }
          .info-value {
            color: #f3f4f6;
            font-weight: 700;
          }
          .alert-box {
            background-color: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 10px;
            padding: 16px;
            font-size: 13px;
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
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <div className="logo-badge">Comfort Business Hub</div>
            <h1 className="title">Password Changed Successfully</h1>
          </div>
          <div className="content">
            <p>Hello {userName},</p>
            <p>
              This is confirmation that the password for your Comfort Business Hub account (<strong>{userEmail}</strong>) was changed.
            </p>
            
            <div className="info-box">
              <div className="info-row">
                <span className="info-label">Date & Time:</span>
                <span className="info-value">{changeTimestamp}</span>
              </div>
              <div className="info-row">
                <span className="info-label">IP Address:</span>
                <span className="info-value">{ipAddress}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Action:</span>
                <span className="info-value">All active sessions revoked</span>
              </div>
            </div>

            <p>
              As a security precaution, all existing login sessions on other devices have been invalidated. You will need to log in with your new password on all active devices.
            </p>

            <div className="alert-box">
              <strong>Did you not authorize this change?</strong>
              <br />
              If you did not reset your password, your account may have been compromised. Please contact support immediately or initiate a fresh password reset.
            </div>
          </div>
          <div className="footer">
            <p>Comfort Business Hub Security Ops</p>
            <p>© {new Date().getFullYear()} Comfort Business Hub. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  );
};

export default PasswordChangedConfirmationEmail;
