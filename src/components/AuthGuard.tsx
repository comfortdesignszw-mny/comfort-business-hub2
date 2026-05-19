import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import GuestLoginPrompt from './GuestLoginPrompt';

interface AuthGuardProps {
  children: React.ReactNode;
  title?: string;
  message?: string;
  actionLabel?: string;
}

export default function AuthGuard({ children, title, message, actionLabel }: AuthGuardProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const isSignedIn = !!auth.currentUser;

  const handleClick = (e: React.MouseEvent) => {
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
      />
    </>
  );
}
