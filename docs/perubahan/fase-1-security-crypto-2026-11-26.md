# Catatan Perubahan Fase 1 (`P0 — Kritis`): Keamanan Server-Side, Sesi Persisten & Kriptografi Nyata

> **Metadata Eksekusi**
> - **Proyek**: JagaMedis (Cryptographic Offline-First HIS & RME)
> - **Branch**: `refactor/fase-1-security-crypto`
> - **Tanggal Eksekusi**: Kamis, 26 November 2026
> - **Rentang Waktu**: `07:55 WIB` – `08:15 WIB` (UTC+7)
> - **Acuan Master Plan**: [audit_menyeluruh_jagamedis_22Nov2026.md](../audit/audit_menyeluruh_jagamedis_22Nov2026.md) (`F1.1` – `F1.4`)
> - **Migrasi Basis Data**: `prisma/migrations/20261126011004_add_persistent_sessions/migration.sql`
> - **Status Verifikasi**: **LULUS 100%** (`tsc`: 0 error, `vitest`: 40/40 lulus, `eslint`: 0 error/warning, `next build`: 33/33 rute + `Proxy`)

---

## 1. Matriks Kronologis Perubahan Berkas

| No | Waktu (WIB) | Tugas | Status | Jalur Berkas | Ringkasan Perubahan Teknis |
| :---: | :---: | :---: | :---: | :--- | :--- |
| 1 | 07:58 | `F1.1` | Dimodifikasi | `prisma/schema.prisma` | Menambahkan tabel ke-17 `Session` (`@@map("sessions")`) dengan FK `userId` (`onDelete: Cascade`), indeks `[userId, isRevoked]` & `[expiresAt]`, serta relasi `sessions Session[]` pada `User`. |
| 2 | 07:58 | `F1.1` | Dimodifikasi | `lib/auth/sessionStore.ts` | Meningkatkan store sesi dari RAM-only menjadi arsitektur L1 Write-Through Cache + L2 PostgreSQL persisten (`registerSessionAsync`, `getSessionFromStoreAsync`, `isSessionValidAsync`, `revokeSessionAsync`). |
| 3 | 07:58 | `F1.1` | **Baru** | `features/auth/guard.ts` | Membuat guard otorisasi server-side terpusat (`requireSession(allowedRoles)`, `getAuthenticatedSession`, `recordSecurityAuditBestEffort`) yang memverifikasi cookie HTTP-Only ke tabel `sessions` dan mencatat `IDOR_BLOCKED` otomatis. |
| 4 | 07:58 | `F1.1` | **Baru** | `proxy.ts` | Memasang network boundary guard resmi Next.js 16 (pengganti `middleware.ts` yang deprecated) untuk memproteksi rute `/beranda`, `/pasien`, `/staf`, `/nakes`, dan `/admin` berdasarkan keberadaan cookie HTTP-Only `resilio_session_token`. |
| 5 | 07:58 | `F1.1` | Dimodifikasi | `app/api/auth/session/route.ts` | Menyamakan `POST /api/auth/session` ke PostgreSQL Prisma + 100% `bcrypt.compare`, menyimpan sesi persisten, dan memperbarui `GET` & `DELETE` agar memvalidasi/mencabut token di tabel `sessions` serta mengembalikan objek `session` terverifikasi. |
| 6 | 07:58 | `F1.4` | Dimodifikasi | `next.config.ts` | Menambahkan HTTP Security Headers (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control`). |
| 7 | 07:59 | `F1.1` | Dimodifikasi | `lib/auth/auth.ts` | Menghapus celah eskalasi hak akses via cookie non-HttpOnly `resilio_user_role` di `getUserSession()`, dan menambahkan `syncSessionFromServer()` yang memverifikasi sesi melalui `GET /api/auth/session`. |
| 8 | 07:59 | `F1.1` | Dimodifikasi | `app/(dashboard)/layout.tsx` | Mengubah pemulihan sesi klien agar memverifikasi terhadap `syncSessionFromServer()` (dengan fallback offline-first hanya saat server tak terjangkau), serta mencatat insiden `IDOR_BLOCKED` nyata ke SIEM saat akses rute ditolak. |
| 9 | 07:59 | `F1.1` | Dimodifikasi | `app/(auth)/login/page.tsx` | Menghapus fallback login lokal klien `loginUser()` pada tombol Quick Demo sehingga seluruh autentikasi wajib melewati `loginServerAction` dan menerima cookie HTTP-Only persisten. |
| 10 | 07:59 | `F1.3` | Dimodifikasi | `lib/crypto/hmac.ts` | Mengganti perbandingan string `===` dengan verifikasi *constant-time* W3C Web Crypto `crypto.subtle.verify("HMAC", ...)` untuk mitigasi *Timing Attack* (CWE-208 / NIST SP 800-107). |
| 11 | 08:00 | `F1.3` | Dimodifikasi | `lib/crypto/aes.ts` | Menghapus *key reuse* pada `encryptBinaryAttachment` & `decryptBinaryAttachment` dengan menurunkan sub-kunci terpisah via `deriveSubKeysHKDF` (NIST SP 800-57) serta menambahkan `verifyBinaryAttachmentHMAC`. |
| 12 | 08:00 | `F1.3` | **Baru** | `features/medical-records/crypto-service.ts` | Membuat layanan kriptografi RME terpusat dengan format `CanonicalSoapPayload`, AAD deterministik (`PATIENT:{id}|RECORD:{id}|V:{v}`), `encryptMedicalRecordPayload` (HKDF + AES-256-GCM + AAD + HMAC), dan `decryptMedicalRecordPayload` (*Fail-Closed* murni). |
| 13 | 08:01 | `F1.2` | Dimodifikasi | `lib/validations/triage.ts` | Memperketat `AssignDpjpSchema` sehingga `inputPin` wajib diisi tepat 6 digit angka (menghapus `.optional().or(z.literal(""))`). |
| 14 | 08:01 | `F1.2` | Dimodifikasi | `lib/actions/faskes.ts` | Memasang `requireSession(["admin"])` pada `toggleFaskesKillSwitchServerAction` dan mencatat log audit `QUARANTINE_FASKES`. |
| 15 | 08:01 | `F1.2` | Dimodifikasi | `lib/actions/consent.ts` | Memasang `requireSession` & verifikasi kepemilikan `patientId === session.id` pada seluruh aksi consent (get, grant, revoke, extend, delete) + pencatatan `REVOKE_CONSENT` & `IDOR_BLOCKED`. |
| 16 | 08:01 | `F1.2` | Dimodifikasi | `lib/actions/triage.ts` | Memasang `requireSession(["staf", "nakes", "admin"])`, menurunkan `staffId` dari sesi server, dan mencatat `CHECK_IN_TRIAGE`. |
| 17 | 08:01 | `F1.2` | Dimodifikasi | `lib/actions/ticket.ts` | Memasang `requireSession`, mengunci `reporterId`/`reporterName`/`reporterRole` dari sesi server, membatasi daftar tiket non-admin hanya milik sendiri, dan membatasi `resolveTroubleTicketServerAction` khusus `admin`. |
| 18 | 08:01 | `F1.2` | Dimodifikasi | `lib/actions/audit.ts` | Memasang `requireSession` pada `getPatientAuditLogsServerAction` & `createAuditLogServerAction` serta mengunci identitas aktor log SIEM dari sesi server. |
| 19 | 08:02 | `F1.1`/`F1.2` | Dimodifikasi | `lib/actions/auth.ts` | Menghapus seluruh cabang perbandingan password plaintext & fallback `DEMO_USERS` (100% `bcrypt.compare`), menyimpan sesi ke PostgreSQL, serta memasang `requireSession` & cek kepemilikan BOLA pada aksi KYC dan profil pasien. |
| 20 | 08:03 | `F1.2` | Dimodifikasi | `lib/actions/appointment.ts` | Memasang `requireSession` + scoping peran pada semua aksi antrean, menutup bypass PIN kosong pada `assignDpjpServerAction`, menyembunyikan `consentPin` dari peran non-pasien, cek kepemilikan reschedule/hapus, dan blokir booking pada faskes `QUARANTINED`. |
| 21 | 08:04 | `F1.2`/`F1.3` | Dimodifikasi | `lib/actions/clinical.ts` | Memasang `requireSession` pada semua 10 aksi klinis; menghapus bypass `|| "DOC-01"`, menambahkan cek `validUntil > now`, masking NIK di server, menyembunyikan PII/`encryptionKeyHex` saat akses ditolak; mengganti Base64/Hex plaintext & IV/HMAC statis menjadi enkripsi nyata HKDF+AEAD+AAD dan sistem Addendum immutable pada tambah resep/lab/tindakan. |
| 22 | 08:05 | `F1.3` | Dimodifikasi | `prisma/seed.ts` | Memperbarui seeder RME agar seluruh data seed `medical_records` dienkripsi menggunakan `encryptMedicalRecordPayload` (HKDF + AES-256-GCM + AAD + HMAC-SHA256) asli. |
| 23 | 08:06–08:09 | `F1.2`/`F1.3` | Dimodifikasi | `app/(dashboard)/{nakes/periksa/[bookingId], nakes/pasien-lookup/page, nakes/pasien-lookup/[patientId], pasien/rekam-medis/page, pasien/rekam-medis/[recordId], pasien/consent, pasien/tiket-kendala, pasien/page, staf/assign-dpjp, beranda, admin/verifikasi-kyc}/page.tsx` | Menghapus seluruh hardcoded encryption key, menghapus fallback data medis palsu (`120/80`, `Amlodipine`), menerapkan dekripsi *Fail-Closed* dengan alert tamper + log `HMAC_MISMATCH`, menghapus kebocoran PIN di placeholder Assign DPJP, menghapus kebocoran `P-101`, dan membatasi pemanggilan statistik dokter di `/beranda` sesuai peran. |
| 24 | 08:09–08:13 | `QA` | **Baru** | `tests/phase1-security-crypto.test.ts`, `vitest.config.ts`, `prisma/migrations/20261126011004_add_persistent_sessions/migration.sql` | Menambahkan 7 skenario uji otomatis Quality Gates Fase 1, konfigurasi alias `@/` untuk Vitest, dan berkas migrasi SQL tabel `sessions`. |

---

## 2. Catatan Arsitektural Khusus Next.js 16

- Pada dokumen audit awal tertulis `middleware.ts`, namun berdasarkan dokumentasi resmi `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` pada **Next.js 16.3.6**, konvensi `middleware.ts` telah berstatus *deprecated* dan digantikan oleh **`proxy.ts`** dengan ekspor fungsi `export function proxy(request: NextRequest)`.
- Implementasi telah menggunakan **`proxy.ts`** dan terkonfirmasi aktif pada output `npm run build` (`ƒ Proxy (Middleware)`).

---

## 3. Hasil Verifikasi & Quality Gates Fase 1

| Indikator Uji | Standar Acuan | Perintah / Bukti Verifikasi | Hasil Riil | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Migrasi & Seeding DB** | PostgreSQL 17 / Prisma 7 | `npx prisma migrate dev --name add_persistent_sessions && npx tsx prisma/seed.ts` | Migrasi `20261126011004_add_persistent_sessions` diterapkan; seluruh seed RME terenkripsi HKDF+AEAD+AAD | **LULUS** |
| **Kompilasi Tipe Statis** | TypeScript Strict | `npx tsc --noEmit` | **0 error** | **LULUS** |
| **Otorisasi Server Actions (Anti-BOLA)** | OWASP ASVS V4.1.1, V4.2.1 & API1:2023 | `tests/phase1-security-crypto.test.ts` (Test #2) | `toggleFaskesKillSwitch`, `approveKyc`, `revokeAccess`, `getSingleMedicalRecord` 100% ditolak (`401`) tanpa sesi | **LULUS** |
| **Sesi Persisten & Anti-Cookie Escalation** | OWASP ASVS V3.2, V3.4 & NIST SP 800-63B | `tests/phase1-security-crypto.test.ts` (Test #1) | Sesi bertahan di tabel `sessions` saat RAM cache dihapus & hangus setelah logout; cookie `resilio_user_role` tidak lagi dipercaya | **LULUS** |
| **Penegakan PIN 6-Digit** | OWASP ASVS V2.1 | `tests/phase1-security-crypto.test.ts` (Test #3) | `inputPin` kosong, hilang, atau < 6 digit ditolak ketat oleh `AssignDpjpSchema` & `assignDpjpServerAction` | **LULUS** |
| **Kriptografi AEAD + HKDF + AAD** | NIST SP 800-38D, SP 800-57, RFC 5869 | `tests/phase1-security-crypto.test.ts` (Test #4 & #6) + `tests/crypto.test.ts` | 2 enkripsi menghasilkan IV 96-bit berbeda; bukan Base64/Hex JSON; AAD pasien lain ditolak; biner memakai sub-kunci HKDF terpisah | **LULUS** |
| ***Fail-Closed* & Anti-Timing** | ISO 27799 & CWE-208 (NIST SP 800-107) | `tests/phase1-security-crypto.test.ts` (Test #5 & #6) | Tamper 1 byte / static IV / empty HMAC ditolak (`HMAC_MISMATCH` / `INVALID_FORMAT`); `crypto.subtle.verify` aktif; 0 data palsu tampil | **LULUS** |
| **HTTP Security Headers** | OWASP Secure Headers | `tests/phase1-security-crypto.test.ts` (Test #7) | `CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` terpasang di `next.config.ts` | **LULUS** |
| **Regresi Unit & Integrasi** | ISO/IEC 25010 | `npx vitest run` | **5 berkas tes, 40/40 lulus (100%)** | **LULUS** |
| **Linter & Build Produksi** | ESLint 9 / Next.js 16 | `npm run lint && npm run build` | **0 error, 0 warning**; **33/33 rute + `ƒ Proxy (Middleware)`** sukses | **LULUS** |
