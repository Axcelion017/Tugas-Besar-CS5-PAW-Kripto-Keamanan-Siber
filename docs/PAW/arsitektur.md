# Arsitektur Aplikasi & Keputusan Desain Antarmuka — Resilio-Health (PAW)

Dokumen ini mendokumentasikan keputusan rancangan arsitektur, hierarki komponen antarmuka, strategi tata letak responsif, arsitektur *Offline-First* PWA, serta kontrak antarmuka bertipe (*strictly typed interfaces*) pada sistem Resilio-Health.

---

## 1. Keputusan Rancangan Utama (*Architectural Decisions*)

### 1.1 Transformasi dari Monolitik ke Clean Architecture (Next.js App Router)
- **Keputusan**: Mengganti arsitektur halaman tunggal `/beranda` dengan Route Groups yang memisahkan area publik `(auth)` dan area terproteksi `(dashboard)` dengan segmentasi domain yang terisolasi: `/pasien`, `/nakes`, dan `/admin`.
- **Alasan**:
  - Menegakkan prinsip **Separation of Duties** dan **Least Privilege** secara struktural di tingkat rute peramban.
  - Menghilangkan *cascading render* dan kerentanan kebocoran antarmuka peran lain.
  - Memfasilitasi skalabilitas kode: penambahan fitur klinis nakes tidak mengganggu modul kontrol consent pasien atau konsol regulasi admin.

### 1.2 Ketahanan Offline PWA (*Offline-First Resilience Architecture*)
- **Keputusan**: Mengadopsi arsitektur *Offline-First* menggunakan Service Worker, cache aset statis, dan media penyimpanan lokal peramban IndexedDB (`resilio_offline_queue`).
- **Alasan**:
  - Mengatasi permasalahan **Downtime Chaos** di rumah sakit: ketika koneksi internet ke server pusat (seperti SATUSEHAT) mati atau diserang ransomware, stasiun kerja nakes tetap dapat membuka data antrean dan menginput formulir pemeriksaan klinis tanpa kehilangan data sedikit pun.
  - Data yang diinput dalam mode *offline* langsung diamankan dengan enkripsi simetris AES-256-GCM dan diberi tag integritas HMAC-SHA256 di memori klien sebelum masuk ke IndexedDB, lalu disinkronkan otomatis ke server saat jaringan pulih.

### 1.3 Zero-Knowledge Client-Side Cryptography
- **Keputusan**: Seluruh data klinis rekam medis (keluhan, tanda vital, diagnosa, dan resep) dienkripsi di peramban menggunakan W3C Web Crypto API sebelum dikirim ke jaringan atau media penyimpanan lokal.
- **Alasan**:
  - **Zero-Knowledge Storage**: Admin regulator dan pihak penyedia infrastruktur *cloud* tidak memiliki kunci simetris untuk membaca isi penyakit pasien.
  - Mencegah kebocoran data riwayat medis pasien (*Information Disclosure*) meskipun basis data pusat diretas atau disalin pihak luar.

### 1.4 Sistem Komponen Bersih & Aksesibilitas Enterprise (WCAG 2.1 AA)
- **Keputusan**:
  - Menghilangkan seluruh karakter emoji kasual dan menggantinya dengan ikon vektor SVG monokrom standar enterprise (`components/ui/Icons.tsx`) yang fleksibel dan beradaptasi dengan warna teks (`currentColor`).
  - Mengikat setiap kontrol formulir (`<input>`, `<select>`, `<textarea>`) secara eksplisit dengan elemen `<label htmlFor="...">`.
  - Menggunakan tipografi Google Fonts Montserrat yang dioptimalkan melalui `next/font/google` untuk efisiensi pemuatan.

### 1.5 Validasi Formulir Berlapis & Type-Safe Schema Engine (Zod v4)
- **Keputusan**: Menerapkan pustaka validasi skema **Zod v4** terpusat di direktori `lib/validations/` (`clinical.ts`, `auth.ts`, `triage.ts`, `patient.ts`).
- **Alasan**:
  - **Mencegah Bypass Input Client**: Menghilangkan ketergantungan semata-mata pada atribut HTML5 (`required`, `type="number"`) yang rentan dibypass melalui modifikasi DevTools atau manipulasi request.
  - **Kepatuhan Medikolegal Permenkes No. 24/2022**: Mengunci batasan fisiologis tanda vital (sistolik 70–250 mmHg, diastolik 40–150 mmHg, suhu 30–45°C), kode diagnosis ICD-10 resmi (`z.enum`), dan pernyataan keabsahan medikolegal sebelum data dapat dienkripsi AES-256-GCM.
  - **Penanganan Umpan Balik Real-Time**: Menyediakan pemetaan galat spesifik per kolom (`validationErrors[field]`) serta banner peringatan ringkas di antarmuka pengguna tanpa memicu unhandled runtime exception.

### 1.6 Alur Server Actions & Keamanan Cookie Sesi Stateful
- **Keputusan**: Menerapkan modul Server Action `"use server"` di `lib/actions/` (`clinical.ts` dan `auth.ts`) serta penerbitan cookie sesi HTTP-Only (`resilio_session_token`).
- **Alasan**:
  - **Pipeline 6-Tahap Ketat**: Menjalankan alur berurutan: Sesi -> Validasi Bentuk (Zod) -> Validasi Semantik (Alergi UR-T10) -> Mutasi Kripto (AES-GCM/HMAC) -> `revalidatePath` -> `redirect`.
  - **Keamanan Cookie Sesi HTTP-Only**: Cookie dikonfigurasikan dengan `HttpOnly: true`, `SameSite: "lax"`, `Max-Age: 14400`, dan `Path: "/"` guna melindungi token sesi dari eksfiltrasi XSS di peramban.
  - **Stateful Invalidation (UU PDP)**: Mendukung pembatalan hak akses instan (*Instant Revocation*) di sisi server saat pasien mencabut persetujuan (*1-Click Revoke*) atau saat pengguna logout.

---

## 2. Struktur Rute & Hierarki Komponen (*Component Hierarchy*)

```text
app/
├── layout.tsx                     # Root Layout: Server Component, Montserrat font, lang="id"
├── loading.tsx                    # Root Suspense Shimmer Skeleton
├── error.tsx                      # Root Application Error Boundary
├── not-found.tsx                  # Global 404 Intelligent Page (Mempertahankan sesi aktif pengguna)
├── page.tsx                       # Landing Page Publik (Hero, Integrasi 3 Mata Kuliah, Quick Demo)
├── beranda/page.tsx               # Automatic Session Redirector (Mendistribusikan ke rute peran)
│
├── (auth)/                        # Route Group: Autentikasi & Registrasi Publik
│   ├── login/page.tsx             # Login multi-role (Username/Email/NIK 16 digit + Quick Demo)
│   ├── register/
│   │   ├── pasien/page.tsx        # UR-P01, UR-P09: Pendaftaran Pasien NIK, Biodata, Alergi & e-KYC Watermark
│   │   └── nakes/page.tsx         # UR-T01: Pendaftaran Dokter NIK, Nomor STR, SIP & Dokumen Kemenkes
│   └── verifikasi-pending/page.tsx# Landing Page Pemberitahuan Kepatuhan Verifikasi KYC/KYD
│
└── (dashboard)/                   # Route Group: Area Terproteksi Multi-Role
    ├── layout.tsx                 # Dashboard Layout: Zero-Trust Route Guard, RoleNav, NetworkBanner
    ├── loading.tsx                # Dashboard Suspense Skeleton Shimmer
    ├── error.tsx                  # In-Dashboard Error Boundary (Menangkap error tanpa memutus sesi)
    │
    ├── pasien/                    # Domain: PASIEN (UR-P01 s.d. UR-P12)
    │   ├── page.tsx               # UR-P10, P11: Ringkasan, Family Proxy, Active Encounter PIN
    │   ├── faskes/
    │   │   ├── page.tsx           # UR-P02: Pencarian Faskes Pintar (Filter Gejala/Penyakit & Poli)
    │   │   └── [faskesId]/page.tsx# UR-P03: Profil Faskes, Dokter Praktik, Jadwal & Kuota Harian (404-safe)
    │   ├── booking/page.tsx       # UR-P04: Pemesanan Jadwal Periksa & Penerbitan Auto-Consent
    │   ├── rekam-medis/
    │   │   ├── page.tsx           # UR-P06, P12: Linimasa RME, Grafik Tensi, Dekripsi Citra Medis
    │   │   └── [recordId]/page.tsx# Detail Bukti Hukum RME & Modul Pengujian Tamper Kripto (404-safe)
    │   ├── consent/page.tsx       # UR-P05 & UR-P07: Manajemen Hak Akses, 1-Click Revoke & Transfer RME
    │   ├── audit-log/page.tsx     # UR-P07: Transparansi Jejak Audit Siapa & Kapan Akses Data (UU PDP)
    │   └── tiket-kendala/page.tsx # UR-P08: Pelaporan Masalah & Ketidaksesuaian Data Medis
    │
    ├── nakes/                     # Domain: DOKTER (DPJP) (UR-T01 s.d. UR-T10)
    │   ├── page.tsx               # UR-T02: Stasiun Kerja, Status Praktik, Antrean Pasien Hari Ini
    │   ├── periksa/[bookingId]/
    │   │   └── page.tsx           # UR-T04, T07, T09, T10: SOAP, Citra Medis, Addendum & Alergi (404-safe)
    │   ├── pasien-lookup/page.tsx # UR-T03 & T08: Lookup NIK, BOLA Gate & Break-Glass IGD
    │   ├── rujukan/page.tsx       # UR-T06: Penerbitan Surat Rujukan Digital Lintas Faskes
    │   └── offline-sync/page.tsx  # UR-T05 & T06: Status Antrean Sinkronisasi IndexedDB Offline
    │
    ├── staf/                      # Domain: STAF NAKES (TRIASE & ADMISI) (UR-S01 s.d. UR-S04)
    │   ├── page.tsx               # UR-S01: Penerimaan Pasien (Check-in) & Antrean Walk-in Loket
    │   ├── triase/page.tsx        # UR-S02: Input Triase Awal & Tanda Vital (Hijau/Kuning/Merah)
    │   ├── assign-dpjp/page.tsx   # UR-S03: Penugasan Dokter DPJP & Active Encounter Ticket
    │   └── rujukan/page.tsx       # UR-S04: Pengelolaan Administrasi Rujukan Masuk & Keluar
    │
    └── admin/                     # Domain: ADMIN REGULATOR (UR-A01 s.d. UR-A07)
        ├── page.tsx               # Ringkasan Eksekutif, Status Sistem & Agregat Keamanan
        ├── verifikasi-kyc/page.tsx# UR-A01 & A06: Antrean Verifikasi Visual KTP Ber-watermark + Selfie
        ├── verifikasi-kyd/page.tsx# UR-A02: Verifikasi STR & SIP Dokter Konsil Kedokteran
        ├── faskes/page.tsx        # UR-A03: Master Direktori Faskes & Ransomware Kill-Switch
        ├── siem-monitor/page.tsx  # UR-A04 & A07: SIEM Live Feed (IDOR, Break-Glass, HMAC Alarms)
        └── incident-center/page.tsx# UR-A05: Failed Sync Queue & Penanganan Tiket Masalah Teknis

lib/
├── actions/                      # Modul Server Actions ("use server")
│   ├── clinical.ts               # Mutasi SOAP Medis, Validasi Semantik UR-T10, revalidatePath, redirect
│   └── auth.ts                   # Login, Logout & Pengelolaan Cookie Sesi HttpOnly (resilio_session_token)
├── auth/auth.ts                  # Autentikasi 4-Role, Normalisasi Sesi & Route Guard
├── crypto/
│   ├── aes.ts                    # AES-256-GCM 96-bit CSPRNG IV & Web Crypto Engine
│   └── hmac.ts                   # HMAC-SHA256 Keutuhan Data & Deteksi Tamper
├── db/mockData.ts                # Database Mock Komprehensif (4 Peran, 700+ baris)
└── validations/                  # Skema Validasi Tipe Aman Zod v4
    ├── clinical.ts               # PemeriksaanKlinisSchema (SOAP, Tensi, ICD-10, Medikolegal)
    ├── auth.ts                   # LoginSchema, RegisterPasienSchema (e-KYC), RegisterNakesSchema (e-KYD)
    ├── triage.ts                 # TriaseSchema, WalkInAdmisiSchema, AssignDpjpSchema (PIN)
    └── patient.ts                # BookingSchema, TroubleTicketSchema, ConsentGrantSchema
```

---

## 3. Komponen Bersama (*Shared Components*)

1. **`RoleNav.tsx` (`components/shared/RoleNav.tsx`)**:
   - Sidebar navigasi adaptif yang secara otomatis memuat menu tautan spesifik sesuai peran aktif pengguna (Pasien, Nakes, Admin).
   - Menggunakan ikon SVG vektor monokrom (`components/ui/Icons.tsx`) untuk menjamin tampilan bersih, profesional, dan bebas dari emoji.
   - Terintegrasi dengan modal konfirmasi keluar sesi (`LogoutModal.tsx`).
2. **`NetworkStatusBanner.tsx` (`components/shared/NetworkStatusBanner.tsx`)**:
   - Indikator status jaringan waktu nyata (Hijau = Terhubung Server Pusat; Kuning = Mode Offline IndexedDB).
   - Dilengkapi tombol simulasi pemutus jaringan dan *badge counter* jumlah berkas rekam medis yang sedang mengantre di IndexedDB.
3. **`LogoutModal.tsx` (`components/ui/LogoutModal.tsx`)**:
   - Dialog konfirmasi keluar sesi aksesibel yang membersihkan seluruh kunci sesi dan kredensial sementara di memori peramban.

---

## 4. Kontrak Tipe Data TypeScript (*TypeScript Typed Contracts*)

### 4.1 Sesi Pengguna & Autentikasi (`lib/auth/auth.ts`)
```typescript
export type UserRole = "doctor" | "patient" | "admin" | "nakes" | "pasien" | "staf";

export interface UserSession {
  id: string;              // "DOC-01", "P-101", "ADM-01", "STF-01"
  name: string;            // Nama lengkap dan gelar
  username: string;        // Nama pengguna unik
  role: UserRole;          // Peran pengguna
  nik?: string;            // Nomor Induk Kependudukan 16 digit
  strNumber?: string;      // Nomor Surat Tanda Registrasi (Nakes)
  sipNumber?: string;      // Nomor Surat Izin Praktik (Nakes)
  specialization?: string; // Spesialisasi dokter
  faskesId?: string;       // ID fasilitas kesehatan bertugas
  faskesName?: string;     // Nama faskes bertugas
  posisiStaf?: "Perawat Triase" | "Staf Admisi" | "Kepala Ruangan";
  status?: "VERIFIED" | "PENDING" | "REJECTED";
  allergies?: string[];    // Riwayat alergi obat/makanan kritis
  bloodType?: string;      // Golongan darah
  phone?: string;          // Nomor kontak
  encryptionKeyHex?: string; // Kunci enkripsi simetris 256-bit klien
}
```

### 4.2 Dokumen Rekam Medis Klinis (SOAP & Kriptografi)
```typescript
export interface VitalSigns {
  systolic: number;        // Batas normal: 90 - 180 mmHg
  diastolic: number;       // Batas normal: 60 - 120 mmHg
  heartRate: number;       // Batas normal: 50 - 150 bpm
  temperature: number;     // Batas normal: 35.0 - 41.0 °C
  respiratoryRate?: number;// Laju pernapasan per menit
  spo2: number;            // Saturasi oksigen (%)
}

export interface EncryptedMedicalRecord {
  recordId: string;        // "REC-2026-001"
  patientId: string;       // ID pasien pemilik rekam medis
  patientName: string;     // Nama lengkap pasien
  faskesId: string;        // ID faskes pemeriksaan
  faskesNama: string;      // Nama faskes pemeriksaan
  dokterStr: string;       // Atribusi nomor STR dokter pemeriksa
  dokterNama: string;      // Nama dokter pemeriksa
  primaryIcd10: string;    // Kode standar internasional (misal: "I10", "J06.9")
  diagnosisShort: string;  // Deskripsi ringkas diagnosis
  encryptedPayload: string;// Ciphertext heksadesimal hasil AES-256-GCM
  ivHex: string;           // Initialization Vector acak 96-bit (24 hex chars)
  hmacDigest: string;      // Tag integritas HMAC-SHA256 (64 hex chars)
  timestamp: string;       // Waktu pemeriksaan
  isOfflineCreated?: boolean; // Penanda dibuat saat offline mode
  version: number;         // Versi revisi addendum (immutable)
}
```

### 4.3 Izin Akses & Kedaulatan Pasien (Consent Management)
```typescript
export interface AccessGrant {
  id: string;              // "GRANT-01"
  pasienId: string;        // ID pasien pemberi izin
  pasienNama: string;      // Nama pasien
  entityId: string;        // ID dokter atau ID faskes terotorisasi
  entityNama: string;      // Nama dokter atau faskes
  entityType: "DOKTER" | "FASKES";
  scope: string;           // Lingkup izin medis (misal: "Konsultasi Kardiologi")
  validUntil: string;      // Tanggal dan waktu berakhir izin
  isRevoked: boolean;      // Status pencabutan 1-Click Revoke
  createdAt: string;       // Waktu penerbitan izin
}
```

### 4.4 Audit Keamanan & SIEM Event Log
```typescript
export interface SecurityAuditLog {
  id: string;              // "LOG-01"
  timestamp: string;       // Waktu kejadian ISO/Lokal
  actorId: string;         // ID pengguna pelaku aksi
  actorName: string;       // Nama pelaku aksi
  actorRole: "PASIEN" | "NAKES" | "ADMIN" | "GATEWAY";
  action: "LOGIN" | "VIEW_RME" | "WRITE_RME" | "IDOR_BLOCKED" | "HMAC_VERIFIED" | "HMAC_MISMATCH" | "REVOKE_CONSENT" | "QUARANTINE_FASKES";
  targetResource: string;  // Resource URL (misal: "/api/rme/record-P101-01")
  ipAddress: string;       // Alamat IP klien
  userAgent: string;       // Informasi peramban/klien
  severity: "INFO" | "WARN" | "CRITICAL";
  detail: string;          // Kronologi dan alasan mitigasi
}
```

---

## 5. Strategi Aksesibilitas Web (WCAG 2.1 AA)

1. **Semantik HTML5**:
   - Penggunaan elemen landmark struktural yang tepat: `<header>`, `<main>`, `<aside>`, `<nav>`, dan `<footer>`.
2. **Keterikatan Kontrol Formulir**:
   - Seluruh elemen kontrol formulir (`<input>`, `<select>`, `<textarea>`) terikat secara eksplisit dengan elemen `<label>` melalui pasangan atribut `htmlFor` dan `id` yang unik.
3. **Kontras Warna Teruji**:
   - Teks gelap di atas latar belakang terang menggunakan palet Slate-900 dan Slate-600 untuk memenuhi rasio kontras $\ge 4.5:1$ terhadap latar belakang `#F8FAFC` dan Putih.
4. **Navigasi Keyboard & Indikator Fokus**:
   - Elemen interaktif memiliki *focus indicator* yang tegas (`focus:ring-2 focus:ring-blue-500` atau `focus:ring-emerald-500`).
   - Kontrol tanpa teks visual dilengkapi atribut `aria-label` deskriptif.
