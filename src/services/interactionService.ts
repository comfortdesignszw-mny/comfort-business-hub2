import { 
  doc, 
  collection, 
  addDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  runTransaction,
  increment
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, Notification } from '../types';

export const interactionService = {
  async sendNotification(
    recipientId: string, 
    type: Notification['type'], 
    fromUser: UserProfile, 
    targetId?: string,
    customTitle?: string,
    customMessage?: string
  ) {
    if (recipientId === fromUser.uid) return; // Don't notify self

    try {
      const title = customTitle || this.getDefaultTitle(type);
      const message = customMessage || this.getDefaultMessage(type, fromUser.name || 'Someone');

      await addDoc(collection(db, 'notifications'), {
        userId: recipientId,
        type,
        fromUserId: fromUser.uid,
        fromUserName: fromUser.name || 'A user',
        targetId,
        title,
        message,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
  },

  getDefaultTitle(type: Notification['type']): string {
    switch (type) {
      case 'engage': return 'New Engagement Signal';
      case 'buy': return 'Purchase Initialization';
      case 'rate': return 'New Neural Feedback';
      case 'follow': return 'New Hub Follower';
      case 'like_store': return 'Store Liked';
      case 'like_product': return 'Product Liked';
      default: return 'Hub Update';
    }
  },

  getDefaultMessage(type: Notification['type'], name: string): string {
    switch (type) {
      case 'engage': return `${name} has engaged with your inventory node.`;
      case 'buy': return `${name} initialized a purchase protocol for your item.`;
      case 'rate': return `${name} uploaded neural feedback for your product.`;
      case 'follow': return `${name} is now following your storefront node.`;
      case 'like_store': return `${name} liked your storefront.`;
      case 'like_product': return `${name} liked one of your inventory items.`;
      default: return `New activity detected from ${name}.`;
    }
  },

  async followStore(storeId: string, storeOwnerId: string, user: UserProfile) {
    try {
      await runTransaction(db, async (transaction) => {
        const followQuery = query(
          collection(db, 'follows'),
          where('storeId', '==', storeId),
          where('userId', '==', user.uid)
        );
        const followSnap = await getDocs(followQuery);
        
        if (!followSnap.empty) return; // Already following

        const followRef = doc(collection(db, 'follows'));
        transaction.set(followRef, {
          storeId,
          userId: user.uid,
          createdAt: serverTimestamp()
        });

        transaction.update(doc(db, 'stores', storeId), {
          followerCount: increment(1)
        });
      });

      await this.sendNotification(storeOwnerId, 'follow', user, storeId);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'follow-store');
    }
  },

  async likeStore(storeId: string, storeOwnerId: string, user: UserProfile) {
    try {
      await runTransaction(db, async (transaction) => {
        const likeQuery = query(
          collection(db, 'storeLikes'),
          where('storeId', '==', storeId),
          where('userId', '==', user.uid)
        );
        const likeSnap = await getDocs(likeQuery);
        
        if (!likeSnap.empty) return; // Already liked

        const likeRef = doc(collection(db, 'storeLikes'));
        transaction.set(likeRef, {
          storeId,
          userId: user.uid,
          createdAt: serverTimestamp()
        });

        transaction.update(doc(db, 'stores', storeId), {
          likeCount: increment(1)
        });
      });

      await this.sendNotification(storeOwnerId, 'like_store', user, storeId);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'like-store');
    }
  },

  async likeProduct(productId: string, productOwnerId: string, user: UserProfile) {
    try {
      await runTransaction(db, async (transaction) => {
        const likeQuery = query(
          collection(db, 'productLikes'),
          where('productId', '==', productId),
          where('userId', '==', user.uid)
        );
        const likeSnap = await getDocs(likeQuery);
        
        if (!likeSnap.empty) return; // Already liked

        const likeRef = doc(collection(db, 'productLikes'));
        transaction.set(likeRef, {
          productId,
          userId: user.uid,
          createdAt: serverTimestamp()
        });

        transaction.update(doc(db, 'products', productId), {
          likeCount: increment(1)
        });
      });

      await this.sendNotification(productOwnerId, 'like_product', user, productId);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'like-product');
    }
  },

  async submitReview(productId: string, storeId: string, profile: UserProfile, rating: number, comment: string, productOwnerId: string) {
    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', productId);
        const storeRef = doc(db, 'stores', storeId);
        
        const [pSnap, sSnap] = await Promise.all([
          transaction.get(productRef),
          transaction.get(storeRef)
        ]);

        if (!pSnap.exists()) throw new Error("Product mismatch");

        // Update Product stats
        const pData = pSnap.data();
        const pCount = pData.reviewCount || 0;
        const pRating = pData.rating || 0;
        const pNewCount = pCount + 1;
        const pNewAvg = ((pRating * pCount) + rating) / pNewCount;

        transaction.update(productRef, {
          rating: pNewAvg,
          reviewCount: pNewCount
        });

        // Update Store stats (optional but recommended for industry standards)
        if (sSnap.exists()) {
          const sData = sSnap.data();
          const sCount = sData.reviewCount || 0;
          const sRating = sData.rating || 0;
          const sNewCount = sCount + 1;
          const sNewAvg = ((sRating * sCount) + rating) / sNewCount;
          
          transaction.update(storeRef, {
            rating: sNewAvg,
            reviewCount: sNewCount
          });
        }

        // Create Review doc - use a specific ID to prevent multiple submissions if needed, but addDoc is fine for reviews
        const reviewRef = doc(collection(db, 'reviews'));
        transaction.set(reviewRef, {
          productId,
          userId: profile.uid,
          userName: profile.name || 'Anonymous',
          userAvatar: profile.avatar || '',
          rating,
          comment,
          createdAt: serverTimestamp()
        });
      });

      // Notification
      await this.sendNotification(productOwnerId, 'rate', profile, productId, "New Neural Feedback", `${profile.name || 'Citizen'} submitted a ${rating}-star rating.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'submit-review');
    }
  },

  async markNotificationRead(id: string) {
    try {
      await deleteDoc(doc(db, 'notifications', id)); // Or update to read: true
    } catch (err) {
      console.error('Notification fail', err);
    }
  }
};
