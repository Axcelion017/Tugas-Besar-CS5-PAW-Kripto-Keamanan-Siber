# EVALUASI.md — Hasil Evaluasi & Pengujian Kriptografi

Dokumen evaluasi pengujian komponen kriptografi Resilio-Health menggunakan Vitest runner (Milestone `v0.1`).

## 1. Matriks Skenario Uji Otomatis

Pengujian dijalankan pada berkas `tests/crypto.test.ts` dengan data sintetis:

| ID Uji | Kategori | Skenario Uji | Masukan | Ekspektasi | Hasil Riil | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **UJI-01** | Positif | Enkripsi dan Dekripsi AES-256-GCM | Plaintext diagnosa medis sintetis + Kunci 256-bit Hex valid | Plaintext hasil dekripsi identik 100% dengan masukan awal | Plaintext cocok secara byte-by-byte | **LULUS (PASS)** |
| **UJI-02** | Positif | Integritas HMAC-SHA256 Data Asli | Payload klinis + Kunci rahasia | `verifyHMAC()` mengembalikan `true` | Validasi sukses bernilai boolean `true` | **LULUS (PASS)** |
| **UJI-03** | Negatif | Deteksi Manipulasi Data (Tampering) | Payload klinis sengaja dimodifikasi + digest lama | `verifyHMAC()` mengembalikan `false` | Modifikasi terdeteksi, digest tidak cocok | **LULUS (PASS)** |
| **UJI-04** | Batas | Dekripsi GCM dengan IV Rusak / Korup | Ciphertext valid + IV "000000000000000000000000" | Operasi melempar error (`rejects.toThrow()`) | Web Crypto API melempar `OperationError` (Fail-closed) | **LULUS (PASS)** |

## 2. Temuan dan Perbaikan (Bug & Security Fixes)

- **Temuan 1**: Format kunci sembarang string menyebabkan galat saat parsing byte AES.
  - *Perbaikan*: Kunci distandarisasi menjadi representasi heksadesimal 256-bit (64 karakter) dan divalidasi sebelum diimpor ke Web Crypto SubtleCrypto.
- **Temuan 2**: Vitest v5 membutuhkan import eksplisit `describe`, `test`, dan `expect`.
  - *Perbaikan*: Berkas `tests/crypto.test.ts` diperbarui dengan import eksplisit dari modul `"vitest"`.

## 3. Kesimpulan Evaluasi v0.1

Seluruh 4 skenario uji (2 positif, 1 negatif, 1 batas) berhasil lulus 100% (`4 passed, 0 failed`). Komponen dasar kriptografi siap digunakan sebagai fondasi proteksi rekam medis pada Milestone 2 (`v0.2`).