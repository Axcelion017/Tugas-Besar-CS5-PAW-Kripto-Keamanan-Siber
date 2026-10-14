# Matriks Keterlacakan Antarmata Kuliah — Resilio-Health

Dokumen ini memetakan benang merah keterhubungan antara **Kebutuhan Pengguna (PAW)**, **Fondasi Kriptografi (Kriptografi)**, serta **Model Ancaman & Kontrol Risiko (Keamanan Komputasi dan Siber)** untuk menjamin konsistensi pengembangan produk terpadu sepanjang semester.

---

## 1. Matriks Keterlacakan Komprehensif (Traceability Matrix)

| ID Kebutuhan (PAW) | Deskripsi Fitur Produk | Ancaman STRIDE Terkait (KKS) | Risiko Prioritas (KKS) | Solusi Kriptografi (Kripto) | Komponen Kode Implementasi | Bukti Verifikasi Uji |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-01** & **REQ-02** | Login Multi-Peran & Dynamic Hub `/beranda` | **THR-01 (Spoofing)**: Peniruan akun dokter/pasien. | **RSK-05**: Pembajakan sesi pengguna. | Isolasi token sesi peran berbasis memori runtime. | `app/page.tsx`, `lib/auth/auth.ts`, `app/beranda/page.tsx` | Skenario Login & Guard test di `verification.md` |
| **REQ-03** | Form Input Klinis & Validasi Client-side | **THR-05 (DoS)**: Injeksi masukan teks berukuran abnormal / rusak. | **RSK-02**: Kesalahan data medis fatal. | Sanitasi masukan sebelum payload dienkripsi. | `DokterView.tsx`, `components/ui/InputField.tsx` | Kasus Uji Formulir VAL-01 s.d. VAL-04 |
| **REQ-04** | Protokol Pembatasan Penugasan Bangsal | **THR-06 (Elevation of Privilege)**: Dokter mengakses pasien tidak sah. | **RSK-03**: Akses tidak sah ke berkas rahasia medis. | Kontrol akses Zero-Trust: Kunci pasien hanya diberikan ke dokter bertugas. | `DokterView.tsx` (`hasAccess` guard) | Kasus Uji VAL-03 (Lockout panel) |
| **REQ-06** | Portal Pasien Mandiri & Dekripsi On-Demand | **THR-04 (Information Disclosure)**: Kebocoran riwayat penyakit oleh admin/cloud. | **RSK-01**: Kebocoran rekam medis (EHR). | **AES-256-GCM** (Kunci 256-bit, IV 96-bit unik CSPRNG). | `lib/crypto/aes.ts`, `PasienView.tsx` | Uji Vitest UJI-01 (Enkripsi/Dekripsi valid) |
| **REQ-07** | Deteksi Integritas & Simulasi Manipulasi Data | **THR-02 (Tampering)**: Modifikasi ciphertext di penyimpanan lokal. | **RSK-02**: Kerusakan data klinis akibat manipulasi bit. | **HMAC-SHA256**: Pencocokan digest sebelum dekripsi (Fail-Closed). | `lib/crypto/hmac.ts`, `AdminView.tsx` | Uji Vitest UJI-02 & UJI-03 (Deteksi Tamper) |
| **REQ-08** & **REQ-09** | Responsivitas Antarmuka & Aksesibilitas WCAG AA | **THR-05 (DoS/Usability Failure)**: Antarmuka rusak pada layar ponsel darurat. | - | HTML semantik, kontras warna $\ge 4.5:1$, dan binding form label eksplisit. | `app/layout.tsx`, Tailwind Breakpoint, `globals.css` | Audit Lighthouse A11y Skor 95/100 |

---

## 2. Pemetaan Milestone Sepanjang Semester

| Tahapan Evaluasi | Mata Kuliah PAW | Mata Kuliah Kriptografi | Mata Kuliah KKS | Penanda Rilis Git |
| :--- | :--- | :--- | :--- | :---: |
| **Pekan 3 (Milestone 1)** | Antarmuka Responsif & Aksesibel, Form Validasi, Mock Data | Kebutuhan Kripto, AES-GCM + HMAC, $\ge 4$ Unit Test Vitest | Asset Inventory, DFD 2 Trust Boundary, STRIDE, Risk Register | `v0.1` & `sec-0.1` |
| **Pekan 6 (Milestone 2)** | Integrasi Logika Server, Database Prisma, Migrasi & Seed Sintetis | Pengikatan Kunci ke Basis Data, AEAD pada Data Riil Produk | Kontrol Mitigasi SQLi/XSS, Penguatan Session Management | `v0.2` & `sec-0.2` |
| **Pekan 13 (Milestone 3)** | Spesifikasi OpenAPI (`openapi.yaml`), Route Handlers Lengkap | Alur Kunci Publik (Asimetris / KEM / Tandatangan Digital) | Laporan Penetrasi Keamanan (OWASP), Bukti Otomatisasi CI/CD | `v0.3` & `sec-0.3` |
| **Pekan 16 (Final Project)** | Rilis Aplikasi Penuh Bersama, Evaluasi Kualitas Perangkat Lunak | Evaluasi Kinerja Kriptografi, Bukti Ketahanan Terhadap Serangan | Evaluasi Keamanan Komprehensif, Bukti Pengajuan Ciptaan | `v1.0` |