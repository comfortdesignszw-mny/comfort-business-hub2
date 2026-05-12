# Comfort Business Hub - Security Specification (Fortress Grade)

## 1. Data Invariants
- **verified_supply_chain**: ALL supply-side entities (`Store`, `Product`, `Spotlight`) MUST be owned by a user with `email_verified == true`.
- **relational_integrity**: A `Product` cannot be created without a valid `Store` ID that is owned by the same user.
- **ownership_immutability**: Once created, `uid`, `ownerId`, `userId`, and `customerId` fields are immutable.
- **privacy_isolation**: User profile PII (Contact links, location) is only accessible via `get` for authenticated users; bulk `list` is strictly forbidden.

## 2. The "Dirty Dozen" Logic Leaks (Attack Payloads)
| Attack ID | Vector | Malicious Payload Example | Expected Result |
| :--- | :--- | :--- | :--- |
| **LEAK-01** | Identity Spoofing | `setDoc(doc(db, 'users', 'victim-uid'), { name: 'Attacker' })` | `PERMISSION_DENIED` |
| **LEAK-02** | Shadow Update | `updateDoc(doc(db, 'users', 'me'), { isVerified: true })` | `PERMISSION_DENIED` |
| **LEAK-03** | Orphaned Product | `addDoc(collection(db, 'products'), { storeId: 'someone-elses-store' })` | `PERMISSION_DENIED` |
| **LEAK-04** | ID Poisoning | `setDoc(doc(db, 'stores', '...1MB-JUNK-STRING...'), { ... })` | `PERMISSION_DENIED` |
| **LEAK-05** | Denial of Wallet | `addDoc(collection(db, 'messages'), { text: 'A'.repeat(1000000) })` | `PERMISSION_DENIED` |
| **LEAK-06** | State Shortcutting | `updateDoc(doc(db, 'deals', 'id'), { status: 'delivered' })` | `PERMISSION_DENIED` |
| **LEAK-07** | Query Scraping | `getDocs(query(collection(db, 'notifications')))` (without filter) | `PERMISSION_DENIED` |
| **LEAK-08** | Unauthorized Like | `addDoc(collection(db, 'productLikes'), { userId: 'victim-id' })` | `PERMISSION_DENIED` |
| **LEAK-09** | Spoofed News | `addDoc(collection(db, 'spotlights'), { authorId: 'admin-id' })` | `PERMISSION_DENIED` |
| **LEAK-10** | Unverified Seller | `addDoc(collection(db, 'stores'), { ... })` (User email not verified) | `PERMISSION_DENIED` |
| **LEAK-11** | Message Interjection | `addDoc(collection(db, 'messages'), { senderId: 'not-me' })` | `PERMISSION_DENIED` |
| **LEAK-12** | Review Spam | `addDoc(collection(db, 'reviews'), { rating: 99 })` | `PERMISSION_DENIED` |

## 3. Infrastructure Compliance
- **TLS 1.3**: All communications forced over encrypted layers.
- **Zero-Trust Rules**: Standardized `isValidId()` and `isValid[Entity]()` helpers applied to 100% of mutation paths.
- **No Blanket Lists**: Rules explicitly check `resource.data` against `request.auth.uid`.
