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

JagaMedis (sebelumnya Resilio-Health) v0.2 telah memenuhi seluruh kriteria evaluasi integrasi tiga mata kuliah (PAW, Kriptografi, KKS) dan kini telah ditingkatkan melalui **Fase 1 Hardening (`v0.3.0-fase1`)**, **Fase 2 End-to-End PostgreSQL (`v0.3.1-fase2`)**, serta **Fase 3 Arsitektur Modular, REST API & PWA/IndexedDB (`v0.3.2-fase3`, 26 November 2026)**.

---

## 5. Matriks Verifikasi Quality Gates Fase 1 (`tests/phase1-security-crypto.test.ts`)

Pengujian otomatis tambahan dijalankan pada 26 November 2026 di branch `refactor/fase-1-security-crypto` (total **5 berkas tes, 40/40 lulus 100%**):

| ID Uji | Sub-Fase | Skenario Uji | Standar Acuan | Hasil Riil | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **F1-01** | `F1.1` | Ketahanan sesi persisten PostgreSQL saat cache RAM server dikosongkan (simulasi restart) & pencabutan saat logout | OWASP ASVS V3.2 & NIST SP 800-63B | Sesi pulih dari tabel `sessions` DB dan bernilai `null` pasca-`revokeSessionAsync` | **LULUS (PASS)** |
| **F1-02** | `F1.2` | Penolakan Server Actions sensitif (`toggleFaskesKillSwitch`, `approveKyc`, `revokeAccess`, `getSingleMedicalRecord`) tanpa sesi cookie | OWASP ASVS V4.1.1, V4.2.1 & API1:2023 | 100% ditolak (`401 Unauthorized`), 0 mutasi DB | **LULUS (PASS)** |
| **F1-03** | `F1.2` | Penegakan wajib PIN 6-digit pada `AssignDpjpSchema` (menolak PIN kosong, `undefined`, atau < 6 digit) | OWASP ASVS V2.1 | Seluruh input PIN kosong/cacat ditolak ketat | **LULUS (PASS)** |
| **F1-04** | `F1.3` | Enkripsi RME 2x beruntun menghasilkan IV 96-bit acak berbeda & ciphertext bukan Base64/Hex plaintext | NIST SP 800-38D & RFC 5869 | IV 24-hex unik per simpan, bukan JSON Hex/Base64, dekripsi `hkdf-aead` sukses | **LULUS (PASS)** |
| **F1-05** | `F1.3` | *Fail-Closed* murni pada tamper 1-byte, AAD pasien berbeda, serta penolakan payload static IV / empty HMAC | ISO 27799 & NIST SP 800-38D | Seluruhnya mengembalikan `ok: false` (`HMAC_MISMATCH`/`INVALID_FORMAT`), 0 data palsu tampil | **LULUS (PASS)** |
| **F1-06** | `F1.3` | Verifikasi HMAC *constant-time* (`crypto.subtle.verify`) & pemisahan sub-kunci HKDF citra biner | CWE-208 (NIST SP 800-107) & SP 800-57 | Hex tak valid ditolak aman (`false`); verifikasi biner gagal pada AAD berbeda | **LULUS (PASS)** |
| **F1-07** | `F1.4` | Kelengkapan HTTP Security Headers pada `next.config.ts` | OWASP Secure Headers | `CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` aktif | **LULUS (PASS)** |

---

## 6. Matriks Verifikasi Quality Gates Fase 2 (`tests/phase2-end-to-end.test.ts`)

Pengujian integrasi end-to-end lintas 4 peran dijalankan terhadap PostgreSQL 17 pada 26 November 2026 di branch `refactor/fase-2-end-to-end-db` (total **6 berkas tes, 44/44 lulus 100%**):

| ID Uji | Sub-Fase | Skenario Uji | Standar Acuan | Hasil Riil | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **F2-01** | `F2.2`–`F2.4` | Penolakan tanpa sesi (`401`) pada seluruh Server Actions baru Fase 2 (`admin.ts`, `checkIn`, `walkIn`, `getAppointmentForExam`) | OWASP ASVS V4.1.1 & API1:2023 | 100% ditolak (`401 Unauthorized`) sebelum menyentuh basis data | **LULUS (PASS)** |
| **F2-02** | `F2.1`–`F2.4` | Alur End-to-End 4 Peran 100% PostgreSQL: Booking + Auto-Consent $\rightarrow$ Check-In $\rightarrow$ Triase Atomik `MERAH` $\rightarrow$ Assign DPJP ber-PIN $\rightarrow$ Periksa SOAP AEAD $\rightarrow$ Audit SIEM | ISO/IEC 25010 & NISTIR 7804 | Seluruh transisi status (`PENDING_ARRIVAL` $\rightarrow$ `WAITING_TRIAGE` $\rightarrow$ `WAITING_DOCTOR` $\rightarrow$ `IN_EXAMINATION` $\rightarrow$ `COMPLETED`), data triase `MERAH` (SpO2 89%), RME terenkripsi, & log SIEM `WRITE_RME` sinkron 100% di PostgreSQL | **LULUS (PASS)** |
| **F2-03** | `F2.1`/`F2.3`/`F2.4` | Penegakan Kill-Switch Siber (`FaskesStatus.QUARANTINED`) oleh Admin terhadap booking pasien & penulisan RME dokter | ISO 27799 / UR-A03 | Booking pasien dan `submitPemeriksaanKlinisAction` di faskes terkarantina ditolak tegas di server | **LULUS (PASS)** |
| **F2-04** | `F2.1`/`F2.4` | Siklus status e-KYC: pengajuan tidak menimpa `patient.nik` sebelum disetujui & penolakan Admin tersimpan permanen sebagai `REJECTED` | Permenkes / Administrasi | `patient.nik` tetap utuh saat pengajuan `PENDING`; pasca penolakan status `kyc_submissions` & `users` bernilai `REJECTED` beserta `alasanPenolakan` | **LULUS (PASS)** |

---

## 7. Matriks Verifikasi Quality Gates Fase 3 (`tests/phase3-architecture-pwa.test.ts`)

Pengujian otomatis arsitektur modular, kontrak REST HTTP, PWA/IndexedDB, dan sinkronisasi jadwal dijalankan pada 26 November 2026 di branch `refactor/fase-3-architecture-pwa` (total **7 berkas tes, 48/48 lulus 100%**):

| ID Uji | Sub-Fase | Skenario Uji | Standar Acuan | Hasil Riil | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **F3-01** | `F3.3` | Kontrak REST `GET /api/health` dengan pengujian koneksi PostgreSQL langsung (`SELECT 1`) | RESTful HTTP / Docker Healthcheck | Mengembalikan HTTP `200 OK`, `status: "ok"`, `database: "connected"`, beserta `latencyMs` | **LULUS (PASS)** |
| **F3-02** | `F3.3`/`F3.4` | Kontrak REST `POST /api/sync/outbox`: penolakan tanpa sesi (`401`), penolakan tamper HMAC (`422`), dan sinkronisasi berkas terenkripsi AEAD+HMAC sah ke PostgreSQL (`201`) | W3C PWA Background Sync & NIST SP 800-38D | Tanpa sesi `401`, HMAC palsu ditolak `422` (+ log `HMAC_MISMATCH`), payload sah tersimpan ke `medical_records` (`201`) | **LULUS (PASS)** |
| **F3-03** | `F3.3` | Kontrak REST `GET/POST /api/attachments`: validasi `401`, `400`, `404`, `201`, `200`, serta proteksi Anti-BOLA `403` antar pasien | OWASP API1:2023 & RESTful HTTP | Seluruh kode status akurat; pasien `P-102` ditolak `403 Forbidden` saat mencoba mengunduh lampiran pasien `P-101` | **LULUS (PASS)** |
| **F3-04** | `F3.1`/`F3.4` | Validitas `public/manifest.json`, `public/icon.svg`, `public/sw.js`, nol duplikasi `safeRevalidate`, modul tunggal `parsePrescriptionDetail`, & sinkronisasi tanggal jadwal seed | ISO/IEC 25010 & W3C PWA | Manifest & SW valid, 0 duplikasi util, `APT-2026-001` sinkron dengan tanggal hari ini | **LULUS (PASS)** |
