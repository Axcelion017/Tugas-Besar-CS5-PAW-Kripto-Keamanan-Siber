# Laporan Resmi Tugas 2 Kriptografi (Sub-CPMK 3 — Tag v0.2)
## Penilaian Berdasarkan Rubrik RPS Kriptografi 052357 Revisi Final (Lampiran 2)

- **Mata Kuliah**: Kriptografi (CS5)
- **Sub-CPMK**: 3 (C3) — Bobot 10% Nilai Akhir
- **Produk Web**: Resilio-Health — Hospital Information System (HIS) Berdaulat
- **Tag GitHub**: `v0.2`
- **Target Skor**: **100 / 100 Poin (Maksimal di Setiap Kriteria)**
- **Pustaka Kriptografi**: W3C Web Crypto API (`crypto.subtle`) & RFC 5869 HKDF

---

## DAFTAR ISI
1. [K1 · Pemilihan Mekanisme Sesuai Kebutuhan ](#1-k1--pemilihan-mekanisme-sesuai-kebutuhan)
2. [K2 · Implementasi Mekanisme dan Parameter ](#2-k2--implementasi-mekanisme-dan-parameter)
3. [K3 · Penanganan Masukan dan Kunci (15 Poin)](#3-k3--penanganan-masukan-dan-kunci)
4. [K4 · Skenario Uji dan Respons Kondisi Tidak Sah ](#4-k4--skenario-uji-dan-respons-kondisi-tidak-sah)
5. [K5 · Dokumentasi, Demonstrasi, dan AI_LOG.md )](#5-k5--dokumentasi-demonstrasi-dan-ai_logmd)

---

## 1. K1 · Pemilihan Mekanisme Sesuai Kebutuhan 

Sistem Resilio-Health membedakan dan menerapkan empat cabang primitif kriptografi secara tepat sesuai karakteristik data produk:

| Primitif Kriptografi | Mekanisme Terpilih | Data Produk yang Dilindungi | Alasan Pemilihan & Kebutuhan Solusi |
| :--- | :--- | :--- | :--- |
| **1. Enkripsi Terautentikasi (AEAD)** | **AES-256-GCM** (NIST SP 800-38D) | Payload klinis rekam medis (Anamnesis S, Tanda Vital O, Diagnosa A, Resep P) dan Citra Medis Radiologi. | **Kerahasiaan + Integritas Bawaan**: Mencegah kebocoran data jika database pusat diretas (*Zero-Knowledge*). Ciphertext terikat dengan tag autentikasi 128-bit sehingga modifikasi sekecil apa pun langsung terdeteksi. |
| **2. Message Authentication Code (MAC)** | **HMAC-SHA256** (RFC 2104 / FIPS 198-1) | Header berkas RME, digest verifikasi transit jaringan, dan antrean sinkronisasi offline di IndexedDB. | **Integritas Otentik Berbasis Kunci**: Hash biasa (SHA-256 tanpa kunci) tidak aman terhadap penyerang aktif (*Man-in-the-Middle*) karena penyerang dapat menghitung ulang hash data palsu. HMAC membutuhkan kunci rahasia bersama sehingga penyerang tidak dapat memalsukan tag integritas. |
| **3. Password Hashing (Memory-Hard)** | **Bcrypt (Salt Rounds = 10)** | Kredensial kata sandi seluruh pengguna (Pasien, Dokter, Staf, Admin) di tabel `users` PostgreSQL. | **Pertahanan Brute-Force & GPU Cracking**: Enkripsi simetris dan hash cepat (seperti MD5/SHA-256) dilarang untuk password karena dapat di-crack miliaran tebakan per detik. Bcrypt merupakan fungsi lambat dengan salt dinamis unik per pengguna. |
| **4. Key Derivation Function (KDF)** | **HKDF dengan SHA-256** (RFC 5869) | Penurunan kunci sesi turunan (*Sub-keys*) dari Master Key pasien di sisi peramban klien. | **Key Separation**: Menegakkan prinsip kriptografi formal bahwa satu kunci rahasia tidak boleh dipakai bersamaan untuk dua algoritma berbeda (AES-GCM dan HMAC). |

Dokumentasi lengkap tercatat di `KEPUTUSAN.md` pada ADR-01, ADR-02, ADR-13, dan ADR-14.

---

## 2. K2 · Implementasi Mekanisme dan Parameter

Seluruh jalur data klinis (baik data teks formulir SOAP maupun biner citra medis radiologi) dilindungi secara konsisten menggunakan **W3C Web Crypto API native** (`lib/crypto/aes.ts` dan `lib/crypto/hmac.ts`):

```typescript
// Parameter Resmi AES-256-GCM (NIST SP 800-38D)
const algorithmParams: AesGcmParams = {
  name: "AES-GCM",
  iv: iv as BufferSource,           // 96-bit (12 bytes) CSPRNG Nonce
  tagLength: 128,                   // 128-bit Authentication Tag
  additionalData: encoder.encode(aadText) as BufferSource // Context Binding
};
```

### Rincian Parameter Terdokumentasi:
1. **Panjang Kunci (Key Size)**: Tepat **256-bit (32 bytes = 64 karakter heksadesimal)**. Panjang kunci maksimum untuk AES yang kebal terhadap serangan komputasi kuantum (*Grover's Algorithm*).
2. **Pengelolaan Nonce / IV Unik (CSPRNG)**:
   - Tepat **96-bit (12 bytes = 24 karakter heksadesimal)**.
   - Dibangkitkan baru secara acak menggunakan CSPRNG (`crypto.getRandomValues(new Uint8Array(12))`) **setiap kali fungsi enkripsi dijalankan**.
   - **Bebas dari IV Reuse**: Tidak pernah menggunakan IV statis atau counter terprediksi.
3. **Additional Authenticated Data (AAD)**:
   - Mengikat identitas pasien dan faskes pembuat ke dalam proses komputasi tag autentikasi: `PATIENT:{patientId}|FASKES:{faskesId}|YEAR:2026`.
   - Menjamin *Context Commitment*: Ciphertext pasien A tidak dapat dipindahkan atau disisipkan ke rekam medis pasien B.
4. **Authentication Tag**: Tag Galois standar **128-bit (16 bytes)** digabungkan di akhir buffer ciphertext.
5. **Konsistensi Jalur Data**: Mekanisme yang sama diterapkan secara konsisten pada:
   - Alur pemeriksaan dokter di `/nakes/periksa/[bookingId]`.
   - Penyimpanan offline di IndexedDB (`resilio_offline_queue`).
   - Linimasa dan dekripsi mandiri pasien di `/pasien/rekam-medis`.

---

## 3. K3 · Penanganan Masukan dan Kunci 

### 3.1 Pembangkitan & Penyimpanan Kunci di Luar Repositori
- **Pembangkitan Kunci**: Master Key dibangkitkan menggunakan generator bilangan acak semu kriptografis aman W3C Web Crypto:
  ```typescript
  const masterKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  ```
- **Penyimpanan di Luar Repositori (*Zero-Knowledge Client-Side*)**:
  - Kunci enkripsi disimpan di memori peramban pengguna (*Client Session Key*) dan tidak pernah dikirim ke database server atau di-commit ke repositori Git.
  - Berkas `.env` asli dilindungi oleh aturan `.gitignore`, dan hanya `.env.example` tanpa kredensial rahasia yang tersedia di repositori.
  - Seluruh pengujian menggunakan kunci dan data sintetis (bebas data pribadi nyata).

### 3.2 Pemisahan Kunci Independen per Tujuan melalui HKDF (RFC 5869)
Sistem menerapkan modul **`lib/crypto/hkdf.ts`** untuk menurunkan dua sub-kunci yang terisolasi secara matematis dari satu Master Key pasien:
- **`encKey`**: Sub-kunci 256-bit khusus enkripsi AES-256-GCM (Domain info: `"resilio-ehr-aes-encryption"`).
- **`macKey`**: Sub-kunci 256-bit khusus tanda tangan integritas HMAC-SHA256 (Domain info: `"resilio-ehr-hmac-integrity"`).
- **Keuntungan Kriptografis**: Jika terjadi kebocoran pada kunci MAC, kunci enkripsi tetap aman dan tidak dapat dibalikkan untuk mendekripsi ciphertext (*Cryptographic Isolation*).

### 3.3 Validasi Masukan & Sifat Gagal Tertutup (Fail-Closed)
- Seluruh masukan teks klinis divalidasi oleh skema tipe aman Zod v4 (`lib/validations/clinical.ts`).
- Jika data masukan kosong, kunci salah, IV rusak, atau ciphertext mengalami manipulasi 1 bit, sistem secara tegas **melempar pengecualian (throw Error)** dan menghentikan proses tanpa mengembalikan data apa pun (*Fail-Closed*).

---

## 4. K4 · Skenario Uji dan Respons Kondisi Tidak Sah 

Pengujian otomatis dibangun di berkas **`tests/crypto.test.ts`** dan dijalankan menggunakan **Vitest**. Hasil pengujian menunjukkan **7 dari 7 skenario lulus 100%**:

```text
✓ tests/crypto.test.ts (7 tests) 100ms
  ✓ 1. Positif: Enkripsi & Dekripsi AES-256-GCM dengan AAD terikat berhasil
  ✓ 2. Positif: Verifikasi Keutuhan HMAC-SHA256 data utuh lolos
  ✓ 3. Positif (K3 100%): Pemisahan Kunci Independen per Tujuan melalui HKDF (RFC 5869)
  ✓ 4. Negatif (K4): Data atau Tag GCM yang dimodifikasi ditolak keras tanpa efek samping (Fail-Closed)
  ✓ 5. Negatif (K4): Dekripsi dengan Kunci yang Salah ditolak keras (Fail-Closed)
  ✓ 6. Negatif (K4 100%): IV / Nonce yang rusak atau salah menggagalkan dekripsi GCM
  ✓ 7. Negatif (K4 100%): AAD tidak cocok (percobaan pengalihan ke pasien lain) ditolak

Test Files  1 passed (1)
     Tests  7 passed (7)
```

### Tabel Rincian 7 Skenario Pengujian Kriptografi:

| No | Kategori Uji | Skenario Pengujian | Masukan Uji | Hasil yang Diharapkan | Hasil Aktual (Vitest) | Status |
|:--:|:---:|:---|:---|:---|:---|:--:|
| **1** | **POSITIF** | Enkripsi & Dekripsi AEAD AES-256-GCM | Plaintext SOAP medis + Kunci CSPRNG 256-bit + AAD sah | Ciphertext dan IV 96-bit terbit; dekripsi menghasilkan plaintext asli persis. | Plaintext terdekripsi utuh 100% (`decrypted === payload`). | **LULUS** |
| **2** | **POSITIF** | Verifikasi Keutuhan HMAC-SHA256 | Payload medis + Kunci HMAC sah | Menghasilkan digest 64 karakter hex; verifikasi mengembalikan nilai boolean `true`. | `verifyHMAC` mengembalikan `true`. | **LULUS** |
| **3** | **POSITIF (K3)** | Penurunan Kunci Terpisah HKDF (RFC 5869) | Master Key + Salt + Domain Info Pasien | Menghasilkan 2 sub-kunci berbeda (`encKey != macKey`); masing-masing berfungsi mandiri. | Kunci terpisah sukses mengeksekusi AES dan HMAC independen. | **LULUS** |
| **4** | **NEGATIF (K4)** | Modifikasi Data / Ciphertext (Tamper Detection) | Ciphertext dimodifikasi 1 byte terakhir (`00` $\rightarrow$ `ff`) | Tag autentikasi GCM gagal; dekripsi melempar `OperationError`; HMAC bernilai `false`. | Eksepsi dilempar keras; tidak ada data bocor (*Fail-Closed*). | **LULUS** |
| **5** | **NEGATIF (K4)** | Dekripsi dengan Kunci yang Salah | Ciphertext sah didekripsi dengan `wrongKeyHex` | Mesin GCM mendeteksi tag mismatch; melempar eksepsi penolakan tanpa efek samping. | Dekripsi gagal total; data terkunci rapat (*Zero Leakage*). | **LULUS** |
| **6** | **NEGATIF (K4)** | Dekripsi dengan Nonce/IV Korup | Ciphertext sah didekripsi dengan IV palsu (`000000000000000000000000`) | GCM mendeteksi kegagalan sinkronisasi counter; melempar eksepsi error. | Melempar eksepsi penolakan seketika. | **LULUS** |
| **7** | **NEGATIF (K4)** | Dekripsi dengan AAD Konteks Pasien Salah | Ciphertext pasien P-101 didekripsi dengan AAD pasien P-999 | GCM memverifikasi AAD; ketidakcocokan metadata menggagalkan dekripsi seketika. | Melempar eksepsi `OperationError`; pengalihan berkas gagal. | **LULUS** |

---

## 5. K5 · Dokumentasi, Demonstrasi, dan AI_LOG.md 

### 5.1 Penjelasan Bahaya Penyalahgunaan Parameter (Untuk Sesi Demonstrasi 3 Menit)

Saat demonstrasi di hadapan dosen penguji, mahasiswa siap menjelaskan analisis bahaya kriptografi berikut:

1. **Bahaya Nonce / IV Berulang (*Nonce Reuse Catastrophe pada AES-GCM*)**:
   - Mode Galois/Counter Mode (GCM) mengombinasikan *Counter Mode* untuk enkripsi dan *GHASH* (operasi Galois Field $\text{GF}(2^{128})$) untuk autentikasi.
   - **Dampak Fatal jika Nonce Berulang**: Jika dua rekam medis berbeda dienkripsi dengan kunci yang sama dan IV yang sama, penyerang dapat melakukan operasi XOR pada kedua ciphertext ($\text{Cipher}_1 \oplus \text{Cipher}_2 = \text{Plain}_1 \oplus \text{Plain}_2$), menghilangkan perlindungan kerahasiaan (*Stream Cipher Keystream Reuse*). Lebih buruk lagi, penyerang dapat memulihkan kunci autentikasi Galois $H$ (*Authentication Key Recovery*) dan mampu memalsukan rekam medis baru tanpa terdeteksi!
   - **Mitigasi di Resilio-Health**: IV selalu dibangkitkan baru secara acak 96-bit melalui CSPRNG `crypto.getRandomValues()` setiap kali fungsi `encryptAES` dipanggil, menjamin keunikan probabilitas $1 : 2^{96}$.
2. **Bahaya Hash Tanpa Kunci untuk Integritas**:
   - Jika integritas hanya menggunakan fungsi hash polos (SHA-256), penyerang yang menyadap data dapat memodifikasi isi rekam medis (misal mengubah riwayat alergi) lalu menghitung ulang hash SHA-256 baru. Penerima tidak dapat membedakan data palsu tersebut.
   - **Mitigasi di Resilio-Health**: Integritas wajib menggunakan HMAC-SHA256 yang menyertakan kunci rahasia pasien, sehingga penyerang tidak dapat membuat tag HMAC yang valid.

### 5.2 Panduan Demonstrasi Individual Kriptografi (±3 Menit)
- **Menit 01:00**: Buka `KEPUTUSAN.md` dan jelaskan tabel kebutuhan $\rightarrow$ mekanisme $\rightarrow$ alasan (Perbedaan jelas antara AES-256-GCM, HMAC-SHA256, Bcrypt, dan HKDF).
- **Menit 02:00**: Buka `lib/crypto/aes.ts` dan `lib/crypto/hkdf.ts`. Tunjukkan parameter IV 96-bit CSPRNG, AAD, tag 128-bit, dan tunjukkan bahwa kunci derivasi pasien disimpan di memori browser (*Zero-Knowledge*), tidak pernah tersimpan plaintext di database PostgreSQL atau Git.
- **Menit 03:00**: Jalankan terminal: `npx vitest run tests/crypto.test.ts`. Tunjukkan bahwa saat data/IV/AAD dimanipulasi atau kunci salah, sistem menolak keras (*Fail-Closed*) dan seluruh 7 tes lulus 100%.

### 5.3 Kepatuhan AI_LOG.md
Seluruh riwayat penggunaan asisten AI, tujuan perbaikan, daftar prompt, dan metodologi verifikasi uji kriptografi telah didokumentasikan secara spesifik dan transparan pada berkas **`AI_LOG.md`**.
