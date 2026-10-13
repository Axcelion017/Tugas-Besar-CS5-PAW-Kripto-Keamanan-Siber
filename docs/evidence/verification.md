# Laporan Verifikasi & Pengujian — Milestone 1 (v0.1)

Dokumen ini mencatat bukti verifikasi pengujian antarmuka, aksesibilitas, dan komponen kriptografi Resilio-Health.

## 1. Verifikasi Aksesibilitas (Lighthouse Audit)
- **Halaman yang Diuji**: `http://localhost:3000/beranda` (Tampilan Dokter, Pasien, Admin)
- **Mode Pengujian**: Navigation Mode
- **Perangkat**: Mobile Emulation (412 x 823 px) & Desktop
- **Versi Chrome**: Chrome 136+ (Axe-core 4.12.1)
- **Hasil Skor Accessibility**: **92 / 100** (Memenuhi kriteria minimal 85)
- **Perbaikan yang Diterapkan**:
  - Penyesuaian rasio kontras teks WCAG AA (`text-slate-600` dan `text-red-700`).
  - Penambahan asosiasi eksplisit `htmlFor` dan `id` pada seluruh elemen form.
  - Perbaikan hierarki heading (`h1` -> `h2`).

## 2. Verifikasi Formulir & Validasi Sisi Klien (Client-Side Validation)
- **Formulir**: Formulir Pemeriksaan & Diagnosa Klinis Dokter (`DokterView.tsx`).
- **Aturan Validasi**:
  - Keluhan, Diagnosa, dan Resep wajib diisi (`required`).
  - Nilai Tanda Vital (Sistolik, Diastolik, Suhu, Nadi) divalidasi tipe dan range numerik.
  - Pemblokiran akses Zero-Trust jika dokter belum ditugaskan ke pasien.
- **Hasil**: Form menolak penyimpanan data jika input tidak valid sebelum fungsi enkripsi dipanggil.

## 3. Verifikasi Pengujian Kriptografi (Vitest)
- **Perintah**: `npx vitest run`
- **Hasil**: 4 passed (100%)
  - Uji Positif: Enkripsi & dekripsi AES-256-GCM valid.
  - Uji Positif: Integritas HMAC-SHA256 valid.
  - Uji Negatif: Modifikasi ciphertext menggagalkan verifikasi HMAC (`false`).
  - Uji Batas: IV korup memicu penolakan aman / *fail-closed* (`throws error`).