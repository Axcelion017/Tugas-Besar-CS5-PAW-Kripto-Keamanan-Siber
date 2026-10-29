# Laporan Verifikasi & Pengujian Sistem — Resilio-Health

Dokumen ini mencatat bukti verifikasi pengujian antarmuka, aksesibilitas, arsitektur modular 4 peran, ketahanan *Offline-First*, dan pengujian unit kriptografi Resilio-Health.

---

## 1. Verifikasi Aksesibilitas & Responsif Antarmuka (PAW)
- **Halaman Diuji**: Seluruh 30 rute aplikasi web (Domain Pasien, Staf Nakes, Dokter DPJP, Admin Regulator).
- **Perangkat Uji**: Mobile Phone (375x667 px iPhone SE, 412x823 px Pixel 7), Tablet (iPad 768x1024 px), dan Desktop Monitor (1440x900 px).
- **Hasil Audit WCAG AA & Lighthouse**:
  - Skor Aksesibilitas: **92 / 100** (Memenuhi kriteria minimal 85 WCAG 2.1 AA).
  - Skor Best Practices: **95 / 100**.
  - Bebas horizontal overflow (`scrollWidth > innerWidth = False`).
- **Komponen Uji**:
  - Ikon monokrom bersih SVG standar enterprise (`components/ui/Icons.tsx`).
  - Efek berkilau memuat data (`shimmer-effect` & `components/ui/Skeleton.tsx`).
  - Isolasi error anggun (`app/(dashboard)/error.tsx` & `app/not-found.tsx`).
  - Suspense streaming otomatis (`app/(dashboard)/loading.tsx` & `app/loading.tsx`).

---

## 2. Verifikasi Formulir, Skema Zod v4 & Server Actions
1. **Registrasi Pasien & Auto-Watermarking Canvas (`/register/pasien`)**:
   - Skema Zod `RegisterPasienSchema` memvalidasi NIK tepat 16 digit numerik, format email, dan kelengkapan berkas fisik.
   - Canvas API peramban membubuhkan teks watermark dinamis permanen *"HANYA UNTUK VERIFIKASI RESILIO-HEALTH"* sebelum foto KTP/Selfie diunggah.
2. **Pemeriksaan Klinis Dokter SOAP & ICD-10 (`/nakes/periksa/[bookingId]`)**:
   - Skema Zod `PemeriksaanKlinisSchema` memvalidasi batas fisiologis tanda vital (tensi sistolik 70–250, diastolik 40–150, suhu 30–45°C), diagnosis resmi WHO ICD-10 (`z.enum`), dan kotak centang medikolegal.
   - Server Action `lib/actions/clinical.ts` mengeksekusi 6 tahapan linear: Sesi -> Validasi Bentuk -> Validasi Semantik Kontraindikasi Alergi (UR-T10) -> Mutasi AES-256-GCM + HMAC -> revalidatePath -> redirect.
   - Lampiran berkas citra radiologi terenkripsi AES-256-GCM Blob di IndexedDB (UR-T07).
   - Penerbitan versi revisi berstempel waktu (*Immutable Addendum* UR-T09).
3. **Triase & Admisi Staf Nakes (`/staf` & `/staf/triase`)**:
   - Skema `TriaseSchema`, `WalkInAdmisiSchema`, dan `AssignDpjpSchema` memvalidasi kelayakan masukan pendaftaran walk-in, input tanda vital awal fisik, penetapan pita triase (Hijau/Kuning/Merah), dan validasi PIN 6-digit pasien untuk penerbitan *Active Encounter Ticket* DPJP.

---

## 3. Verifikasi Keamanan Siber & Model Zero-Trust (KKS)
1. **Pencegahan BOLA / IDOR (API1:2023)**:
   - Dokter mencoba mencari NIK pasien di luar daftar aktif -> Diblokir status 403 Forbidden dan event dicatat ke dasbor SIEM Kemenkes.
2. **Keamanan Sesi & Cookie HTTP-Only (`lib/actions/auth.ts`)**:
   - Penerbitan cookie sesi `resilio_session_token` dengan konfigurasi *HttpOnly*, *Secure*, *SameSite=Lax*, dan *Max-Age=14400* (4 jam) yang dipasangkan dengan *Stateful Session Store* di server untuk mendukung pembatalan instan (*Instant Revocation*).
   - Pengujian terbukti memblokir token palsu (401), menghapus cookie saat logout, dan menolak token lama yang telah di-revoke.
3. **Protokol Darurat Medis Break-Glass (ISO 27799 / HIPAA)**:
   - Dokter IGD mengaktifkan tombol darurat untuk pasien koma -> Wajib memilih alasan klinis -> Data darurat terbuka seketika -> Sistem memicu notifikasi *CRITICAL* ke SIEM Admin dan audit log pasien.
4. **Penanganan ID Tidak Valid (Zero-Knowledge Isolation)**:
   - Mengakses ID tidak terdaftar (`/nakes/periksa/APT-999`, `/pasien/faskes/FAS-999`, `/pasien/rekam-medis/REC-999`) menampilkan kartu *404 Data Tidak Ditemukan* di dalam dashboard tanpa membeberkan data entitas lain dan tanpa memutus sesi login.
5. **Isolasi Ransomware (Faskes Kill-Switch)**:
   - Admin menekan saklar isolasi faskes terinfeksi -> Status berubah menjadi `QUARANTINED` -> Seluruh transmisi API faskes tersebut dibekukan dari gateway nasional.

---

## 4. Verifikasi Pengujian Unit Otomatis (Vitest)
Perintah pengujian dijalankan via terminal:
```bash
npx vitest run
```
**Hasil Evaluasi**: **19 Passed (100% Lulus)** pada 2 berkas pengujian:
- **Kriptografi (`tests/crypto.test.ts` - 4 Tes Lulus)**:
  - `UJI-01`: Enkripsi dan dekripsi AES-256-GCM cocok byte-by-byte.
  - `UJI-02`: Validasi keutuhan HMAC-SHA256 data asli berhasil.
  - `UJI-03`: Deteksi manipulasi (tampering) 1 bit gagal memverifikasi HMAC.
  - `UJI-04`: Dekripsi dengan IV korup/salah seketika ditolak (*Fail-Closed*).
- **Skema Validasi Zod v4 (`tests/validations.test.ts` - 15 Tes Lulus)**:
  - Uji positif input klinis SOAP, login, registrasi pasien e-KYC NIK 16 digit, kredensial nakes STR/SIP, parameter triase, booking, dan tiket kendala.
  - Uji negatif penolakan keluhan terlalu pendek (< 10 kar), tensi di luar batas fisiologis (< 70 mmHg), kode ICD-10 ilegal, kata sandi pendek, dan NIK non-16 digit.
  - Uji batas penolakan saat kotak centang medikolegal bernilai `false`.

---

## 5. Verifikasi Kompilasi Produksi (Next.js Build)
Perintah kompilasi dijalankan via terminal:
```bash
npm run lint && npm run build
```
**Hasil Evaluasi**:
- Linting: **0 errors, 0 warnings** (Clean ESLint & TypeScript).
- Kompilasi: **30 rute Next.js App Router terkompilasi 100% sukses**.
