# Resilio-Health — Hospital Information System (HIS)

Resilio-Health adalah sistem informasi rekam medis rumah sakit berbasis web yang mengintegrasikan antarmuka responsif dan aksesibel, protokol pengawasan otorisasi *Zero-Trust*, serta perlindungan kerahasiaan dan integritas data klinis *end-to-end* menggunakan Web Crypto API standar W3C.

Repositori ini digunakan secara berkelanjutan sepanjang semester untuk tiga mata kuliah terintegrasi:
1. **Pengembangan Aplikasi Web (PAW)** — Milestone 1: Antarmuka Web Responsif dan Aksesibel (Tag: `v0.1`)
2. **Kriptografi** — Tugas 1: Fondasi dan Komponen Dasar Kriptografi (Tag: `v0.1`)
3. **Keamanan Komputasi dan Siber (KKS)** — Tugas 1: Threat Modeling dan Analisis Risiko Produk (Penanda: `sec-0.1`)

---

## 1. Konsep Produk & Permasalahan yang Diselesaikan

### 1.1 Latar Belakang & Permasalahan
Sistem Informasi Manajemen Rumah Sakit (SIMRS) konvensional kerap menyimpan data klinis pasien dalam bentuk teks terang (*plaintext*) pada basis data terpusat. Hal ini menimbulkan kerentanan kebocoran riwayat penyakit oleh pihak internal/penyedia *cloud* (*Information Disclosure*) serta risiko manipulasi dosis rekam medis (*Data Tampering*).

### 1.2 Solusi Resilio-Health
Resilio-Health menyelesaikan permasalahan tersebut dengan:
- **Zero-Knowledge Storage**: Seluruh rekam medis klinis (keluhan, diagnosa, dan resep) dienkripsi di peramban menggunakan kunci unik pasien sebelum disimpan (*client-side encryption*).
- **Zero-Trust Access Control**: Dokter hanya dapat memasukkan catatan medis ke pasien yang telah ditugaskan secara resmi oleh Administrator bangsal.
- **Deteksi Pemalsuan Integritas**: Penerapan HMAC-SHA256 mendeteksi manipulasi data sekecil 1 bit pada media penyimpanan lokal.

---

## 2. Arsitektur Antarmuka & Peran Pengguna (Role-Based Hub)

Sistem menggunakan gerbang terpadu pada rute `/beranda` yang secara dinamis menampilkan antarmuka spesifik sesuai sesi akun pengguna:

- **1. Stasiun Kerja Dokter (`DokterView.tsx`)**:
  - Pilihan pasien bangsal yang ditugaskan.
  - Formulir input klinis dengan validasi sisi klien (*client-side validation*) untuk keluhan, tanda vital, diagnosa, dan resep.
  - Enkripsi otomatis AES-256-GCM dan pembangkitan HMAC-SHA256 digest.
  - Visualisasi grafik fluktuasi tekanan darah (sistolik/diastolik) pasien.
- **2. Portal Mandiri Pasien (`PasienView.tsx`)**:
  - Tampilan riwayat rekam medis pribadi pasien yang sedang login.
  - Fitur dekripsi *on-demand* menggunakan kunci privat pasien.
  - Indikator validasi integritas HMAC data rekam medis.
- **3. Dasbor Administrator (`AdminView.tsx`)**:
  - Manajemen delegasi penugasan dokter terhadap pasien bangsal (Zero-Trust Gatekeeper).
  - Simulasi pengujian integritas kriptografi (*Tamper Simulation*) untuk menguji ketahanan deteksi manipulasi data.
  - Audit log sistem.

### Komponen Reusable Bertipe (`components/ui/`)
1. **`StatCard`**: Kartu ringkasan metrik statistik dengan props bertipe.
2. **`InputField`**: Input formulir aksesibel yang terikat dengan pesan galat validasi.
3. **`StatusBadge`**: Indikator status peran, otorisasi, dan validitas integritas.
4. **`TopHeader`**: Bilah navigasi atas responsif dengan kartu identitas pengguna aktif.
5. **`LogoutModal`**: Dialog konfirmasi keluar sistem aksesibel tanpa popup peramban *native*.

---

## 3. Spesifikasi & Kebutuhan Kriptografi Produk

### 3.1 Tabel Kebutuhan Kriptografi Produk

| Data Produk | Kebutuhan / Ancaman | Tujuan Keamanan | Algoritma Terpilih | Prioritas |
| :--- | :--- | :--- | :--- | :---: |
| **Keluhan, Diagnosa, Resep (EHR)** | Kebocoran data rekam medis oleh admin/perantara | Kerahasiaan (*Confidentiality*) | **AES-256-GCM** (NIST SP 800-38D) | **Kritis** |
| **Ciphertext Rekam Medis** | Pemalsuan riwayat medis / malpraktik dosis | Keutuhan (*Integrity & Authenticity*) | **HMAC-SHA256** (RFC 2104) | **Kritis** |
| **Hak Penugasan Dokter-Pasien** | Peniruan identitas dokter bangsal lain | Otentikasi Akses (*Authorization*) | **Zero-Trust Role Guard** | **Tinggi** |

### 3.2 Rancangan Komponen Kriptografi
- **Masukan**: Plaintext objek rekam medis format JSON string + Kunci 256-bit Hexadecimal unik per pasien.
- **Proses**:
  1. Pembangkitan *Initialization Vector* (IV) 96-bit (12 bytes) acak kriptografis menggunakan CSPRNG `window.crypto.getRandomValues()`.
  2. Enkripsi Galois/Counter Mode (AES-GCM) dengan otentikasi tag bawaan 128-bit.
  3. Kalkulasi *Keyed-Hash Message Authentication Code* (HMAC-SHA256) atas string *ciphertext*.
- **Keluaran**: Rekam data aman `{ ciphertext: hex, iv: hex, hmacDigest: hex, timestamp: string }`.
- **Representasi Data**: Heksadesimal (*Hex String*, 64 karakter untuk kunci 256-bit dan 24 karakter untuk IV 96-bit).
- **Prinsip Keamanan**: *Fail-Closed* — dekripsi ditolak secara aman jika digest HMAC tidak valid atau IV korup.

---

## 4. Akun Pengujian Sintetis (Demo Login)

Aplikasi menyediakan tombol *Quick Demo* pada halaman login (`/`) untuk mempermudah evaluasi:

| Peran | Username | Password | Deskripsi Aksesibilitas Peran |
| :--- | :--- | :--- | :--- |
| **Dokter** | `dr_andi` | `doctor123` | Akses pasien bangsal Mawar 01 (Budi Santoso) |
| **Pasien** | `budi` | `patient123` | Akses melihat & mendekripsi rekam medis pribadi P-101 |
| **Administrator** | `admin` | `admin123` | Penugasan dokter bangsal & simulasi audit integritas |

> *Catatan: Seluruh akun dan rekam medis yang digunakan adalah data sintetis tiruan untuk keperluan pengujian dan tidak memuat data pribadi riil.*

---

## 5. Struktur Direktori Repositori

Struktur repositori ditata terorganisir untuk memisahkan domain masing-masing mata kuliah:

```text
.
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Halaman Login & Quick Demo Peran
│   ├── beranda/page.tsx          # Hub Utama Multi-Peran (Dokter, Pasien, Admin)
│   ├── layout.tsx                # Root Layout, Tipografi Montserrat & Metadata
│   └── globals.css               # Konfigurasi Tailwind CSS & Utilitas sr-only
├── components/                   # Komponen React Reusable Bertipe
│   ├── ui/                       # StatCard, InputField, StatusBadge, TopHeader, LogoutModal
│   └── dashboard/                # DokterView, PasienView, AdminView
├── lib/                          # Logika Bisnis & Utilitas
│   ├── auth/auth.ts              # Pengelolaan Sesi & Zero-Trust Role Guard
│   └── crypto/                   # aes.ts (AES-256-GCM) & hmac.ts (HMAC-SHA256)
├── tests/                        # Pengujian Otomatis Kriptografi
│   └── crypto.test.ts            # Unit Test Vitest (Positif, Negatif, Batas)
├── docs/                         # Dokumentasi Terstruktur 3 Mata Kuliah
│   ├── PAW/                      # Pengembangan Aplikasi Web
│   │   ├── kebutuhan.md          # Spesifikasi Kebutuhan Antarmuka & Kriteria Penerimaan
│   │   └── arsitektur.md         # Keputusan Rancangan UI & Struktur Komponen
│   ├── security/                 # Keamanan Komputasi dan Siber (KKS)
│   │   ├── asset-inventory.md    # Inventaris 5 Aset Sistem
│   │   ├── dfd.md                # Data Flow Diagram & Minimal 2 Trust Boundary
│   │   ├── threat-model.md       # Analisis 10 Ancaman Berbasis STRIDE
│   │   └── risk-register.md      # 5 Risiko Prioritas & Rencana Mitigasi Kontrol
│   ├── cryptography/             # Kriptografi
│   │   └── CRYPTO_SPEC.md        # Spesifikasi Detail Algoritma, Kunci, & Alur Data
│   └── evidence/                 # Bukti Pengujian Terpadu
│       └── verification.md       # Laporan Kondisi Uji Lighthouse, Form, & Vitest
├── KEPUTUSAN.md                  # Architectural Decision Record (ADR) Kriptografi
├── EVALUASI.md                   # Matriks Evaluasi & Hasil Pengujian Kriptografi
├── AI_LOG.md                     # Transparansi Rekapitulasi Penggunaan Asisten AI
├── CHANGELOG.md                  # Riwayat Perubahan Rilis v0.1
├── ATTRIBUTION.md                # Atribusi Pustaka dan Aset Pihak Ketiga
├── LICENSE                       # Lisensi Perangkat Lunak (MIT License)
└── README.md                     # Dokumentasi Utama Produk