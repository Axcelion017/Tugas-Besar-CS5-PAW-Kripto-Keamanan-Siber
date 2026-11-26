# AI_LOG.md — JagaMedis (sebelumnya Resilio-Health)

Dokumen pencatatan penggunaan asisten kecerdasan buatan (AI) sesuai kebijakan integritas akademik.

---

## 2026-11-26 — Core REST API v1 (Opsi A) Berstandar RFC 9457 Problem Details (`v0.3.5`)

- **Tool**: Google Antigravity (Gemini Models)
- **Branch**: `refactor/v0.3.4-auth-hardening-ux` (siap di-commit/cabang `feat/v0.3.5-rest-api-v1-rfc9457` oleh pengguna)
- **Tujuan**:
  1. Mengimplementasikan **Opsi A — Core REST API v1 (`/api/v1/*`)** sebanyak **17 Route Handler files** yang dipisah spesifik per domain & transisi status klinis dengan standar **RFC 9110** dan **RFC 9457 (`application/problem+json`)**.
  2. Menerapkan `await context.params` (Next.js 16) + validasi ID ketat (`validatePathId`) sebelum kueri Prisma, guard `requireApiSession()` + Anti-BOLA + SIEM audit, verifikasi AEAD+HMAC pada penulisan/addendum RME, serta penolakan `409 Conflict` untuk relasi `RESTRICT` & transisi status ilegal.
  3. Mendokumentasikan kontrak API aktif beserta **Backlog Phase B (Next Session)** pada `docs/PAW/rest_api_v1.md` dan menyinkronkan dokumen hidup (`README.md`, `CHANGELOG.md`, `KEPUTUSAN.md`, `docs/PAW/arsitektur.md`, `AI_LOG.md`).
- **Ringkasan Prompt**: *"okeh ambil opsi A, untuk api yang lain itu bisa di dokumentasikan untuk next session."*
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - Fondasi: `lib/api/problem.ts`, `lib/api/auth.ts`, `lib/validations/api-v1.ts`.
  - 17 Route Handlers `/api/v1/*`: `faskes` (`route`, `[id]`, `[id]/quarantine`), `appointments` (`route`, `[id]`, `[id]/check-in`, `[id]/triage`, `[id]/assign-dpjp`), `medical-records` (`route`, `[id]`, `[id]/addenda`), `access-grants` (`route`, `[id]/revoke`), `patients/me/family-members` (`route`, `[id]`), `trouble-tickets` (`route`, `[id]`).
  - Pengujian & Dokumentasi: `tests/v035-rest-api-v1.test.ts` (19 tes baru), `docs/PAW/rest_api_v1.md`, `README.md`, `CHANGELOG.md`, `KEPUTUSAN.md` (`ADR-21`), `docs/PAW/arsitektur.md`, `AI_LOG.md`.
- **Cara Verifikasi**:
  - `npx tsc --noEmit`: 0 error TypeScript.
  - `npm run lint`: 0 error, 0 warning.
  - `npx vitest run`: **10 berkas tes, 75/75 skenario lulus (100%)** dalam `1.30s`.
  - `npm run build`: Kompilasi produksi sukses (**42 halaman statis + 21 Route Handlers API + `ƒ Proxy`**).

---

## 2026-11-26 — Sinkronisasi Menyeluruh Spesifikasi & Dokumentasi Proyek ke Kondisi Aktual `v0.3.4`

- **Tool**: Google Antigravity (Gemini Models)
- **Branch**: `refactor/v0.3.4-auth-hardening-ux`
- **Tujuan**:
  1. Menyelaraskan seluruh dokumen spesifikasi hidup (*living docs*) dengan arsitektur, keamanan, kriptografi, UX, dan hasil uji aktual **`v0.3.4`** (**36 rute Next.js 16 + `ƒ Proxy`**, **17 model relasional + 14 enum**, **54 panggilan `requireSession()`**, **9 berkas / 56 tes Vitest lulus 100%**, *Rate Limiting* `429`, Anti-*Account Enumeration* `CWE-204`, *Family Proxy* CRUD PostgreSQL, & isolasi cetak A4) tanpa mengubah arsip historis praktikum (`docs/praktikum/modul04..07.md`, `docs/Tugas2/*`).
- **Ringkasan Prompt**: *"Update dokumen dokumen untuk menyesuaikan dengan spesifikasi sistem saat ini."*
- **Bagian yang Dimutakhirkan**:
  - Root: `README.md`, `SPECIFICATION.md`, `KEPUTUSAN.md` (penambahan `ADR-15` s.d. `ADR-20`), `AI_LOG.md`.
  - Spesifikasi Teknis: `docs/keamanan.md`, `docs/cryptography/CRYPTO_SPEC.md`, `docs/PAW/arsitektur.md`, `docs/keterlacakan.md`, `docs/THREAT_MODEL.md` (penambahan `RSK-12`).
  - Audit, Standar & SOP: `docs/audit/audit_ulang_menyeluruh_v0.3_26Nov2026.md` (`R2`/`R3`/`P-01`–`P-05b` ditutup, `56/56` Vitest), `docs/standar/matriks_standar_acuan_v0.3.md` (`CWE-204` & ASVS V2.2.1 terimplementasi), `docs/sop/simulasi_alur_dan_sop_jagamedis.md`.
- **Cara Verifikasi**: Inspeksi langsung terhadap `git status -s` dan konsistensi metrik lintas dokumen terhadap hasil uji terakhir (`tsc` 0 error, `eslint` 0 warning, `56/56` Vitest lulus, `36/36` build sukses).

---

## 2026-11-26 — Tahap A (`v0.3.4`): Auth Hardening (Rate Limit & Anti-Enumeration), Poles UX Klinis & Modularitas `<350` Baris

- **Tool**: Google Antigravity (Gemini Models)
- **Branch**: `refactor/v0.3.4-auth-hardening-ux`
- **Catatan Perubahan Rinci**: `docs/perubahan/v0.3.4-auth-hardening-ux-2026-11-26.md`
- **Tujuan**:
  1. Menuntaskan seluruh item **Tahap A (`P-01` s.d. `P-05b`)** dari peta jalan audit ulang `v0.3` tanpa migrasi skema basis data.
  2. Menutup celah *Account Enumeration* (OWASP ASVS V2.2.2 / CWE-204) dengan pesan error seragam & dummy `bcrypt.compare`, serta memasang *sliding-window rate limiting* (`HTTP 429`) pada `loginServerAction` dan `POST /api/auth/session`.
  3. Membungkus *Quick Demo* dengan *feature flag* `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`, menghapus 4 fallback klien `|| "DOC-01"` serta fallback `MOCK_PATIENTS`/`MOCK_ENCRYPTED_RECORDS` (diganti cache IndexedDB `cached_active_patients`).
  4. Menyederhanakan navigasi `RoleNav` (tanpa duplikasi `/beranda`), mengubah penanda menu aktif ke aksen tepi kiri lembut (`bg-red-50/80 text-red-800 border-l-4 border-red-600` + `aria-current="page"`, mempertahankan brand merah JagaMedis sembari mencegah *alert fatigue* NISTIR 7804), menambahkan lencana *pending* IndexedDB di sidebar dokter, dan memecah 5 berkas domain $>350$ baris menjadi modul ramping $\le 350$ baris.
- **Ringkasan Prompt**: *"sekarang task yang dapat dilakukan nih apa ya? — opsi 1."*
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - **Auth Hardening**: `lib/auth/rateLimit.ts` (baru), `lib/auth/demoConfig.ts` (baru), `features/auth/session-actions.ts`, `features/auth/register-actions.ts` (baru), `lib/actions/auth.ts`, `app/api/auth/session/route.ts`, `.env.example`.
  - **UX Klinis & IndexedDB**: `components/shared/RoleNav.tsx`, `app/page.tsx`, `app/(auth)/login/page.tsx`, `lib/storage/indexedDb.ts`, `app/(dashboard)/nakes/{pasien-lookup,offline-sync}/page.tsx`, `app/(dashboard)/pasien/rekam-medis/{page,[recordId]/page}.tsx`.
  - **Modularisasi Domain**: `features/medical-records/exam/{useExamForm.ts,exam-builders.ts,ExamTab4Plan.tsx,ExamTab5MedicoLegal.tsx,ExamTabs4To5.tsx,ExamWorkspace.tsx}`, `features/medical-records/{exam-actions.ts,exam-support-actions.ts}`, `features/medical-records/patient-detail/{PatientProfileCard.tsx,PatientRecordsSection.tsx,PatientDetailWorkspace.tsx}`, `lib/actions/clinical.ts`.
  - **QA & Dokumentasi**: `tests/v034-auth-hardening-ux.test.ts` (baru, 4 tes Quality Gates), `docs/perubahan/v0.3.4-auth-hardening-ux-2026-11-26.md` (baru), `docs/perubahan/README.md`, `CHANGELOG.md`, `EVALUASI.md`, `AI_LOG.md`, `docs/audit/audit_ulang_menyeluruh_v0.3_26Nov2026.md`.
- **Cara Verifikasi**:
  - `npx tsc --noEmit`: 0 error TypeScript.
  - `npm run lint`: 0 error, 0 warning.
  - `npx vitest run`: **9 berkas tes, 56/56 skenario lulus (100%)** dalam `1.26s`.
  - `npm run build`: Kompilasi produksi **36/36 rute + `ƒ Proxy (Middleware)`** sukses (`885ms`).

---

## 2026-11-26 — Audit Ulang Menyeluruh, Keterlacakan Penuh, Matriks Standar Acuan & SOP Operasional (`v0.3.3-fase4`)

- **Tool**: Google Antigravity (Gemini Models)
- **Branch**: `audit/re-audit-v0.3-standards-sop`
- **Tujuan**:
  1. Melakukan audit ulang menyeluruh secara langsung (*read-only*) terhadap seluruh basis kode pasca-eksekusi Fase 1–4 pada transisi Milestone `v0.2` $\rightarrow$ **`v0.3`** (`v0.3.3-fase4`) beserta pemetaan keterlacakan penuh (`Full Traceability`) antara temuan audit, kebutuhan pengguna (`UR-P/S/T/A`), berkas implementasi, dan bukti uji otomatis.
  2. Menyusun katalog resmi **28 standar acuan internasional & regulasi nasional** pada direktori khusus `docs/standar/` yang memuat Nama Acuan, Isi/Klausul Inti, Justifikasi Pemilihan, serta Implementasi Nyata di proyek.
  3. Menyusun panduan simulasi penggunaan aplikasi *end-to-end* (5 skenario), diagram alur sistem & penanganan insiden (Mermaid), serta 7 dokumen SOP resmi (`SOP-JM-01` s.d. `SOP-JM-07`) pada direktori khusus `docs/sop/`.
- **Ringkasan Prompt**:
  1. *"Buat branch terpisah untuk melakukan audit ulang keseluruhan, mentrace seluruhnya, membuat dokumen yang isinya standard acuan (nama acuan, isinya, justifikasi/alasan, penggunaannya dalam projek), berikan juga simulasi penggunaan aplikasi, alur, dan juga SOP penanganannya sesuai dengan standard."*
  2. *"Opsi A, untuk simulasi alur dan SOP jangan di direktori yang sama dengan audit, kemudian yang matriks standar acuan itu juga sama namain direktori khusus untuk masing-masingnya, kalo yang audit tetap sama."*
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - `docs/audit/audit_ulang_menyeluruh_v0.3_26Nov2026.md` (baru — skor perbandingan `v0.2` vs `v0.3.3-fase4`, matriks keterlacakan penuh, inventaris 4 REST API / 63 Server Actions / 52 `requireSession` / 17 model / 14 enum, 7 catatan residual jujur `R1`–`R7`, evaluasi efisiensi tabel DB 17 $\rightarrow$ 12–13 / UX `U1`–`U5` / relevansi fitur / audit login & strategi Email OTP + TOTP offline, serta peta jalan perbaikan terstandar `P-01`–`P-13` & cetak biru tentatif VPS `VPS-01`–`VPS-06`).
  - `docs/standar/matriks_standar_acuan_v0.3.md` (baru — 30 standar acuan dalam 6 pilar lengkap dengan klausul inti, justifikasi, dan lokasi kode, termasuk CWE-204 & RFC 6238 TOTP).
  - `docs/sop/simulasi_alur_dan_sop_jagamedis.md` (baru — 5 skenario simulasi penggunaan & serangan, 2 diagram Mermaid alur & insiden, serta `SOP-JM-01` s.d. `SOP-JM-07`).
  - `AI_LOG.md` & `README.md` (pembaruan indeks direktori dokumentasi & metrik `v0.3.3-fase4`).
- **Cara Verifikasi**:
  - `npx tsc --noEmit`: 0 error TypeScript.
  - `npm run lint`: 0 error, 0 warning.
  - `npx vitest run`: **8 berkas tes, 52/52 skenario lulus (100%)** dalam `714ms`.
  - Inspeksi grep langsung terhadap `prisma/schema.prisma` (17 model, 14 enum), `requireSession(` (52 pemanggilan), `window.alert/confirm` (0 kemunculan), dan catatan residual `localStorage`/ukuran berkas secara transparan.

---

## 2026-11-26 — Fase 4 Refactoring (`P3 — Poles Milestone v0.3`): WCAG 2.1 AA, *Progressive Disclosure* & DevOps Hardening

- **Tool**: Google Antigravity (Gemini Models)
- **Branch**: `refactor/fase-4-ui-a11y-qa`
- **Catatan Perubahan Rinci**: `docs/perubahan/fase-4-ui-a11y-qa-2026-11-26.md`
- **Tujuan**:
  1. Melaksanakan item **Fase 4 (`F4.2` & `F4.3`)** dari Master Plan Audit Menyeluruh JagaMedis (`docs/audit/audit_menyeluruh_jagamedis_22Nov2026.md`) untuk mematangkan transisi Milestone `v0.2` $\rightarrow$ **`v0.3`** (`v0.3.3-fase4`, dengan tetap menjaga skema 17 tabel Modul 6 utuh).
  2. Menghapus konflik kontras OS Dark Mode (`globals.css`), memasang `prefers-reduced-motion: reduce`, membangun komponen `Modal`/`ConfirmModal` & `ToastBanner` berstandar WCAG 2.1 AA, mengganti 100% sisa `window.alert()`/`window.confirm()`, memperbaiki *double sticky header* mobile & risiko hidrasi `error.tsx`, menerapkan *Progressive Disclosure* pada halaman RME Pasien, serta menambahkan peringatan *unsaved changes* & indikator error per-tab di formulir SOAP 5-tab.
  3. Menyelaraskan DevOps container (`Dockerfile` $\rightarrow$ `node:24-alpine` + `HEALTHCHECK`, `docker-compose.yml` menarik kredensial dari `.env`, dan templat `.env.example`).
- **Ringkasan Prompt**:
  1. *"Sepertinya ada bug dibagian cetak rekam medis, hapus tombol duplikat di bawah dan pastikan yang dicetak hanya dokumen rekam medisnya saja."*
  2. *"Berikan saya nama branch untuk fase 4 — okeh lakukan fase 4."*
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - **Aksesibilitas & UI (`F4.2`)**: `components/ui/Modal.tsx` (baru), `components/ui/ToastBanner.tsx` (baru), `components/ui/LogoutModal.tsx`, `app/globals.css`, `components/shared/RoleNav.tsx`, `app/(dashboard)/layout.tsx`, `app/(dashboard)/error.tsx`, `app/(dashboard)/pasien/{profil,rekam-medis,booking,consent}/page.tsx`, `app/(dashboard)/admin/faskes/page.tsx`, `features/medical-records/exam/ExamWorkspace.tsx`, `components/clinical/DoctorCalendarSchedule.tsx`, `app/(dashboard)/nakes/jadwal/page.tsx`.
  - **DevOps (`F4.3`)**: `Dockerfile`, `docker-compose.yml`, `.env.example` (baru).
  - **Pengujian & Dokumentasi**: `tests/phase4-ui-a11y-devops.test.ts` (baru, 4 tes Quality Gates Fase 4), `docs/perubahan/fase-4-ui-a11y-qa-2026-11-26.md` (baru), `docs/perubahan/README.md`, `AI_LOG.md`, `CHANGELOG.md`, `EVALUASI.md`, `README.md`, `docs/audit/audit_menyeluruh_jagamedis_22Nov2026.md`.
- **Cara Verifikasi**:
  - `npx tsc --noEmit`: 0 kesalahan tipe statis.
  - `npx vitest run`: 8 berkas tes, **52/52 tes lulus (100%)**.
  - `npm run lint`: 0 error, 0 warning.
  - `npm run build`: Kompilasi produksi **36/36 rute + `ƒ Proxy (Middleware)`** sukses.

---

## 2026-11-26 — Fase 3 Refactoring (`P2 — Sedang`): Modularisasi `features/`, Server Components, 4 Endpoint REST, PWA/IndexedDB & Sinkronisasi Jadwal

- **Tool**: Google Antigravity (Gemini Models)
- **Branch**: `refactor/fase-3-architecture-pwa`
- **Catatan Perubahan Rinci**: `docs/perubahan/fase-3-architecture-pwa-2026-11-26.md`
- **Tujuan**:
  1. Memperbaiki ketidaksinkronan tampilan **Jadwal Hari Ini** (`/nakes`) dan **Jadwal Praktik Mingguan** (`/nakes/jadwal`) akibat tanggal seed Oktober 2026, header pekan hardcode, dan zona waktu UTC vs WIB.
  2. Melaksanakan seluruh item **Fase 3 (`F3.1` – `F3.4`)** dari Master Plan Audit Menyeluruh JagaMedis (`docs/audit/audit_menyeluruh_jagamedis_22Nov2026.md`).
  3. Memecah seluruh *god files* (`clinical.ts`, `auth.ts`, `appointment.ts`, `admin.ts`, `beranda`, `pasien`, `nakes`, `periksa/[bookingId]`, `pasien-lookup/[patientId]`) ke struktur modular `features/` serta menghapus duplikasi `safeRevalidate` (7 salinan) dan `parsePrescriptionDetail` (2 salinan).
  4. Memigrasikan pembacaan awal halaman utama (`/beranda`, `/nakes`, `/pasien`) ke **Next.js 16 Server Components** dengan `<Suspense>` streaming langsung dari Prisma.
  5. Membangun 4 endpoint REST strategis (`GET /api/health`, `/api/auth/session`, `POST /api/sync/outbox`, `GET/POST /api/attachments`) dan mengaktifkan PWA nyata (`public/manifest.json`, `PwaRegistrar`, `IndexedDB resilio_offline_db`, & `POST /api/sync/outbox`).
- **Ringkasan Prompt**:
  1. *"Sepertinya tampilan jadwal hari ini dengan yang jadwal praktik mingguan tidak sinkron, coba kamu cek lagi."*
  2. *"Nama branch untuk fase 3 — yap langsung saja sekalian fase 3."*
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - **Sinkronisasi Jadwal**: `prisma/seed.ts`, `components/clinical/DoctorCalendarSchedule.tsx`, `app/(dashboard)/nakes/jadwal/page.tsx`.
  - **Modularisasi `features/` & Deduplikasi (`F3.1`)**: `lib/utils/revalidate.ts`, `features/medical-records/prescription-parser.ts`, `features/admin/*`, `features/auth/*`, `features/appointments/*`, `features/dashboard/*`, `features/medical-records/*` (`exam/*`, `patient-detail/*`), serta perampingan `lib/actions/{admin,auth,appointment,clinical}.ts` dan `app/(dashboard)/{beranda,nakes,pasien,nakes/periksa/[bookingId],nakes/pasien-lookup/[patientId]}/page.tsx`.
  - **Server Components (`F3.2`)**: `features/dashboard/queries.ts`, `features/appointments/queries.ts`, `features/medical-records/queries.ts`.
  - **Endpoint REST (`F3.3`)**: `app/api/health/route.ts`, `app/api/sync/outbox/route.ts`, `app/api/attachments/route.ts`.
  - **PWA & IndexedDB Nyata (`F3.4`)**: `public/manifest.json`, `public/icon.svg`, `public/sw.js`, `components/shared/PwaRegistrar.tsx`, `app/layout.tsx`, `lib/storage/indexedDb.ts`, `components/shared/NetworkStatusBanner.tsx`, `app/(dashboard)/nakes/offline-sync/page.tsx`.
  - **Pengujian & Dokumentasi**: `tests/phase3-architecture-pwa.test.ts` (baru, 4 skenario uji Quality Gates Fase 3), `docs/perubahan/fase-3-architecture-pwa-2026-11-26.md` (baru), `docs/perubahan/README.md`, `AI_LOG.md`, `CHANGELOG.md`, `EVALUASI.md`, `README.md`, `docs/audit/audit_menyeluruh_jagamedis_22Nov2026.md`.
- **Cara Verifikasi**:
  - `npx tsx prisma/seed.ts`: Seeding ulang idempoten dengan tanggal jadwal sinkron hari ini sukses.
  - `npx tsc --noEmit`: 0 kesalahan tipe statis.
  - `npx vitest run`: 7 berkas tes, **48/48 tes lulus (100%)**.
  - `npm run lint`: 0 error, 0 warning.
  - `npm run build`: Kompilasi produksi **36/36 rute + `ƒ Proxy (Middleware)`** sukses.

---

## 2026-11-26 — Fase 2 Refactoring (`P1 — Tinggi`): Eliminasi *Split-Brain* & Integritas Alur End-to-End 4 Peran (100% PostgreSQL)

- **Tool**: Google Antigravity (Gemini Models)
- **Branch**: `refactor/fase-2-end-to-end-db`
- **Catatan Perubahan Rinci**: `docs/perubahan/fase-2-end-to-end-db-2026-11-26.md`
- **Tujuan**:
  1. Melaksanakan seluruh item **Fase 2 (`F2.1` – `F2.4`)** dari Master Plan Audit Menyeluruh JagaMedis (`docs/audit/audit_menyeluruh_jagamedis_22Nov2026.md`) untuk menghilangkan *split-brain* antara `localStorage` / `MOCK_*` dan PostgreSQL pada keempat peran pengguna.
  2. Menyambungkan seluruh alur **Pasien** (booking + auto-consent atomik, direktori faskes + blokir karantina, consent manager, tiket kendala, audit log, dashboard tanpa data vital palsu, profil & KYC) ke PostgreSQL 100%.
  3. Menyambungkan seluruh alur **Staf Triase & Admisi** (check-in, walk-in, handoff cepat `?aptId=`, transaksi atomik triase $\rightarrow$ `WAITING_DOCTOR`, peringatan vital kritis CDS, assign DPJP ber-PIN, pemisahan rujukan masuk/keluar) ke PostgreSQL.
  4. Menyambungkan seluruh alur **Dokter DPJP** (ruang periksa 100% PostgreSQL + Sticky Patient Banner NISTIR 7804 + enkripsi Tab 2–5, penonaktifan cetak sebelum dekripsi, kalender dinamis, perbaikan metrik, serta penegakan Kill-Switch `QUARANTINED` pada seluruh aksi tulis klinis).
  5. Membuat `lib/actions/admin.ts` dan menyambungkan seluruh 6 halaman **Konsol Admin Regulator** ke PostgreSQL serta menegakkan siklus status `AccountStatus.REJECTED` e-KYC/e-KYD secara persisten.
- **Ringkasan Prompt**:
  1. *"Berikan pesan commit yang komprehensif dan berikan nama branch untuk fase kedua."*
  2. *"Okeh sekarang sudah dibuatkan branch baru sekarang lanjut ke fase kedua."*
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - **Server Actions (`F2.1`–`F2.4`)**: `lib/actions/admin.ts` (baru, 8 aksi Admin), `lib/actions/{auth,appointment,triage,clinical}.ts`.
  - **Portal Pasien (`F2.1`)**: `app/(dashboard)/pasien/{page,booking,consent,faskes,faskes/[faskesId],audit-log,profil,tiket-kendala}/page.tsx`.
  - **Meja Staf Triase (`F2.2`)**: `app/(dashboard)/staf/{page,triase/page,assign-dpjp/page,rujukan/page}.tsx`.
  - **Stasiun Kerja Dokter (`F2.3`)**: `app/(dashboard)/nakes/{page,jadwal/page,rujukan/page,periksa/[bookingId]/page,pasien-lookup/[patientId]/page}.tsx`, `components/clinical/DoctorCalendarSchedule.tsx`.
  - **Konsol Admin (`F2.4`)**: `app/(dashboard)/admin/{page,siem-monitor/page,verifikasi-kyc/page,verifikasi-kyd/page,incident-center/page,faskes/page}.tsx`.
  - **Pengujian & Dokumentasi**: `tests/phase2-end-to-end.test.ts` (baru, 4 skenario integrasi end-to-end PostgreSQL), `docs/perubahan/fase-2-end-to-end-db-2026-11-26.md` (baru), `docs/perubahan/README.md`, `AI_LOG.md`, `CHANGELOG.md`, `EVALUASI.md`, `README.md`, `docs/audit/audit_menyeluruh_jagamedis_22Nov2026.md`.
- **Cara Verifikasi**:
  - `npx tsc --noEmit`: 0 kesalahan tipe statis.
  - `npx vitest run`: 6 berkas tes, **44/44 tes lulus (100%)**.
  - `npm run lint`: 0 error, 0 warning.
  - `npm run build`: Kompilasi produksi **33/33 rute + `ƒ Proxy (Middleware)`** sukses.

---

## 2026-11-26 — Fase 1 Refactoring (`P0 — Kritis`): Keamanan Server-Side, Sesi Persisten & Kriptografi Nyata

- **Tool**: Google Antigravity (Gemini Models)
- **Branch**: `refactor/fase-1-security-crypto`
- **Catatan Perubahan Rinci**: `docs/perubahan/fase-1-security-crypto-2026-11-26.md`
- **Tujuan**:
  1. Melaksanakan seluruh item **Fase 1 (`F1.1` – `F1.4`)** dari Master Plan Audit Menyeluruh JagaMedis (`docs/audit/audit_menyeluruh_jagamedis_22Nov2026.md`) untuk menutup seluruh temuan keamanan & kriptografi berprioritas Kritis (`P0`).
  2. Menerapkan sesi persisten PostgreSQL (tabel ke-17 `sessions`), guard server-side terpusat `requireSession(allowedRoles)`, network boundary Next.js 16 `proxy.ts`, serta menghapus celah cookie escalation `resilio_user_role` dan cabang fallback password plaintext.
  3. Menutup seluruh celah BOLA/IDOR, bypass PIN 6-digit, serta kebocoran PII & `encryptionKeyHex` lintas pengguna pada seluruh berkas Server Actions.
  4. Menghapus enkripsi palsu Base64/Hex dan IV/HMAC statis; menerapkan enkripsi AEAD nyata (`HKDF` + `AES-256-GCM` + `AAD` + *constant-time* `crypto.subtle.verify`) dan prinsip *Fail-Closed* murni (0 data medis fiktif) pada seluruh alur penulisan, pembacaan, dan seeding RME.
  5. Memasang HTTP Security Headers (OWASP Secure Headers) pada `next.config.ts` dan menyinkronkan seluruh dokumentasi proyek serta membuat direktori pencatatan perubahan khusus `docs/perubahan/`.
- **Ringkasan Prompt**:
  1. *"Cek keseluruhan modul07.md."*
  2. *"Konflik PR #12 pada app/(dashboard)/layout.tsx."*
  3. *"Cek docs/audit/audit_menyeluruh_jagamedis_22Nov2026.md, saya sudah lakukan fase 0, sekarang ingin melakukan fase 1 namun bingung nama branch."*
  4. *"Lakukan bertahap fase 1 nya dan buat dokumen pencatatan perubahan di direktori khusus yang lengkap ada dokumentasi apa saja yang berubah di filenya dan waktunya, AI_LOG.md, dan keseluruhan dokumen yang ada."*
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - **Skema & Migrasi DB**: `prisma/schema.prisma` (model `Session` / `sessions`), `prisma/migrations/20261126011004_add_persistent_sessions/migration.sql`, `prisma/seed.ts` (enkripsi seed RME menggunakan HKDF + AES-256-GCM + AAD + HMAC).
  - **Autentikasi & Guard Server (`F1.1`)**: `features/auth/guard.ts` (baru), `proxy.ts` (baru, konvensi resmi Next.js 16), `lib/auth/sessionStore.ts`, `lib/auth/auth.ts`, `app/api/auth/session/route.ts`, `app/(dashboard)/layout.tsx`, `app/(auth)/login/page.tsx`.
  - **Hardening Server Actions Anti-BOLA (`F1.2`)**: `lib/actions/{auth,appointment,clinical,consent,faskes,ticket,triage,audit}.ts`, `lib/validations/triage.ts`.
  - **Kriptografi Nyata & Fail-Closed (`F1.3`)**: `features/medical-records/crypto-service.ts` (baru), `lib/crypto/{aes,hmac}.ts`, serta 11 halaman dashboard klien (`periksa`, `pasien-lookup`, `pasien/rekam-medis`, `pasien/consent`, `pasien/tiket-kendala`, `pasien/page`, `staf/assign-dpjp`, `beranda`, `admin/verifikasi-kyc`).
  - **HTTP Security Headers & Pengujian (`F1.4` & QA)**: `next.config.ts`, `vitest.config.ts` (baru), `tests/phase1-security-crypto.test.ts` (baru, 7 tes Quality Gates).
  - **Dokumentasi**: `docs/perubahan/README.md` (baru), `docs/perubahan/fase-1-security-crypto-2026-11-26.md` (baru), `AI_LOG.md`, `CHANGELOG.md`, `EVALUASI.md`, `README.md`, `docs/database.md`, `docs/keamanan.md`, `docs/audit/audit_menyeluruh_jagamedis_22Nov2026.md`.
- **Cara Verifikasi**:
  - `npx prisma migrate dev --name add_persistent_sessions && npx tsx prisma/seed.ts`: Migrasi diterapkan dan seeding idempoten 100% sukses.
  - `npx tsc --noEmit`: 0 kesalahan tipe statis.
  - `npx vitest run`: 5 berkas tes, **40/40 tes lulus (100%)**.
  - `npm run lint`: 0 error, 0 warning.
  - `npm run build`: Kompilasi produksi **33/33 rute + `ƒ Proxy (Middleware)`** sukses.

---

## 2026-11-22 — Penyelesaian Konflik PR #12, Tindak Lanjut Code Review, Penyelarasan Merek JagaMedis, & Audit Arsitektur Menyeluruh

- **Tool**: Google Antigravity (Gemini Models)
- **Tujuan**:
  1. Menyelesaikan konflik *merge* pada branch `Week-7` terhadap `origin/main` untuk berkas beranda, layout dashboard, dan sesi autentikasi.
  2. Menyempurnakan Bagian 4–7 `docs/praktikum/modul07.md`, termasuk pemisahan Subbagian 5.1 (templat + panduan review PR rekan) dan Subbagian 5.2 (respon 3 komentar `@rafly1764` pada PR #12).
  3. Menerapkan tindak lanjut *code review* aksesibilitas pada modal cetak resume medis (`PrintableMedicalResume.tsx`) dan mengganti sisa `Math.random()` di Server Actions dengan CSPRNG `node:crypto` `randomInt`.
  4. Menyelaraskan tampilan merek `Resilio-Health` / `R` yang tersisa di antarmuka, *watermark* dokumen, dan *user-agent* log menjadi **JagaMedis** / `J` tanpa merusak pengenal teknis internal.
  5. Menyusun dokumen audit menyeluruh (*read-only*) dan Master Plan perombakan bertahap (`docs/audit_menyeluruh_jagamedis.md`) mengacu pada standar internasional (OWASP ASVS/Top 10, NIST SP 800-38D/57/63B/107, NISTIR 7804, RFC 5869, ISO/IEC 25010, ISO 27799, WCAG 2.1 AA, Core Web Vitals) dan regulasi nasional (Permenkes 24/2022, UU PDP 27/2022).
- **Ringkasan Prompt**:
  1. *"Cek modul07.md bagian 4 ke bawah agar menyesuaikan, beri panduan manual untuk nomor 5 code review, lalu revisi 5.1 (review PR teman) dan 5.2 (respon komentar review teman)."*
  2. *"Perbaiki konflik di app/(dashboard)/beranda/page.tsx dan app/(dashboard)/layout.tsx tanpa melakukan merge ke main terlebih dahulu."*
  3. *"Buat rencana lalu terapkan masukan code review pada PrintableMedicalResume.tsx serta opsional penggantian Math.random()."*
  4. *"Perbaiki sisa tampilan nama Resilio-Health agar seragam menjadi JagaMedis."*
  5. *"Lakukan audit menyeluruh (read-only) mencakup kode, 16 tabel database, arsitektur file/endpoint, titik pembeda produk, blind spot UI/UX, dan indikator pengujian tiap fase, lalu simpan ke docs/audit_menyeluruh_jagamedis.md."*
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - `app/(dashboard)/beranda/page.tsx`, `app/(dashboard)/layout.tsx`, `lib/auth/auth.ts`: Penyelesaian konflik terhadap `origin/main` (commit `54513ea`) serta penyelarasan judul bilah atas `"Beranda Terpadu JagaMedis"`.
  - `components/clinical/PrintableMedicalResume.tsx`: Penambahan `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, listener keyboard `Escape` + pemulihan fokus, *light-dismiss* backdrop, *sticky responsive action bar* atas dengan tombol `✕ Tutup Dokumen`, `overscroll-contain`, dan pembaruan logo `R` $\rightarrow$ `J`.
  - `lib/actions/auth.ts` & `lib/actions/appointment.ts`: Penggantian `Math.random()` pada pembuatan `mrn` dan `consentPin` 6-digit menjadi `randomInt` (`node:crypto`), serta pembaruan teks *watermark* menjadi `JAGAMEDIS`.
  - `components/shared/RoleNav.tsx`, `app/(auth)/register/nakes/page.tsx`, `app/(dashboard)/admin/verifikasi-kyc/page.tsx`, `app/(dashboard)/pasien/profil/page.tsx`, `lib/actions/audit.ts`, `lib/actions/clinical.ts`, `lib/db/mockData.ts`: Penyelarasan tampilan merek mobile header, *watermark* dokumen, dan *user-agent* log menjadi `JagaMedis` / `JAGAMEDIS`.
  - `docs/praktikum/modul07.md`: Penyempurnaan Bagian 4–7, pembaruan tautan PR #12, pemisahan Subbagian 5.1 (review PR teman) dan 5.2 (tanggapan 3 komentar `@rafly1764` dengan `image-22.png`–`image-24.png`).
  - `docs/audit_menyeluruh_jagamedis.md`: Dokumen audit arsitektur & keamanan menyeluruh (*read-only*) lengkap dengan glosarium, UVP & perbandingan produk, 2 diagram alur Mermaid, audit 7 domain (`3.A`–`3.G`), serta Master Plan 5 fase (`F0.1`–`F4.3`) beserta tabel *Quality Gates*.
- **Cara Verifikasi**:
  - `npx tsc --noEmit`: 0 kesalahan tipe statis.
  - `npx vitest run`: 4 berkas tes, 33/33 tes lulus (100%).
  - `npm run lint`: 0 error, 0 warning.
  - `npm run build`: Kompilasi produksi 33/33 rute Next.js App Router sukses.

---

## 2026-11-19 — Modul 7: Debugging dan Telaah Kode (Resilio-Health)

- **Tool**: Google Antigravity & Hermes Coding Agent (Claude 3.7 Sonnet & Gemini 2.5 Pro)
- **Tujuan**:
  1. Mengonfigurasi lingkungan debugging terintegrasi VS Code untuk Next.js 16 App Router (Server Components & Server Actions via Node inspector) serta pencatatan kueri SQL Prisma ORM.
  2. Melakukan reproduksi sistematis, penelusuran akar masalah (*Root Cause Analysis*), inspeksi panel variabel debugger, analisis lapisan jaringan DevTools, dan perbaikan permanen pada 3 galat kritis aplikasi HIS.
  3. Menyusun dokumen teknis laporan Modul 7 (`docs/praktikum/modul07.md`) lengkap dengan matriks daftar galat, langkah reproduksi deterministik, bukti tangkapan layar sebelum/sesudah, 4 keputusan teknis medikolegal, dan telaah kode (*Pull Request code review*).
- **Ringkasan Prompt**:
  1. *"Setup breakpoint debugger VS Code pada Server Component layout.tsx dan konfigurasi log query Prisma di prisma.ts."*
  2. *"Bantu reproduksi dan analisis galat 1: hanging login akun dokter akibat format hash bcrypt cacat di seeder."*
  3. *"Bantu reproduksi dan perbaiki galat 2: runtime crash RSC serialization pada Prisma.Decimal tanda vital triase loket."*
  4. *"Bantu telusuri dan perbaiki galat 3: penolakan akses dokter DPJP pada RME pasien akibat gateway Zero-Trust kaku yang mengabaikan tiket janji temu aktif."*
  5. *"Susun dokumen teknis Modul 7 sesuai rubrik praktikum mencakup keputusan teknis z.stringbool(), onDelete: RESTRICT, derived state, dan error boundary."*
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - `lib/actions/auth.ts`: Sanitasi defensif format modular crypt Bcrypt dan penanganan kegagalan autentikasi tanpa blocking runtime.
  - `prisma/seed.ts`: Memperbarui seeder kata sandi dokter dan nakes menggunakan hashing Bcrypt dengan 10 putaran salt valid (`bcrypt.hash(password, 10)`).
  - `lib/actions/triage.ts`: Sanitasi instans `Prisma.Decimal` menjadi tipe primitif JavaScript `Number(...)` sebelum ditransmisikan melintasi batas serialisasi RSC Flight.
  - `lib/actions/clinical.ts`: Penerapan *Encounter-Based Access Control* (`isAccessAllowed = !!activeGrant || !!activeAppointment`) dan perbaikan kueri agregasi entitas unik pada kartu ringkasan dokter.
  - `app/(dashboard)/nakes/pasien-lookup/[patientId]/page.tsx`: Penanganan dekripsi RME terenkripsi AES-256-GCM, verifikasi integritas HMAC, dan render status izin akses aktif.
  - `.vscode/launch.json`: Konfigurasi multi-target Next.js App Router (server-side node-terminal `--inspect`, client-side Chrome debugger, dan full-stack compound).
  - `lib/db/prisma.ts`: Konfigurasi pencatatan log Prisma Client tingkat lanjut (`query`, `warn`, `error`).
  - `docs/praktikum/modul07.md`: Dokumen teknis komprehensif 7 bab mencakup konfigurasi debugger, tabel galat, 3 catatan penelusuran galat mendalam dengan bukti tangkapan layar otentik, keputusan teknis arsitektural, matriks telaah kode PR, kendala penyelesaian, dan kepatuhan AI.
- **Cara Verifikasi**:
  - `npx tsc --noEmit`: 0 kesalahan tipe statis (100% type-safe).
  - `npx vitest run`: 33/33 unit test otomatis lulus 100% (kriptografi, validasi Zod, kontrol akses, dan transaksi rollback).
  - `npm run build`: Kompilasi produksi 33 rute Next.js App Router sukses tanpa galat.
  - Pengujian live debugging di VS Code: Menghentikan eksekusi pada Server Component `app/layout.tsx:25` dan inspeksi breakpoint variabel runtime pada `lib/actions/clinical.ts:719`.

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

## 2026-11-08 — Integrasi Standar RME Permenkes RI No. 24/2022, Recharts, & Citra Biner

- **Tool**: Hermes Coding Agent
- **Tujuan**: Mengintegrasikan cetak biru spesifikasi sistem `SPECIFICATION.md` mencakup Permenkes RI No. 24/2022, enkripsi citra biner AES-GCM + HMAC, visualisasi grafik Recharts, formulir 5-tab dokter, dan wrapper IndexedDB.
- **Ringkasan Prompt**:
  1. "Dokumen spesifikasi teknis dan arsitektur sistem (System Blueprint & Technical Requirement Specification) untuk Resilio-Health di bawah ini dirancang secara terstruktur..."
  2. "lakukan penyesuaian dengan yang baru ini"
  3. "Setuju, jalankan"
- **Bagian yang Dihasilkan / Dimodifikasi**:
  - `SPECIFICATION.md`: Cetak biru lengkap arsitektur sistem, RBAC 4 peran, 2 kelompok besar RME (Administratif & Klinis), skema SQL, alur kriptografi biner, dan alur offline PWA.
  - `types/ehr.ts`: Definisi antarmuka TypeScript terstandarisasi untuk `AdministrativeRecord` dan `ClinicalRecordPayload` (9 sub-komponen Permenkes 24/2022).
  - `lib/crypto/aes.ts` & `lib/crypto/hmac.ts`: Penambahan fungsi `encryptBinaryAttachment` dan `decryptBinaryAttachment` (ArrayBuffer) serta alias standar `aesGcmEncrypt`, `aesGcmDecrypt`, `hmacSha256Sign`, dan `hmacSha256Verify`.
  - `lib/storage/indexedDb.ts`: Wrapper IndexedDB `resilio_offline_db` dengan 3 Object Stores (`cached_active_patients`, `offline_clinical_outbox`, `offline_media_blobs`).
  - `public/sw.js`: Service Worker PWA dengan dukungan caching aset statis dan Background Sync API (`sync-medical-records`).
  - `prisma/schema.prisma` & Migrasi `20261108063337_enhance_ehr_permenkes24`: Penambahan kolom `vitalSignsTrend`, `claimStatus` pada `MedicalRecord`, dan `fileSizeBytes`, `binaryHmac` pada `MedicalImage`.
  - `scripts/harden-os.sh` & `scripts/setup-docker-node.sh`: Skrip otomatisasi hardening sistem operasi Ubuntu 22.04 LTS (SSH key-only, root disabled, UFW, sysctl) dan audit Lynis.
  - `scripts/verify-hardening.sh`: Skrip verifikasi mandiri kepatuhan seluruh rubrik penugasan Tugas 2 KKS berpenanda `sec-0.2`.
  - `app/(dashboard)/pasien/rekam-medis/page.tsx` & `[recordId]/page.tsx`: Penambahan helper `parsePrescriptionDetail` untuk menyajikan detail penggunaan obat (dosis, aturan minum, cara minum, indikasi, peringatan).
  - `components/clinical/PrintableMedicalResume.tsx`: Perombakan format lembar cetak resume rekam medis menjadi dokumen administratif kontinu standar rumah sakit tanpa kotak-kotak terpisah, dilengkapi informasi lengkap pasien, lokasi faskes/server, dan tombol tutup dokumen.
  - `app/(dashboard)/beranda/page.tsx`: Halaman Beranda terpadu untuk seluruh pengguna (Pasien, Dokter DPJP, Staf Nakes, Admin) yang memuat ringkasan informasi penting, status kedaulatan kriptografi, kepatuhan Permenkes 24/2022, dan pintasan aksi navigasi.
  - `app/(dashboard)/nakes/jadwal/page.tsx`: Halaman fitur mandiri jadwal praktik dokter berbasis kalender mingguan (Senin s.d. Minggu) dengan filter faskes rumah sakit dan alokasi waktu pelayanan.
  - `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx`: Integrasi fitur rujukan dokter lintas rumah sakit dengan pemilih faskes resmi, dokter spesialis konsulen, dan tingkat urgensi rujukan.
  - `components/clinical/DoctorCalendarSchedule.tsx`: Komponen visual jadwal praktik dokter poliklinik berbasis kalender interaktif dengan mode Timeline slot jam (08:00 - 17:00 WIB) dan mode Grid kartu blok waktu, dilengkapi durasi mulai-selesai dan indikator warna skala prioritas.
  - `components/clinical/PrintableMedicalResume.tsx`: Komponen cetak dokumen resmi resume rekam medis rumah sakit dengan dukungan `@media print` yang dapat diakses oleh Dokter, Staf Nakes, dan Pasien.
  - `components/clinical/VitalSignsTrendChart.tsx`: Komponen grafik tren tanda vital dinamis berbasis Recharts.
  - `app/(dashboard)/nakes/pasien-lookup/page.tsx`: Transformasi fitur pencarian menjadi Daftar Pasien & Status Rekam Medis terpadu yang menampilkan 4 metrik (Jumlah Pasien, Jumlah Antrean, Belum Ditandatangani, Sudah Ditandatangani), filter cepat, serta list pasien interaktif yang terhubung ke PostgreSQL via `getDoctorPatientListServerAction`.
  - `app/(dashboard)/nakes/pasien-lookup/[patientId]/page.tsx`: Halaman detail rekam medis pasien yang dipilih oleh dokter, menyajikan kartu identitas, tanda vital triase, riwayat dokumen SOAP, dekripsi berkas klinis, dan integrasi modal cetak resume medis resmi.
  - `app/(dashboard)/pasien/rekam-medis/page.tsx` & `[recordId]/page.tsx`: Pembersihan simbol visual berwarna menjadi enterprise clean UI dan implementasi `smartDecryptPayload` sehingga pasien dapat membuka dan membaca detail rekam medis pribadinya secara instan dan aman.
  - `app/(dashboard)/pasien/page.tsx`: Integrasi grafik tren tanda vital dan pengambilan data RME riil via `getMedicalRecordsServerAction`.
  - `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx`: Restrukturisasi formulir klinis menjadi 5-Tab interaktif (Administratif, Anamnesis/Fisik GCS, ICD-10/Penunjang, Penatalaksanaan Resep, CPPT/Resume).
  - `app/(dashboard)/pasien/rekam-medis/page.tsx` & `[recordId]/page.tsx`: Desain ulang tampilan rekam medis pasien dengan kartu atribusi dokter DPJP yang mendiagnosis dan staf perawat yang melakukan tindakan fisik awal, penyajian kartu diagnosis awam, resep obat per-kartu, tanda vital, dan integrasi ke Server Actions PostgreSQL.
  - `tests/crypto.test.ts`: Penambahan skenario pengujian unit ke-8 untuk enkripsi dan verifikasi keutuhan biner citra medis (100% lulus).
- **Cara Verifikasi**:
  - `npx prisma migrate dev`: Migrasi database diterapkan sukses ke PostgreSQL lokal `resilio_health`.
  - `npx prisma db seed`: Seeder idempoten berhasil dieksekusi 100%.
  - `npx vitest run`: Seluruh 33 uji unit otomatis lulus 100%.
  - `npm run lint`: 0 error, 0 warning.
  - `npm run build`: Kompilasi 32 rute Next.js App Router sukses 100%.

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
