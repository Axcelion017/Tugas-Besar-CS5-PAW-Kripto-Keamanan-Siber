# AI_LOG.md — Resilio-Health

Dokumen pencatatan penggunaan asisten kecerdasan buatan (AI) sesuai kebijakan integritas akademik.

---

## 2026-10-17 — Milestone 2 (Tag v0.2 & sec-0.2)

- **Tool**: Google Antigravity & Hermes Coding Agent (Claude & Gemini Models)
- **Tujuan**: Restrukturisasi arsitektur Next.js 15 App Router 30 rute (ekosistem 4 peran: Pasien, Staf Nakes Triase, Dokter DPJP, Admin Regulator), enkripsi citra medis biner (IndexedDB Blob), protokol darurat Break-Glass IGD, auto-watermarking e-KYC, penegakan Zero-Trust BOLA guard, dan sistem animasi Shimmer Skeleton.
- **Ringkasan Prompt**:
  1. "Restrukturisasi rute dashboard Next.js ke dalam 4 domain peran dengan isolasi Zero-Trust dan hapus seluruh kode monolitik lama."
  2. "Tambahkan peran ke-4 Staf Nakes Faskes (Perawat Triase & Admisi) untuk memisahkan wewenang administratif dan menetapkan DPJP melalui Active Encounter Ticket ber-PIN 6 digit."
  3. "Implementasikan protokol Break-Glass darurat medis IGD (ISO 27799) dengan pencatatan High-Severity Alert ke SIEM Kemenkes."
  4. "Bangun dukungan enkripsi citra medis biner (Rontgen, USG, Lab) menggunakan AES-256-GCM Blob dan IndexedDB lokal."
  5. "Implementasikan auto-watermarking teks permanen pada foto KTP dan selfie di canvas peramban sebelum berkas diunggah."
  6. "Perbaiki celah BOLA fallback || list[0] menjadi penanganan kartu error 404 terisolasi tanpa memutus sesi pengguna."
  7. "Bangun pustaka Shimmer Skeleton dan banner penanganan gangguan jaringan offline."
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - Subsistem Staf Nakes: `app/(dashboard)/staf/page.tsx`, `triase/page.tsx`, `assign-dpjp/page.tsx`, `rujukan/page.tsx`.
  - Subsistem Dokter DPJP: `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx`, `pasien-lookup/page.tsx`.
  - Subsistem Pasien: `app/(dashboard)/pasien/rekam-medis/page.tsx`, `consent/page.tsx`, `faskes/[faskesId]/page.tsx`.
  - Pustaka Antarmuka & Efek: `components/ui/Skeleton.tsx`, `components/ui/Icons.tsx`, `app/globals.css`, `app/(dashboard)/loading.tsx`, `app/not-found.tsx`, `app/(dashboard)/error.tsx`.
  - Seluruh dokumen laporan di folder `docs/` (`kebutuhan.md`, `arsitektur.md`, `keterlacakan.md`, `keamanan.md`, `CRYPTO_SPEC.md`, `asset-inventory.md`, `risk-register.md`, `dfd.md`, `threat-model.md`, `verification.md`, `Latihan1.md`, `ATTRIBUTION.md`).
- **Cara Verifikasi**:
  - `npm run lint`: 0 error, 0 warning (ESLint terstandarisasi).
  - `npm run build`: Kompilasi produksi 30 rute Next.js App Router sukses 100%.
  - `npx vitest run`: 4/4 tes unit kriptografi AES-256-GCM dan HMAC-SHA256 lulus.
  - Pengujian peramban langsung (Chrome DevTools Protocol & Emulasi Mobile 375x667 px).

---

## 2026-10-30 — Integrasi Basis Data PostgreSQL Riil & Skema Prisma 7 Seeding Idempoten

- **Tool**: Hermes Coding Agent
- **Tujuan**: Membangun arsitektur basis data relasional server menggunakan Prisma 7 ORM, driver adapter PostgreSQL (`@prisma/adapter-pg`), pemisahan modular backend (`prisma/`, `lib/db/prisma.ts`), eksekusi migrasi fisik 16 entitas, dan pengisian data awal menggunakan pola `upsert` idempoten.
- **Ringkasan Prompt**:
  1. "Unggah diagram dua entitas produk Anda yang berelasi 1:N, lengkap dengan atribut dan tipe, primary key, foreign key, dan minimal satu constraint unik."
  2. "Tuliskan aturan penghapusan (Restrict, Cascade, atau SetNull) yang Anda pilih untuk relasi tersebut beserta alasannya."
  3. "Susun daftar 10 skenario uji (8 CRUD dan 2 relasi)."
  4. "Jelaskan urutan perintah Prisma 7 setelah skema berubah dan alasan generate serta seed harus dijalankan eksplisit."
  5. "1, namun untuk pengerjaan setup postgre itu kan nanti menggunakan postgre saya, jika membutuhkan koneksi database postgre tanyakan dulu saja dan beri tahu saya panduannya"
  6. "cek koneksi apakah sudah terkonek dengan db saya?"
  7. "iyap jalankan, pastikan untuk backend berada di folder yang berbeda kalo misalkan diperlukan"
  8. "oh iya ku lupa untuk pendaftaran pasien baru itu kan perlu membuat password tapi sepertinya belum ada ya? kemudian ketika aku udh mendaftar sepertinya tidak masuk ke DB data akun yang ingin diverifikasi di eKYC serta ketika sudah di setujui belum ada di db users barunya?"
  9. "nah skema prisma semuanya dihubungkan dengan database sehingga semua interaksi kita bisa tes dengan databasenya"
  10. "Sepertinya ada bug terutama bagian umur profil kemudian data per profilnya masih bermasalah, usahakan semua interaksi sudah berbasis database, kemudian sesuaikan ukuran tulisan"
  11. "Tambahkan informasi Tech Stack di README"
  12. "Tugas 2 — Milestone 2: Integrasi Logika Server dan Database Produk Web (Sub-CPMK 3, Tag v0.2)"
  13. "Sepertinya untuk audit log akses pada pasien diubah jadi mirip notifikasi pesan gitu kek email yang isinya apa yang terjadi kemudian siapa yang melakukan biar lebih mudah dipahami oleh user pasien"
  14. "Tugas 2 Kriptografi (AEAD, Tag v0.2) & Tugas 2 KKS (Kontrol Akses, Lynis, Image Scan, SBOM, Penanda sec-0.2)"
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - Berkas Bukti Kriptografi: `docs/Tugas2/Kriptografi/LaporanTugas2_Kripto.md` (spesifikasi parameter AEAD, AAD context binding, panduan demo 3 menit, dan 5 tes lulus).
  - Berkas Bukti KKS: `docs/Tugas2/KKS/LaporanTugas2_KKS.md`, `security/access-tests.md` (matriks 4 peran & 8 tes akses seimbang), `security/lynis-before.txt` & `lynis-after.txt` (skor 74), `security/image-scan-before.txt` & `image-scan-after.txt` (0 critical), serta `security/sbom.cdx.json` (CycloneDX).
  - Penyesuaian Kode: Integrasi `bcryptjs` salt rounds 10 di `lib/actions/auth.ts`, `Dockerfile` non-root (`USER node`), `docker-compose.yml` port terisolasi, `lib/crypto/aes.ts` dengan AAD, dan unit test `tests/access-control.test.ts` serta `tests/crypto.test.ts`.
  - Transformasi Halaman Audit Log Pasien: Mendesain ulang `app/(dashboard)/pasien/audit-log/page.tsx` menjadi antarmuka pesan masuk (*Inbox & Message Reader*) bergaya email, memuat uraian bahasa manusia, detail aktor pengakses, nama faskes, serta tombol aksi pintas pencabutan izin.
  - Server Action Audit Database: Membangun `lib/actions/audit.ts` (`getPatientAuditLogsServerAction`, `createAuditLogServerAction`) untuk mengambil log kejadian langsung dari PostgreSQL.
  - Pembaruan Navigasi RoleNav: Mengubah label menu di sidebar dari "Audit Log Akses" menjadi "Notifikasi Akses Medis".
  - Dokumentasi Pengujian Milestone 2: Membangun berkas `docs/Tugas2/PAW/LaporanTugas2.md` dan `docs/pengujian-milestone2.md` yang merinci 10 skenario pengujian CRUD dan relasi data (100% lulus), 3 bukti penolakan validasi server Zod, dan panduan tangkapan layar.
  - Implementasi CRUD Antarmuka Penuh: Melengkapi fungsi Update (Reschedule & Extend Duration) dan Delete (Batalkan antrean & Hapus izin akses) di `/pasien/booking` dan `/pasien/consent` yang langsung memutasi PostgreSQL.
  - Pembaruan README.md: Menambahkan Bab 2 (Perkembangan Fitur v0.1 ke v0.2) dan Bab 8 (Petunjuk Menjalankan Aplikasi & Hasil Verifikasi).
  - Dokumentasi README.md: Menambahkan Bab 4 "Teknologi yang Digunakan (Tech Stack)" dengan tabel 11 baris yang mencakup Next.js App Router, React 19, Tailwind CSS v4, Montserrat, Server Actions, PostgreSQL 17, Prisma 7, Zod v4, Web Crypto API, PWA Service Worker, Vitest, dan ESLint.
  - Perhitungan Umur Dinamis: Menambahkan helper `calculateAge(birthDate)` di `lib/db/mockData.ts` dan menghapus `age: 30` hardcoded pada dasbor pasien.
  - Interaksi Penuh Berbasis Basis Data: Menghubungkan seluruh pengambilan data antrean (`getAppointmentsServerAction`), izin akses (`getAccessGrantsServerAction`), dan tiket kendala (`getTroubleTicketsServerAction`) murni ke PostgreSQL, meniadakan kebocoran data mock antar-akun.
  - Tipografi Enterprise: Mengganti micro-font `text-[9px]`, `text-[10px]`, `text-[11px]` menjadi ukuran standar yang mudah dibaca (`text-xs` dan `text-sm`) di halaman dasbor dan profil.
  - Suite Server Actions Penuh: Membangun `lib/actions/appointment.ts`, `lib/actions/triage.ts`, `lib/actions/consent.ts`, `lib/actions/faskes.ts`, `lib/actions/ticket.ts` yang mencakup seluruh operasi CRUD entitas Prisma.
  - Integrasi Antarmuka ke Database: Menghubungkan tombol formulir booking pasien, input tanda vital triase, penetapan DPJP ber-PIN, 1-Click Revoke izin akses UU PDP, tiket kendala data, dan isolasi siber faskes kill-switch ke PostgreSQL.
  - Validasi & Form Registrasi: Penambahan kolom `password` (minimal 6 karakter) pada `RegisterPasienSchema` (`lib/validations/auth.ts`) dan form JSX `app/(auth)/register/pasien/page.tsx` dengan konfirmasi kata sandi.
  - Alur Transaksional PostgreSQL: Pembangunan `registerPasienServerAction` (`lib/actions/auth.ts`) untuk mutasi paralel tabel `User` (status `PENDING`), `Patient` (nomor MRN), dan `KycSubmission`.
  - Integrasi Persetujuan Admin e-KYC: Pembangunan `approveKycServerAction` & `rejectKycServerAction` yang dipanggil langsung saat Admin Kemenkes menekan tombol setujui/tolak di `app/(dashboard)/admin/verifikasi-kyc/page.tsx` untuk mengaktifkan status akun `User` menjadi `VERIFIED`.
  - Autentikasi Pengguna Dinamis: `loginServerAction` mengecek langsung ke database PostgreSQL, menolak akun berstatus `PENDING` dengan peringatan antrean verifikasi Kemenkes, dan mengizinkan login setelah verifikasi disetujui.
  - Konfigurasi & Dependensi: `prisma@7.10.1`, `@prisma/client@7.10.1`, `@prisma/adapter-pg`, `pg`, `tsx` pada `package.json` dan `.env`.
  - Berkas Konfigurasi Prisma 7: `prisma.config.ts` mendefinisikan direktori migrasi, seeder, dan datasource PostgreSQL.
  - Skema Relasional: `prisma/schema.prisma` memodelkan 16 entitas domain HIS dengan integritas relasi `onDelete: Restrict` dan tipe data kriptografi.
  - Klien Database Backend: `lib/db/prisma.ts` mengisolasi connection pool `pg` dan singleton `PrismaClient` di luar komponen UI.
  - Skrip Seeder Idempoten: `prisma/seed.ts` mengimplementasikan pola `upsert` pada seluruh model sehingga aman dieksekusi berulang kali.
  - Migrasi Fisik Database: Terbentuk berkas SQL `prisma/migrations/20261030083339_init_his_schema` dan `prisma/migrations/20261030083810_adjust_access_grant` yang telah diaplikasikan ke database PostgreSQL lokal `resilio_health` (17 tabel aktif).
- **Cara Verifikasi**:
  - `SELECT current_database()` via pg driver: Berhasil terhubung ke `resilio_health` di PostgreSQL 17.6.
  - `npx prisma migrate dev`: Berhasil sinkronisasi skema ke basis data fisik.
  - `npx prisma db seed`: 100% sukses terisi tanpa error, dan uji eksekusi kedua membuktikan sifat idempoten.
  - `npm run lint`: 0 error, 0 warning.
  - `npx vitest run`: 19/19 unit test lulus.
  - `npm run build`: Kompilasi Next.js sukses 100%.

---

## 2026-10-18 — Implementasi Skema Validasi Tipe Aman Zod v4 & Kontrak Data Modul 5

- **Tool**: Hermes Coding Agent
- **Tujuan**: Mengadopsi pustaka Zod v4 ke dalam seluruh alur transaksi formulir Resilio-Health, mengimplementasikan skema validasi SOAP klinis medikolegal, autentikasi, triase keperawatan, pendaftaran loket walk-in, dan pemesanan jadwal faskes, serta menyinkronkan seluruh berkas dokumentasi.
- **Ringkasan Prompt**:
  1. "Apakah di project ada implementasi form and validation?"
  2. "Apakah semuanya dalam hal form dan validation sudah mengimplementasikan schema Zod atau yang lain?"
  3. "Ya boleh nanti dicatat ya perubahan dan hal lainnya ke dalam documents ya."
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - Dependensi baru: `zod` (^4.6.7) pada `package.json`.
  - Pustaka Skema Zod (`lib/validations/`):
    - `clinical.ts`: `PemeriksaanKlinisSchema` (keluhan 10–1000 kar, rentang tensi fisiologis sistolik 70–250 & diastolik 40–150, ICD-10 enum, resep, dan kotak centang medikolegal).
    - `auth.ts`: `LoginSchema`, `RegisterPasienSchema` (e-KYC NIK 16 digit), dan `RegisterNakesSchema` (e-KYD STR & SIP).
    - `triage.ts`: `TriaseSchema` (parameter triase fisik), `WalkInAdmisiSchema` (admisi loket), dan `AssignDpjpSchema` (PIN 6-digit).
    - `patient.ts`: `BookingSchema`, `TroubleTicketSchema`, dan `ConsentGrantSchema`.
  - Modul Server Actions & Keamanan Sesi Cookie (`lib/actions/`):
    - `clinical.ts`: `submitPemeriksaanKlinisAction` (alur 6-tahap: Sesi -> Zod Shape -> Semantik Alergi UR-T10 -> Mutasi AES-GCM/HMAC -> revalidatePath -> redirect).
    - `auth.ts`: `loginServerAction` (penerbitan cookie HTTP-Only `resilio_session_token` dengan `SameSite=Lax`, `Max-Age=14400`, dan `SERVER_ACTIVE_SESSIONS`) serta `logoutServerAction` (invalidation & pemusnahan cookie).
  - Formulir Antarmuka Pengguna:
    - `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx`: Penambahan validasi skema Zod sebelum enkripsi AES-256-GCM, penambahan kotak centang medikolegal, banner galat, dan umpan balik inline.
    - `app/(auth)/login/page.tsx`: Integrasi pemanggilan `loginServerAction` untuk penerbitan cookie sesi server.
    - `components/shared/RoleNav.tsx`: Integrasi pemanggilan `logoutServerAction` untuk pemusnahan cookie sesi saat logout.
    - `app/(auth)/register/pasien/page.tsx`, `app/(auth)/register/nakes/page.tsx`, `app/(dashboard)/staf/triase/page.tsx`, `app/(dashboard)/staf/assign-dpjp/page.tsx`, `app/(dashboard)/staf/page.tsx`, `app/(dashboard)/pasien/booking/page.tsx`, `app/(dashboard)/pasien/tiket-kendala/page.tsx`.
  - Berkas Pengujian:
    - `tests/validations.test.ts`: 15 skenario pengujian unit otomatis mencakup uji positif, negatif (keluhan pendek, tensi di luar rentang, ICD-10 invalid, NIK non-16 digit), dan batas (checkbox false). Total 19 tes lulus 100%.
  - Dokumentasi Basis Data & Sistem:
    - `docs/database.md` & `docs/PAW/database.md`: Spesifikasi lengkap 16 entitas, relasi, CDM, LDM, PDM, dan skrip DDL SQL PostgreSQL.
    - `docs/PAW/kebutuhan.md`, `docs/PAW/arsitektur.md`, `docs/keterlacakan.md`, `CHANGELOG.md`, `EVALUASI.md`, `README.md`, `KEPUTUSAN.md`.
- **Cara Verifikasi**:
  - `npm run lint`: 0 errors, 0 warnings.
  - `npx vitest run`: 19/19 unit test lulus 100% (4 crypto + 15 validation).
  - `npm run build`: 30/30 rute Next.js App Router terkompilasi sukses 100%.
  - Pengujian live runtime peramban: Verifikasi cookie `resilio_session_token` berstatus `HttpOnly: true` terpasang saat login dan terhapus saat logout.

---

## 2026-10-13 — Tugas 1 (Tag v0.1 & sec-0.1)

- **Tool**: Google Antigravity (Gemini & Claude Models)
- **Tujuan**: Perancangan tata letak antarmuka responsif, perbaikan aksesibilitas web WCAG 2.1 AA (Lighthouse), implementasi komponen Web Crypto API (AES-256-GCM & HMAC-SHA256), serta penyusunan threat model STRIDE dan risk register.
- **Ringkasan Prompt**:
  1. "Refactor layout dan komponen dashboard HIS dengan tema putih-merah, tipografi Montserrat, dan optimasi kontras WCAG serta label formulir untuk mencapai skor Lighthouse Accessibility minimal 85."
  2. "Implementasikan enkripsi AES-256-GCM dan HMAC-SHA256 menggunakan Web Crypto API native beserta skenario pengujian unit positif, negatif, dan batas."
  3. "Susun dokumen asset inventory, diagram alir data (DFD) dengan trust boundary, threat model STRIDE (10 ancaman), dan risk register (5 risiko prioritas)."
- **Bagian yang Digunakan**:
  - Komponen antarmuka `DokterView.tsx`, `PasienView.tsx`, `AdminView.tsx`, `TopHeader.tsx`, `InputField.tsx`.
  - Utilitas kriptografi `lib/crypto/aes.ts` dan `lib/crypto/hmac.ts`.
  - Berkas dokumentasi keamanan `docs/asset-inventory.md`, `docs/dfd.md`, `docs/threat-model.md`, `docs/risk-register.md`.
- **Bagian yang Diubah**:
  - Menyesuaikan rasio kontras warna tombol keluar (`text-red-700`) dan teks label abu-abu (`text-slate-600`) agar lolos uji kontras rasio $\ge 4.5:1$.
  - Menambahkan pasangan atribut eksplisit `htmlFor` dan `id` pada seluruh elemen masukan tanda vital formulir dokter.
  - Memastikan IV dibangkitkan acak menggunakan `crypto.getRandomValues` dengan panjang 12 bytes per sesi enkripsi.
- **Cara Verifikasi**:
  - Audit otomatis menggunakan Chrome DevTools Lighthouse Accessibility (Skor $\ge 85$).
  - Menjalankan uji tipe statis TypeScript `npx tsc --noEmit` (0 kesalahan).
  - Menjalankan unit test kriptografi dengan Vitest (4 skenario lulus).
