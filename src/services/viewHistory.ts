export interface ViewedStoreEntry {
  storeId: string;
  storeName?: string;
  category?: string;
  timestamp: number;
}

export interface ViewedProductEntry {
  productId: string;
  productName?: string;
  category?: string;
  storeId?: string;
  timestamp: number;
}

const STORE_HISTORY_KEY = 'cbh_viewed_stores_v1';
const PRODUCT_HISTORY_KEY = 'cbh_viewed_products_v1';
const CATEGORY_STATS_KEY = 'cbh_viewed_category_stats_v1';

export const viewHistoryService = {
  recordStoreView(storeId: string, storeName?: string, category?: string) {
    if (!storeId) return;
    try {
      const stores: ViewedStoreEntry[] = JSON.parse(localStorage.getItem(STORE_HISTORY_KEY) || '[]');
      const filtered = stores.filter(s => s.storeId !== storeId);
      const updated = [
        { storeId, storeName, category, timestamp: Date.now() },
        ...filtered
      ].slice(0, 30);
      localStorage.setItem(STORE_HISTORY_KEY, JSON.stringify(updated));

      if (category) {
        this.incrementCategoryCount(category);
      }
    } catch (e) {
      console.error('Failed to record store view', e);
    }
  },

  recordProductView(productId: string, productName?: string, category?: string, storeId?: string) {
    if (!productId) return;
    try {
      const products: ViewedProductEntry[] = JSON.parse(localStorage.getItem(PRODUCT_HISTORY_KEY) || '[]');
      const filtered = products.filter(p => p.productId !== productId);
      const updated = [
        { productId, productName, category, storeId, timestamp: Date.now() },
        ...filtered
      ].slice(0, 50);
      localStorage.setItem(PRODUCT_HISTORY_KEY, JSON.stringify(updated));

      if (category) {
        this.incrementCategoryCount(category);
      }
      if (storeId) {
        this.recordStoreView(storeId, undefined, category);
      }
    } catch (e) {
      console.error('Failed to record product view', e);
    }
  },

  incrementCategoryCount(category: string) {
    if (!category || category === 'All') return;
    try {
      const stats: Record<string, { count: number; lastViewed: number }> = JSON.parse(localStorage.getItem(CATEGORY_STATS_KEY) || '{}');
      const current = stats[category] || { count: 0, lastViewed: 0 };
      stats[category] = {
        count: current.count + 1,
        lastViewed: Date.now()
      };
      localStorage.setItem(CATEGORY_STATS_KEY, JSON.stringify(stats));
    } catch (e) {
      console.error('Failed to increment category count', e);
    }
  },

  getViewedStoreEntries(): ViewedStoreEntry[] {
    try {
      return JSON.parse(localStorage.getItem(STORE_HISTORY_KEY) || '[]');
    } catch (e) {
      return [];
    }
  },

  getViewedProductEntries(): ViewedProductEntry[] {
    try {
      return JSON.parse(localStorage.getItem(PRODUCT_HISTORY_KEY) || '[]');
    } catch (e) {
      return [];
    }
  },

  getViewedStoreIds(): Set<string> {
    return new Set(this.getViewedStoreEntries().map(s => s.storeId));
  },

  getViewedProductIds(): Set<string> {
    return new Set(this.getViewedProductEntries().map(p => p.productId));
  },

  getCategoryPreferences(): { category: string; weight: number }[] {
    try {
      const stats: Record<string, { count: number; lastViewed: number }> = JSON.parse(localStorage.getItem(CATEGORY_STATS_KEY) || '{}');
      const storeEntries = this.getViewedStoreEntries();
      const productEntries = this.getViewedProductEntries();

      const weights: Record<string, number> = {};

      Object.entries(stats).forEach(([cat, data]) => {
        if (cat && cat !== 'All') {
          weights[cat] = (weights[cat] || 0) + data.count * 2;
        }
      });

      storeEntries.forEach((s, idx) => {
        if (s.category && s.category !== 'All') {
          const recencyMultiplier = Math.max(1, 10 - idx);
          weights[s.category] = (weights[s.category] || 0) + recencyMultiplier * 3;
        }
      });

      productEntries.forEach((p, idx) => {
        if (p.category && p.category !== 'All') {
          const recencyMultiplier = Math.max(1, 10 - idx);
          weights[p.category] = (weights[p.category] || 0) + recencyMultiplier * 4;
        }
      });

      return Object.entries(weights)
        .map(([category, weight]) => ({ category, weight }))
        .sort((a, b) => b.weight - a.weight);
    } catch (e) {
      return [];
    }
  },

  clearHistory() {
    localStorage.removeItem(STORE_HISTORY_KEY);
    localStorage.removeItem(PRODUCT_HISTORY_KEY);
    localStorage.removeItem(CATEGORY_STATS_KEY);
  }
};
