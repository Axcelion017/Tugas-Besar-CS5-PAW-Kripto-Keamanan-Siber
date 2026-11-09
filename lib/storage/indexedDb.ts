// lib/storage/indexedDb.ts
// Standardized IndexedDB Wrapper for Resilio-Health Offline-First Architecture
// Compliant with SPECIFICATION.md: Section 4.A (Struktur Penyimpanan Lokal IndexedDB)

const DB_NAME = "resilio_offline_db";
const DB_VERSION = 1;

export const STORES = {
  CACHED_PATIENTS: "cached_active_patients",
  CLINICAL_OUTBOX: "offline_clinical_outbox",
  MEDIA_BLOBS: "offline_media_blobs",
} as const;

export interface OfflineOutboxItem {
  recordId: string;
  encounterId: string;
  patientId: string;
  faskesId: string;
  encryptedPayload: string;
  ivHex: string;
  hmacDigest: string;
  version: number;
  clientCreatedAt: string;
  status: "PENDING_SYNC" | "SYNCING" | "SYNC_FAILED";
  retryCount: number;
  lastError?: string;
}

export interface OfflineMediaBlobItem {
  attachmentId: string;
  clinicalRecordId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  encryptedArrayBuffer: ArrayBuffer;
  ivHex: string;
  binaryHmac: string;
  createdAt: string;
}

export function openOfflineDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB is not supported in this environment."));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Store: cached_active_patients
      if (!db.objectStoreNames.contains(STORES.CACHED_PATIENTS)) {
        db.createObjectStore(STORES.CACHED_PATIENTS, { keyPath: "patientId" });
      }

      // 2. Store: offline_clinical_outbox
      if (!db.objectStoreNames.contains(STORES.CLINICAL_OUTBOX)) {
        const outboxStore = db.createObjectStore(STORES.CLINICAL_OUTBOX, { keyPath: "recordId" });
        outboxStore.createIndex("status", "status", { unique: false });
        outboxStore.createIndex("patientId", "patientId", { unique: false });
      }

      // 3. Store: offline_media_blobs
      if (!db.objectStoreNames.contains(STORES.MEDIA_BLOBS)) {
        const mediaStore = db.createObjectStore(STORES.MEDIA_BLOBS, { keyPath: "attachmentId" });
        mediaStore.createIndex("clinicalRecordId", "clinicalRecordId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// =============================================================================
// Helper Functions CRUD untuk IndexedDB
// =============================================================================

export async function saveToOutbox(item: OfflineOutboxItem): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CLINICAL_OUTBOX, "readwrite");
    const store = tx.objectStore(STORES.CLINICAL_OUTBOX);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getOutboxItems(): Promise<OfflineOutboxItem[]> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CLINICAL_OUTBOX, "readonly");
    const store = tx.objectStore(STORES.CLINICAL_OUTBOX);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOutboxItem(recordId: string): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CLINICAL_OUTBOX, "readwrite");
    const store = tx.objectStore(STORES.CLINICAL_OUTBOX);
    const req = store.delete(recordId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveMediaBlob(item: OfflineMediaBlobItem): Promise<void> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEDIA_BLOBS, "readwrite");
    const store = tx.objectStore(STORES.MEDIA_BLOBS);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getMediaBlobsByRecord(clinicalRecordId: string): Promise<OfflineMediaBlobItem[]> {
  const db = await openOfflineDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.MEDIA_BLOBS, "readonly");
    const store = tx.objectStore(STORES.MEDIA_BLOBS);
    const index = store.index("clinicalRecordId");
    const req = index.getAll(clinicalRecordId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
