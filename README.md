# Resilio-Health — Hospital Information System (HIS)

Resilio-Health adalah sistem informasi rekam medis rumah sakit berbasis web yang mengintegrasikan antarmuka responsif dan aksesibel, protokol pengawasan otorisasi *Zero-Trust*, ketahanan *Offline-First* (PWA & IndexedDB), serta perlindungan kerahasiaan dan integritas data klinis *end-to-end* menggunakan Web Crypto API standar W3C.

Repositori ini digunakan secara berkelanjutan sepanjang semester untuk tiga mata kuliah terintegrasi:
1. **Pengembangan Aplikasi Web (PAW)** — Milestone 2: Arsitektur Modular Multi-Role, Offline-First PWA & Aksesibilitas WCAG 2.1 AA (Tag: `v0.2`)
2. **Kriptografi** — Tugas 2: Zero-Knowledge Client-Side Encryption (AES-256-GCM + HMAC-SHA256) & Deteksi Manipulasi Data (Tag: `v0.2`)
3. **Keamanan Komputasi dan Siber (KKS)** — Tugas 2: Zero-Trust BOLA / IDOR Defense, KYC/KYD Verification, SIEM Monitor, & Ransomware Isolation Kill-Switch (Penanda: `sec-0.2`)

---

## 1. Konsep Produk & Permasalahan yang Diselesaikan

### 1.1 Latar Belakang & Permasalahan Dunia Nyata
Berdasarkan data insiden nyata hingga tahun 2026:
- **Kasus Change Healthcare (AS)**: Kebocoran lebih dari 190 juta rekam medis akibat kelumpuhan server pusat oleh serangan *ransomware*.
- **Data BSSN Indonesia**: Sebanyak 96% permasalahan keamanan digital di faskes bersumber dari kerentanan web (BOLA/IDOR, miskonfigurasi API, dan kebocoran token). Ketika server pusat down, faskes daerah kehilangan akses terhadap data pasien sehingga penanganan medis gawat darurat terhenti total (*Downtime Chaos*).
- **Single Point of Failure (SPOF)**: Integrasi API nasional (seperti SATUSEHAT) rentan lumpuh jika server pusat terganggu.

### 1.2 Solusi Resilio-Health
Resilio-Health menyelesaikan permasalahan tersebut dengan:
- **Ketahanan Offline-First PWA (PAW)**: Stasiun kerja nakes tetap dapat membuka data antrean dan menginput formulir pemeriksaan klinis ke IndexedDB lokal saat internet mati, lalu otomatis tersinkronisasi saat jaringan pulih.
- **Zero-Knowledge Storage (Kriptografi)**: Seluruh rekam medis klinis (SOAP: keluhan, tanda vital, diagnosa ICD-10, dan resep) dienkripsi di peramban menggunakan AES-256-GCM dan diberi tag integritas HMAC-SHA256 sebelum disimpan ke server atau media lokal.
- **Zero-Trust BOLA / IDOR Defense (KKS)**: Gateway API memverifikasi tiket izin aktif (`access_grants`) sebelum mengembalikan data medis pasien, memblokir percobaan IDOR seketika, serta menyediakan saklar darurat *kill-switch* untuk mengisolasi faskes yang terinfeksi ransomware.

---

## 2. Arsitektur Domain & Peran Pengguna (Role Segregation)

Sistem menerapkan arsitektur modular Next.js App Router dengan pemisahan wilayah publik `(auth)` dan wilayah terproteksi `(dashboard)` yang terbagi ke dalam 3 domain peran:

### 1. Portal Mandiri Pasien (`app/(dashboard)/pasien/`) — UR-P01 s.d. UR-P08
- **Ringkasan Kesehatan & Kartu Darurat**: Kartu Resilio ID darurat berstatus KYC terverifikasi Dukcapil dan indikator riwayat alergi berbahaya.
- **Pencarian Faskes Pintar**: Menemukan RS, klinik, atau puskesmas berdasarkan keluhan gejala penyakit (Hipertensi, Jantung, Gigi, ISPA) atau spesialisasi.
- **Eksplorasi Profil Faskes & Dokter**: Meninjau jadwal dokter, nomor SIP terverifikasi, dan kuota antrean harian.
- **Pemesanan Jadwal & Auto-Consent**: Memesan antrean dengan penerbitan tiket izin akses digital otomatis berbatas waktu bagi dokter pemeriksa.
- **Linimasa RME & Grafik Tanda Vital**: Visualisasi tren fluktuasi tekanan darah sistolik/diastolik serta fitur dekripsi mandiri menggunakan kunci privat pasien.
- **Kedaulatan Izin (Consent Manager)**: Pemberian izin rujukan lintas faskes dan pencabutan hak akses instan (*1-Click Revoke*).
- **Audit Trail Pribadi & Laporan Kendala**: Transparansi log siapa dan kapan data medis dibuka (UU PDP) serta pelaporan kendala teknis ke Admin.

### 2. Stasiun Kerja Tenaga Kesehatan (`app/(dashboard)/nakes/`) — UR-T01 s.d. UR-T06
- **Antrean Pasien & Jadwal Harian**: Daftar periksa harian dengan status periksa (Menunggu, Sedang Diperiksa, Selesai) dan peringatan alergi kritis.
- **Pemeriksaan Klinis (SOAP Standar)**: Formulir anamnesis (S), tanda vital fisik (O), kode diagnosis internasional ICD-10 (A), dan *e-Prescription* (P) dengan enkripsi AES-256-GCM + tag HMAC-SHA256.
- **Pencarian Pasien via NIK (BOLA Guard)**: Validasi izin akses sebelum data dibuka; percobaan akses tanpa izin langsung diblokir 403 Forbidden dan dicatat ke SIEM.
- **Ketahanan Offline (IndexedDB Engine)**: Operasional penuh saat internet faskes mati; data diantrekan secara terenkripsi di memori lokal.
- **Background Sync & Surat Rujukan**: Sinkronisasi otomatis ke server pusat setelah verifikasi HMAC lolos serta penerbitan surat rujukan digital antar faskes.

### 3. Konsol Pengawas Regulasi Admin (`app/(dashboard)/admin/`) — UR-A01 s.d. UR-A05
- **Ringkasan Eksekutif & Status Sistem**: Agregat antrean KYC/KYD, tingkat ancaman siber, dan status kesehatan faskes terintegrasi.
- **Verifikasi Kependudukan Pasien (KYC)**: Antrean verifikasi kecocokan nomor NIK dengan dokumen foto fisik KTP asli.
- **Verifikasi Kredensial Dokter (KYD)**: Validasi nomor STR (Konsil Kedokteran) dan nomor SIP dokter sebelum wewenang penginputan RME diaktifkan.
- **Master Faskes & Ransomware Kill-Switch**: Pengelolaan direktori faskes dan tombol saklar darurat untuk mengisolasi faskes yang terinfeksi malware.
- **SIEM Live Security Feed**: Pemantauan real-time pencegahan BOLA/IDOR dan anomali HMAC dengan tombol uji coba simulasi serangan.
- **Incident Center (Observabilitas Teknis)**: Resolusi tiket kendala pengguna dan pemantauan antrean gagal sinkron (*Failed Sync Queue*) tanpa pernah melihat isi rahasia medis pasien.

---

## 3. Spesifikasi Kriptografi Produk

| Komponen | Spesifikasi Teknis | Standar Acuan | Fungsi Keamanan |
| :--- | :--- | :--- | :--- |
| **Kerahasiaan (Confidentiality)** | AES-256-GCM | NIST SP 800-38D | Enkripsi simetris data klinis SOAP menggunakan kunci 256-bit unik pasien |
| **Inisialisasi Keacakan (IV)** | 96-bit CSPRNG Nonce | W3C Web Crypto | `crypto.getRandomValues()` 12 bytes unik per rekam medis (Mencegah IV Reuse) |
| **Keutuhan Data (Integrity)** | HMAC-SHA256 | RFC 2104 | Verifikasi keutuhan ciphertext; tolak dekripsi jika terjadi perubahan 1 bit (*Fail-Closed*) |
| **Penyimpanan (Storage)** | Zero-Knowledge Store | UU PDP No. 27/2022 | Server dan Admin basis data hanya menyimpan opaque ciphertext |

---

## 4. Akun Pengujian Evaluasi (Quick Demo)

Aplikasi menyediakan tombol *Quick Demo* pada halaman masuk (`/login` dan `/`) untuk kemudahan evaluasi:

| Peran | Identifier / Username | Kata Sandi | Deskripsi Hak Akses Peran |
| :--- | :--- | :--- | :--- |
| **Tenaga Medis** | `dr_andi` | `doctor123` | Spesialis Penyakit Dalam di RSUP Dr. Sardjito, akses pemeriksaan SOAP & antrean |
| **Pasien** | `budi` (atau NIK `3171012304800001`) | `patient123` | Pasien terverifikasi KYC, akses dekripsi mandiri, booking & revoke consent |
| **Admin Regulator** | `admin` | `admin123` | Pengawas Kemenkes, verifikasi KYC/KYD, SIEM live monitor & kill-switch |

---

## 5. Struktur Direktori Repositori

```text
.
├── app/
│   ├── (auth)/                   # Area Autentikasi Publik
│   │   ├── login/page.tsx        # Login multi-role (Username/Email/NIK + Demo)
│   │   ├── register/             # Registrasi Pasien (NIK/KTP) & Nakes (STR/SIP)
│   │   └── verifikasi-pending/   # Pemberitahuan status antrean verifikasi
│   ├── (dashboard)/              # Area Terproteksi Multi-Role
│   │   ├── layout.tsx            # Zero-Trust Route Guard, RoleNav, NetworkBanner
│   │   ├── pasien/               # 8 Rute Portal Pasien (UR-P01 s.d. UR-P08)
│   │   ├── nakes/                # 5 Rute Stasiun Kerja Nakes (UR-T01 s.d. UR-T06)
│   │   └── admin/                # 6 Rute Konsol Admin Regulator (UR-A01 s.d. UR-A05)
│   ├── beranda/page.tsx          # Automatic Session Redirector
│   ├── layout.tsx                # Root Layout, Tipografi Montserrat & Metadata
│   └── page.tsx                  # Landing Page Publik Interaktif
├── components/
│   ├── shared/                   # RoleNav (Navigasi SVG), NetworkStatusBanner
│   └── ui/                       # Icons.tsx (Vector Iconset), LogoutModal, StatCard, StatusBadge
├── lib/
│   ├── auth/auth.ts              # Pengelolaan Sesi & Normalisasi Peran
│   ├── crypto/                   # aes.ts (AES-256-GCM) & hmac.ts (HMAC-SHA256)
│   └── db/mockData.ts            # Entitas Terstandarisasi, Mock Persistence & Storage Helpers
├── tests/
│   └── crypto.test.ts            # Pengujian Unit Kriptografi Vitest (4/4 Passed)
└── docs/                         # Dokumentasi Terstruktur Laporan Tugas Besar
    ├── PAW/                      # kebutuhan.md & arsitektur.md
    ├── security/                 # asset-inventory.md, dfd.md, threat-model.md, risk-register.md
    └── cryptography/             # CRYPTO_SPEC.md
```

---

## 6. Verifikasi & Pengujian Sistem

- **Kompilasi Antarmuka**: Seluruh 26 rute Next.js terkompilasi bersih tanpa galat TypeScript (`npm run build`).
- **Pengujian Kriptografi**: Seluruh uji unit (AES-256-GCM, HMAC-SHA256, deteksi *tamper*, dan *fail-closed*) lulus 100% (`npx vitest run`).
