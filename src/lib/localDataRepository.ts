import { localDB, calculateTTL, DEFAULT_TTL_MS, INITIAL_OFFLINE_STORES, INITIAL_OFFLINE_PRODUCTS } from './db';
import { db } from './firebase';
import { collection, doc, getDoc, getDocs, limit, query } from 'firebase/firestore';

export interface RepositoryOptions {
  ttlMs?: number;
  timeoutMs?: number;
  forceNetworkRefresh?: boolean;
}

export interface CacheResult<T> {
  data: T;
  isStale: boolean;
  fromCache: boolean;
  error?: string;
}

export class LocalDataRepository {
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
