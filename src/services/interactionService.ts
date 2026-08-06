import { 
  doc, 
  collection, 
  addDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  serverTimestamp, 
  runTransaction,
  increment,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, AppNotification } from '../types';

export const interactionService = {
  async sendNotification(
    recipientId: string, 
    type: AppNotification['type'], 
    fromUser: UserProfile, 
    targetId?: string,
    customTitle?: string,
    customMessage?: string
  ) {
    if (recipientId === fromUser.uid) return; 

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

  getDefaultTitle(type: AppNotification['type']): string {
    switch (type) {
      case 'engage': return 'New Engagement Signal';
      case 'buy': return 'Purchase Initialization';
      case 'rate': return 'New Neural Feedback';
      case 'follow': return 'New Hub Follower';
      case 'like_store': return 'Store Liked';
      case 'like_product': return 'Product Liked';
      case 'connect_request': return 'Connection Uplink Request';
      case 'connect_accept': return 'Connection Protocol Established';
      case 'spotlight_approval': return '📢 Ad Pending Approval';
      default: return 'Hub Update';
    }
  },

  getDefaultMessage(type: AppNotification['type'], name: string): string {
    switch (type) {
      case 'engage': return `${name} has engaged with your inventory node.`;
      case 'buy': return `${name} initialized a purchase protocol for your item.`;
      case 'rate': return `${name} uploaded neural feedback for your product.`;
      case 'follow': return `${name} is now following your storefront node.`;
      case 'like_store': return `${name} liked your storefront.`;
      case 'like_product': return `${name} liked one of your inventory items.`;
      case 'connect_request': return `${name} wants to establish a trusted connection with you.`;
      case 'connect_accept': return `${name} accepted your connection request. You are now trusted partners.`;
      case 'spotlight_approval': return `${name} created an ad/spotlight pending admin approval.`;
      default: return `New activity detected from ${name}.`;
    }
  },

  async notifyAdminsOfPendingAd(
    adTitle: string,
    authorName: string,
    authorUid: string,
    adId?: string
  ) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const adminDocs = snap.docs.filter(d => {
        const data = d.data();
        return data.isAdmin === true || data.email === 'comfort.designszw@gmail.com';
      });

      const adminUids = new Set<string>();
      adminDocs.forEach(d => adminUids.add(d.id));

      const promises = Array.from(adminUids).map(adminUid => {
        if (adminUid === authorUid) return Promise.resolve();
        return addDoc(collection(db, 'notifications'), {
          userId: adminUid,
          type: 'spotlight_approval',
          fromUserId: authorUid,
          fromUserName: authorName || 'Supplier',
          targetId: adId || 'admin_spotlights',
          title: '📢 New Ad Pending Approval',
          message: `${authorName || 'A supplier'} created a new ad/spotlight "${adTitle}". Review and approve it in Command Center to show on Explorer Hub.`,
          read: false,
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(promises);
    } catch (err) {
      console.error('Failed to notify admins of pending ad:', err);
    }
  },

  async sendConnectionRequest(sender: UserProfile, receiver: { uid: string, name: string, avatar?: string }) {
    try {
      // Use deterministic ID to prevent multiple requests
      const connectionId = [sender.uid, receiver.uid].sort().join('_');
      const connRef = doc(db, 'connections', connectionId);
      
      const snap = await getDoc(connRef);
      if (snap.exists()) return;

      await setDoc(connRef, {
        id: connectionId,
        senderId: sender.uid,
        senderName: sender.name || 'User',
        senderAvatar: sender.avatar || '',
        receiverId: receiver.uid,
        receiverName: receiver.name || 'Store',
        receiverAvatar: receiver.avatar || '',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await this.sendNotification(receiver.uid, 'connect_request', sender, connectionId);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'send-connection-request');
    }
  },

  async acceptConnection(connectionId: string, connection: any, currentUser: UserProfile) {
    try {
      await runTransaction(db, async (transaction) => {
        const connRef = doc(db, 'connections', connectionId);
        
        // Determine connection type
        // Sender and receiver role comparison
        // We'll need the other user's role too, but we can assume or fetch it.
        // For simplicity, let's just mark as accepted first.
        
        transaction.update(connRef, {
          status: 'accepted',
          updatedAt: serverTimestamp()
        });
      });

      // Notify the requester
      await this.sendNotification(connection.senderId, 'connect_accept', currentUser, connectionId);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'accept-connection');
    }
  },

  async declineConnection(connectionId: string) {
    try {
      await deleteDoc(doc(db, 'connections', connectionId));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'decline-connection');
    }
  },

  async followStore(storeId: string, storeOwnerId: string, user: UserProfile) {
    try {
      const followId = `${storeId}_${user.uid}`;
      const followRef = doc(db, 'follows', followId);
      
      const followSnap = await getDoc(followRef);
      if (followSnap.exists()) return; // Already following

      await runTransaction(db, async (transaction) => {
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
      const likeId = `${storeId}_${user.uid}`;
      const likeRef = doc(db, 'storeLikes', likeId);
      
      const likeSnap = await getDoc(likeRef);
      if (likeSnap.exists()) return; // Already liked

      await runTransaction(db, async (transaction) => {
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
      const likeId = `${productId}_${user.uid}`;
      const likeRef = doc(db, 'productLikes', likeId);
      
      const likeSnap = await getDoc(likeRef);
      if (likeSnap.exists()) return; // Already liked

      await runTransaction(db, async (transaction) => {
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

        // Create Review doc
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
      await this.sendNotification(productOwnerId, 'rate', profile, productId, "New Product Rating", `${profile.name || 'A user'} rated your product ${rating} stars.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'submit-review');
    }
  },

  async submitStoreReview(storeId: string, storeOwnerId: string, profile: UserProfile, rating: number, comment: string) {
    try {
      await runTransaction(db, async (transaction) => {
        const storeRef = doc(db, 'stores', storeId);
        const sSnap = await transaction.get(storeRef);

        if (!sSnap.exists()) throw new Error("Store non-existent");

        const sData = sSnap.data();
        const sCount = sData.reviewCount || 0;
        const sRating = sData.rating || 0;
        const sNewCount = sCount + 1;
        const sNewAvg = ((sRating * sCount) + rating) / sNewCount;

        transaction.update(storeRef, {
          rating: sNewAvg,
          reviewCount: sNewCount
        });

        const reviewRef = doc(collection(db, 'storeReviews'));
        transaction.set(reviewRef, {
          storeId,
          userId: profile.uid,
          userName: profile.name || 'Anonymous',
          userAvatar: profile.avatar || '',
          rating,
          comment,
          createdAt: serverTimestamp()
        });
      });

      await this.sendNotification(storeOwnerId, 'rate', profile, storeId, "New Storefront Rating", `${profile.name || 'A customer'} rated your store ${rating} stars.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'submit-store-review');
    }
  },

  async markNotificationRead(id: string) {
    try {
      await deleteDoc(doc(db, 'notifications', id)); // Or update to read: true
    } catch (err) {
      console.error('Notification fail', err);
    }
  },

  async logStoreEngagement(storeId: string, type: 'order' | 'whatsapp' | 'checkout', priceAmount: number = 0) {
    if (!storeId) return;
    try {
      const { updateDoc, doc, increment } = await import('firebase/firestore');
      const storeRef = doc(db, 'stores', storeId);
      const updates: any = {
        updatedAt: new Date().toISOString()
      };
      if (type === 'order') {
        updates.orderClicks = increment(1);
        if (priceAmount > 0) {
          updates.estimatedSalesUsd = increment(priceAmount);
        }
      } else if (type === 'whatsapp') {
        updates.whatsappClicks = increment(1);
        if (priceAmount > 0) {
          updates.estimatedSalesUsd = increment(priceAmount);
        }
      } else if (type === 'checkout') {
        if (priceAmount > 0) {
          updates.estimatedSalesUsd = increment(priceAmount);
        }
      }
      await updateDoc(storeRef, updates);
    } catch (err) {
      console.error('Failed logging store engagement stats:', err);
    }
  },

  async logProductClick(productId: string, clickType: 'detail' | 'cta' = 'detail') {
    if (!productId) return;
    try {
      const { updateDoc, doc, increment } = await import('firebase/firestore');
      const pRef = doc(db, 'products', productId);
      const updates: any = {
        clickCount: increment(1),
        updatedAt: new Date().toISOString()
      };
      if (clickType === 'detail') {
        updates.detailClicks = increment(1);
      } else {
        updates.ctaClicks = increment(1);
      }
      await updateDoc(pRef, updates);
    } catch (err) {
      console.error('Failed logging product click:', err);
    }
  },

  async logProductShare(productId: string) {
    if (!productId) return;
    try {
      const { updateDoc, doc, increment } = await import('firebase/firestore');
      const pRef = doc(db, 'products', productId);
      await updateDoc(pRef, {
        shareCount: increment(1),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed logging product share:', err);
    }
  },

  async logProductReport(productId: string) {
    if (!productId) return;
    try {
      const { updateDoc, doc, increment } = await import('firebase/firestore');
      const pRef = doc(db, 'products', productId);
      await updateDoc(pRef, {
        reportCount: increment(1),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed logging product report:', err);
    }
  }
};
