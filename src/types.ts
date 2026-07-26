export type Role = 'customer' | 'supplier';

export interface PublicProfile {
  uid: string;
  name: string;
  avatar?: string;
  currentRole: Role;
  location?: {
    city?: string;
  };
  isVerified: boolean;
  status?: 'active' | 'suspended' | 'banned';
  isAdmin?: boolean;
  whatsappNumber?: string;
  updatedAt: any;
}

export interface UserProfile {
  uid: string;
  isGuest?: boolean;
  name: string;
  displayName?: string;
  authMethod?: 'google' | 'email' | 'phone';
  email?: string | null;
  phone: string;
  phoneNumber?: string | null;
  phoneVerified?: boolean;
  avatar?: string;
  currentRole: Role;
  geohash?: string;
  lat?: number;
  lng?: number;
  businessName?: string;
  businessCategory?: string;
  isVerified: boolean;
  isAdmin?: boolean;
  status?: 'active' | 'suspended' | 'banned';
  suspensionEnd?: string;
  suspensionDuration?: string;
  reportCount?: number;
  whatsappNumber?: string;
  whatsappUrl?: string;
  requiredProducts?: string[];
  fcmToken?: string;
  notificationPrefs?: {
    purchases: boolean;
    messages: boolean;
    social: boolean;
    highPriority: boolean;
  };
  location?: {
    city?: string;
    coordinates?: { lat: number; lng: number };
    address?: string;
  };
  gateway?: {
    provider: 'paypal' | 'stripe' | 'paynow' | 'ecocash' | 'pod' | 'custom';
    details: string;
    isActive: boolean;
  };
  createdAt?: any;
  updatedAt?: any;
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
  coverPhoto?: string;
  address?: string;
  rating: number;
  reviewCount: number;
  followerCount?: number;
  likeCount?: number;
  isVerified?: boolean;
  whatsappNumber?: string;
  statsResetAt?: string;
  createdAt: any;
  updatedAt?: any;
}

export type BuyButtonType = 'checkout' | 'chat' | 'link' | 'ecocash' | 'pod';

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
  buyButtonText?: string;
  rating?: number;
  reviewCount?: number;
  followerCount?: number;
  likeCount?: number;
  isVerified?: boolean;
  isActive: boolean;
  createdAt: any;
  updatedAt?: any;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'engage' | 'buy' | 'rate' | 'follow' | 'like_store' | 'like_product' | 'connect_request' | 'connect_accept' | 'message' | 'reminder' | 'deal' | 'share' | 'report';
  fromUserId: string;
  fromUserName: string;
  targetId?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
}

export interface PushNotificationSettings {
  messagesEnabled: boolean;
  dealsEnabled: boolean;
  engagementsEnabled: boolean;
  weeklyRemindersEnabled: boolean;
  lastWeeklyReminder?: number;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment?: string;
  createdAt: any;
}

export type DealStatus = 'pending' | 'quoted' | 'accepted' | 'shipped' | 'delivered' | 'cancelled';

export interface Deal {
  id: string;
  customerId: string;
  supplierId: string;
  productId: string;
  status: DealStatus;
  agreedPrice: number;
  customerNotes?: string;
  supplierNotes?: string;
  updatedAt: any;
}

export interface MessageAttachment {
  id: string;
  url: string;
  name: string;
  type: string; // mime type
  size: number;
  thumbnail?: string;
  metadata?: any;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  type: 'text' | 'quote' | 'location' | 'image' | 'video' | 'file' | 'contact' | 'audio';
  payload?: any;
  attachments?: MessageAttachment[];
  read: boolean;
  createdAt: any;
}

export interface Spotlight {
  id: string;
  authorId: string;
  authorName: string;
  type: 'news' | 'event' | 'update' | 'spotlight' | 'classified';
  title: string;
  content: string;
  image?: string;
  location?: string;
  date?: string;
  isActive: boolean;
  createdAt: any;

  // Classified Ads specific properties
  isClassified?: boolean;
  category?: string;
  price?: string;
  badge?: string;
  durationHours?: number;
  expiresAt?: any;
  contactPhone?: string;
  whatsappNumber?: string;
  actionUrl?: string;
  targetType?: 'chat' | 'whatsapp' | 'call' | 'store' | 'external';
  tier?: 'standard' | 'featured' | 'vip_banner';
}

export type EngagementType = 'engaged' | 'interested' | 'order_now';

export interface Engagement {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  supplierId: string;
  type: EngagementType;
  price?: number;
  currency?: string;
  details?: string;
  createdAt: any;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: any;
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined';

export interface Connection {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  status: ConnectionStatus;
  type?: 'partner' | 'supplier' | 'customer';
  createdAt: any;
  updatedAt: any;
}

export type ReportType = 'substandard' | 'misinformation' | 'illegal' | 'nudity' | 'violence';

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  targetId: string; // Product ID, Store ID, or User ID
  targetType: 'product' | 'store' | 'user';
  targetName: string;
  ownerId: string; // Owner of the reported item
  type: ReportType;
  details: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: any;
}
