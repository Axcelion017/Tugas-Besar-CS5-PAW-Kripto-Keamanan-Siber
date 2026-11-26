# Arsitektur Aplikasi & Keputusan Desain Antarmuka — JagaMedis (`v0.3.5` — PAW)

Dokumen ini mendokumentasikan keputusan rancangan arsitektur, hierarki komponen antarmuka, strategi *Hybrid Feature-Modular*, Server Components, **REST API v1 berstandar RFC 9457** (`docs/PAW/rest_api_v1.md`), arsitektur *Offline-First* PWA, serta kontrak antarmuka bertipe (*strictly typed interfaces*) pada sistem **JagaMedis** (sebelumnya Resilio-Health).

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

### 1.7 Integrasi Basis Data PostgreSQL Riil & Prisma 7 ORM (Clean Architecture Backend)
- **Keputusan**: Mengintegrasikan basis data PostgreSQL 17 lokal (`localhost:5432/resilio_health`) menggunakan **Prisma 7 ORM** (`@prisma/client@7.10.1`, `@prisma/adapter-pg`, dan connection pool `pg`) dengan **17 model relasional & 14 enum** (termasuk tabel `sessions` persisten & `family_members` CRUD).
- **Alasan**:
  - **Integritas Referensial Medis Kepatuhan Regulasi**: Menegakkan aturan penghapusan `onDelete: Restrict` pada seluruh entitas rekam medis dan master faskes guna mematuhi kewajiban retensi data rekam medis sesuai Permenkes No. 24/2022.
  - **Pemisahan Modular Backend**: Logika database diisolasi di `prisma/` dan `lib/db/prisma.ts`, dengan seeder idempoten berbasis `upsert` yang menghasilkan enkripsi AEAD+HKDF nyata dan tanggal jadwal sinkron zona waktu WIB.

### 1.8 *Hybrid Feature-Modular* (`features/`), Server Components, Core REST API v1 (RFC 9457) & `proxy.ts` (`v0.3.5`)
- **Keputusan**: Memecah seluruh *god files* ke struktur domain `features/{auth,appointments,medical-records,dashboard,admin}/` ($\le 350$ baris pada seluruh modul inti), memigrasikan pembacaan awal `/beranda`, `/nakes`, & `/pasien` ke **Next.js 16 Server Components** (`queries.ts` + `<Suspense>`), memasang network boundary **`proxy.ts`**, serta menyediakan **17 Route Handlers Core REST API v1 (`/api/v1/*`) berstandar RFC 9457 (`application/problem+json`)** + 4 utilitas `/api/*` (`GET /api/health`, `GET/POST/DELETE /api/auth/session`, `POST /api/sync/outbox`, `GET/POST /api/attachments`). Rincian kontrak & backlog Phase B tercatat pada `docs/PAW/rest_api_v1.md`.
- **Alasan**: Menghilangkan *RSC waterfall*, memenuhi standar maintainability **ISO/IEC 25010**, dan menyediakan kontrak HTTP presisi (`200/201/204/400/401/403/404/405/409/422/429/500`) dengan pemisahan aksi klinis spesifik (`/check-in`, `/triage`, `/assign-dpjp`, `/addenda`, `/revoke`, `/quarantine`).

---

## 2. Struktur Rute (53 Rute + `ƒ Proxy`) & Hierarki Modul

```text
proxy.ts                           # Next.js 16 Network Boundary Route Guard (Cookie HttpOnly)
app/
├── layout.tsx                     # Root Layout: Montserrat, PwaRegistrar, lang="id", manifest.json
├── loading.tsx / error.tsx / not-found.tsx
├── page.tsx                       # Landing Page Publik (Quick Demo dikendalikan env)
├── api/
│   ├── health/route.ts            # GET /api/health (Docker HEALTHCHECK + PostgreSQL ping)
│   ├── auth/session/route.ts      # GET/POST/DELETE /api/auth/session (Rate Limit 429 & Anti-Enumeration)
│   ├── sync/outbox/route.ts       # POST /api/sync/outbox (PWA IndexedDB Sync + AEAD/HMAC + Kill-Switch)
│   ├── attachments/route.ts       # GET/POST /api/attachments (Citra Medis Terenkripsi Anti-BOLA 403)
│   └── v1/                        # Core REST API v1 — RFC 9457 (17 Route Handlers, docs/PAW/rest_api_v1.md)
│       ├── faskes/                # GET/POST, [id] (GET/PATCH/DELETE 409), [id]/quarantine (PATCH)
│       ├── appointments/          # GET/POST, [id] (GET/PATCH/DELETE 409), check-in (POST), triage (PUT), assign-dpjp (POST)
│       ├── medical-records/       # GET/POST (AEAD+HMAC), [id] (GET Anti-BOLA), [id]/addenda (POST immutable)
│       ├── access-grants/         # GET/POST, [id]/revoke (POST 1-Click Revoke)
│       ├── patients/me/family-members/ # GET/POST, [id] (PATCH/DELETE Anti-BOLA)
│       └── trouble-tickets/       # GET/POST, [id] (GET/PATCH/DELETE 409)
├── (auth)/                        # login, register/{pasien,nakes}, verifikasi-pending
└── (dashboard)/                   # layout (skip-link #main-content, lg:sticky), loading, error (error.digest)
    ├── beranda/page.tsx           # Server Component Ringkasan Terpadu
    ├── pasien/                    # page (Server Component), profil (3 Tab + Family Proxy CRUD), faskes, [faskesId], booking (3 langkah), rekam-medis, [recordId], consent, audit-log, tiket-kendala
    ├── nakes/                     # page (Server Component), jadwal (sinkron WIB), periksa/[bookingId], pasien-lookup (filter skala prioritas), [patientId], rujukan (master-detail pasien ditangani), offline-sync (IndexedDB)
    ├── staf/                      # page (check-in/walk-in), triase (CDS vital kritis), assign-dpjp (PIN 6-digit), rujukan
    └── admin/                     # page, verifikasi-kyc, verifikasi-kyd, faskes (Kill-Switch), siem-monitor, incident-center

features/                          # Domain bisnis modular (actions, queries, & workspace UI <=350 baris)
├── auth/                          # guard.ts, session-actions, register-actions, kyc-actions, profile-actions, family-actions, FamilyMemberManager
├── appointments/                  # booking-actions, workflow-actions, dpjp-actions, queries, NakesDashboardClient
├── medical-records/               # crypto-service, prescription-parser, exam/*, patient-detail/*, queries, PasienDashboardClient
├── dashboard/                     # queries, BerandaClient
└── admin/                         # overview, siem, verification, faskes, incident actions

lib/                               # Primitif & utilitas lintas domain
├── actions/                       # Fasad re-export Server Actions ("use server")
├── auth/                          # auth.ts, sessionStore.ts (PostgreSQL), rateLimit.ts (429/CWE-204), demoConfig.ts
├── crypto/                        # aes.ts, hmac.ts (constant-time verify), hkdf.ts (RFC 5869)
├── db/                            # prisma.ts & mockData.ts
├── storage/                       # indexedDb.ts (resilio_offline_db: cached_active_patients, outbox, media_blobs)
├── utils/                         # revalidate.ts (safeRevalidate tunggal)
└── validations/                   # Skema Zod v4 (clinical, auth, triage, patient)

public/                            # manifest.json, icon.svg, sw.js (PWA Service Worker aktif)
prisma/                            # schema.prisma (17 model & 14 enum), migrations/, seed.ts
```

---

## 3. Komponen Bersama (*Shared Components*)

1. **`RoleNav.tsx` (`components/shared/RoleNav.tsx`)**:
   - Sidebar navigasi adaptif 4 peran tanpa duplikasi `/beranda` (pasca-login langsung menuju dasbor peran masing-masing).
   - Mempertahankan identitas merah JagaMedis dengan penanda aktif tepi kiri lembut (`bg-red-50/80 text-red-800 border-l-4 border-red-600` + `aria-current="page"`, kontras WCAG AAA 7.6:1 & anti-*alert fatigue* NISTIR 7804).
   - Menampilkan lencana reaktif jumlah berkas luring IndexedDB (`OUTBOX_UPDATED_EVENT`) khusus pada menu dokter.
2. **`NetworkStatusBanner.tsx` & `PwaRegistrar.tsx` (`components/shared/`)**:
   - Mendaftarkan `public/sw.js`, memantau konektivitas `online`/`offline` peramban, dan menyinkronkan antrean `resilio_offline_db` ke `POST /api/sync/outbox`.
3. **`Modal.tsx`, `ToastBanner.tsx` & `LogoutModal.tsx` (`components/ui/`)**:
   - Komponen dialog (`role="dialog"`, `aria-modal="true"`, tutup `Escape`, pemulihan fokus) dan notifikasi melayang (`role="alert"`/`"status"`) berstandar WCAG 2.1 AA menggantikan 100% `window.alert()`/`window.confirm()`.
4. **`PrintableMedicalResume.tsx` (`components/clinical/`)**:
   - Lembar Resume Medis A4 terisolasi menggunakan `createPortal(..., document.body)` + `#jagamedis-print-portal` sehingga tampilan navigasi aplikasi tidak ikut tercetak.

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
