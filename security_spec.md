# Comfort Business Hub - Security Specification (Production Grade)

## 1. Identity Invariants
- **Email Sovereignty**: All supply-chain actions (creating stores, products, or spotlights) require `email_verified == true`.
- **Identity Integrity**: User profile UIDs must mathematically equal the authenticated system UID.
- **Relational Sync**: Engagement records and chat messages can only be initialized by the primary customer node.

## 2. Infrastructure Hardening
- **ID Poisoning Protection**: All document IDs are validated against regex `^[a-zA-Z0-9_\\-]+$` with a 64-character ceiling.
- **Payload Size Capping**:
  - Message text: max 5,000 characters.
  - User Names: max 100 characters.
  - Store Geohashes: max 32 characters.
- **Atomic Integrity**: Count updates (likes/followers) use Firestore Transactions to prevent race conditions during high-concurrency event streams.

## 3. The "Dirty Dozen" Payload Audit
| Payload Attack | Prevention Mechanism | Status |
| :--- | :--- | :--- |
| **Shadow Field Update** | `affectedKeys().hasOnly()` validates specific update schemas. | ✅ PASS |
| **Identity Spoofing** | UIDs must match `request.auth.uid` globally. | ✅ PASS |
| **Denial of Wallet (ID Junk)** | `isValidId()` enforces path variable size and schema. | ✅ PASS |
| **PII Blanket List query** | Rules enforce `resource.data.userId == request.auth.uid` for list queries. | ✅ PASS |
| **Unverified Seller** | `isVerified()` gate blocks supply-chain writes for unverified emails. | ✅ PASS |
| **Recursive Count Attack** | Transactions and static validation gate cost-attacks. | ✅ PASS |
| **Terminal State Bypass** | Immutability rules prevent changing IDs after creation. | ✅ PASS |
| **Secrets Exposure** | Automated scan verified no exposed keys or PII in code artifacts. | ✅ PASS |

## 4. Optimization & Performance
- **Asset PWA Strategies**: Service worker caches 80% of UI assets and 3rd party icons (DiceBear, Lucide).
- **Network Resilience**: Firestore `IndexedDB` persistence enabled for total offline-first data availability.
- **Fast Web Loading**: 
  - `React.lazy` + `Suspense` for all high-level page modules.
  - `OptimizedImage` handles selective loading and referrer-safe image fetching.
  - Query limits curtailed to 50-150 items per initial scan to ensure rapid TTI (Time to Interactive).
