export type Role = 'customer' | 'supplier';

export interface UserProfile {
  uid: string;
  name: string;
  phone: string;
  avatar?: string;
  currentRole: Role;
  geohash?: string;
  lat?: number;
  lng?: number;
  businessName?: string;
  businessCategory?: string;
  isVerified: boolean;
  whatsappUrl?: string;
  requiredProducts?: string[];
  fcmToken?: string;
  location?: {
    city?: string;
    coordinates?: { lat: number; lng: number };
    address?: string;
  };
  gateway?: {
    provider: 'paypal' | 'stripe' | 'paynow' | 'custom';
    details: string;
    isActive: boolean;
  };
}

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  contactNumbers: string[];
  email: string;
  category: string;
  specificBusinessType?: string;
  geohash: string;
  lat: number;
  lng: number;
  logo?: string;
  rating: number;
  reviewCount: number;
  createdAt: string;
}

export type BuyButtonType = 'checkout' | 'chat' | 'link';

export interface Product {
  id: string;
  storeId: string;
  ownerId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  images: string[];
  buyButtonType: BuyButtonType;
  buyButtonLink?: string;
  isActive: boolean;
  createdAt: string;
}

export type DealStatus = 'pending' | 'quoted' | 'accepted' | 'delivered' | 'cancelled';

export interface Deal {
  id: string;
  customerId: string;
  supplierId: string;
  productId: string;
  status: DealStatus;
  agreedPrice: number;
  customerNotes?: string;
  supplierNotes?: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  type: 'text' | 'quote' | 'location' | 'image';
  payload?: any;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: string;
}
