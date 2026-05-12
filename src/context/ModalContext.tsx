import React, { createContext, useContext, useState, ReactNode } from 'react';
import UserProfileModal from '../components/UserProfileModal';
import UserListModal from '../components/UserListModal';
import { UserProfile } from '../types';

interface ModalContextType {
  openUserProfile: (userId: string) => void;
  openUserList: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function useModals() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModals must be used within a ModalProvider');
  }
  return context;
}

export function ModalProvider({ children, profile }: { children: ReactNode, profile: UserProfile | null }) {
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [showUserList, setShowUserList] = useState(false);

  const openUserProfile = (userId: string) => {
    setViewUserId(userId);
    setShowUserList(false); // Close list if opening profile from it
  };

  const openUserList = () => {
    setShowUserList(true);
  };

  return (
    <ModalContext.Provider value={{ openUserProfile, openUserList }}>
      {children}
      
      <UserListModal 
        isOpen={showUserList} 
        onClose={() => setShowUserList(false)} 
        onUserClick={openUserProfile} 
      />
      
      <UserProfileModal 
        userId={viewUserId || ''} 
        isOpen={!!viewUserId} 
        onClose={() => setViewUserId(null)} 
        currentUserProfile={profile}
      />
    </ModalContext.Provider>
  );
}
