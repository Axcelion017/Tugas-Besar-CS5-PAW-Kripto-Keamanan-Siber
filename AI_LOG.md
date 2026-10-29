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
