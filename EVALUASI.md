# EVALUASI.md — Hasil Evaluasi, Pengujian & Kelaikan Sistem

Dokumen evaluasi pengujian komprehensif komponen kriptografi, antarmuka responsif Next.js, dan postur keamanan *Zero-Trust* Resilio-Health (Milestone `v0.1` dan `v0.2`).

---

## 1. Matriks Skenario Uji Otomatis Kriptografi (Vitest)

Pengujian dijalankan pada berkas `tests/crypto.test.ts` menggunakan runtime Vitest:

| ID Uji | Kategori | Skenario Uji | Masukan | Ekspektasi | Hasil Riil | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **UJI-01** | Positif | Enkripsi dan Dekripsi AES-256-GCM | Plaintext diagnosa medis sintetis + Kunci 256-bit Hex valid | Plaintext hasil dekripsi identik 100% dengan masukan awal | Plaintext cocok secara byte-by-byte | **LULUS (PASS)** |
| **UJI-02** | Positif | Integritas HMAC-SHA256 Data Asli | Payload klinis + Kunci rahasia | `verifyHMAC()` mengembalikan `true` | Validasi sukses bernilai boolean `true` | **LULUS (PASS)** |
| **UJI-03** | Negatif | Deteksi Manipulasi Data (Tampering) | Payload klinis sengaja dimodifikasi + digest lama | `verifyHMAC()` mengembalikan `false` | Modifikasi terdeteksi, digest tidak cocok | **LULUS (PASS)** |
| **UJI-04** | Batas | Dekripsi GCM dengan IV Rusak / Korup | Ciphertext valid + IV "000000000000000000000000" | Operasi melempar error (`rejects.toThrow()`) | Web Crypto API melempar `OperationError` (Fail-closed) | **LULUS (PASS)** |

---

## 2. Matriks Pengujian Validasi Formulir Tipe Aman (Zod v4 Vitest)

Pengujian dijalankan pada berkas `tests/validations.test.ts` memvalidasi skema data klinis, autentikasi, triase, dan pasien:

| ID Uji | Kategori | Skenario Uji | Masukan | Ekspektasi | Hasil Riil | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **VAL-01** | Positif | Pengkajian SOAP & Tanda Vital Valid | Data klinis lengkap dalam rentang fisiologis & kotak centang `true` | `PemeriksaanKlinisSchema.safeParse().success === true` | Lolos validasi skema | **LULUS (PASS)** |
| **VAL-02** | Negatif | Keluhan Utama (Subjective) Terlalu Pendek | Teks keluhan `< 10` karakter ("Pusing") | Validasi gagal, pesan batas minimal 10 karakter | Gagal, mengembalikan pesan galat spesifik | **LULUS (PASS)** |
| **VAL-03** | Negatif | Tekanan Darah di Luar Rentang Fisiologis | Sistolik 65 mmHg (di bawah ambang minimal 70) | Validasi gagal, pesan batas rentang 70–250 mmHg | Gagal, mengembalikan pesan galat spesifik | **LULUS (PASS)** |
| **VAL-04** | Negatif | Kode Diagnosis ICD-10 di Luar Enum | `icd10: "INVALID_CODE"` | Validasi gagal, pesan wajib memilih enum sah | Gagal, ditolak oleh Zod Enum | **LULUS (PASS)** |
| **VAL-05** | Batas | Kotak Centang Keabsahan Medikolegal Kosong | `isMedicallyConfirmed: false` | Validasi gagal (Fail-Closed sebelum enkripsi) | Gagal, dokter diwajibkan mencentang konfirmasi | **LULUS (PASS)** |
| **VAL-06** | Positif | Autentikasi Pengguna & Sesi | Kredensial valid NIK/username & password $\ge 6$ karakter | `LoginSchema.safeParse().success === true` | Lolos validasi | **LULUS (PASS)** |
| **VAL-07** | Negatif | Kata Sandi Kurang dari 6 Karakter | `password: "123"` | Validasi gagal, pesan batas minimal 6 karakter | Gagal, kredensial ditolak | **LULUS (PASS)** |
| **VAL-08** | Positif | Pendaftaran Pasien e-KYC Valid | NIK tepat 16 digit angka kependudukan & berkas lengkap | `RegisterPasienSchema.safeParse().success === true` | Lolos validasi | **LULUS (PASS)** |
| **VAL-09** | Negatif | NIK Pasien Kurang dari 16 Digit | NIK 10 digit angka | Validasi gagal, pesan tepat 16 digit angka | Gagal, ditolak regex NIK | **LULUS (PASS)** |
| **VAL-10** | Negatif | Berkas KTP Belum Diunggah | `ktpUploaded: false` | Validasi gagal e-KYC | Gagal, berkas wajib diunggah | **LULUS (PASS)** |
| **VAL-11** | Positif | Pendaftaran Nakes Kredensial Lengkap | NIK 16 digit, STR & SIP valid, berkas terunggah | `RegisterNakesSchema.safeParse().success === true` | Lolos validasi | **LULUS (PASS)** |
| **VAL-12** | Positif | Skema Triase Keperawatan Lengkap | Tanda vital lengkap + triase level `HIJAU` | `TriaseSchema.safeParse().success === true` | Lolos validasi | **LULUS (PASS)** |
| **VAL-13** | Negatif | NIK Walk-in Loket Mengandung Huruf | `nik: "317101ABCD900001"` | Validasi regex NIK gagal | Gagal, karakter non-digit ditolak | **LULUS (PASS)** |
| **VAL-14** | Positif | Penugasan DPJP dengan PIN 6-Digit | `aptId`, `doctorId`, dan PIN 6-digit | `AssignDpjpSchema.safeParse().success === true` | Lolos validasi | **LULUS (PASS)** |
| **VAL-15** | Positif | Pemesanan Jadwal (Booking) & Tiket Kendala | Faskes, dokter, tanggal, jam, keluhan awal | `BookingSchema` & `TroubleTicketSchema` valid | Lolos validasi | **LULUS (PASS)** |

---

## 3. Matriks Pengujian Fungsional & Keamanan Sistem (Milestone v0.2)

| Area Pengujian | Skenario Uji | Metode & Lingkungan | Hasil Pengujian | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Kompilasi Antarmuka** | Kompilasi produksi 30 rute Next.js App Router | `npm run build` (Turbopack) | Seluruh 30 rute terkompilasi bersih tanpa kesalahan TypeScript | **LULUS (PASS)** |
| **Kualitas Kode** | Analisis statis linter ESLint | `npm run lint` | 0 errors, 0 warnings di seluruh basis kode | **LULUS (PASS)** |
| **Keamanan Sesi & Cookie** | Penerbitan cookie `resilio_session_token` via Server Action | DevTools & Browser Exec | Cookie berstatus `HttpOnly: true`, `SameSite: Lax`, dan terhapus saat logout | **LULUS (PASS)** |
| **Server Action Form** | Eksekusi pipeline 6-tahap `submitPemeriksaanKlinisAction` | Server Action POST | Validasi bentuk & semantik alergi lolos, mutasi RME terenkripsi tersimpan | **LULUS (PASS)** |
| **Pertahanan BOLA/IDOR** | Akses ID tidak terdaftar (`/nakes/periksa/APT-999`, `/pasien/faskes/FAS-999`) | Browser Test & Headless | Menampilkan kartu error 404 terisolasi tanpa membocorkan data entitas lain dan sesi tetap utuh | **LULUS (PASS)** |
| **Protokol Break-Glass** | Pembukaan darurat pasien koma di IGD | Modal Break-Glass | Rekam medis darurat terbuka, alarm High-Severity terkirim ke SIEM Kemenkes | **LULUS (PASS)** |
| **Deteksi Alergi Klinis** | Resep obat memuat alergen pasien (Penicillin) | Text Input Match | Banner merah berkedip seketika saat kata kunci alergen terdeteksi (UR-T10) | **LULUS (PASS)** |
| **Auto-Watermarking** | Unggah KTP & Selfie e-KYC | Canvas API Peramban | Foto otomatis dibubuhi teks watermark permanen sebelum dikirim | **LULUS (PASS)** |
| **Shimmer Skeleton** | Simulasi pemutusan koneksi internet faskes | Banner Status & Skeleton | Banner offline muncul, shimmer effect aktif, data tetap terbaca via IndexedDB | **LULUS (PASS)** |
| **Aksesibilitas Mobile** | Navigasi pada resolusi 375x667 px | Chrome Emulation | Drawer menu responsif, bebas horizontal overflow (`scrollWidth = innerWidth`) | **LULUS (PASS)** |

---

## 4. Temuan, Refaktorisasi & Perbaikan Kritis (Bug Fixes)

1. **Temuan 1: Celah BOLA Fallback `|| list[0]`**:
   - *Masalah*: Saat ID di URL tidak ditemukan, kode lama mengalihkan ke `list[0]`, membocorkan data orang lain.
   - *Perbaikan*: Menghapus seluruh fallback `|| list[0]` dan menggantinya dengan penanganan kartu kesalahan 404 terisolasi di dalam dashboard.
2. **Temuan 2: TypeError `allergies.filter` Undefined**:
   - *Masalah*: Objek pasien tanpa properti `allergies` memicu crash runtime di stasiun kerja dokter.
   - *Perbaikan*: Menerapkan pengecekan defensif `Array.isArray(patient?.allergies) ? patient.allergies : []`.
3. **Temuan 3: Sesi Login Hilang saat Menemui 404**:
   - *Masalah*: Pengalihan paksa server membuang pengguna ke halaman login saat salah mengetik ID.
   - *Perbaikan*: Menyediakan *In-Dashboard Error Boundary* (`app/(dashboard)/error.tsx`) dan 404 global pintar (`app/not-found.tsx`) yang mempertahankan sesi login.
4. **Temuan 4: Animasi Transisi & Skeleton Shimmer**:
   - *Perbaikan*: Mengimplementasikan CSS keyframe `shimmer-effect` dan konvensi resmi Next.js `app/(dashboard)/loading.tsx`.

---

## 4. Kesimpulan Kelaikan Sistem

Resilio-Health v0.2 telah memenuhi seluruh kriteria evaluasi integrasi tiga mata kuliah (PAW, Kriptografi, KKS). Sistem siap dipresentasikan dengan arsitektur 4 peran lengkap, ketahanan *Offline-First* berdaya tahan tinggi, dan kepatuhan regulasi UU PDP No. 27/2022 serta Permenkes No. 24/2022.
