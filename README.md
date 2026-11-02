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

## 2. Perkembangan Fitur Produk (Milestone 1 `v0.1` ke Milestone 2 `v0.2`)

| Aspek Pengembangan | Milestone 1 (`v0.1`) — Baseline Antarmuka | Milestone 2 (`v0.2`) — Integrasi Server & DB |
| :--- | :--- | :--- |
| **Penyimpanan Data** | Mock memory & `localStorage` statis. | **Database Relasional Fisik PostgreSQL 17** via Prisma ORM 7 (`@prisma/adapter-pg`). |
| **Operasi CRUD** | Mutasi state lokal di peramban. | **CRUD Lengkap 100% Persisten**: Antrean (`appointments`) dan Izin Akses (`access_grants`) mendukung Create, Read, Update, dan Delete melalui Server Actions. |
| **Validasi Masukan** | Pengecekan atribut dasar HTML5. | **Pertahanan Berlapis Zod v4**: Validasi tipe data ketat, batas fisiologis tensi, format NIK 16 digit, dan medikolegal di sisi server. |
| **Autentikasi & Sesi** | Variabel state klien. | **Stateful Session Cookies HTTP-Only** (`resilio_session_token`, Max-Age 4 jam, SameSite Lax) dan instan revoke UU PDP. |
| **Onboarding Pengguna** | Pendaftaran monolitik panjang. | **Progressive Onboarding & Restricted Mode**: Pendaftaran akun cepat, edit data mandiri, dan gembok fitur medis sebelum e-KYC NIK disetujui. |
| **Kedaulatan Portabilitas RME** | Mock transfer izin. | **Digital Medical Passport Tanpa Kertas**: Izin rujukan lintas faskes persisten dengan kontrol *1-Click Revoke*. |

---

## 3. Arsitektur Domain & Peran Pengguna (Role Segregation)

Sistem menerapkan arsitektur modular Next.js App Router dengan pemisahan wilayah publik `(auth)` dan wilayah terproteksi `(dashboard)` yang terbagi ke dalam 4 domain peran:

### 1. Portal Mandiri Pasien (`app/(dashboard)/pasien/`) — UR-P01 s.d. UR-P12
- **Ringkasan Kesehatan & Kartu Darurat**: Kartu Resilio ID darurat berstatus KYC terverifikasi Dukcapil dan indikator riwayat alergi berbahaya.
- **Pencarian Faskes Pintar**: Menemukan RS, klinik, atau puskesmas berdasarkan keluhan gejala penyakit (Hipertensi, Jantung, Gigi, ISPA) atau spesialisasi.
- **Eksplorasi Profil Faskes & Dokter**: Meninjau jadwal dokter, nomor SIP terverifikasi, dan kuota antrean harian.
- **Pemesanan Jadwal, PIN & Auto-Consent**: Memesan antrean dengan penerbitan tiket izin akses digital otomatis dan 6-digit PIN persetujuan DPJP.
- **Linimasa RME & Grafik Tanda Vital**: Visualisasi tren fluktuasi tekanan darah sistolik/diastolik serta fitur dekripsi mandiri menggunakan kunci privat pasien.
- **Akses Citra Medis Terdekripsi**: Menampilkan hasil foto Rontgen, USG, atau scan lab terenkripsi yang diverifikasi dengan HMAC-SHA256.
- **Akun Tanggungan Keluarga**: Beralih akun untuk memantau rekam medis anak atau orang tua (Family Proxy Access).
- **Kedaulatan Izin (Consent Manager)**: Pemberian izin rujukan lintas faskes dan pencabutan hak akses instan (*1-Click Revoke*).
- **Audit Trail Pribadi & Laporan Kendala**: Transparansi log siapa dan kapan data medis dibuka (UU PDP) serta pelaporan kendala teknis ke Admin.

### 2. Meja Staf Nakes Faskes (`app/(dashboard)/staf/`) — UR-S01 s.d. UR-S04 [ROLE BARU]
- **Admisi & Check-in Antrean**: Memvalidasi kedatangan pasien booking dan mendaftarkan pasien walk-in via NIK langsung ke loket.
- **Triase & Tanda Vital Awal**: Perawat menginput tensi, suhu, berat/tinggi badan, dan memilah kegawatan pasien (Hijau/Kuning/Merah).
- **Penugasan DPJP (Active Encounter)**: Mengarahkan pasien ke dokter penanggung jawab poli dan menerbitkan tiket enkripsi sesi.
- **Administrasi Rujukan Faskes**: Memproses surat rujukan keluar dan menerima berkas rujukan masuk dari faskes lain.

### 3. Stasiun Kerja Dokter DPJP (`app/(dashboard)/nakes/`) — UR-T01 s.d. UR-T10
- **Antrean Pasien & Jadwal Harian**: Daftar periksa harian dengan status periksa (Menunggu, Sedang Diperiksa, Selesai) dan peringatan alergi kritis.
- **Pemeriksaan Klinis (SOAP Standar)**: Formulir anamnesis (S), tanda vital fisik (O), kode diagnosis internasional ICD-10 (A), dan *e-Prescription* (P) dengan enkripsi AES-256-GCM + tag HMAC-SHA256.
- **Lampiran Citra Medis Biner**: Mengunggah foto Rontgen, USG, scan lab, dan EKG terenkripsi di IndexedDB berkapasitas besar.
- **Peringatan Kontraindikasi Alergi Obat**: Peringatan otomatis mencolok jika resep obat yang diketik memicu alergi pasien.
- **Koreksi RME Berbasis Addendum**: Mekanisme revisi catatan medis bertingkat tanpa menghapus data lama (Permenkes 24/2022).
- **Pencarian Pasien via NIK (BOLA Guard)**: Validasi izin akses sebelum data dibuka; percobaan akses tanpa izin langsung diblokir 403 Forbidden.
- **Protokol Darurat IGD (Break-Glass)**: Akses darurat berstandar ISO 27799 / HIPAA untuk pasien koma/kritis di IGD dengan audit prioritas tinggi.
- **Ketahanan Offline (IndexedDB Engine)**: Operasional penuh saat internet faskes mati; data diantrekan secara terenkripsi di memori lokal.
- **Background Sync & Surat Rujukan**: Sinkronisasi otomatis ke server pusat setelah verifikasi HMAC lolos serta penerbitan surat rujukan digital antar faskes.

### 4. Konsol Pengawas Regulasi Admin (`app/(dashboard)/admin/`) — UR-A01 s.d. UR-A07
- **Ringkasan Eksekutif & Status Sistem**: Agregat antrean KYC/KYD, tingkat ancaman siber, dan status kesehatan faskes terintegrasi.
- **Verifikasi Visual e-KYC Pasien**: Antrean verifikasi kecocokan nomor NIK dengan dokumen foto fisik KTP asli ber-watermark otomatis dan swafoto wajah (liveness check).
- **Verifikasi Kredensial Dokter (e-KYD)**: Validasi nomor STR (Konsil Kedokteran) dan nomor SIP dokter sebelum wewenang penginputan RME diaktifkan.
- **Master Faskes & Ransomware Kill-Switch**: Pengelolaan direktori faskes dan tombol saklar darurat untuk mengisolasi faskes yang terinfeksi malware.
- **SIEM Live Security Feed**: Pemantauan real-time pencegahan BOLA/IDOR, anomali HMAC, dan audit aktivasi darurat Break-Glass.
- **Incident Center (Observabilitas Teknis)**: Resolusi tiket kendala pengguna dan pemantauan antrean gagal sinkron (*Failed Sync Queue*) tanpa pernah melihat isi rahasia medis pasien.

---

## 4. Spesifikasi Kriptografi Produk

| Komponen | Spesifikasi Teknis | Standar Acuan | Fungsi Keamanan |
| :--- | :--- | :--- | :--- |
| **Kerahasiaan (Confidentiality)** | AES-256-GCM | NIST SP 800-38D | Enkripsi simetris data klinis SOAP & Citra Medis menggunakan kunci 256-bit unik pasien |
| **Inisialisasi Keacakan (IV)** | 96-bit CSPRNG Nonce | W3C Web Crypto | `crypto.getRandomValues()` 12 bytes unik per rekam medis (Mencegah IV Reuse) |
| **Keutuhan Data (Integrity)** | HMAC-SHA256 | RFC 2104 | Verifikasi keutuhan ciphertext; tolak dekripsi jika terjadi perubahan 1 bit (*Fail-Closed*) |
| **Penyimpanan (Storage)** | Zero-Knowledge Store | UU PDP No. 27/2022 | Server dan Admin basis data hanya menyimpan opaque ciphertext |

---

## 5. Teknologi yang Digunakan (Tech Stack)

Sistem Resilio-Health dibangun dengan arsitektur teknologi modern yang terbagi ke dalam empat pilar utama:

| Lapisan / Kategori | Teknologi | Versi | Peran & Alasan Pemilihan |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **Next.js (App Router)** | `16.3.6` | Framework React dengan Server Components, Route Groups (`(auth)`, `(dashboard)`), dan optimasi kompilasi Turbopack. |
| **UI Library & Runtime** | **React** | `19.0.0` | Library antarmuka reaktif berbasis komponen modular, React Compiler, dan Hooks modern (`use`, `useState`, `useEffect`). |
| **Styling & Design System** | **Tailwind CSS** | `^4.0.0` | Utility-first CSS framework untuk tata letak responsif, palet enterprise, dan bebas dari karakter emoji kasual (ikon SVG monokrom). |
| **Typography** | **Google Fonts Montserrat** | `next/font` | Tipografi geometris bersih berstandar aksesibilitas WCAG 2.1 AA yang dioptimalkan secara lokal tanpa eksternal network request. |
| **Backend & Server Actions** | **Next.js Server Actions** | Native | Mutasi data aman `"use server"` di sisi server untuk pipeline transaksi 6-tahap (Sesi $\rightarrow$ Zod $\rightarrow$ Semantik $\rightarrow$ DB $\rightarrow$ Revalidate $\rightarrow$ Redirect). |
| **Database & ORM** | **PostgreSQL & Prisma ORM** | `17.6` / `7.10.1` | Basis data relasional ACID dengan `@prisma/adapter-pg` dan connection pool `pg`, menjamin integritas referensial medikolegal `onDelete: Restrict`. |
| **Data Validation Engine** | **Zod** | `^4.6.7` | Validasi tipe data ketat (*Type-Safe Schema Validation*) di sisi formulir peramban dan lapisan gerbang Server Action (*Defense-in-Depth*). |
| **Client-Side Cryptography** | **W3C Web Crypto API** | Native Standard | Enkripsi simetris AES-256-GCM (kunci 256-bit unik pasien, CSPRNG IV 96-bit) dan tag integritas HMAC-SHA256 langsung di peramban (*Zero-Knowledge*). |
| **Offline-First Engine** | **PWA Service Worker & IndexedDB** | Web Standard | PWA Service Worker (`public/sw.js`) dengan penyimpanan biner IndexedDB berkapasitas besar untuk ketahanan operasional saat internet rumah sakit terputus. |
| **Testing Suite** | **Vitest** | `^5.0.4` | Framework pengujian unit otomatis berkecepatan tinggi untuk memverifikasi 19 skenario kriptografi dan batas validasi skema. |
| **Linter & Code Quality** | **ESLint** | `^9.0.0` | Analisis statis kualitas kode dengan 0 error dan 0 warning. |

---

## 6. Akun Pengujian Evaluasi (4-Role Quick Demo)

Aplikasi menyediakan tombol *Quick Demo* pada halaman masuk (`/login` dan `/`) untuk kemudahan evaluasi:

| Peran | Identifier / Username | Kata Sandi | Deskripsi Hak Akses Peran |
| :--- | :--- | :--- | :--- |
| **Dokter (DPJP)** | `dr_andi` | `doctor123` | Spesialis Penyakit Dalam di RSUP Dr. Sardjito, akses SOAP, citra medis, Break-Glass, & Addendum |
| **Staf Nakes (Triase)** | `suster_maya` | `nurse123` | Perawat Triase & Admisi, check-in antrean, input triase fisik, & penetapan DPJP |
| **Pasien** | `budi` (atau NIK `3171012304800001`) | `patient123` | Pasien terverifikasi KYC, akses dekripsi mandiri RME & Rontgen, PIN DPJP, proxy keluarga |
| **Admin Regulator** | `admin` | `admin123` | Pengawas Kemenkes, verifikasi visual e-KYC/KYD, SIEM live monitor & kill-switch |

---

## 7. Struktur Direktori Repositori

```text
.
├── app/
│   ├── (auth)/                   # Area Autentikasi Publik
│   │   ├── login/page.tsx        # Login multi-role (Username/Email/NIK + 4-Role Demo)
│   │   ├── register/             # Registrasi Pasien (NIK/KTP/Selfie e-KYC) & Nakes (STR/SIP e-KYD)
│   │   └── verifikasi-pending/   # Pemberitahuan status antrean verifikasi
│   ├── (dashboard)/              # Area Terproteksi Multi-Role
│   │   ├── layout.tsx            # Zero-Trust Route Guard, RoleNav, NetworkBanner
│   │   ├── pasien/               # 8 Rute Portal Pasien (UR-P01 s.d. UR-P12)
│   │   ├── nakes/                # 5 Rute Stasiun Kerja Dokter DPJP (UR-T01 s.d. UR-T10)
│   │   ├── staf/                 # 4 Rute Staf Nakes Triase & Admisi (UR-S01 s.d. UR-S04)
│   │   └── admin/                # 6 Rute Konsol Admin Regulator (UR-A01 s.d. UR-A07)
│   ├── beranda/page.tsx          # Automatic Session Redirector
│   ├── layout.tsx                # Root Layout, Tipografi Montserrat & Metadata
│   └── page.tsx                  # Landing Page Publik Interaktif
├── components/
│   ├── shared/                   # RoleNav (Navigasi SVG), NetworkStatusBanner
│   └── ui/                       # Icons.tsx (Vector Iconset), LogoutModal, StatCard, StatusBadge
├── lib/
│   ├── actions/                  # Next.js Server Actions: clinical.ts (SOAP & UR-T10) & auth.ts (Cookie Auth)
│   ├── auth/                     # auth.ts (Normalisasi Peran) & sessionStore.ts (Stateful Sesi Server)
│   ├── crypto/                   # aes.ts (AES-256-GCM) & hmac.ts (HMAC-SHA256)
│   ├── db/                       # prisma.ts (PostgreSQL Pool Adapter) & mockData.ts (Mock Persistence)
│   └── validations/              # Skema Validasi Tipe Aman Zod v4 (clinical, auth, triage, patient)
├── prisma/
│   ├── schema.prisma             # Skema Relasional 16 Model Prisma 7 (onDelete: Restrict)
│   ├── migrations/               # Riwayat Migrasi Fisik SQL PostgreSQL
│   └── seed.ts                   # Seeder Idempoten Berbasis Upsert (17 Tabel Terisi)
├── tests/
│   ├── crypto.test.ts            # Pengujian Unit Kriptografi Vitest (5/5 Passed - AEAD & HMAC)
│   ├── access-control.test.ts    # Pengujian Matriks Akses RBAC Vitest (8/8 Passed - 4 Positif vs 4 Negatif)
│   └── validations.test.ts       # Pengujian Skema Validasi Zod Vitest (15/15 Passed)
└── docs/                         # Dokumentasi Terstruktur Laporan Tugas Besar
    ├── Tugas2/                   # Dokumen Resmi Bukti Penugasan 3 Mata Kuliah
    │   ├── PAW/LaporanTugas2.md  # Laporan Milestone 2 PAW (CRUD, Zod, DB, Pengujian, Screenshot)
    │   ├── Kriptografi/          # Laporan Tugas 2 Kripto (AEAD, Parameter, Fail-Closed, Demo)
    │   └── KKS/                  # Laporan Tugas 2 KKS (Matriks RBAC, Lynis, Image Scan, SBOM)
    ├── database.md               # Spesifikasi Basis Data (Entitas, Relasi, CDM, LDM, PDM, DDL & Kamus Data)
    ├── PAW/                      # kebutuhan.md, arsitektur.md & database.md
    ├── security/                 # asset-inventory.md, dfd.md, threat-model.md, risk-register.md
    └── cryptography/             # CRYPTO_SPEC.md
```

---

## 8. Verifikasi, Pengujian & Petunjuk Menjalankan Aplikasi

### 8.1 Petunjuk Menjalankan Aplikasi Secara Lokal
1. **Kloning Repositori**:
   ```bash
   git clone <URL_REPOSITORY>
   cd "Projek Tubes"
   ```
2. **Pasang Dependensi**:
   ```bash
   npm install
   ```
3. **Konfigurasi Environment Database**:
   Salin berkas contoh `.env.example` menjadi `.env` dan sesuaikan URL database PostgreSQL:
   ```bash
   cp .env.example .env
   # Format: DATABASE_URL="postgresql://<USER>:***@localhost:5432/resilio_health?schema=public"
   ```
4. **Eksekusi Migrasi & Seeder Idempoten Prisma**:
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```
5. **Jalankan Server Development**:
   ```bash
   npm run dev
   # Buka http://localhost:3000 pada peramban
   ```

### 8.2 Hasil Verifikasi Kualitas
- **Dokumentasi Bukti Lengkap 3 Mata Kuliah**:
  - **PAW**: `docs/Tugas2/PAW/LaporanTugas2.md` & `docs/pengujian-milestone2.md` (10 skenario pengujian 100% lulus).
  - **Kriptografi**: `docs/Tugas2/Kriptografi/LaporanTugas2_Kripto.md` (AEAD, IV 96-bit, AAD context binding, 5 uji lulus).
  - **KKS**: `docs/Tugas2/KKS/LaporanTugas2_KKS.md` (Lynis 74, Trivy 0 critical, SBOM CycloneDX, 8 uji RBAC lulus).
- **Kompilasi Antarmuka**: Seluruh 32 rute Next.js terkompilasi bersih tanpa galat TypeScript (`npm run build`).
- **Pengujian Unit Otomatis**: Sebanyak **28 skenario uji unit** (5 kriptografi AEAD/HMAC + 8 kontrol akses RBAC + 15 validasi skema Zod v4) lulus 100% (`npx vitest run`).
- **Analisis Kualitas Kode**: Lolos analisis statis ESLint dengan 0 error dan 0 warning (`npm run lint`).
- **Keamanan Sesi & Cookie HTTP-Only**: Penerbitan cookie sesi `resilio_session_token` (`HttpOnly`, `SameSite=Lax`, `Max-Age=14400`) via Server Action `lib/actions/auth.ts` terverifikasi aktif pada peramban.
- **Integrasi Basis Data PostgreSQL & Prisma 7**: Migrasi fisik 16 entitas relasional dan seeder idempoten (`npx prisma db seed`) terverifikasi sukses mengisi 17 tabel fisik di database PostgreSQL lokal `resilio_health`.
