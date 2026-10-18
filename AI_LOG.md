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
