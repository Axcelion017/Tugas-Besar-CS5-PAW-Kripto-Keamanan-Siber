# Laporan Pengerjaan Tugas 2 Kriptografi (v0.2)
## Enkripsi Terautentikasi (AEAD) dan Integritas Data Medis

- **Mata Kuliah**: Kriptografi (CS5)
- **Sub-CPMK**: 3 — Bobot 10% Nilai Akhir
- **Produk Web**: Resilio-Health — Hospital Information System (HIS) Berdaulat
- **Tag GitHub**: `v0.2`
- **Pustaka Kriptografi**: W3C Web Crypto API (Native Standard W3C / FIPS Pub 197)
- **Tenggat**: Pekan 6 (Minggu, 08 November 2026, 23.59 WIB)

---

## 1. Pemilihan Mekanisme Kriptografi (K1: 20 Poin)
*Dokumentasi keterlacakan Kebutuhan $\rightarrow$ Mekanisme $\rightarrow$ Alasan (KEPUTUSAN.md)*

```text
┌──────────────────────────┬──────────────────────────┬──────────────────────────────────────────┐
│ Kebutuhan Produk         │ Mekanisme Kriptografi    │ Alasan Pemilihan & Kepatuhan Standar     │
├──────────────────────────┼──────────────────────────┼──────────────────────────────────────────┤
│ Kerahasiaan Data Medis   │ AES-256-GCM              │ NIST SP 800-38D: Enkripsi AEAD terpadu.  │
│ Pasien (SOAP & Diagnosa) │ (Galois/Counter Mode)    │ Server & admin hanya menyimpan opaque    │
│ dari trauma kebocoran DB │                          │ ciphertext (Zero-Knowledge Storage).     │
├──────────────────────────┼──────────────────────────┼──────────────────────────────────────────┤
│ Keutuhan & Anti-Tamper   │ HMAC-SHA256              │ RFC 2104 & FIPS 198-1: Menjamin tidak ada│
│ Rekam Medis (Transit &   │ (Hash-based MAC)         │ perubahan 1 bit pun pada riwayat alergi, │
│ Offline IndexedDB)       │                          │ tensi, & dosis obat (Fail-Closed).       │
├──────────────────────────┼──────────────────────────┼──────────────────────────────────────────┤
│ Context Binding          │ Additional Authenticated │ Mengikat ID Pasien (patientId) dan tahun │
│ Pasien Terhadap Cipher   │ Data (AAD) pada GCM      │ ke ciphertext agar data tidak bisa       │
│                          │                          │ dipindahkan ke rekam medis pasien lain.  │
├──────────────────────────┼──────────────────────────┼──────────────────────────────────────────┤
│ Keamanan Kata Sandi      │ Bcrypt (Salt Rounds 10)  │ Slow hashing memory-hard function        │
│ Pengguna di PostgreSQL   │                          │ mencegah serangan Rainbow Table & Brute. │
└──────────────────────────┴──────────────────────────┴──────────────────────────────────────────┘
```

---

## 2. Parameter Kriptografi & Penanganan Kunci (K2 & K3: 45 Poin)

### 2.1 Spesifikasi Parameter Kriptografi Terstandarisasi
Seluruh parameter kriptografi pada modul `lib/crypto/aes.ts` dan `lib/crypto/hmac.ts` terdokumentasi secara ketat:

1. **Panjang Kunci Simetris (Key Length)**:
   - Panjang: **256-bit (32 bytes)**, direpresentasikan dalam heksadesimal 64 karakter.
   - Pembangkitan: Wajib dibangkitkan secara aman menggunakan CSPRNG (`crypto.getRandomValues(new Uint8Array(32))`).
2. **Initialization Vector / Nonce (IV Unik CSPRNG)**:
   - Panjang: **96-bit (12 bytes = 24 karakter hex)** sesuai anjuran NIST SP 800-38D untuk mode GCM.
   - Keunikan: Dibangkitkan baru secara acak menggunakan CSPRNG (`crypto.getRandomValues(new Uint8Array(12))`) untuk setiap rekam medis. Mencegah kerentanan fatal *Nonce Reuse Catastrophe* pada Galois Counter Mode.
3. **Data Terautentikasi Tambahan (AAD - Additional Authenticated Data)**:
   - Mengikat konteks metadata identitas pasien: `PATIENT:{patientId}|FASKES:{faskesId}|YEAR:2026`.
   - AAD diverifikasi keutuhannya bersama tag autentikasi; jika penyerang mencoba memindahkan ciphertext ke pasien lain, proses dekripsi seketika gagal.
4. **Authentication Tag (Tag Panjang)**:
   - Menggunakan tag autentikasi standar **128-bit (16 bytes)** yang digabungkan di akhir ciphertext buffer.
5. **Pustaka Kriptografi yang Terpelihara**:
   - Menggunakan pustaka native **W3C Web Crypto API (`crypto.subtle`)**. Pustaka ini terpelihara langsung oleh engine browser/V8, kebal dari kerentanan dependensi pihak ketiga, serta bebas dari celah *timing attacks*.

### 2.2 Kebijakan Penanganan Kunci di Luar Repositori (Zero-Knowledge)
- **Tempat Penyimpanan Kunci**: Kunci simetris pasien (`encryptionKeyHex`) diturunkan di memori klien peramban dan disimpan pada penyimpanan terenkripsi sisi klien (*Session Key*).
- **Kerahasiaan Repositori**: Tidak ada kunci privat, token akses, password, atau master key yang di-hardcode ke dalam repositori git. Seluruh data pengujian menggunakan data sintetis murni.
- **Sifat Gagal Tertutup (Fail-Closed)**:
  - Jika kunci salah, IV salah, tag autentikasi rusak, atau masukan kosong, modul `decryptAES` dan `verifyHMAC` secara tegas **melempar pengecualian (throw Error)** dan menolak menampilkan data teks biasa (*Fail-Closed*).

---

## 3. Hasil Pengujian Kondisi Tidak Sah (K4: 25 Poin)

Pengujian otomatis telah dibuat di berkas `tests/crypto.test.ts` dan dijalankan menggunakan **Vitest** dengan hasil **5 dari 5 skenario lulus 100%** (melebihi batas minimal 4 skenario uji):

```text
✓ tests/crypto.test.ts (5 tests) 14ms
  ✓ 1. Positif: Enkripsi & Dekripsi AES-256-GCM dengan AAD terikat berhasil
  ✓ 2. Positif: Verifikasi Keutuhan HMAC-SHA256 data utuh lolos
  ✓ 3. Negatif: Manipulasi data (Ciphertext Tampered) ditolak keras oleh AEAD & HMAC
  ✓ 4. Negatif: Dekripsi dengan Kunci yang Salah ditolak (Fail-Closed)
  ✓ 5. Negatif: Dekripsi dengan AAD yang Tidak Cocok ditolak (Context Mismatch)

Test Files  1 passed (1)
     Tests  5 passed (5)
```

### Rincian 5 Skenario Pengujian:
1. **Skenario 1 (Positif - AEAD Valid)**: Payload teks medis berhasil dienkripsi dan didekripsi sempurna menggunakan AES-256-GCM dengan parameter IV 96-bit dan AAD terikat.
2. **Skenario 2 (Positif - HMAC Valid)**: Tag HMAC-SHA256 64-karakter hex cocok 100% pada data medis yang tidak mengalami perubahan.
3. **Skenario 3 (Negatif - Data/Ciphertext Dimodifikasi)**: Ciphertext yang diubah 1 byte bitwise ditolak keras oleh tag autentikasi GCM dengan melempar exception `OperationError`, dan HMAC mendeteksi manipulasi (`isMatch = false`).
4. **Skenario 4 (Negatif - Kunci Salah)**: Dekripsi menggunakan kunci 256-bit lain ditolak keras (*Fail-Closed*), tidak ada data medis yang bocor.
5. **Skenario 5 (Negatif - AAD Mismatch)**: Dekripsi dengan metadata AAD yang diubah (misal mencoba mengalihkan rekam medis ke pasien lain) seketika digagalkan oleh mesin GCM.

---

## 4. Panduan Demonstrasi Individual Kriptografi (±3 Menit)

Saat demonstrasi pekan 6 di hadapan dosen penguji, ikuti urutan berikut:

1. **Menit 01:00 — Penjelasan Kebutuhan & Mekanisme (KEPUTUSAN.md)**:
   - Jelaskan bahwa aplikasi menyelesaikan masalah kebocoran data medis nasional: database PostgreSQL di-host di server pusat, namun data SOAP klinis dienkripsi menggunakan AES-256-GCM + HMAC-SHA256 di browser (*Zero-Knowledge*).
2. **Menit 02:00 — Menunjukkan Kode Parameter & Tempat Kunci Disimpan**:
   - Buka `lib/crypto/aes.ts`: Tunjukkan penggunaan CSPRNG `crypto.getRandomValues(new Uint8Array(12))` untuk IV unik 96-bit dan `tagLength: 128`.
   - Tunjukkan tempat kunci disimpan: Buka DevTools peramban $\rightarrow$ tunjukkan bahwa kunci derivasi pasien dipegang oleh peramban klien dan **tidak pernah disimpan dalam bentuk plaintext di database server maupun di repositori git**.
   - Tunjukkan tabel `medical_records` di PostgreSQL / Prisma Studio: Buktikan kolom `encrypted_payload` dan `iv_hex` murni berupa karakter acak yang tidak bisa dibaca oleh admin database.
3. **Menit 03:00 — Peragaan Eksekusi Uji Gagal Tertutup (Fail-Closed)**:
   - Jalankan terminal: `npx vitest run tests/crypto.test.ts`.
   - Tunjukkan bahwa saat data dimanipulasi 1 bit atau kunci didekripsi dengan kunci yang salah, sistem secara otomatis menolak (*Fail-Closed*) dan seluruh 5 uji lulus 100%.

---

## 5. Catatan Pemanfaatan AI (K5: 10 Poin)
Seluruh riwayat prompt, perintah verifikasi, dan sinkronisasi modul kriptografi telah tercatat lengkap di berkas **`AI_LOG.md`**.
