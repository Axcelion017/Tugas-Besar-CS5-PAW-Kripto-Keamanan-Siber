# Spesifikasi Komponen Kriptografi — Resilio-Health

Dokumen ini mendefinisikan spesifikasi teknis komponen kriptografi pada sistem Resilio-Health untuk memenuhi standar mata kuliah Kriptografi dan regulasi perlindungan data medis nasional (Permenkes No. 24/2022).

---

## 1. Algoritma Terpilih & Standar Acuan

1. **AES-256-GCM (Authenticated Encryption with Associated Data / AEAD)**:
   - **Standar**: NIST SP 800-38D.
   - **Tujuan Keamanan**: Kerahasiaan (*Confidentiality*) rekam medis klinis (EHR).
   - **Panjang Kunci Simetris**: 256-bit (32 bytes / 64 karakter heksadesimal).
   - **Initialization Vector (IV)**: 96-bit (12 bytes / 24 karakter heksadesimal) acak unik per enkripsi, dibangkitkan via CSPRNG `window.crypto.getRandomValues()`.
   - **Tag Autentikasi Bawaan**: 128-bit tag integritas Galois/Counter Mode.
   - **Pencegahan Kelemahan**: Tidak ada penggunaan ulang IV (*No IV Reuse*); pembangkitan nonce baru untuk setiap berkas rekam medis.

2. **HMAC-SHA256 (Keyed-Hash Message Authentication Code)**:
   - **Standar**: RFC 2104 / FIPS PUB 198-1.
   - **Fungsi Hash Dasar**: SHA-256 (FIPS PUB 180-4).
   - **Tujuan Keamanan**: Integritas data (*Integrity*) dan otentisitas asal data (*Authenticity*) atas string *ciphertext*.
   - **Panjang Digest**: 256-bit (32 bytes / 64 karakter heksadesimal).
   - **Penggunaan Khusus**: Verifikasi integritas data sebelum proses dekripsi di peramban serta validasi antrean data saat sinkronisasi offline ke server.

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

## 3. Diagram Alir Komponen Kriptografi

```text
[Plaintext JSON SOAP] ───┐
                         ▼
[CSPRNG 96-bit IV] ──▶ [AES-256-GCM Encrypt] ──▶ [Ciphertext Hex String]
                                                       │
                                  ┌────────────────────┘
                                  ▼
[Kunci 256-bit] ───────▶ [HMAC-SHA256 Sign] ───▶ [HMAC Digest Hex String]
                                                       │
                                  ┌────────────────────┘
                                  ▼
                 [Paket Rekam Medis Aman Tersimpan]
                  { ciphertext, iv, hmacDigest }
```

### Prinsip Keamanan Fail-Closed
1. Sebelum dekripsi dilakukan oleh peramban klien, digest HMAC-SHA256 dihitung ulang atas ciphertext dan dibandingkan dengan `hmacDigest` yang tersimpan.
2. Jika ada perbedaan sekecil 1 bit (misal akibat korupsi media penyimpanan atau modifikasi bit oleh malware):
   - Status integritas dinyatakan **GAGAL**.
   - Sistem menolak mendekripsi data (*Fail-Closed*).
   - Menampilkan peringatan keamanan ke pengguna dan mencatat alert ke SIEM.
3. Jika IV korup atau kunci salah, fungsi `crypto.subtle.decrypt` secara otomatis menolak operasi (*throw error*).

---

## 4. Kasus Uji Kriptografi Otomatis (Vitest)

Pengujian unit otomatis diimplementasikan pada `tests/crypto.test.ts` menggunakan runtime native Web Crypto API:

| ID Uji | Kasus Uji | Kategori | Ekspektasi | Hasil Verifikasi |
| :--- | :--- | :--- | :--- | :---: |
| **UJI-01** | Enkripsi & dekripsi AES-256-GCM dengan kunci sah | Positif | Plaintext hasil dekripsi identik 100% dengan masukan awal | **PASSED** |
| **UJI-02** | Validasi integritas HMAC-SHA256 data utuh | Positif | `verifyHMAC()` mengembalikan nilai `true` | **PASSED** |
| **UJI-03** | Deteksi pemalsuan data (manipulasi 1 bit ciphertext) | Negatif | `verifyHMAC()` mengembalikan nilai `false` (Tamper Detected) | **PASSED** |
| **UJI-04** | Dekripsi dengan IV korup / salah | Batas (Boundary) | Sistem menolak dekripsi secara aman (*throws error Fail-Closed*) | **PASSED** |

---

## 5. Enkripsi Citra Medis Biner (IndexedDB Blob Engine)

Untuk mendukung lampiran gambar klinis berukuran besar (Foto Rontgen, USG, hasil scan laboratorium, dan grafik EKG) tanpa terbentur batas 5 MB `localStorage`:
1. File gambar dikonversi menjadi biner `ArrayBuffer` atau `Blob` di memori peramban.
2. File biner dienkripsi menggunakan `crypto.subtle.encrypt("AES-GCM", key, binaryBuffer)` menghasilkan `encryptedBlobHex`.
3. Keaslian citra dilindungi dengan `crypto.subtle.sign("HMAC", key, encryptedBlob)`.
4. Berkas terenkripsi disimpan pada media penyimpanan lokal **IndexedDB** berkapasitas besar (mendukung ratusan MB hingga GB) sebagai kesiapan *Offline-First*, dan diunggah ke server saat koneksi internet pulih.
5. Jika ada manipulasi pada citra (misal penghapusan bayangan tumor atau penggantian file citra oleh malware), nilai HMAC akan rusak dan peramban menolak menampilkan citra medis.
