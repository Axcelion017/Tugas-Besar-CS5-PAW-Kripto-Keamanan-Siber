# Catatan Perubahan Fase 3 (`P2 — Sedang`): Modularisasi `features/`, Server Components, 4 Endpoint REST, PWA & Sinkronisasi Jadwal

> **Metadata Eksekusi**
> - **Proyek**: JagaMedis (Cryptographic Offline-First HIS & RME)
> - **Branch**: `refactor/fase-3-architecture-pwa`
> - **Tanggal Eksekusi**: Kamis, 26 November 2026
> - **Rentang Waktu**: `09:03 WIB` – `09:36 WIB` (UTC+7)
> - **Acuan Master Plan**: [audit_menyeluruh_jagamedis_22Nov2026.md](../audit/audit_menyeluruh_jagamedis_22Nov2026.md) (`F3.1` – `F3.4` + Perbaikan Sinkronisasi Jadwal Hari Ini vs Mingguan)
> - **Migrasi Basis Data**: Tidak diperlukan (menggunakan skema 17 tabel PostgreSQL; seeding diperbarui agar jadwal demo dinamis terhadap tanggal hari ini)
> - **Status Verifikasi**: **LULUS 100%** (`tsc`: 0 error, `vitest`: 48/48 lulus, `eslint`: 0 error/warning, `next build`: 36/36 rute + `ƒ Proxy (Middleware)`)

---

## 1. Matriks Kronologis Perubahan Berkas

| No | Waktu (WIB) | Tugas | Status | Jalur Berkas | Ringkasan Perubahan Teknis |
| :---: | :---: | :---: | :---: | :--- | :--- |
| 1 | 09:04 | `F3.1` | **Baru** | `lib/utils/revalidate.ts` | Menyatukan 7 salinan duplikat `function safeRevalidate` di `lib/actions/*.ts` menjadi 1 modul utilitas tunggal yang menerima `string \| string[]`. |
| 2 | 09:04 | `F3.1` | **Baru** | `features/medical-records/prescription-parser.ts` | Menyatukan duplikasi `parsePrescriptionDetail` (~125 baris) dari `pasien/rekam-medis/page.tsx` dan `pasien/rekam-medis/[recordId]/page.tsx` menjadi 1 modul tunggal. |
| 3 | 09:05 | `Sync` | Dimodifikasi | `prisma/seed.ts`, `components/clinical/DoctorCalendarSchedule.tsx`, `app/(dashboard)/nakes/jadwal/page.tsx` | Memperbaiki ketidaksinkronan Jadwal Hari Ini vs Mingguan: tanggal seed relatif terhadap hari ini/besok, formatter lokal WIB `formatLocalIsoDate`, default kalender harian `todayIso`, label pekan dinamis (menghapus hardcode `12–18 Oktober 2026`), dropdown RS dinamis, dan tombol lompat cepat ke pekan jadwal terdekat. |
| 4 | 09:05 | `F3.1` | Dimodifikasi | `app/(dashboard)/pasien/rekam-medis/page.tsx`, `app/(dashboard)/pasien/rekam-medis/[recordId]/page.tsx`, `lib/actions/{consent,triage,faskes,ticket}.ts` | Menghapus seluruh definisi duplikat `parsePrescriptionDetail` dan `safeRevalidate` serta mengimpor dari modul tunggal. |
| 5 | 09:08 | `F3.3` | **Baru** | `app/api/health/route.ts` | Menambahkan endpoint REST `GET /api/health` yang menguji konektivitas PostgreSQL (`SELECT 1`) beserta metrik latensi (`200 OK` / `503 Service Unavailable`). |
| 6 | 09:08 | `F3.3` | **Baru** | `app/api/sync/outbox/route.ts` | Menambahkan endpoint REST `POST /api/sync/outbox` ber-guard `requireSession(["nakes", "staf", "admin"])` dengan validasi Zod v4, cek Kill-Switch `QUARANTINED`, verifikasi HKDF + AES-256-GCM + AAD + HMAC-SHA256, idempotensi, penyimpanan ke PostgreSQL, serta audit SIEM `WRITE_RME` / `HMAC_MISMATCH`. |
| 7 | 09:08 | `F3.3` | **Baru** | `app/api/attachments/route.ts` | Menambahkan endpoint REST `GET` & `POST /api/attachments` untuk penyimpanan & pengunduhan biner citra medis terenkripsi pada `medical_images` dengan Anti-BOLA `403`, validasi IV/HMAC, dan penegakan Kill-Switch. |
| 8 | 09:09 | `F3.4` | **Baru** | `public/manifest.json`, `public/icon.svg`, `components/shared/PwaRegistrar.tsx` | Menambahkan Web App Manifest standar W3C (`JagaMedis`), ikon SVG monokrom, dan komponen pendaftar Service Worker `/sw.js` yang meneruskan event `RESILIO_TRIGGER_OFFLINE_SYNC`. |
| 9 | 09:09 | `F3.4` | Dimodifikasi | `app/layout.tsx`, `public/sw.js`, `lib/storage/indexedDb.ts`, `components/shared/NetworkStatusBanner.tsx`, `app/(dashboard)/nakes/offline-sync/page.tsx` | Menautkan `manifest: "/manifest.json"` & `<PwaRegistrar />`; memutakhirkan cache SW `jagamedis-v0.3`; mendengarkan event nyata `online`/`offline` browser; mengganti antrean offline `localStorage` menjadi **IndexedDB nyata (`resilio_offline_db`)** + sinkronisasi ke **`POST /api/sync/outbox`**. |
| 10 | 09:11 | `F3.1` | **Baru** | `features/admin/{monitoring-actions,verification-actions}.ts`, `features/auth/{session-actions,kyc-actions,profile-actions}.ts`, `features/appointments/{booking-actions,workflow-actions}.ts` | Memecah *god files* `lib/actions/{admin,auth,appointment}.ts` (441–736 baris) menjadi 7 modul domain terfokus di `features/` dan menjadikan berkas `lib/actions/*.ts` sebagai barrel re-export tipis (13–20 baris). |
| 11 | 09:21 | `F3.1` | **Baru** | `features/medical-records/{helpers,exam-actions,record-actions,lookup-actions,patient-list-actions,addendum-actions}.ts` | Memecah *god file* terbesar `lib/actions/clinical.ts` (**1.820 baris $\rightarrow$ 28 baris**) menjadi 6 modul domain klinis di `features/medical-records/`. |
| 12 | 09:23 | `F3.2` | **Baru** | `features/dashboard/{queries.ts,BerandaClient.tsx}`, `features/appointments/{queries.ts,NakesDashboardClient.tsx}`, `features/medical-records/{queries.ts,PasienDashboardClient.tsx}` | Memigrasikan pembacaan data awal `/beranda`, `/nakes`, dan `/pasien` dari `useEffect` POST Server Action menjadi **Next.js 16 Server Components** yang memanggil Prisma langsung di server dibungkus `<Suspense>` (dan hanya mengambil statistik sesuai peran aktif). |
| 13 | 09:23 | `F3.1`/`F3.2` | Dimodifikasi | `app/(dashboard)/beranda/page.tsx`, `app/(dashboard)/nakes/page.tsx`, `app/(dashboard)/pasien/page.tsx` | Merampingkan ketiga rute utama menjadi Server Components tipis (**771 $\rightarrow$ 21 baris**, **391 $\rightarrow$ 21 baris**, **641 $\rightarrow$ 21 baris**). |
| 14 | 09:30 | `F3.1`/`F3.4` | **Baru** | `features/medical-records/exam/{StickyPatientBanner,ExamTabs1To3,ExamTabs4To5,ExamWorkspace}.tsx`, `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx` | Memecah `periksa/[bookingId]/page.tsx` (**1.437 $\rightarrow$ 11 baris**) menjadi 4 modul terpisah dan menghubungkan mode offline ruang periksa langsung ke **IndexedDB `saveToOutbox()`** + PWA Background Sync. |
| 15 | 09:31 | `F3.1` | **Baru** | `features/medical-records/patient-detail/{ClinicalActionModals,MedicalRecordItemCard,PatientDetailWorkspace}.tsx`, `app/(dashboard)/nakes/pasien-lookup/[patientId]/page.tsx` | Memecah `pasien-lookup/[patientId]/page.tsx` (**1.230 $\rightarrow$ 11 baris**) menjadi 3 modul terpisah dan menghapus fallback `localStorage` tidak aman yang sebelumnya menyetel `accessAllowed: true`. |
| 16 | 09:32 | `QA` | **Baru** | `tests/phase3-architecture-pwa.test.ts` | Menambahkan 4 skenario uji otomatis *Quality Gates* Fase 3 (kontrak REST `/api/health`, `/api/sync/outbox`, `/api/attachments` termasuk Anti-BOLA `403`, validitas PWA Manifest/SW, nol duplikasi `safeRevalidate`, dan sinkronisasi tanggal jadwal seed hari ini). |
| 17 | 09:46 | `Fix` | Dimodifikasi | `components/clinical/PrintableMedicalResume.tsx`, `app/globals.css` | Menghapus action bar duplikat di bagian bawah modal cetak (menyisakan 1 action bar sticky di atas) dan mengisolasi cetak khusus lembar dokumen rekam medis melalui `createPortal(..., document.body)` + `@media print` (`#jagamedis-print-portal`) agar UI dashboard/aplikasi tidak ikut tercetak. |

---

## 2. Perbandingan Ukuran Berkas Utama (Sebelum vs Sesudah `F3.1` & `F3.2`)

| Berkas Target | Sebelum Fase 3 | Sesudah Fase 3 | Keterangan |
| :--- | :---: | :---: | :--- |
| `lib/actions/clinical.ts` | 1.820 baris | **28 baris** | Dipecah ke 6 modul `features/medical-records/*` |
| `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx` | 1.437 baris | **11 baris** | Dipecah ke 4 komponen `features/medical-records/exam/*` |
| `app/(dashboard)/nakes/pasien-lookup/[patientId]/page.tsx` | 1.230 baris | **11 baris** | Dipecah ke 3 komponen `features/medical-records/patient-detail/*` |
| `app/(dashboard)/beranda/page.tsx` | 771 baris | **21 baris** | Server Component + `<Suspense>` (`features/dashboard/*`) |
| `lib/actions/auth.ts` | 736 baris | **20 baris** | Dipecah ke 3 modul `features/auth/*` |
| `lib/actions/appointment.ts` | 723 baris | **14 baris** | Dipecah ke 2 modul `features/appointments/*` |
| `app/(dashboard)/pasien/page.tsx` | 641 baris | **21 baris** | Server Component + `<Suspense>` (`features/medical-records/*`) |
| `lib/actions/admin.ts` | 441 baris | **13 baris** | Dipecah ke 2 modul `features/admin/*` |
| `app/(dashboard)/nakes/page.tsx` | 391 baris | **21 baris** | Server Component + `<Suspense>` (`features/appointments/*`) |

---

## 3. Hasil Verifikasi & Quality Gates Fase 3

| Indikator Uji | Standar Acuan | Perintah / Bukti Verifikasi | Hasil Riil | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Modularisasi & Deduplikasi (`F3.1`)** | ISO/IEC 25010 (Maintainability) | `tests/phase3-architecture-pwa.test.ts` (Test #4) + `wc -l` | **0 duplikasi** `safeRevalidate` / `parsePrescriptionDetail`; seluruh rute utama `app/` $\le$ 21 baris | **LULUS** |
| **Server Components (`F3.2`)** | Next.js 16 App Router & CWV | `npm run build` | `/beranda`, `/nakes`, dan `/pasien` terkompilasi sebagai Server Components (`ƒ`) dengan `<Suspense>` streaming langsung dari Prisma | **LULUS** |
| **4 Endpoint REST Strategis (`F3.3`)** | RESTful HTTP Standards | `tests/phase3-architecture-pwa.test.ts` (Test #1–#3) | `/api/health` (`200`), `/api/auth/session` (`200/401`), `/api/sync/outbox` (`401/422/201`), `/api/attachments` (`401/400/404/201/200/403`) lulus 100% | **LULUS** |
| **PWA Manifest, SW & IndexedDB (`F3.4`)** | W3C PWA & Background Sync | `tests/phase3-architecture-pwa.test.ts` (Test #4) | `manifest.json` & `icon.svg` valid, `sw.js` terdaftar di `app/layout.tsx`, antrean luring tersimpan di `resilio_offline_db` dan disinkronkan via `/api/sync/outbox` | **LULUS** |
| **Sinkronisasi Jadwal Harian & Mingguan** | Konsistensi UI Klinis | `tests/phase3-architecture-pwa.test.ts` (Test #4) | Seed jadwal sinkron dengan tanggal hari ini, kalender harian default `todayIso`, header pekan mingguan dinamis | **LULUS** |
| **Kompilasi, Uji, Linter & Build** | TypeScript / Vitest / ESLint / Next 16 | `npx tsc --noEmit && npx vitest run && npm run lint && npm run build` | **0 error TS**, **48/48 tes Vitest lulus (7 berkas)**, **0 error/warning ESLint**, **36/36 rute + `ƒ Proxy` sukses** | **LULUS** |
