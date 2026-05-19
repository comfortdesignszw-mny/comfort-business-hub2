import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import GuestLoginPrompt from './GuestLoginPrompt';
import { UserProfile } from '../types';

interface AuthGuardProps {
  children: React.ReactNode;
  title?: string;
  message?: string;
  actionLabel?: string;
  allowGuest?: boolean;
  onGuestContinue?: () => void;
  requireRealUser?: boolean;
  profile?: UserProfile | null;
}

export default function AuthGuard({ children, title, message, actionLabel, allowGuest, onGuestContinue, requireRealUser, profile }: AuthGuardProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const isSignedIn = !!auth.currentUser || (!requireRealUser && profile?.isGuest);

  const handleClick = (e: React.MouseEvent) => {
    // Allow specific elements to bypass the auth guard (e.g. share button)
    const target = e.target as HTMLElement;
    if (target.closest('.no-auth-guard')) {
      return;
    }

    if (!isSignedIn) {
      e.preventDefault();
      e.stopPropagation();
      setShowPrompt(true);
    }
  };

  if (isSignedIn) {
    return <>{children}</>;
  }

  return (
    <>
      <div onClickCapture={handleClick} className="contents cursor-pointer">
        {children}
      </div>
      <GuestLoginPrompt 
        isOpen={showPrompt} 
        onClose={() => setShowPrompt(false)}
        title={title}
        message={message}
        actionLabel={actionLabel}
        allowGuest={allowGuest}
        onGuestContinue={() => {
          setShowPrompt(false);
          if (onGuestContinue) onGuestContinue();
        }}
      />
    </>
  );
}
