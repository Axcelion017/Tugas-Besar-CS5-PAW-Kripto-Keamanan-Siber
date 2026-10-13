# AI_LOG.md — Resilio-Health

Dokumen pencatatan penggunaan asisten kecerdasan buatan (AI) sesuai kebijakan integritas akademik.

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