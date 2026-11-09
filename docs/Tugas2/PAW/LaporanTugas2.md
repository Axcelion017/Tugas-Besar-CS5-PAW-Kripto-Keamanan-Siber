# Laporan Pengerjaan Tugas 2 — Milestone 2 (v0.2)
## Integrasi Logika Server dan Database Produk Web

- **Mata Kuliah**: Praktikum Pengembangan Aplikasi Web (PAW)
- **Produk Web**: Resilio-Health — Hospital Information System (HIS) Berdaulat & Zero-Trust
- **Tag GitHub**: `v0.2`
- **Basis Data**: PostgreSQL 17 (`resilio_health`) via Prisma ORM 7 (`@prisma/adapter-pg`)

---

## DAFTAR ISI
1. [Deskripsi Produk & Perkembangan Fitur v0.1 ke v0.2](#1-deskripsi-produk--perkembangan-fitur-v01-ke-v02)
2. [Pemodelan Database Relasional PostgreSQL & Prisma 7](#2-pemodelan-database-relasional-postgresql--prisma-7)
3. [Bukti Implementasi Operasi CRUD Lengkap 2 Entitas Berelasi](#3-bukti-implementasi-operasi-crud-lengkap-2-entitas-berelasi)
4. [Bukti Validasi Sisi Server (Zod v4) & Penolakan Input Tidak Sah](#4-bukti-validasi-sisi-server-zod-v4--penolakan-input-tidak-sah)
5. [Dokumentasi 10 Skenario Pengujian Sistem (8 CRUD + 2 Relasi Data)](#5-dokumentasi-10-skenario-pengujian-sistem-8-crud--2-relasi-data)
6. [Pembuktian Persistensi Data Database PostgreSQL](#6-pembuktian-persistensi-data-database-postgresql)
7. [Panduan Tangkapan Layar (Screenshot) untuk Lampiran Moodle](#7-panduan-tangkapan-layar-screenshot-untuk-lampiran-moodle)
8. [Petunjuk Menjalankan Aplikasi Secara Mandiri](#8-petunjuk-menjalankan-aplikasi-secara-mandiri)

---

## 1. Deskripsi Produk & Perkembangan Fitur v0.1 ke v0.2

### 1.1 Deskripsi Produk
**Resilio-Health** adalah *Web-based Hospital Information System* (HIS) yang dirancang untuk mengatasi permasalahan nyata di Indonesia:
1. **Fragmentasi Rekam Medis Fisik**: Pasien yang berpindah faskes / dirujuk tidak perlu lagi membawa map kertas tebal atau amplop rontgen fisik. Berkas rekam medis dapat diakses secara digital lintas faskes menggunakan persetujuan digital pasien (*Consent-Driven Health Record*).
2. **Perlindungan Kebocoran Data Medis (Pascakasus BPJS/eHAC)**: Database server tidak pernah menyimpan isi penyakit dalam teks polos (*Plaintext*). Seluruh data anamnesis, diagnosa ICD-10, dan resep obat dienkripsi langsung di peramban menggunakan **AES-256-GCM** dan diverifikasi keutuhannya dengan **HMAC-SHA256** (*Zero-Knowledge Storage*).
3. **Kedaulatan Pasien (UU PDP No. 27/2022)**: Pasien memegang kendali penuh untuk memberikan izin portabilitas RME atau mencabut izin akses faskes seketika (*1-Click Revoke*), serta menerima transparansi notifikasi setiap kali datanya dibuka.

### 1.2 Tabel Perkembangan Fitur (Milestone 1 `v0.1` $\rightarrow$ Milestone 2 `v0.2`)

| Aspek Pengembangan | Milestone 1 (`v0.1`) | Milestone 2 (`v0.2`) |
| :--- | :--- | :--- |
| **Penyimpanan Data** | Mock memory lokal & `localStorage` statis. | **Database Relasional Fisik PostgreSQL 17** via Prisma ORM 7 connection pool. |
| **Operasi CRUD** | Mutasi state peramban sementara. | **CRUD Penuh 100% Persisten**: Antrean (`appointments`) dan Izin Akses (`access_grants`) mendukung Create, Read, Update, Delete via Server Actions. |
| **Validasi Formulir** | Pengecekan dasar HTML5 peramban. | **Validasi Server Zod v4**: Skema tipe aman di backend (`lib/validations/`) dengan penolakan ketat pada field terkait. |
| **Manajemen Sesi** | Variabel state klien peramban. | **Stateful Session Store & Cookie HTTP-Only** (`resilio_session_token`, Max-Age 4 jam, SameSite Lax). |
| **Alur Onboarding** | Registrasi panjang dan membebani. | **Progressive Onboarding & Restricted Mode**: Pendaftaran cepat, edit profil mandiri, dan gembok fitur sebelum verifikasi e-KYC NIK. |
| **Transparansi Akses** | Tabel log audit teknis SIEM. | **Kotak Masuk Notifikasi Akses Medis (Inbox & Message Viewer)** bergaya email yang mudah dipahami pasien awam. |

---

## 2. Pemodelan Database Relasional PostgreSQL & Prisma 7

### 2.1 Konfigurasi Prisma ORM 7 & PostgreSQL Adapter
Sistem menggunakan Prisma 7 dengan arsitektur driver adapter resmi `@prisma/adapter-pg`:
- **Datasource**: PostgreSQL 17 lokal (`localhost:5432/resilio_health`)
- **Adapter**: `PrismaPg` dipadukan dengan connection pool `pg.Pool` (`lib/db/prisma.ts`)
- **Aturan Integritas Medikolegal**: Relasi rekam medis dan master faskes dilindungi dengan **`onDelete: Restrict`** demi mematuhi kewajiban retensi berkas RME selama 25 tahun sesuai Pasal 21 Permenkes No. 24/2022.

### 2.2 Diagram Relasi Dua Entitas Utama (1 : N)

```mermaid
erDiagram
    PATIENTS ||--o{ APPOINTMENTS : "memiliki antrean (1:N)"
    PATIENTS ||--o{ ACCESS_GRANTS : "mendelegasikan izin (1:N)"
    
    PATIENTS {
        varchar(32) id PK
        varchar(36) user_id FK "Unique"
        char(16) nik "Unique"
        varchar(120) name
        date birth_date
        varchar(5) blood_type
        varchar(30) mrn "Unique"
        char(64) encryption_key_hex
    }

    APPOINTMENTS {
        varchar(32) id PK
        varchar(32) patient_id FK "Restrict"
        varchar(32) faskes_id FK "Restrict"
        varchar(32) doctor_id FK "Restrict"
        timestamptz tanggal
        varchar(20) jam
        varchar(100) poli
        text keluhan_awal
        boolean consent_active
        char(6) consent_pin
        enum status
    }

    ACCESS_GRANTS {
        varchar(32) id PK
        varchar(32) patient_id FK "Cascade"
        varchar(36) entity_id
        varchar(150) entity_name
        enum entity_type
        varchar(100) scope
        timestamptz valid_until
        boolean is_revoked
        timestamptz revoked_at
    }
```

---

## 3. Bukti Implementasi Operasi CRUD Lengkap 2 Entitas Berelasi

Aplikasi menyediakan kontrol interaktif lengkap **Create, Read, Update, Delete** pada dua entitas berelasi utama:

### 3.1 Entitas 1: `Appointment` (Antrean & Booking Konsultasi / Rujukan)
1. **CREATE (C)**:
   - **Lokasi Antarmuka**: Halaman `/pasien/booking`.
   - **Server Action**: `createAppointmentServerAction` (`lib/actions/appointment.ts`).
   - **Alur**: Pasien memilih Faskes, Dokter, Tanggal, Jam, dan menginput keluhan awal. Saat submit, server menerbitkan baris antrean status `PENDING_ARRIVAL` serta 6-digit PIN persetujuan dokter (`consentPin`).
2. **READ (R)**:
   - **Lokasi Antarmuka**: Halaman `/pasien/booking`, `/pasien`, dan `/nakes`.
   - **Server Action**: `getAppointmentsServerAction`.
   - **Alur**: Pasien membaca daftar antrean aktif miliknya, dokter membaca antrean stasiun kerja hari ini langsung dari tabel `appointments`.
3. **UPDATE (U)**:
   - **Lokasi Antarmuka**: Tombol **"Reschedule"** pada kartu antrean di `/pasien/booking`.
   - **Server Action**: `updateAppointmentDetailsServerAction`.
   - **Alur**: Pasien dapat menjadwalkan ulang tanggal dan sesi jam antrean sebelum diperiksa dokter. Kolom `tanggal` dan `jam` di database diperbarui seketika.
4. **DELETE (D)**:
   - **Lokasi Antarmuka**: Tombol **"Batalkan"** pada kartu antrean di `/pasien/booking`.
   - **Server Action**: `deleteAppointmentServerAction`.
   - **Alur**: Pasien membatalkan tiket kunjungan dengan dialog konfirmasi; server menghapus baris antrean dari tabel `appointments`.

### 3.2 Entitas 2: `AccessGrant` (Izin Akses Digital Portabilitas RME UU PDP)
1. **CREATE (C)**:
   - **Lokasi Antarmuka**: Formulir *"Berikan Izin Akses Baru"* di `/pasien/consent`.
   - **Server Action**: `grantAccessServerAction` (`lib/actions/consent.ts`).
   - **Alur**: Pasien memilih Faskes/Dokter rujukan dan masa berlaku (1-30 hari) $\rightarrow$ server menyimpan rekaman izin di tabel `access_grants`.
2. **READ (R)**:
   - **Lokasi Antarmuka**: Tabel *"Daftar Izin Akses Aktif"* di `/pasien/consent`.
   - **Server Action**: `getAccessGrantsServerAction`.
   - **Alur**: Menampilkan daftar faskes yang berhak membaca riwayat medis pasien beserta status aktif/dicabut.
3. **UPDATE (U)**:
   - **Lokasi Antarmuka**: Tombol **"+48 Jam"** atau **"Aktifkan Lagi"** pada tabel izin di `/pasien/consent`.
   - **Server Action**: `updateAccessGrantServerAction`.
   - **Alur**: Memperpanjang masa kedaluwarsa izin akses selama 48 jam ke depan (`valid_until`) dan mengaktifkan kembali status izin.
4. **DELETE (D)**:
   - **Lokasi Antarmuka**: Tombol **"Cabut (Revoke)"** (Soft Delete UU PDP) dan tombol **"Hapus"** (Permanent Delete) pada baris tabel di `/pasien/consent`.
   - **Server Action**: `revokeAccessServerAction` dan `deleteAccessGrantServerAction`.
   - **Alur**: Menghanguskan izin akses seketika di server atau menghapus rekaman riwayat dari PostgreSQL.

---

## 4. Bukti Validasi Sisi Server (Zod v4) & Penolakan Input Tidak Sah

Server Actions menerapkan validasi skema Zod v4 di backend. Jika ada pengguna yang membypass validasi HTML peramban (`novalidate`) atau mengirim request langsung dari terminal cURL, server tetap menolak secara tegas:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│             BUKTI 1: PENOLAKAN NIK BUKAN 16 DIGIT ANGKA                  │
├──────────────────────────────────────────────────────────────────────────┤
│ Formulir     : Pendaftaran Akun Pasien & e-KYC (/pasien/profil)          │
│ Skema Zod    : RegisterPasienSchema di lib/validations/auth.ts           │
│ Input Uji    : nik = "3171011102" (hanya 10 digit angka)                 │
│ Respon Server: HTTP 400 Bad Request / safeParse Failure                  │
│ Pesan Galat  : "NIK wajib terdiri dari tepat 16 digit angka kependudukan"│
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│          BUKTI 2: PENOLAKAN TENSI DI LUAR BATAS FISIOLOGIS MANUSIA       │
├──────────────────────────────────────────────────────────────────────────┤
│ Formulir     : Pengkajian Triase Tanda Vital Loket (/staf/triase)        │
│ Skema Zod    : TriaseSchema di lib/validations/triage.ts                 │
│ Input Uji    : systolic = 350 mmHg (melebihi batas maksimal 300 mmHg)    │
│ Respon Server: Server Action menolak mutasi ke PostgreSQL                │
│ Pesan Galat  : "Sistolik maksimal 300 mmHg."                             │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│             BUKTI 3: PENOLAKAN KELUHAN AWAL TERLALU PENDEK               │
├──────────────────────────────────────────────────────────────────────────┤
│ Formulir     : Booking Janji Temu Dokter (/pasien/booking)               │
│ Skema Zod    : BookingSchema di lib/validations/patient.ts               │
│ Input Uji    : keluhanAwal = "skt" (hanya 3 karakter)                    │
│ Respon Server: Server Action menolak mutasi ke tabel appointments        │
│ Pesan Galat  : "Keluhan awal minimal 5 karakter untuk referensi dokter." │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Dokumentasi 10 Skenario Pengujian Sistem (8 CRUD + 2 Relasi Data)

Pengujian dilakukan secara menyeluruh terhadap database PostgreSQL lokal menggunakan data sintetis (tidak menggunakan data pribadi nyata).

| No | Kategori | Entitas | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual (Kueri DB PostgreSQL) | Status |
|:--:|:---|:---|:---|:---|:---|:---|:--:|
| **1** | **CREATE (C)** | `Appointment` | Pasien memesan jadwal konsultasi dokter baru dengan penerbitan 6-digit PIN. | 1. Buka `/pasien/booking`<br>2. Pilih Faskes & Dokter<br>3. Input keluhan $\ge$ 5 karakter<br>4. Klik "Konfirmasi Booking" | Baris baru terbentuk di tabel `appointments` status `PENDING_ARRIVAL` dengan `consent_pin` terbit. | Record `APT-2026-XXXX` tersimpan dengan relasi FK `patient_id` & `doctor_id` valid. | **LULUS** |
| **2** | **READ (R)** | `Appointment` | Pasien dan Dokter membaca antrean kunjungan aktif masing-masing. | 1. Buka dasbor `/pasien` atau `/nakes`<br>2. Sistem memicu `getAppointmentsServerAction` | Data antrean tampil spesifik sesuai ID pengguna aktif tanpa tercampur data orang lain. | Kueri `SELECT * FROM appointments WHERE patient_id = $1` mengembalikan data pengguna aktif. | **LULUS** |
| **3** | **UPDATE (U)** | `Appointment` | Pasien melakukan jadwal ulang (*reschedule*) tanggal dan jam konsultasi. | 1. Pada kartu antrean di `/pasien/booking`, klik "Reschedule"<br>2. Pilih tanggal & jam baru<br>3. Klik "Simpan Jadwal Baru" | Kolom `tanggal` dan `jam` pada baris antrean di database berhasil diperbarui. | Data `tanggal` dan `jam` di PostgreSQL terupdate tanpa mengubah ID atau FK relasi. | **LULUS** |
| **4** | **DELETE (D)** | `Appointment` | Pasien membatalkan dan menghapus tiket antrean yang belum diperiksa. | 1. Pada kartu antrean, klik "Batalkan"<br>2. Konfirmasi dialog modal pembatalan | Baris antrean dihapus permanen dari tabel `appointments`. | Kueri `DELETE FROM appointments WHERE id = $1` berhasil; jumlah baris berkurang 1. | **LULUS** |
| **5** | **CREATE (C)** | `AccessGrant` | Pasien menerbitkan izin akses RME digital baru ke faskes rujukan (UU PDP). | 1. Buka `/pasien/consent`<br>2. Pilih dokter/faskes tujuan<br>3. Pilih durasi izin (1-30 hari)<br>4. Klik "+ Berikan Izin Digital" | Baris izin akses baru terbentuk di tabel `access_grants` dengan masa berlaku `valid_until`. | Record `AG-XXXX` tersimpan dengan `is_revoked = false` dan tanggal kedaluwarsa presisi. | **LULUS** |
| **6** | **READ (R)** | `AccessGrant` | Pasien melihat daftar entitas medis yang memegang izin akses berkas RME. | 1. Buka `/pasien/consent`<br>2. Sistem memicu `getAccessGrantsServerAction` | Tabel menampilkan seluruh faskes/dokter terotorisasi beserta status aktif/dicabut. | Kueri `SELECT * FROM access_grants WHERE patient_id = $1` mengembalikan daftar grant aktif. | **LULUS** |
| **7** | **UPDATE (U)** | `AccessGrant` | Pasien memperpanjang masa berlaku izin akses (*extend duration* +48 jam). | 1. Pada tabel izin aktif, klik tombol "+48 Jam"<br>2. Sistem menjalankan `updateAccessGrantServerAction` | Kolom `valid_until` bertambah 48 jam dan status otomatis aktif kembali. | Kolom `valid_until` di PostgreSQL bertambah 172.800 detik dari timestamp saat ini. | **LULUS** |
| **8** | **DELETE (D)** | `AccessGrant` | Pasien menghapus rekaman izin akses kedaluwarsa secara permanen. | 1. Pada tabel riwayat izin, klik tombol "Hapus"<br>2. Konfirmasi dialog penghapusan | Baris rekaman izin terhapus permanen dari tabel `access_grants`. | Kueri `DELETE FROM access_grants WHERE id = $1` berhasil dieksekusi di database. | **LULUS** |
| **9** | **RELASI (1:N)** | `Patient` $\rightarrow$ `Appointment` | Integritas referensial pembuatan antrean kunjungan terikat ID pasien sah. | 1. Insert appointment dengan `patient_id: P-101`<br>2. Insert appointment dengan `patient_id` fiktif | Appointment untuk pasien sah berhasil; appointment untuk pasien fiktif ditolak DB. | PostgreSQL mengembalikan error FK Violation `Key (patient_id)=(...) is not present in table patients`. | **LULUS** |
| **10** | **RELASI (Restrict)** | `Patient` $\rightarrow$ `MedicalRecord` | Perlindungan retensi 25 tahun: larangan menghapus pasien yang memiliki rekam medis (`onDelete: Restrict`). | 1. Jalankan `DELETE FROM patients WHERE id = 'P-101'` pada pasien yang memiliki RME | Penghapusan ditolak demi kepatuhan Pasal 21 Permenkes No. 24/2022. | PostgreSQL menolak dengan error `update or delete on table "patients" violates foreign key constraint on table "medical_records"`. | **LULUS** |

---

## 6. Pembuktian Persistensi Data Database PostgreSQL

Untuk membuktikan data tersimpan permanen di database fisik (bukan mock memory):
1. **Uji Muat Ulang Halaman (*Hard Refresh*)**:
   - Setelah membuat janji temu di `/pasien/booking` atau memperbarui profil di `/pasien/profil`, halaman dimuat ulang paksa dengan `Cmd + Shift + R`.
   - Seluruh baris data tetap tampil persisten karena Server Component dan Client Component menghidrasi data langsung dari kueri PostgreSQL via Prisma ORM.
2. **Uji Siklus Sesi (Logout $\rightarrow$ Login)**:
   - Pengguna logout dan cookie sesi dihancurkan.
   - Saat pengguna login kembali, riwayat antrean dan izin akses tetap tampil persisten.
3. **Uji Idempotensi Seeder Database**:
   - Perintah `npx prisma db seed` dijalankan berulang kali di terminal; seluruh 17 tabel fisik tetap terisi data terstandarisasi tanpa menghasilkan duplikasi atau *Unique Constraint Violation* karena mengimplementasikan pola klausul **`upsert`**.

---

## 7. Panduan Tangkapan Layar (Screenshot) untuk Lampiran Moodle

Silakan ambil **5 tangkapan layar utama** berikut di peramban Anda untuk dilampirkan sebagai bukti pengerjaan Milestone 2:

### Screenshot 1: Implementasi CREATE & READ Antrean (`/pasien/booking`)
  ![alt text](image-7.png)

### Screenshot 2: Implementasi UPDATE & DELETE Antrean (`/pasien/booking`)
  ![alt text](image-6.png)

### Screenshot 3: Implementasi CRUD Izin Akses UU PDP (`/pasien/consent`)
  - Formulir *"Berikan Izin Akses Baru"* (Create).
  ![alt text](image-4.png)
  - Tabel daftar izin akses aktif (Read) yang memuat tombol **"+48 Jam"** (Update perpanjang izin), tombol **"Cabut (Revoke)"**, dan tombol **"Hapus"** (Delete).
  ![alt text](image-5.png)

### Screenshot 4: Bukti Penolakan Validasi Sisi Server (Zod Error Banner)
  Data tidak sah dan pesan error Zod:
  ![alt text](image-3.png)

### Screenshot 5: Inspeksi Visual Database PostgreSQL (Prisma Studio)
  Patient:
  ![alt text](image.png)
  Appointment:
  ![alt text](image-1.png)
  AccessGrant:
  ![alt text](image-2.png)
---

## 8. Petunjuk Menjalankan Aplikasi Secara Mandiri

### 8.1 Prasyarat Lingkungan
- **Node.js**: Versi $\ge$ 20.x (disarankan LTS)
- **PostgreSQL**: Versi 17 aktif di `localhost:5432` dengan database `resilio_health`

### 8.2 Langkah Instalasi & Menjalankan
```bash
# 1. Masuk ke direktori proyek
cd "Projek Tubes"

# 2. Pasang dependensi
npm install

# 3. Siapkan environment database
cp .env.example .env
# Sesuaikan DATABASE_URL di berkas .env:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/resilio_health?schema=public"

# 4. Jalankan migrasi skema dan seeder idempoten
npx prisma migrate dev
npx prisma db seed

# 5. Jalankan automated test suite
npm run lint
npx vitest run

# 6. Jalankan server aplikasi web
npm run dev
# Buka http://localhost:3000 pada peramban
```
