# Spesifikasi Komponen Kriptografi — JagaMedis (`v0.3.4`)

Dokumen ini mendefinisikan spesifikasi teknis komponen kriptografi pada sistem **JagaMedis** (sebelumnya Resilio-Health) sesuai standar internasional (**NIST SP 800-38D, SP 800-57, SP 800-107, RFC 5869, RFC 2104, CWE-208**) dan regulasi nasional (**Permenkes RI No. 24/2022 & UU PDP No. 27/2022**).

---

## 1. Algoritma Terpilih & Standar Acuan

1. **HKDF-SHA256 (Key Separation — RFC 5869 & NIST SP 800-57)**:
   - **Modul Implementasi**: `lib/crypto/hkdf.ts` (`deriveSubKeysHKDF`) dipanggil secara terpusat di `features/medical-records/crypto-service.ts` dan `lib/crypto/aes.ts` (enkripsi citra biner).
   - **Tujuan Keamanan**: Menurunkan dua sub-kunci independen (`encKeyHex` khusus AES-256-GCM dan `macKeyHex` khusus HMAC-SHA256) dari satu Master Key 256-bit pasien agar tidak terjadi *key reuse* lintas primitif.

2. **AES-256-GCM + AAD Context Binding (AEAD — NIST SP 800-38D)**:
   - **Modul Implementasi**: `lib/crypto/aes.ts` (`encryptAES`, `decryptAES`) & `features/medical-records/crypto-service.ts`.
   - **Tujuan Keamanan**: Kerahasiaan (*Confidentiality*) & keaslian konteks rekam medis klinis (SOAP, resep, surat sakit/rujukan, citra medis).
   - **Panjang Kunci Simetris**: 256-bit (32 bytes / 64 karakter heksadesimal — diturunkan via HKDF).
   - **Initialization Vector (IV)**: 96-bit (12 bytes / 24 karakter heksadesimal) acak unik per enkripsi via CSPRNG `crypto.getRandomValues()` (*No IV Reuse*; menolak IV statis).
   - **Additional Authenticated Data (AAD)**: Mengikat konteks `PATIENT:{patientId}|RECORD:{recordId}|V:{version}` (atau `ATTACHMENT:{imgId}|PATIENT:{patientId}`) untuk mencegah pemindahan ciphertext lintas pasien (*record swapping*).
   - **Tag Autentikasi Bawaan**: 128-bit Galois/Counter Mode tag.

3. **HMAC-SHA256 *Constant-Time* (RFC 2104 / NIST SP 800-107 / Anti-CWE-208)**:
   - **Modul Implementasi**: `lib/crypto/hmac.ts` (`generateHMAC`, `verifyHMAC`).
   - **Tujuan Keamanan**: Integritas data (*Integrity*) dan otentisitas (*Authenticity*) atas *ciphertext* dengan konstruksi *Encrypt-then-MAC*.
   - **Verifikasi Waktu Konstan**: `verifyHMAC()` menggunakan `crypto.subtle.verify("HMAC", ...)` alih-alih operator `===` guna mencegah *timing side-channel attack* (**CWE-208**).
   - **Panjang Digest**: 256-bit (32 bytes / 64 karakter heksadesimal; menolak hash kosong SHA-256).

---

## 2. Struktur Data Masukan & Keluaran

### 2.1 Masukan Plaintext (Format Klinis SOAP JSON)
```json
{
  "subjective": "Pasien mengeluh pusing dan tengkuk berat sejak 3 hari lalu...",
  "vitalSigns": {
    "systolic": 145,
    "diastolic": 92,
    "heartRate": 82,
    "temperature": 36.6,
    "spo2": 98
  },
  "assessment": {
    "icd10": "I10",
    "desc": "Hipertensi Esensial (Primer)"
  },
  "plan": {
    "resep": [
      "Amlodipine 10mg tab No. XXX, S 1 dd 1 tab pagi",
      "Kandesartan 8mg tab No. XXX, S 1 dd 1 tab malam"
    ],
    "tindakan": "Kontrol tensi berkala dalam 2 minggu, diet rendah garam."
  },
  "meta": {
    "dokterStr": "31.1.1.100.2.22.123456",
    "faskesNama": "RSUP Dr. Sardjito",
    "timestamp": "2026-10-15T09:30:00.000Z"
  }
}
```

### 2.2 Kunci Kriptografi & Parameter
- **Kunci Simetris**: 256-bit Hex String unik per pasien (contoh: `a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90`).
- **IV / Nonce**: 96-bit (12 bytes) CSPRNG Hex String (contoh: `1a2b3c4d5e6f7a8b9c0d1e2f`).

### 2.3 Keluaran Terenkripsi (Encrypted Record Payload)
```typescript
interface EncryptedPayload {
  encryptedPayload: string; // Ciphertext hex string hasil AES-256-GCM
  ivHex: string;            // 24 karakter hex IV acak
  hmacDigest: string;       // 64 karakter hex digest HMAC-SHA256
}
```

---

## 3. Diagram Alir Komponen Kriptografi (Encrypt-then-MAC + HKDF + AAD)

```text
[Master Key 256-bit Pasien] ──▶ [HKDF-SHA256 (RFC 5869)] ──┬──▶ encKey (AES-256-GCM)
                                                           └──▶ macKey (HMAC-SHA256)

[Plaintext JSON SOAP] ───┐
[AAD: PATIENT|RECORD|V] ─┼──▶ [AES-256-GCM Encrypt] ──▶ [Ciphertext Hex]
[CSPRNG 96-bit IV] ──────┘           │                         │
                                     │                         ▼
                                     │       [macKey] ──▶ [HMAC-SHA256 Sign] ──▶ [hmacDigest (64-hex)]
                                     ▼                                                   │
                           [Paket Rekam Medis Aman] ◀────────────────────────────────────┘
                            { encryptedPayload, ivHex, hmacDigest }
```

### Prinsip Keamanan Fail-Closed Murni (`features/medical-records/crypto-service.ts`)
1. Sebelum dekripsi dilakukan oleh peramban klien (`decryptMedicalRecordPayload`), `verifyHMAC()` menjalankan verifikasi *constant-time* (`crypto.subtle.verify`) atas `ciphertext` menggunakan `macKey` hasil derivasi HKDF.
2. Jika ada perbedaan sekecil 1 bit (korupsi media, modifikasi DB, atau manipulasi AAD):
   - Operasi langsung dibatalkan (**0 data fiktif/fallback ditampilkan**).
   - UI memunculkan peringatan *Integrity Breach / Tamper Detected* dan mencatat peristiwa `HMAC_MISMATCH` ber-severity **`CRITICAL`** ke `security_audit_logs` (SIEM).
3. Saat sinkronisasi luring (`POST /api/sync/outbox`), server juga memvalidasi format hex ciphertext, IV 24-hex non-statis, dan HMAC 64-hex sebelum menulis ke PostgreSQL.

---

## 4. Kasus Uji Kriptografi Otomatis (Vitest — 15 Uji Kripto & Integrasi)

Pengujian otomatis dijalankan pada `tests/crypto.test.ts` (**8/8 lulus**) dan `tests/phase1-security-crypto.test.ts` (**7/7 lulus**) menggunakan runtime native Web Crypto API:

| ID Uji | Kasus Uji | Kategori | Ekspektasi | Hasil Verifikasi |
| :--- | :--- | :--- | :--- | :---: |
| **UJI-01** | Enkripsi & dekripsi AES-256-GCM dengan kunci sah | Positif | Plaintext hasil dekripsi identik 100% dengan masukan awal | **PASSED** |
| **UJI-02** | Validasi integritas HMAC-SHA256 *constant-time* data utuh | Positif | `verifyHMAC()` mengembalikan nilai `true` | **PASSED** |
| **UJI-03** | Deteksi pemalsuan data (manipulasi 1 bit ciphertext) | Negatif | `verifyHMAC()` mengembalikan nilai `false` (*Tamper Detected*) | **PASSED** |
| **UJI-04** | Dekripsi dengan IV korup / salah | Batas | Sistem menolak dekripsi secara aman (*Fail-Closed*) | **PASSED** |
| **UJI-05** | Pengikatan konteks AAD (*Record Swapping Defense*) | Negatif | Dekripsi dengan AAD pasien/versi berbeda wajib gagal | **PASSED** |
| **UJI-06** | Pemisahan sub-kunci HKDF-SHA256 (RFC 5869) | Positif | `encKeyHex !== macKeyHex` & deterministik per pasien | **PASSED** |
| **UJI-07** | Enkripsi/dekripsi citra biner AES-GCM + HKDF HMAC | Positif/Negatif | Biner Rontgen/USG utuh kembali & menolak tamper 1 byte | **PASSED** |
| **UJI-08** | Alur RME End-to-End *Fail-Closed* (`phase1-security-crypto.test.ts`) | Integrasi | Payload DB bukan Base64/Hex plaintext, IV selalu unik, tamper memicu blokir | **PASSED** |

---

## 5. Enkripsi Citra Medis Biner (IndexedDB Blob Engine + `/api/attachments`)

Untuk mendukung lampiran gambar klinis berukuran besar (Foto Rontgen, USG, hasil scan laboratorium, dan grafik EKG):
1. File gambar dikonversi menjadi biner `ArrayBuffer`/`Blob` di memori peramban.
2. Sub-kunci terpisah diturunkan via `deriveSubKeysHKDF` (`encKey` untuk AES-GCM dan `macKey` untuk HMAC — patuh NIST SP 800-57).
3. File biner dienkripsi menggunakan `encryptBinaryAttachment` (`AES-256-GCM` + 96-bit CSPRNG IV) dan ditandatangani HMAC-SHA256.
4. Saat *offline*, berkas terenkripsi disimpan pada store `offline_media_blobs` di **IndexedDB (`resilio_offline_db`)**; saat *online*, diunggah/diunduh melalui `GET/POST /api/attachments` dengan proteksi Anti-BOLA `403`.
