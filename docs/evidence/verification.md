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

## 2. Verifikasi Formulir & Validasi Sisi Klien (Client-Side Validation)
1. **Registrasi Pasien & Auto-Watermarking Canvas (`/register/pasien`)**:
   - Validasi NIK tepat 16 digit numerik.
   - Canvas API peramban membubuhkan teks watermark dinamis permanen *"HANYA UNTUK VERIFIKASI RESILIO-HEALTH"* sebelum foto KTP/Selfie diunggah.
2. **Pemeriksaan Klinis Dokter SOAP & ICD-10 (`/nakes/periksa/[bookingId]`)**:
   - Validasi rentang nilai fisiologis tanda vital (Tensi sistolik/diastolik, suhu, nadi, SpO2).
   - Real-time text match alergen pasien saat pengetikan resep obat (UR-T10).
   - Lampiran berkas citra radiologi terenkripsi AES-256-GCM Blob di IndexedDB (UR-T07).
   - Penerbitan versi revisi berstempel waktu (*Immutable Addendum* UR-T09).
3. **Triase & Admisi Staf Nakes (`/staf` & `/staf/triase`)**:
   - Pendaftaran walk-in, input tanda vital awal fisik, penetapan pita triase (Hijau/Kuning/Merah).
   - Validasi PIN 6-digit pasien untuk penerbitan *Active Encounter Ticket* DPJP.

---

## 3. Verifikasi Keamanan Siber & Model Zero-Trust (KKS)
1. **Pencegahan BOLA / IDOR (API1:2023)**:
   - Dokter mencoba mencari NIK pasien di luar daftar aktif -> Diblokir status 403 Forbidden dan event dicatat ke dasbor SIEM Kemenkes.
2. **Protokol Darurat Medis Break-Glass (ISO 27799 / HIPAA)**:
   - Dokter IGD mengaktifkan tombol darurat untuk pasien koma -> Wajib memilih alasan klinis -> Data darurat terbuka seketika -> Sistem memicu notifikasi *CRITICAL* ke SIEM Admin dan audit log pasien.
3. **Penanganan ID Tidak Valid (Zero-Knowledge Isolation)**:
   - Mengakses ID tidak terdaftar (`/nakes/periksa/APT-999`, `/pasien/faskes/FAS-999`, `/pasien/rekam-medis/REC-999`) menampilkan kartu *404 Data Tidak Ditemukan* di dalam dashboard tanpa membeberkan data entitas lain dan tanpa memutus sesi login.
4. **Isolasi Ransomware (Faskes Kill-Switch)**:
   - Admin menekan saklar isolasi faskes terinfeksi -> Status berubah menjadi `QUARANTINED` -> Seluruh transmisi API faskes tersebut dibekukan dari gateway nasional.

---

## 4. Verifikasi Pengujian Unit Kriptografi (Vitest)
Perintah pengujian dijalankan via terminal:
```bash
npx vitest run
```
**Hasil Evaluasi**: 4 Passed (100% Lulus)
- **UJI-01 (AES-256-GCM Positive)**: Enkripsi dan dekripsi payload klinis SOAP menghasilkan plaintext yang identik persis dengan input asli.
- **UJI-02 (HMAC-SHA256 Positive)**: Tag integritas yang dibangkitkan cocok 100% dengan kunci rahasia simetris.
- **UJI-03 (Tamper Detection Negative)**: Modifikasi 1 bit pada string ciphertext terdeteksi seketika; fungsi `verifyHMAC` mengembalikan nilai `false`.
- **UJI-04 (Boundary Fail-Closed)**: Dekripsi dengan IV atau tag korup ditolak secara aman oleh Web Crypto API (*throws error Fail-Closed*).

---

## 5. Verifikasi Kompilasi Produksi (Next.js Build)
Perintah kompilasi dijalankan via terminal:
```bash
npm run lint && npm run build
```
**Hasil Evaluasi**:
- Linting: **0 errors, 0 warnings** (Clean ESLint & TypeScript).
- Kompilasi: **30 rute Next.js App Router terkompilasi 100% sukses**.
