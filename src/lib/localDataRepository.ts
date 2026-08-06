import { localDB, calculateTTL, DEFAULT_TTL_MS, INITIAL_OFFLINE_STORES, INITIAL_OFFLINE_PRODUCTS } from './db';
import { db } from './firebase';
import { collection, doc, getDoc, getDocs, limit, query } from 'firebase/firestore';

export interface RepositoryOptions {
  ttlMs?: number;
  timeoutMs?: number;
  forceNetworkRefresh?: boolean;
}

export interface PaginatedOptions extends RepositoryOptions {
  page?: number;
  pageSize?: number;
  category?: string;
  storeId?: string;
  city?: string;
  search?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  fromCache: boolean;
  isStale: boolean;
}

export interface CacheResult<T> {
  data: T;
  isStale: boolean;
  fromCache: boolean;
  error?: string;
}

export class LocalDataRepository {
  /**
   * Stale-While-Revalidate helper:
   * Returns local data immediately from local storage/IndexedDB.
   * If online, asynchronously fetches fresh data from server in background
   * and triggers onServerUpdate callback if data has changed.
   */
  async getStaleWhileRevalidate<T>(
    key: string,
    readLocal: () => Promise<T | null>,
    fetchServer: () => Promise<T>,
    saveLocal: (fresh: T) => Promise<void>,
    onServerUpdate?: (freshData: T) => void
  ): Promise<T | null> {
    const localData = await readLocal();

    if (navigator.onLine) {
      // Fire background revalidation without blocking caller
      fetchServer()
        .then(async (fresh) => {
          if (fresh !== null && fresh !== undefined) {
            await saveLocal(fresh);
            if (onServerUpdate) {
              onServerUpdate(fresh);
            }
          }
        })
        .catch((err) => {
          console.warn(`[SWR Revalidation] Background update failed for ${key}:`, err);
        });
    }

    return localData;
  }

  /**
   * Universal cache-first fetch helper with TTL and 5-second network timeout.
   * Order:
   * 1. Read Dexie local DB.
   * 2. If present and not forceNetworkRefresh, return immediately or fallback.
   * 3. Attempt network fetch with 5000ms timeout.
   * 4. On network success: upsert to Dexie with new lastSynced/expiresAt.
   * 5. On network failure/offline: return local data or seed fallback. Never throw.
   */
  async fetchWithCacheFallback<T>(
    cacheKey: string,
    readLocal: () => Promise<T | null>,
    saveLocal: (data: T, lastSynced: number, expiresAt: number) => Promise<void>,
    fetchNetwork: () => Promise<T>,
    defaultFallback: T,
    options: RepositoryOptions = {}
  ): Promise<CacheResult<T>> {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const timeoutMs = options.timeoutMs ?? 5000;

    let localResult: T | null = null;

    try {
      localResult = await readLocal();
    } catch (err) {
      console.warn(`[LocalDataRepository] Error reading local cache for ${cacheKey}:`, err);
    }

    const hasLocalData = localResult !== null && (Array.isArray(localResult) ? localResult.length > 0 : true);

    // If offline or fast local hit requested and we have valid local data, return local immediately
    if (hasLocalData && (!navigator.onLine || !options.forceNetworkRefresh)) {
      return {
        data: localResult as T,
        isStale: false,
        fromCache: true,
      };
    }

    // Try network with 5s timeout
    try {
      const networkPromise = fetchNetwork();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Network request timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      const freshData = await Promise.race([networkPromise, timeoutPromise]);

      if (freshData !== null && freshData !== undefined) {
        const { lastSynced, expiresAt } = calculateTTL(ttlMs);
        try {
          await saveLocal(freshData, lastSynced, expiresAt);
        } catch (saveErr) {
          console.warn(`[LocalDataRepository] Failed to update local cache for ${cacheKey}:`, saveErr);
        }

        return {
          data: freshData,
          isStale: false,
          fromCache: false,
        };
      }
    } catch (netErr: any) {
      console.warn(`[LocalDataRepository] Network fetch failed/timed out for ${cacheKey}:`, netErr?.message || netErr);
    }

    // Fallback path: serve local result if available, else serve seed default fallback
    if (localResult !== null) {
      return {
        data: localResult,
        isStale: true,
        fromCache: true,
        error: 'Served offline cached data',
      };
    }

    return {
      data: defaultFallback,
      isStale: true,
      fromCache: true,
      error: 'Served default offline seed data',
    };
  }

  /**
   * Paginated Products Fetching with IndexedDB Indexes & Lazy Loading.
   * Uses Dexie key path indexing on category & storeId for high efficiency local retrieval.
   */
  async getProductsPaginated(options: PaginatedOptions = {}): Promise<PaginatedResult<any>> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    try {
      let queryCollection = localDB.products.toCollection();

      if (options.storeId) {
        queryCollection = localDB.products.where('storeId').equals(options.storeId);
      } else if (options.category) {
        queryCollection = localDB.products.where('category').equals(options.category);
      }

      let allMatching = await queryCollection.toArray();

      if (options.search) {
        const term = options.search.toLowerCase();
        allMatching = allMatching.filter(p => {
          const name = (p.data?.name || '').toLowerCase();
          const cat = (p.data?.category || '').toLowerCase();
          return name.includes(term) || cat.includes(term);
        });
      }

      const total = allMatching.length;
      const paginatedLocal = allMatching.slice(offset, offset + pageSize).map(item => item.data || item);
      const hasMore = offset + pageSize < total;

      if (total > 0 && (!navigator.onLine || !options.forceNetworkRefresh)) {
        return {
          items: paginatedLocal,
          total,
          page,
          pageSize,
          hasMore,
          fromCache: true,
          isStale: false,
        };
      }

      // If online and forceNetworkRefresh or empty local results, fetch batch from Firestore
      if (navigator.onLine) {
        const snap = await getDocs(query(collection(db, 'products'), limit(pageSize * page)));
        const freshProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const { lastSynced, expiresAt } = calculateTTL();
        const records = freshProducts.map((p: any) => ({
          id: p.id,
          storeId: p.storeId || '',
          category: p.category || '',
          data: p,
          updatedAt: Date.now(),
          lastSynced,
          expiresAt,
        }));
        await localDB.products.bulkPut(records);

        const freshTotal = freshProducts.length;
        const freshSlice = freshProducts.slice(offset, offset + pageSize);

        return {
          items: freshSlice,
          total: freshTotal,
          page,
          pageSize,
          hasMore: offset + pageSize < freshTotal,
          fromCache: false,
          isStale: false,
        };
      }

      return {
        items: paginatedLocal.length > 0 ? paginatedLocal : INITIAL_OFFLINE_PRODUCTS.slice(offset, offset + pageSize),
        total: total || INITIAL_OFFLINE_PRODUCTS.length,
        page,
        pageSize,
        hasMore: offset + pageSize < (total || INITIAL_OFFLINE_PRODUCTS.length),
        fromCache: true,
        isStale: true,
      };
    } catch (err) {
      console.warn('[LocalDataRepository] Error fetching paginated products:', err);
      return {
        items: INITIAL_OFFLINE_PRODUCTS.slice(offset, offset + pageSize),
        total: INITIAL_OFFLINE_PRODUCTS.length,
        page,
        pageSize,
        hasMore: false,
        fromCache: true,
        isStale: true,
      };
    }
  }

  /**
   * Paginated Stores Fetching with IndexedDB Indexes & Lazy Loading.
   */
  async getStoresPaginated(options: PaginatedOptions = {}): Promise<PaginatedResult<any>> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    try {
      let queryCollection = localDB.stores.toCollection();

      if (options.category) {
        queryCollection = localDB.stores.where('category').equals(options.category);
      } else if (options.city) {
        queryCollection = localDB.stores.where('city').equals(options.city);
      }

      let allMatching = await queryCollection.toArray();

      if (options.search) {
        const term = options.search.toLowerCase();
        allMatching = allMatching.filter(s => {
          const name = (s.data?.name || '').toLowerCase();
          const city = (s.data?.city || '').toLowerCase();
          return name.includes(term) || city.includes(term);
        });
      }

      const total = allMatching.length;
      const paginatedLocal = allMatching.slice(offset, offset + pageSize).map(item => item.data || item);
      const hasMore = offset + pageSize < total;

      if (total > 0 && (!navigator.onLine || !options.forceNetworkRefresh)) {
        return {
          items: paginatedLocal,
          total,
          page,
          pageSize,
          hasMore,
          fromCache: true,
          isStale: false,
        };
      }

      if (navigator.onLine) {
        const snap = await getDocs(query(collection(db, 'stores'), limit(pageSize * page)));
        const freshStores = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const { lastSynced, expiresAt } = calculateTTL();
        const records = freshStores.map((s: any) => ({
          id: s.id,
          name: s.name || '',
          category: s.category || '',
          city: s.city || '',
          data: s,
          updatedAt: Date.now(),
          lastSynced,
          expiresAt,
        }));
        await localDB.stores.bulkPut(records);

        const freshTotal = freshStores.length;
        const freshSlice = freshStores.slice(offset, offset + pageSize);

        return {
          items: freshSlice,
          total: freshTotal,
          page,
          pageSize,
          hasMore: offset + pageSize < freshTotal,
          fromCache: false,
          isStale: false,
        };
      }

      return {
        items: paginatedLocal.length > 0 ? paginatedLocal : INITIAL_OFFLINE_STORES.slice(offset, offset + pageSize),
        total: total || INITIAL_OFFLINE_STORES.length,
        page,
        pageSize,
        hasMore: offset + pageSize < (total || INITIAL_OFFLINE_STORES.length),
        fromCache: true,
        isStale: true,
      };
    } catch (err) {
      console.warn('[LocalDataRepository] Error fetching paginated stores:', err);
      return {
        items: INITIAL_OFFLINE_STORES.slice(offset, offset + pageSize),
        total: INITIAL_OFFLINE_STORES.length,
        page,
        pageSize,
        hasMore: false,
        fromCache: true,
        isStale: true,
      };
    }
  }

  /**
   * Granular Product Update:
   * Modifies specific keys of a single record in Dexie without re-writing entire table.
   */
  async updateProductGranular(productId: string, updates: Record<string, any>): Promise<void> {
    try {
      const existing = await localDB.products.get(productId);
      const now = Date.now();
      const { lastSynced, expiresAt } = calculateTTL();

      if (existing) {
        const updatedData = { ...existing.data, ...updates, updatedAt: new Date().toISOString() };
        await localDB.products.put({
          ...existing,
          storeId: updates.storeId || existing.storeId,
          data: updatedData,
          updatedAt: now,
          lastSynced,
          expiresAt,
        });
      } else {
        await localDB.products.put({
          id: productId,
          storeId: updates.storeId || '',
          data: { id: productId, ...updates, updatedAt: new Date().toISOString() },
          updatedAt: now,
          lastSynced,
          expiresAt,
        });
      }

      // Sync granular doc to cache table
      const key = `products:${productId}`;
      const cachedDoc = await localDB.cache.get(key);
      if (cachedDoc) {
        await localDB.cache.put({
          ...cachedDoc,
          data: { ...cachedDoc.data, ...updates, updatedAt: new Date().toISOString() },
          updatedAt: now,
          lastSynced,
          expiresAt,
        });
      }
    } catch (err) {
      console.warn('[LocalDataRepository] Granular product update error:', productId, err);
    }
  }

  /**
   * Granular Store Update:
   * Modifies specific keys of a single store record in Dexie.
   */
  async updateStoreGranular(storeId: string, updates: Record<string, any>): Promise<void> {
    try {
      const existing = await localDB.stores.get(storeId);
      const now = Date.now();
      const { lastSynced, expiresAt } = calculateTTL();

      if (existing) {
        const updatedData = { ...existing.data, ...updates, updatedAt: new Date().toISOString() };
        await localDB.stores.put({
          ...existing,
          data: updatedData,
          updatedAt: now,
          lastSynced,
          expiresAt,
        });
      }

      const key = `stores:${storeId}`;
      const cachedDoc = await localDB.cache.get(key);
      if (cachedDoc) {
        await localDB.cache.put({
          ...cachedDoc,
          data: { ...cachedDoc.data, ...updates, updatedAt: new Date().toISOString() },
          updatedAt: now,
          lastSynced,
          expiresAt,
        });
      }
    } catch (err) {
      console.warn('[LocalDataRepository] Granular store update error:', storeId, err);
    }
  }

  /**
   * Get stores with cache-first strategy
   */
  async getStores(options?: RepositoryOptions): Promise<CacheResult<any[]>> {
    return this.fetchWithCacheFallback(
      'stores',
      async () => {
        const records = await localDB.stores.toArray();
        return records.length > 0 ? records.map(r => r.data) : null;
      },
      async (data, lastSynced, expiresAt) => {
        const records = data.map(s => ({
          id: s.id,
          data: s,
          updatedAt: Date.now(),
          lastSynced,
          expiresAt,
        }));
        await localDB.stores.bulkPut(records);
      },
      async () => {
        const snap = await getDocs(query(collection(db, 'stores'), limit(50)));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      },
      INITIAL_OFFLINE_STORES,
      options
    );
  }

  /**
   * Get products with cache-first strategy
   */
  async getProducts(options?: RepositoryOptions): Promise<CacheResult<any[]>> {
    return this.fetchWithCacheFallback(
      'products',
      async () => {
        const records = await localDB.products.toArray();
        return records.length > 0 ? records.map(r => r.data) : null;
      },
      async (data, lastSynced, expiresAt) => {
        const records = data.map(p => ({
          id: p.id,
          storeId: p.storeId || '',
          data: p,
          updatedAt: Date.now(),
          lastSynced,
          expiresAt,
        }));
        await localDB.products.bulkPut(records);
      },
      async () => {
        const snap = await getDocs(query(collection(db, 'products'), limit(50)));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      },
      INITIAL_OFFLINE_PRODUCTS,
      options
    );
  }

  /**
   * Get single document by collection and ID
   */
  async getDocument<T = any>(collectionName: string, docId: string, options?: RepositoryOptions): Promise<CacheResult<T | null>> {
    const key = `${collectionName}:${docId}`;
    return this.fetchWithCacheFallback<T | null>(
      key,
      async () => {
        const cached = await localDB.cache.get(key);
        return cached ? (cached.data as T) : null;
      },
      async (data, lastSynced, expiresAt) => {
        if (data) {
          await localDB.cache.put({
            id: key,
            collection: collectionName,
            docId,
            data,
            updatedAt: Date.now(),
            lastSynced,
            expiresAt,
          });
        }
      },
      async () => {
        const docSnap = await getDoc(doc(db, collectionName, docId));
        return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as T) : null;
      },
      null,
      options
    );
  }

  /**
   * Ensure initial seed data is loaded into Dexie on first boot
   */
  async seedInitialDataIfNeeded(): Promise<void> {
    try {
      const storeCount = await localDB.stores.count();
      if (storeCount === 0) {
        const { lastSynced, expiresAt } = calculateTTL(DEFAULT_TTL_MS * 2);
        const storeRecords = INITIAL_OFFLINE_STORES.map(s => ({
          id: s.id,
          data: s,
          updatedAt: Date.now(),
          lastSynced,
          expiresAt,
        }));
        await localDB.stores.bulkPut(storeRecords);
      }

      const prodCount = await localDB.products.count();
      if (prodCount === 0) {
        const { lastSynced, expiresAt } = calculateTTL(DEFAULT_TTL_MS * 2);
        const prodRecords = INITIAL_OFFLINE_PRODUCTS.map(p => ({
          id: p.id,
          storeId: p.storeId,
          data: p,
          updatedAt: Date.now(),
          lastSynced,
          expiresAt,
        }));
        await localDB.products.bulkPut(prodRecords);
      }
    } catch (e) {
      console.warn('[LocalDataRepository] Error seeding initial data:', e);
    }
  }
}

export const localDataRepository = new LocalDataRepository();
