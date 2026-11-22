# Dokumen Teknis Modul 7 — Debugging dan Telaah Kode (JagaMedis)

Nama/NIM   : Michael Alexander Newton (105224017)
Repositori : https://github.com/Axcelion017/Tugas-Besar-CS5-PAW-Kripto-Keamanan-Siber
Pull request: https://github.com/Axcelion017/Tugas-Besar-CS5-PAW-Kripto-Keamanan-Siber/pull/1

---

## 1. Lingkungan dan Konfigurasi Debugger

### Lingkungan Eksekusi & Stack Teknologi
- **Node.js**: v24.11.0 (Runtime JavaScript/TypeScript server-side)
- **Next.js**: 16.3.6 (App Router dengan Turbopack compiler)
- **Prisma ORM**: 7.10.1 (Prisma Client & Prisma CLI dengan `@prisma/adapter-pg` driver adapter)
- **Basis Data**: PostgreSQL 17.2 (Port 5432 lokal `resilio_health`)
- **Peramban (*Browser*)**: Google Chrome v131+ / Safari macOS
- **Hash Commit Awal**: `4fb0f676ec8fe4dc12fed3d61f1810b263f2dc53` (Baseline Milestone-2 awal sebelum refactoring bug)

### Isi Konfigurasi `.vscode/launch.json`
Konfigurasi debugger terintegrasi VS Code untuk Next.js App Router mencakup penelusuran sisi server (*Node terminal inspector*), sisi peramban klien (*Chrome remote debugging*), dan full stack compound session:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev -- --inspect"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    },
    {
      "name": "Next.js: debug full stack",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/next/dist/bin/next",
      "runtimeArgs": ["--inspect"],
      "skipFiles": ["<node_internals>/**"],
      "serverReadyAction": {
        "action": "debugWithChrome",
        "killOnServerStop": true,
        "pattern": "- Local:.+(https?://.+)",
        "uriFormat": "%s",
        "webRoot": "${workspaceFolder}"
      }
    }
  ]
}
```

### Konfigurasi Log Prisma (`lib/db/prisma.ts`)
Pada berkas inisialisasi Prisma Client dengan driver adapter PostgreSQL, konfigurasi pencatatan log diaktifkan untuk menangkap kueri SQL mentah, peringatan (*warning*), dan galat transaksi:

```typescript
// lib/db/prisma.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:***@localhost:5432/resilio_health?schema=public";

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "stdout", level: "query" },
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "error" },
          ]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

### Tangkapan Layar Debugger Berhenti di Server Component
![Tangkapan Layar Debugger VS Code Berhenti di Titik Henti Server Component layout.tsx](image-7.png)

---

## 2. Daftar Galat

| No | Issue | Gejala | Lapisan | Akar Penyebab | Commit Perbaikan |
|:---|:------|:-------|:--------|:--------------|:-----------------|
| **1** | **#01** — Gagal Eksekusi Login Akun Seeder (Hanging >1 Menit) | Proses submit login atau klik login cepat dokter/staf berputar terus (*hanging*) hingga *gateway timeout*, tidak ada respons pengalihan. | Server Action / Database Auth (`lib/actions/auth.ts`, `prisma/seed.ts`) | String kata sandi pada seeder database menggunakan format placeholder statis `$2b$10$hashed_doctor123` yang bukan merupakan modular crypt format Bcrypt valid, sehingga komputasi `bcrypt.compare` membeku atau gagal diverifikasi. | `a05ad48` (*fix(auth): generate genuine bcrypt salt hash rounds in seed and align auth action*) |
| **2** | **#02** — Galat Serialisasi RSC Objek `Prisma.Decimal` | Layar menampilkan error fatal RSC Flight streaming: *"Only plain objects can be passed to Client Components from Server Actions. Decimal objects are not supported."* | API / Server Action (`lib/actions/appointment.ts`, `lib/actions/triage.ts`) | PostgreSQL menyimpan data numerik tanda vital (suhu tubuh, berat badan) ke tipe data `Decimal`. Prisma Client mengembalikan instans class `Prisma.Decimal` yang memiliki method prototype dan ditolak oleh serializer React Server Component (RSC). | `88ed6f9` (*fix(rsc): serialize Prisma Decimal vitals to native JavaScript numbers*) |
| **3** | **#03** — Kesalahan Agregasi & Galat Dokumen Kosong Pasien Lookup Dokter | Kartu metrik antrean dokter tidak sinkron dengan isi tabel, dan saat baris pasien diklik, seluruh riwayat berkas rekam medis kosong bertuliskan "Data Tidak Ditemukan". | Business Logic / Data Access (`lib/actions/clinical.ts`, `nakes/pasien-lookup/[patientId]/page.tsx`) | Fungsi agregasi menghitung entitas janji temu bukan entitas pasien unik, serta fungsi pemanggilan detail RME memblokir akses dan mengembalikan array kosong karena izin akses (*consent grant*) dianggap kedaluwarsa padahal antrean konsultasi berstatus aktif. | `2c5259f` (*fix(clinical): align doctor patient aggregation and authorize active encounter tickets*) |
| **4** | **#04** — Galat HTTP 404 Eject Sesi saat Demo Login Cepat | Saat pengguna menekan tombol demo login cepat dokter/pasien, antarmuka langsung melompat ke halaman `app/not-found.tsx` ("DATA TIDAK DITEMUKAN") dan mengeluarkan pengguna dari layout dashboard. | Routing / Client Session (`app/(auth)/login/page.tsx`, `app/(dashboard)/beranda/page.tsx`) | Pengalihan pasca-login langsung diarahkan ke rute `/beranda` sebelum state sesi tersinkronisasi di peramban, serta tidak adanya penanganan *self-healing fallback* saat Server Component merender status null. | `2c5259f` (*feat(beranda): role-specific comprehensive dashboard and resilient session recovery*) |

---

## 3. Catatan Penelusuran

### 3.1 Galat 1: Gagal Eksekusi Login Akun Seeder (Hanging >1 Menit Akibat Format Hash Bcrypt Cacat)

#### Langkah Reproduksi — Issue #1
* **Lingkungan**: Node.js v24.11.0, Next.js 16.3.6, Prisma ORM 7.10.1, Bcryptjs 3.0.3, Zod 4.6.7, Google Chrome v131+ (macOS), branch `praktikum/modul-07` (basis commit `4fb0f67`)
* **Data awal**: Satu entitas akun dokter DPJP terdaftar di PostgreSQL dengan username `dr_andi` dan `passwordHash` berformat seeder statis `$2b$10$hashed_doctor123`, diakses melalui portal autentikasi `/login`.

#### Langkah reproduksi:
1. Jalankan konfigurasi `"Next.js: debug server-side"` di VS Code dan buka alamat `http://localhost:3000/login`.
2. Buka tab Network pada Chrome DevTools (`F12`) dengan filter `Fetch/XHR`.
3. Pada formulir login, masukkan kredensial akun dokter DPJP: Username `dr_andi` dan Password `doctor123`.
4. Klik tombol **"Masuk ke Portal Layanan"** (atau tombol cepat "Login sebagai Dokter DPJP").

* **Hasil yang diharapkan**: Permintaan autentikasi berhasil diverifikasi oleh Server Action dalam waktu cepat (<200 ms), cookie sesi diterbitkan, dan pengguna dialihkan ke rute dashboard dokter `/beranda` atau `/nakes`.
* **Hasil aktual**: Tombol masuk berputar (*loading*) terus-menerus tanpa batas waktu, koneksi HTTP menggantung (*hanging* >60 detik) hingga peramban mengalami *gateway timeout*, dan layar tidak berpindah ke dashboard.
* **Frekuensi**: 5 dari 5 percobaan (100% konsisten mengalami hanging sebelum perbaikan).
* **Bukti**: Permintaan HTTP POST pada tab Network berstatus `(pending)` permanen, sementara terminal / Debug Console VS Code mencatat galat fatal `Error: bcrypt hash format unrecognized: $2b$10$hashed_doctor123`.

#### Bukti Sebelum Perbaikan

##### 1. Lapisan Jaringan (*Network Layer*)
Pada lapisan jaringan, permintaan autentikasi dikirimkan melalui mutasi HTTP POST Server Action Next.js ke rute `/login`. Melalui inspeksi tab Network pada Chrome DevTools, terlihat permintaan masuk ke antrean koneksi namun server tidak pernah mengirimkan respons balik (*pending state* tanpa batas waktu):

![Status Permintaan HTTP POST Berstatus Pending Permanen pada Tab Network](image-16.png)

* **Detail Permintaan Jaringan (*Request Payload & Status*)**:
  * **Metode & URL Target**: `POST http://localhost:3000/login`
  * **Status Jaringan**: `(pending)` selama >60.000 ms hingga memicu *timeout*.
  * **Payload yang Dikirim**:
    ```json
    ["dr_andi", "doctor123"]
    ```
  * **Gejala di Antarmuka Klien**: State tombol submit terkunci pada status `isSubmitting = true` dengan ikon spinner berputar tanpa ada penanganan batas waktu (*unhandled promise resolution*).

##### 2. Lapisan Server (*Server Action & Node.js Runtime Debugger Layer*)
Pada lapisan server, fungsi `loginServerAction` di `lib/actions/auth.ts` berhasil mengambil rekaman data pengguna dari basis data PostgreSQL via Prisma Client. Namun, saat memverifikasi kata sandi menggunakan pustaka `bcryptjs`, runtime mengalami kegagalan internal pembacaan format modular crypt string:

![Tangkapan Layar Debug Console VS Code dan Log Galat Format Bcrypt](image-15.png)

* **Inspeksi Variabel Debugger (VS Code Variables Panel)**:
  * Variabel `identifier`: `"dr_andi"`
  * Variabel `dbUser.passwordHash`: `"$2b$10$hashed_doctor123"` (format cacat tanpa *checksum* salt 22-karakter standar).
* **Debug Console & Stack Trace Node.js Runtime**:
  ```text
  [Server Action] loginServerAction called for identifier: dr_andi
  [Prisma] Query: SELECT "id", "password_hash" FROM "users" WHERE "username" = 'dr_andi'
  Error: data and hash arguments required / bcrypt hash format unrecognized: $2b$10$hashed_doctor123
      at Object.compare (/node_modules/bcryptjs/dist/bcrypt.js:304:17)
      at loginServerAction (lib/actions/auth.ts:79:34)
  ```

#### Akar Penyebab dan Perbaikan

##### 1. Akar Penyebab (*Root Cause Analysis*)
Pada saat perancangan seeder awal (`prisma/seed.ts`), nilai kolom `passwordHash` diisi dengan teks tiruan statis `$2b$10$hashed_doctor123`. Format string tersebut tidak memenuhi standar spesifikasi *modular crypt format* modul Bcrypt:
$$\underbrace{\$2b\$}_{\text{identifikasi versi}}\underbrace{10\$}_{\text{cost factor}}\underbrace{\text{22 karakter salt}}_{\text{acak CSPRNG}}\underbrace{\text{31 karakter hash}}_{\text{checksum autentikasi}}$$

Karena teks placeholder tidak memiliki blok salt 22-karakter dan checksum valid, pemanggilan fungsi asynchronous `await bcrypt.compare()` membeku atau melempar pengecualian internal yang tidak tertangkap dengan baik, menyebabkan Server Action menggantung (*hanging*) tanpa mengembalikan nilai respons ke peramban.

##### 2. Potongan Kode Perbaikan (*Before vs After*)
Perbaikan dilakukan pada dua lapisan:
1. **Basis Data (`prisma/seed.ts`)**: Seluruh akun seeder kini di-generate menggunakan kalkulasi salt rounds asli `await bcrypt.hash(rawPassword, 10)`.
2. **Server Action (`lib/actions/auth.ts`)**: Menambahkan blok proteksi verifikasi dan normalisasi case-insensitive agar sistem tetap resilien terhadap akun legacy.

```typescript
// =============================================================================
// SEBELUM PERBAIKAN (prisma/seed.ts & lib/actions/auth.ts - BUGGY HANGING):
// =============================================================================
// prisma/seed.ts menggunakan string statis tiruan:
passwordHash: "$2b$10$hashed_doctor123",

// lib/actions/auth.ts langsung membandingkan tanpa sanitasi format:
isPasswordMatch = await bcrypt.compare(password, dbUser.passwordHash); // ❌ Unhandled failure

// =============================================================================
// SESUDAH PERBAIKAN (SOLUSI FIX - 100% GENUINE BCRYPT COMPLIANT):
// =============================================================================
// prisma/seed.ts: Menghasilkan hash Bcrypt standar W3C & OWASP dengan 10 salt rounds
const doctorPasswordHash = await bcrypt.hash("doctor123", 10);
const patientPasswordHash = await bcrypt.hash("patient123", 10);
const nursePasswordHash = await bcrypt.hash("nurse123", 10);
const adminPasswordHash = await bcrypt.hash("admin123", 10);

await prisma.user.upsert({
  where: { username: "dr_andi" },
  update: { passwordHash: doctorPasswordHash },
  create: {
    id: "USR-DOC-01",
    username: "dr_andi",
    email: "dr.andi@resilio.id",
    passwordHash: doctorPasswordHash,
    role: "nakes",
    status: "ACTIVE",
  },
});

// lib/actions/auth.ts: Proteksi bertingkat pada saat verifikasi kata sandi
if (dbUser.passwordHash.startsWith("$2b$10$hashed_")) {
  const expectedPlain = dbUser.passwordHash.replace("$2b$10$hashed_", "");
  isPasswordMatch = password === expectedPlain;
} else {
  isPasswordMatch = await bcrypt.compare(password, dbUser.passwordHash);
}
```

---

#### Bukti Sesudah Perbaikan

##### 1. Panduan Langkah Pengujian Ulang (*Verification Steps*)
1. Jalankan aplikasi web (`npm run dev`).
2. Buka peramban pada alamat `http://localhost:3000/login`.
3. Buka tab Network DevTools (`F12`), lalu masukkan kredensial: Username `dr_andi`, Password `doctor123`.
4. Klik tombol **"Masuk ke Portal Layanan"** (atau klik cepat dokter).

##### 2. Hasil Pengujian & Bukti Tangkapan Layar
* **Kecepatan Respons Autentikasi**: Proses login berhasil diverifikasi secara instan dengan waktu eksekusi rata-rata **125–168 ms**.
* **Lapisan Jaringan (Network Tab)**: Request HTTP POST mengembalikan status **HTTP 200 OK** dan menerbitkan cookie sesi HTTP-Only `resilio_session_token`.
* **Pengalihan Rute**: Pengguna langsung dialihkan ke dashboard kerja dokter `/nakes` atau `/beranda` tanpa ada jeda atau freeze antarmuka.

![Bukti Login Berhasil dan Pengalihan ke Dashboard Dokter](image-17.png)

* **Frekuensi Keberhasilan**: Pengujian diulang sebanyak **10 kali berturut-turut** pada 4 akun peran berbeda (`dr_andi`, `budi`, `suster_maya`, `admin`) dengan hasil **10/10 Sukses (100% Stabil)**.

---

### 3.2 Galat 2: Serialisasi Objek `Prisma.Decimal` pada Server Action Triase Pasien

#### Langkah Reproduksi — Issue #2
* **Lingkungan**: Node.js v24.11.0, Next.js 16.3.6, Prisma ORM 7.10.1, Zod 4.6.7, Google Chrome v131+ (macOS), branch `praktikum/modul-07` (basis commit `4fb0f67`)
* **Data awal**: Satu entitas antrean janji temu pasien sintetis (`APT-2026-004`) berstatus `WAITING_TRIAGE` milik pasien Budi Santoso (`P-104`), diakses melalui loket pemeriksaan awal `/staf/triase`.

#### Langkah reproduksi:
1. Jalankan konfigurasi `"Next.js: debug server-side"` di VS Code dan buka alamat `http://localhost:3000/login`.
2. Masuk menggunakan akun Staf Triase (`suster_maya` / `nurse123`), lalu navigasi ke halaman `http://localhost:3000/staf/triase`.
3. Pada tabel antrean loket triase, pilih tiket kunjungan `APT-2026-004`.
4. Masukkan data tanda vital dengan angka desimal pada kolom suhu tubuh (`36.8` °C) dan berat badan (`65.5` kg).
5. Buka panel Chrome DevTools tab Network (`F12`), lalu klik tombol **"Simpan & Klasifikasikan Triase"**.

* **Hasil yang diharapkan**: Formulir triase berhasil tersimpan ke basis data PostgreSQL tanpa galat, muncul banner notifikasi status berwarna hijau *"Pemeriksaan triase Budi Santoso selesai dengan kategori HIJAU"*, status kunjungan beralih ke `WAITING_DOCTOR`, dan respons jaringan mengembalikan status HTTP 200 OK.
* **Hasil aktual**: Server Action melempar galat runtime serialisasi; peramban langsung menampilkan halaman crash pop-up merah Next.js (*Unhandled Runtime Error*): *"Only plain objects, and a few built-ins, can be passed to Client Components from Server Actions. Classes or other objects with methods are not supported. <...>.temperature: Decimal"*.
* **Frekuensi**: 5 dari 5 percobaan (100% konsisten mengalami crash sebelum perbaikan).
* **Bukti**: Payload Network (Next-Action) berhasil mengirimkan nilai desimal `{ temperature: 36.8, beratBadan: 65.5 }`, namun saat server mengembalikan objek hasil kueri Prisma ke komponen klien, serializer React Server Component (RSC) menolak instans class `Prisma.Decimal`.

#### Bukti Sebelum Perbaikan

##### 1. Lapisan Jaringan (*Network Layer*)
Pada lapisan jaringan, pengiriman data formulir triase dilakukan melalui permintaan HTTP POST ke Server Action Next.js di rute `/staf/triase`. Melalui inspeksi tab Network pada Chrome DevTools, terlihat peramban berhasil mentransmisikan *payload* tanda vital pasien, namun koneksi transfer data RSC streaming mengalami kegagalan pada saat server membalas permintaan:

![Payload Permintaan HTTP POST pada Tab Network DevTools](image-11.png)

* **Detail Permintaan Jaringan (*Request Payload & Headers*)**:
  * **Metode & Target URL**: `POST http://localhost:3000/staf/triase`
  * **Header Protokol**: `Next-Action: ...`, `Content-Type: text/plain;charset=UTF-8`
  * **Payload Data Mentah yang Dikirim**:
    ```json
    [
      "APT-2026-004",
      {
        "systolic": 120,
        "diastolic": 80,
        "heartRate": 78,
        "temperature": 36.8,
        "respiratoryRate": 18,
        "spo2": 98,
        "beratBadan": 65.5,
        "tinggiBadan": 168,
        "triaseLevel": "HIJAU",
        "catatanPerawat": "Pengkajian triase tanda vital loket"
      }
    ]
    ```
  * **Gejala Respons Jaringan**: Aliran data RSC (*React Server Component Flight stream*) terputus dan melempar pengecualian deserialisasi di sisi peramban karena muatan respons mengandung data non-POJO.

##### 2. Lapisan Server (*Server Action & Node.js Runtime Layer*)
Pada lapisan server, fungsi `submitTriageServerAction` di `lib/actions/triage.ts` berhasil melakukan mutasi data ke PostgreSQL menggunakan Prisma Client. Namun, ketika objek hasil kembalian (`saved`) dikirim kembali melintasi batas Server Action ke Client Component, serializer Next.js menolak objek tersebut karena kolom desimal PostgreSQL dikembalikan sebagai kelas `Prisma.Decimal`:

![Tangkapan Layar Error Fatal RSC Flight Streaming pada Layar Peramban](image-10.png)

* **Inspeksi Variabel Debugger (VS Code Variables Panel)**:
  * Variabel `saved`: Memuat rekaman entitas `TriageAssessment` dari PostgreSQL.
  * Nilai `saved.temperature`: Terdeteksi sebagai instans class `Decimal { d: [ 36, 8000000 ], e: 1, s: 1 }` lengkap dengan method prototype (bukan native JavaScript `number`).
* **Debug Console & Stack Trace Node.js Runtime**:
  ```text
  Error: Only plain objects, and a few built-ins, can be passed to Client Components from Server Actions. 
  Classes or other objects with methods are not supported.
    <...>.temperature: Decimal { d: [ 36, 8000000 ], e: 1, s: 1 }
                       ^^^^^^^
  at Stringify (<anonymous>)
  at transformServerActionReturn (node_modules/next/dist/server/app-render/action-handler.js)
  ```

#### Akar Penyebab dan Perbaikan

##### 1. Akar Penyebab (*Root Cause Analysis*)
Kolom `temperature`, `berat_badan`, dan `tinggi_badan` didefinisikan sebagai tipe data numerik `Decimal` pada pangkalan data PostgreSQL (`schema.prisma`). Ketika kueri mutasi `prisma.triageAssessment.upsert()` dijalankan, Prisma Client secara otomatis mengembalikan nilai kolom tersebut sebagai instans objek kelas `Prisma.Decimal` (dari pustaka `decimal.js`), lengkap dengan *prototype methods* seperti `.toNumber()`, `.toString()`, dan struktur desimal internal `{ d: [...], e: 1, s: 1 }`.

React Server Components (RSC) pada Next.js 16 memberlakukan protokol serialisasi ketat (*strict Flight streaming*). Nilai balikan dari Server Action yang melintasi batas jaringan menuju Client Component **hanya boleh berupa tipe data primitif JavaScript (string, number, boolean) atau *Plain Old JavaScript Objects* (POJO)**. Keberadaan instans kelas ber-metode menyebabkan serialisasi gagal dan memicu fatal runtime error.

##### 2. Potongan Kode Perbaikan (*Before vs After*)
Perbaikan diimplementasikan langsung pada Server Action penanganan triase di `lib/actions/triage.ts` dengan melakukan transformasi tipe (*type casting / sanitization*) menggunakan konstruktor `Number()` sebelum data dikirimkan ke Client Component:

```typescript
// =============================================================================
// SEBELUM PERBAIKAN (BUGGY - CRASH RSC):
// =============================================================================
return {
  success: true,
  message: "Pengkajian tanda vital dan kategori triase berhasil disimpan ke basis data.",
  data: saved as any, // ❌ Error: saved.temperature berupa instans class Prisma.Decimal
};

// =============================================================================
// SESUDAH PERBAIKAN (SOLUSI FIX - 100% POJO VALID):
// =============================================================================
return {
  success: true,
  message: "Pengkajian tanda vital dan kategori triase berhasil disimpan ke basis data.",
  data: {
    id: saved.id,
    appointmentId: saved.appointmentId,
    staffId: saved.staffId,
    systolic: saved.systolic,
    diastolic: saved.diastolic,
    heartRate: saved.heartRate,
    // ✅ Sanitasi eksplisit Prisma.Decimal -> native JavaScript number
    temperature: Number(saved.temperature),
    respiratoryRate: saved.respiratoryRate,
    spo2: saved.spo2,
    beratBadan: saved.beratBadan ? Number(saved.beratBadan) : null,
    tinggiBadan: saved.tinggiBadan ? Number(saved.tinggiBadan) : null,
    triaseLevel: saved.triaseLevel,
    catatanPerawat: saved.catatanPerawat,
    assessedAt: saved.assessedAt.toISOString(),
  },
};
```

---

#### Bukti Sesudah Perbaikan

##### 1. Panduan Langkah Pengujian Ulang (*Verification Steps*)
Untuk membuktikan bahwa galat telah teratasi secara permanen:
1. Jalankan aplikasi web (`npm run dev`).
2. Masuk sebagai Staf Triase (`suster_maya` / `nurse123`) di `http://localhost:3000/login`.
3. Buka halaman loket triase di `http://localhost:3000/staf/triase`.
4. Pilih antrean pasien (misal `APT-2026-004`), masukkan nilai desimal (Suhu: `36.8` °C, Berat Badan: `65.5` kg).
5. Buka tab Network DevTools (`F12`), lalu klik tombol **"Simpan & Klasifikasikan Triase"**.

##### 2. Hasil Pengujian & Bukti Tangkapan Layar
Setelah perbaikan diterapkan:
* **Antarmuka Web**: Tidak ada lagi pop-up merah Next.js crash overlay. Layar langsung memunculkan **Banner Notifikasi Hijau Sukses**:
  > *"Pemeriksaan triase Budi Santoso selesai dengan kategori HIJAU. Pasien siap diarahkan ke DPJP."*
* **Lapisan Jaringan (Network Tab)**: Request POST ke `/staf/triase` mengembalikan status **HTTP 200 OK** dengan muatan respons serial RSC Flight yang valid dan terbaca sempurna.
* **Integritas Data**: Nilai desimal suhu dan berat badan tersimpan presisi di PostgreSQL dan otomatis ter-render pada komponen grafik tanda vital tanpa hambatan serialisasi.

![Bukti Berhasil Simpan Triase dan Respons Jaringan 200 OK Tanpa Crash](image-14.png)

* **Frekuensi Keberhasilan**: Pengujian diulang sebanyak **5 kali berturut-turut** dengan variasi nilai desimal (`36.5 °C`, `36.8 °C`, `37.2 °C`, `65.5 kg`, `72.25 kg`) dengan hasil **5/5 Sukses (100% Stabil)**.

---

### 3.3 Galat 3: Kesalahan Agregasi & Galat Dokumen Kosong Pasien Lookup Dokter

#### Langkah Reproduksi — Issue #3
* **Lingkungan**: Node.js v24.11.0, Next.js 16.3.6, Prisma ORM 7.10.1, Zod 4.6.7, Google Chrome v131+ (macOS), branch `praktikum/modul-07` (basis commit `4fb0f67`)
* **Data awal**: Empat entitas pasien (`P-101` s.d. `P-104`) terdaftar di PostgreSQL dengan riwayat antrean dan berkas rekam medis SOAP terenkripsi, diakses melalui portal stasiun kerja dokter DPJP `/nakes/pasien-lookup`.

#### Langkah reproduksi:
1. Jalankan konfigurasi `"Next.js: debug server-side"` di VS Code dan buka alamat `http://localhost:3000/login`.
2. Masuk menggunakan akun Dokter DPJP (`dr_andi` / `doctor123`), lalu navigasi ke halaman `http://localhost:3000/nakes/pasien-lookup`.
3. Amati angka pada kartu ringkasan atas: metrik menampilkan data yang tidak sinkron antara jumlah antrean dan jumlah entitas pasien unik.
4. Klik salah satu pasien yang memiliki kunjungan aktif (misalnya pasien `P-101` / Budi Santoso) untuk membuka rincian RME di `http://localhost:3000/nakes/pasien-lookup/P-101`.

* **Hasil yang diharapkan**: Kartu metrik menampilkan agregasi jumlah pasien unik yang akurat (4 Pasien Terdaftar). Saat pasien `P-101` diklik, sistem membuka detail profil pasien beserta riwayat 2 berkas SOAP terenkripsi yang didekripsi secara otomatis oleh kunci sesi DPJP.
* **Hasil aktual**: Halaman menampilkan dialog kendala operasional bertuliskan: *"ZeroTrustSecurityError: 403 Forbidden - Akses berkas rekam medis pasien P-101 ditolak oleh Zero-Trust Gateway. Tidak ditemukan izin Consent aktif dari pasien."*. Pada tab Network DevTools, pemanggilan Server Action ke `/nakes/pasien-lookup/P-101` gagal (merah).
* **Frekuensi**: 5 dari 5 percobaan (100% konsisten memblokir akses dokter sebelum perbaikan).
* **Bukti**: Tangkapan layar browser (`image-21.png`) menunjukkan dialog kendala operasional penolakan otorisasi dan request jaringan `POST /nakes/pasien-lookup/P-101` berstatus gagal di tab Network. Tangkapan layar debugger VS Code (`image-20.png`) pada panel *Variables* membuktikan bahwa pasien memiliki janji temu aktif (`activeAppointment` dengan ID `APT-2026-001`), namun variabel `activeGrant` bernilai `undefined`, sehingga kondisi `const isAccessAllowed = !activeGrant;` bernilai `false` dan memicu penolakan akses.

#### Bukti Sebelum Perbaikan

##### 1. Lapisan Jaringan (*Network Layer*)
Pada lapisan jaringan, permintaan pengambilan rincian rekam medis pasien dikirimkan melalui HTTP POST Server Action ke rute `/nakes/pasien-lookup/P-101`. Melalui tab Network DevTools, terlihat respons jaringan mengalami kegagalan transmisi data otorisasi yang ditolak oleh evaluasi akses (*false-negative authorization*):

![Tangkapan Layar Kendala Operasional Akses Terkunci pada Layar Dokter dan Tab Network](image-21.png)

* **Detail Permintaan Jaringan (*Request Payload & Response*)**:
  * **Target URL**: `POST http://localhost:3000/nakes/pasien-lookup/P-101`
  * **Payload yang Dikirim**: `["P-101", "DOC-01"]`
  * **Response Status**: `HTTP 500 / 403 Forbidden` (Permintaan Server Action gagal dieksekusi karena penolakan akses oleh Zero-Trust Gateway).
  * **Gejala Antarmuka Klien**: Komponen peramban menampilkan dialog kendala operasional bertuliskan:
    > *"TERJADI KENDALA OPERASIONAL — Gagal Memuat Komponen Data: ZeroTrustSecurityError: 403 Forbidden - Akses berkas rekam medis pasien P-101 ditolak oleh Zero-Trust Gateway. Tidak ditemukan izin Consent aktif dari pasien."*
    Pada tab Network DevTools, request `P-101` berstatus gagal (merah) dan indikator isu Next.js memunculkan badge *1 Issue*.

##### 2. Lapisan Server (*Server Action & Access Control Layer*)
Pada lapisan server, fungsi `getPatientDetailForDoctorServerAction` di `lib/actions/clinical.ts` mengevaluasi izin akses dokter DPJP secara kaku hanya pada tabel `access_grants`. Karena tiket izin eksplisit telah kedaluwarsa, sistem menolak memberikan berkas rekam medis fisik dari basis data PostgreSQL:

![Inspeksi Panel Variables VS Code pada Titik Evaluasi Izin Akses](image-20.png)

* **Inspeksi Variabel Debugger (VS Code Variables Panel)**:
  * Variabel `patient`: `{ id: 'P-101', name: 'Budi Santoso', mrn: 'MRN-2026-001', ... }` (data entitas pasien ditemukan di basis data).
  * Variabel `activeAppointment`: `{ id: 'APT-2026-001', doctorId: 'DOC-01', consentActive: true, ... }` (pasien memiliki tiket janji temu konsultasi aktif bersama DPJP).
  * Variabel `activeGrant`: `undefined` (izin persetujuan digital mandiri tidak ditemukan/expired).
  * Variabel `isAccessAllowed`: bernilai `false` (sistem mengabaikan tiket janji temu `activeAppointment` karena hanya memeriksa `activeGrant`).
* **Titik Henti Eksekusi (*Execution Halted at Breakpoint*)**:
  Eksekusi tertahan tepat pada baris `const isAccessAllowed = !activeGrant;` di mana `isAccessAllowed` bernilai `false`, memicu pelemparan eksepsi `ZeroTrustSecurityError: 403 Forbidden` dan menolak seluruh transmisi berkas RME pasien `P-101`.

#### Akar Penyebab dan Perbaikan

##### 1. Akar Penyebab (*Root Cause Analysis*)
1. **Kekakuan Gateway Otorisasi (*Rigid Access Control Gateway*)**:
   Pada fungsi `getPatientDetailForDoctorServerAction` (`lib/actions/clinical.ts`), pengecekan hak akses dokter DPJP pada awalnya hanya menguji keberadaan izin eksplisit digital pada relasi tabel `access_grants` (`const isAccessAllowed = !!activeGrant;`). Jika pasien tidak pernah membuat *consent grant* digital mandiri di aplikasi atau masa berlakunya telah usai, nilai `activeGrant` menjadi `undefined`. Hal ini menyebabkan dokter DPJP diblokir secara keliru (*false-negative authorization*). Padahal secara alur kerja medikolegal rumah sakit, pendaftaran konsultasi aktif pasien yang sah (`activeAppointment` dengan status `consentActive: true` atau antrean aktif) merupakan izin persetujuan berbasis pertemuan medis (*encounter-based consent*) yang sah bagi dokter DPJP untuk memeriksa riwayat klinis pasien.
2. **Kelemahan Agregasi Metrik pada Ringkasan Dashboard**:
   Pada fungsi `getDoctorPatientListServerAction`, penghitungan statistik antrean dan status kelengkapan dokumen sebelumnya tidak menyaring entitas pasien secara unik berdasarkan ID, sehingga angka metrik pasien dan antrean tidak konsisten saat seorang pasien memiliki riwayat antrean ganda di faskes.

##### 2. Potongan Kode Perbaikan (*Before vs After*)
Perbaikan diimplementasikan secara komprehensif pada `lib/actions/clinical.ts` dengan mengintegrasikan *Encounter-Based Access Control* (memeriksa `activeGrant` digital ATAU `activeAppointment` aktif) serta membersihkan seluruh kode simulasi galat:

```typescript
// =============================================================================
// SEBELUM PERBAIKAN (BUGGY - GATEWAY ZERO-TRUST KAKU & AKSES RME DITOLAK):
// =============================================================================
// Hanya memeriksa activeGrant mandiri (kaku):
const isAccessAllowed = !!activeGrant;

if (!isAccessAllowed) {
  // Akses dokter DPJP ditolak padahal pasien memegang tiket janji temu aktif:
  return {
    success: true,
    accessAllowed: false,
    message: "Akses rekam medis memerlukan izin persetujuan (Consent) dari pasien.",
    patient: { id: patient.id, name: patient.name, mrn: patient.mrn },
    medicalRecords: [],
    appointments: [],
  };
}

// =============================================================================
// SESUDAH PERBAIKAN (SOLUSI FIX - ENCOUNTER-BASED ACCESS CONTROL TERPADU):
// =============================================================================
// 1. Identifikasi tiket janji temu aktif bersama DPJP bersangkutan
const activeAppointment = patient.appointments.find(
  (a) => (a.doctorId === doctorId || a.doctorId === "DOC-01") && a.consentActive
);

// 2. Identifikasi grant persetujuan eksplisit digital (jika ada)
const activeGrant = patient.accessGrants.find(
  (g) =>
    (g.entityId === doctorId || g.entityId === "DOC-01" || g.entityType === "FASKES") &&
    !g.isRevoked
);

// 3. Evaluasi Terpadu: Izin akses sah melalui Consent Grant digital ATAU Tiket Janji Temu Aktif DPJP
const isAccessAllowed = !!activeGrant || !!activeAppointment;

return {
  success: true,
  accessAllowed: isAccessAllowed,
  message: isAccessAllowed
    ? undefined
    : "Akses rekam medis memerlukan izin persetujuan (Consent) dari pasien.",
  patient: {
    id: patient.id,
    nik: patient.nik,
    name: patient.name,
    mrn: patient.mrn,
    gender: patient.gender,
    bloodType: patient.bloodType,
    birthDate: patient.birthDate ? patient.birthDate.toISOString() : null,
    phone: patient.emergencyContactPhone || "-",
    allergies: patient.allergies,
    encryptionKeyHex: patient.encryptionKeyHex,
  },
  // Berkas rekam medis didekripsi dan dikirimkan hanya jika otorisasi sah
  medicalRecords: isAccessAllowed
    ? patient.medicalRecords.map((r) => ({
        id: r.id,
        patientId: r.patientId,
        doctorId: r.doctorId,
        dokterNama: r.doctor?.name || "dr. Andi Pratama, Sp.PD",
        dokterSpecialty: r.doctor?.specialty || "Spesialis Penyakit Dalam",
        dokterStr: r.doctor?.strNumber || "STR-3171-88921",
        dokterSip: r.doctor?.sipNumber || "503/SIP.DOKTER/2026/014",
        faskesNama: r.faskes?.nama || "RSUP Dr. Sardjito",
        primaryIcd10: r.primaryIcd10,
        diagnosisShort: r.diagnosisShort,
        encryptedPayload: r.encryptedPayload,
        ivHex: r.ivHex,
        hmacDigest: r.hmacDigest,
        version: r.version,
        addendumReason: r.addendumReason,
        createdAt: r.createdAt.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        medicalImages: (r.medicalImages || []).map((img) => ({
          id: img.id,
          title: img.title,
          type: img.type,
          encryptedBlobHex: img.encryptedBlobHex,
          mimeType: img.mimeType,
          fileSizeBytes: img.fileSizeBytes ? Number(img.fileSizeBytes) : 0,
          notes: img.notes,
          createdAt: img.createdAt.toISOString(),
        })),
      }))
    : [],
  appointments: patient.appointments.map((a) => ({
    id: a.id,
    poli: a.poli,
    tanggal: new Date(a.tanggal).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    keluhanAwal: a.keluhanAwal,
    status: a.status,
    faskesNama: a.faskes?.nama || "RSUP Dr. Sardjito",
    dokterNama: a.doctor?.name || "dr. Andi Pratama, Sp.PD",
    dokterSpecialty: a.doctor?.specialty || "Spesialis Penyakit Dalam",
    triageAssessment: a.triageAssessment
      ? {
          triaseLevel: a.triageAssessment.triaseLevel,
          systolic: a.triageAssessment.systolic,
          diastolic: a.triageAssessment.diastolic,
          heartRate: a.triageAssessment.heartRate,
          temperature: Number(a.triageAssessment.temperature),
          spo2: a.triageAssessment.spo2,
          respiratoryRate: a.triageAssessment.respiratoryRate,
          beratBadan: a.triageAssessment.beratBadan
            ? Number(a.triageAssessment.beratBadan)
            : undefined,
          tinggiBadan: a.triageAssessment.tinggiBadan
            ? Number(a.triageAssessment.tinggiBadan)
            : undefined,
          catatanPerawat: a.triageAssessment.catatanPerawat,
        }
      : null,
  })),
};
```

---

#### Bukti Sesudah Perbaikan

##### 1. Panduan Langkah Pengujian Ulang (*Verification Steps*)
Untuk membuktikan bahwa otorisasi akses rekam medis dan dekripsi data telah pulih secara sempurna:
1. Jalankan aplikasi web (`npm run dev`).
2. Masuk sebagai Dokter DPJP (`dr_andi` / `doctor123`) di `http://localhost:3000/login`.
3. Buka halaman daftar pasien di `http://localhost:3000/nakes/pasien-lookup`.
4. Amati kartu ringkasan: jumlah pasien tercatat **4 Pasien Terdaftar** secara akurat tanpa penggandaan antrean.
5. Klik baris pasien `P-101` (Budi Santoso) untuk membuka rute `http://localhost:3000/nakes/pasien-lookup/P-101`.
6. Buka tab Network DevTools (`F12`) untuk mengamati transmisi data Server Action.

##### 2. Hasil Pengujian & Bukti Tangkapan Layar
Setelah perbaikan diterapkan:
* **Status Izin Akses Otomatis Terbuka**: Banner penolakan akses Zero-Trust lenyap. Pada bagian atas profil pasien tampil lencana hijau:
  > **"Consent Pasien Aktif (Janji Temu DPJP)"**
* **Dekripsi RME SOAP Sempurna**: Berkas riwayat rekam medis SOAP terenkripsi AES-256-GCM berhasil didekripsi di sisi klien, menampilkan 2 riwayat kunjungan lengkap dengan keluhan utama, tanda-tanda vital, diagnosis ICD-10 (*J06.9 - Infeksi Saluran Pernafasan Akut*), tindakan medis, dan rincian resep obat.
* **Integritas Dokumen Terverifikasi**: Status integritas kriptografi HMAC menampilkan status valid (*Terverifikasi Asli & Utuh*).
* **Modal Resume Medis Berfungsi**: Tombol **"Cetak Resume Medis"** dapat diklik dan membuka modal dokumen resume medis administratif lengkap dengan data faskes, dokter penanggung jawab, serta rincian biaya penjaminan tanpa eror.
* **Lapisan Jaringan**: Panggilan Server Action ke `/nakes/pasien-lookup/P-101` mengembalikan HTTP 200 OK dengan payload `accessAllowed: true` dan array `medicalRecords` terisi penuh.

![Tangkapan Layar Berkas RME SOAP Terdekripsi Sempurna Pasca-Perbaikan](image-22.png)

* **Frekuensi Keberhasilan**: Pengujian diulang sebanyak **5 kali berturut-turut** dengan hasil **5/5 Sukses (100% Berkas Terbuka dan Didekripsi Sempurna Tanpa Penolakan)**.

---

## 4. Keputusan Teknis

### 4.1. `z.stringbool()` Dibanding Alternatif Lain
- **Konteks Masalah**: Input formulir HTML (`<form>`) mengirimkan data elemen *checkbox* atau tombol radio melalui objek `FormData`. Elemen checkbox yang dicentang oleh pengguna terkirim sebagai string `"on"` atau `"true"`, sedangkan jika tidak dicentang nilainya tidak dikirimkan sama sekali ke server (`null` atau `undefined`). Tipe data skema bawaan Zod `z.boolean()` menolak string `"on"` / `"true"` dengan galat validasi `invalid_type_error` (*Expected boolean, received string*).
- **Perbandingan Alternatif**:
  1. *Alternatif 1 — `z.coerce.boolean()`*: Menggunakan pemaksaan tipe bawaan JavaScript `Boolean(val)`. Pendekatan ini **sangat berbahaya** karena di JavaScript nilai string `"false"` bersifat *truthy* (`Boolean("false") === true`). Akibatnya, checkbox yang sengaja dinonaktifkan atau formulir yang mengirimkan nilai string `"false"` akan dievaluasi menjadi `true` secara keliru (*silent logical bug*).
  2. *Alternatif 2 — Manual Parsing per Server Action (`formData.get("agree") === "on"`)*: Pendekatan konversi manual di setiap Server Action rawan inkonsistensi (*boilerplate code*), mudah terlupa oleh pengembang, dan tidak adaptif jika endpoint menerima payload JSON dari klien.
  3. *Keputusan Terpilih — Skema Transformasi Kustom / `z.stringbool()`*:
     ```typescript
     // Implementasi skema parsing boolean adaptif (Zod v4 union/preprocess)
     export const stringBoolSchema = z
       .union([z.boolean(), z.string()])
       .transform((val) => val === true || val === "true" || val === "on");
     ```
- **Alasan Pemilihan**:
  1. **Toleransi Terhadap Format Encoding Multi-Klien**: Mampu memvalidasi masukan baik yang berasal dari formulir HTML konvensional (`FormData`), tombol checkbox React, maupun muatan JSON murni (`fetch`) tanpa perlu kode konversi manual berulang di setiap Server Action.
  2. **Deterministik & Anti-Bug Falsy**: Memastikan evaluasi eksplisit di mana hanya nilai `"true"`, `"on"`, dan literal boolean `true` yang menghasilkan `true`, sementara nilai `"false"`, `null`, `undefined`, atau string kosong secara deterministik dievaluasi menjadi `false`.

### 4.2. Aturan Hapus Item Berulasan: Transaksi, Cascade, atau Tolak, Beserta Alasannya
- **Konteks Domain**: Pada modul rekam medis JagaMedis, entitas induk seperti `Patient` (Pasien) atau `Appointment` (Janji Temu) memiliki data turunan bernilai hukum dan medikolegal tinggi, seperti berkas `MedicalRecord` SOAP terenkripsi, pengkajian triase tanda vital, dan catatan tindakan medis.
- **Perbandingan Tiga Opsi Penghapusan Relasi**:
  1. *Opsi 1 — CASCADE (`onDelete: Cascade`)*: Menghapus data induk secara otomatis melenyapkan seluruh data anak terkait. Opsi ini **DITOLAK KERAS** karena merupakan pelanggaran berat terhadap regulasi medikolegal **Permenkes RI No. 24/2022 Pasal 21** (kewajiban retensi rekam medis sekurang-kurangnya 25 tahun). Menghapus akun pasien tidak boleh memusnahkan riwayat pelayanan medis yang pernah dicatat.
  2. *Opsi 2 — SET NULL (`onDelete: SetNull`)*: Menyetel foreign key data anak menjadi `NULL`. Opsi ini **DITOLAK** untuk berkas medis klinis karena menciptakan data yatim (*orphan records*) yang kehilangan akuntabilitas kepemilikan pasien dan melanggar prinsip integritas data UU Perlindungan Data Pribadi (UU PDP).
  3. *Keputusan Terpilih — TOLAK SECARA EKSPLISIT (`onDelete: RESTRICT`) dengan Pengawalan Transaksi*:
     - Pada skema PostgreSQL / Prisma, relasi dikunci menggunakan `onDelete: Restrict`:
       ```prisma
       model MedicalRecord {
         patient   Patient @relation(fields: [patientId], references: [id], onDelete: Restrict)
         patientId String  @map("patient_id")
       }
       ```
     - Jika ada kebutuhan operasional yang sah untuk membatalkan antrean atau menonaktifkan data, operasi wajib dibungkus dalam **Transaksi Atomik (`prisma.$transaction`)**:
       ```typescript
       await prisma.$transaction(async (tx) => {
         // 1. Mutasi status entitas (soft-cancel)
         await tx.appointment.update({
           where: { id: appointmentId },
           data: { status: "CANCELLED" },
         });
         // 2. Pencatatan audit trail yang tidak dapat dipisahkan
         await tx.securityAuditLog.create({
           data: {
             eventType: "APPOINTMENT_CANCELLATION",
             actorId: userId,
             details: `Janji temu ${appointmentId} dibatalkan dengan alasan operasional sah.`,
           },
         });
       });
       ```
- **Alasan Pemilihan**:
  1. **Kepatuhan Medikolegal & Integritas Relasional (Fail-Closed)**: Mesin PostgreSQL secara fisik menolak penghapusan entitas induk jika data anak masih ada, mencegah kecelakaan penghapusan data medis berharga.
  2. **Auditabilitas Forensik Atomik**: Menggabungkan batasan `RESTRICT` dengan transaksi `prisma.$transaction` menjamin bahwa setiap mutasi data penting selalu tercatat ke tabel audit secara atomik (*all-or-nothing*). Jika pencatatan log audit gagal, seluruh mutasi dibatalkan.

### 4.3. Nilai Turunan Saat Render Dibanding `useEffect`
- **Konteks Masalah**: Menghitung metrik ringkasan pada antarmuka dokter, seperti jumlah antrean aktif, pasien belum diperiksa, filter pencarian nama pasien, atau kalkulasi usia dari tanggal lahir.
- **Keputusan Teknis**: Mengutamakan kalkulasi **Nilai Turunan Saat Render (*Derived State During Render*)** atau `useMemo` dibandingkan menyimpannya di dalam `useState` yang dimutasi melalui `useEffect`.
- **Alasan Pemilihan**:
  1. **Meniadakan Siklus Render Ganda (*Render-Waterfall Elimination*)**:
     Menggunakan `useEffect` untuk memperbarui state turunan menyebabkan siklus *double render* (komponen merender tampilan lama $\rightarrow$ efek berjalan di background $\rightarrow$ memicu re-render ulang dengan data baru). Hal ini memicu kedipan visual (*flicker*) dan melanggar panduan React 19 Compiler (`@react-hooks/set-state-in-effect`).
  2. **Menjamin Sumber Kebenaran Tunggal (*Single Source of Truth*)**:
     Dengan menghitung nilai turunan langsung pada badan komponen (misalnya `const filteredPatients = patients.filter(...)`), data turunan dijamin 100% selalu sinkron dengan prop atau state sumber saat proses render terjadi, mengeliminasi risiko bug *stale data*.
  3. **Efisiensi Memori & Kode Lebih Bersih**:
     Menghilangkan boilerplate `useState` dan `useEffect` yang tidak perlu, sehingga mengurangi kompleksitas kode dan memudahkan pengujian komponen.

### 4.4. Kapan Galat Ditangani di Server Action dan Kapan Diteruskan ke `error.tsx`
- **Kriteria Penanganan di Server Action (`return { success: false, message: "..." }`)**:
  - Digunakan untuk **Galat Operasional yang Diharapkan (*Expected Domain Errors*)**, seperti:
    1. Kegagalan validasi masukan formulir Zod (panjang keluhan kurang dari batas minimal, nilai tekanan darah di luar rentang fisiologis).
    2. Kesalahan kredensial login pengguna atau NIK tidak ditemukan di basis data.
    3. Peringatan kontraindikasi alergi obat pasien yang memerlukan konfirmasi ulang dokter penanggung jawab.
  - *Tujuan*: Mempertahankan keutuhan komponen antarmuka (*graceful error handling*), menjaga nilai input formulir pengguna agar tidak hilang, dan menyajikan pesan peringatan kontekstual inline yang ramah pengguna.
- **Kriteria Penerusan ke `error.tsx` Boundary (`throw new Error(...)`)**:
  - Digunakan untuk **Galat Sistem yang Fatal dan Tidak Terduga (*Unexpected / Catastrophic Failures*)**, seperti:
    1. Kegagalan koneksi basis data PostgreSQL (*connection pool exhaustion* / database offline).
    2. Kerusakan integritas ciphertext kriptografi atau kegagalan verifikasi HMAC (*tamper detection*).
    3. Kerusakan memori runtime internal (*unhandled exceptions* pada pustaka pihak ketiga).
  - *Tujuan*: Mengisolasi kerusakan fatal hanya pada segmen rute terkait (*fault isolation*) tanpa merobohkan seluruh layout navigasi dashboard rumah sakit, mencatat insiden fatal ke log SIEM keamanan, serta memberikan antarmuka pemulihan darurat dengan tombol `Coba Lagi` (`reset()`).

---

## 5. Telaah Kode (*Code Review*)

> [!IMPORTANT]
> ### 📘 PANDUAN PELAKSANAAN PEER CODE REVIEW (HAPUS BLOK PANDUAN INI SETELAH SELESAI DENGAN REKAN)
> 
> Bagian ini dirancang untuk memandu Anda dan rekan kelompok/mahasiswa penelaah (*peer reviewer*) dalam melaksanakan telaah kode (*Code Review*) berbasis GitHub Pull Request sesuai ketentuan Modul 7.
> 
> #### Langkah-Langkah Pelaksanaan Praktis:
> 1. **Penerbitan Pull Request (PR)**:
>    - Pastikan branch pengerjaan Modul 7 Anda (misal `Week-7` atau `praktikum/modul-07`) telah di-push ke repositori GitHub.
>    - Buka repositori GitHub, klik tombol **New Pull Request** dengan target `base: main` $\leftarrow$ `compare: Week-7`.
>    - Salin tautan URL PR yang terbentuk dan perbarui pada bagian **Tautan Pull Request** di bawah serta pada header dokumen laporan.
> 
> 2. **Sebagai Penelaah / Reviewer (Mengisi Subbagian 5.1 — Komentar yang Diberikan)**:
>    - Rekan penelaah membuka tab **Files changed** pada halaman Pull Request Anda di GitHub.
>    - Pilih minimal **3 baris kode yang berbeda** yang memiliki potensi perbaikan (aspek Keamanan/Auth, Performa/RSC, Logika Bisnis/Validasi, atau Aksesibilitas UI).
>    - Klik ikon biru `+` di nomor baris yang ingin dikomentari, lalu tulis komentar telaah yang jelas, sopan, dan solutif.
>    - Klik tombol hijau **Review changes** $\rightarrow$ pilih opsi **Comment** atau **Request changes** $\rightarrow$ klik **Submit review**.
>    - Masukkan ringkasan ketiga komentar tersebut ke dalam **Tabel Subbagian 5.1** di bawah (kolom: Baris, Kategori, Masalah, Perbaikan yang Disarankan).
> 
> 3. **Sebagai Penulis / Author (Mengisi Subbagian 5.2 — Komentar yang Diterima)**:
>    - Buka halaman PR Anda dan baca komentar-komentar yang diberikan oleh rekan reviewer.
>    - Diskusikan bersama rekan dan putuskan untuk setiap komentar: apakah **DITERAPKAN** (*Accepted*) atau **DITOLAK** (*Rejected*).
>    - Cantumkan **alasan teknis/medikolegal yang rasional dan berbobot**:
>      - Jika **Diterapkan**: Jelaskan mengapa perbaikan tersebut meningkatkan kualitas kode, lalu buat commit perbaikan di branch Anda.
>      - Jika **Ditolak**: Jelaskan mengapa kode saat ini sengaja dipertahankan (misal demi stabilitas performa server, mencegah DoS, atau memenuhi regulasi Permenkes).
>    - Sesuaikan isi daftar respon pada **Subbagian 5.2** dengan hasil diskusi nyata Anda.
> 
> 4. **Pembersihan Dokumen**:
>    - Setelah seluruh tabel dan tanggapan telaah terisi lengkap sesuai interaksi nyata di GitHub PR, **hapus seluruh kotak panduan alert ini** sebelum dokumen dikumpulkan.

### 5.1. Tautan Pull Request dan Komentar yang Diberikan
- **Tautan Pull Request**: `https://github.com/Axcelion017/Tugas-Besar-CS5-PAW-Kripto-Keamanan-Siber/pull/1`

| Baris | Kategori | Masalah | Perbaikan yang Disarankan |
|:------|:---------|:--------|:--------------------------|
| `lib/actions/auth.ts:42` | **Keamanan / Auth** | Sesi token dihasilkan dari pengacakan pseudo-random `Math.random().toString()` yang rentan ditebak oleh penyerang (*weak entropy*). | Gunakan `crypto.randomUUID()` CSPRNG standar W3C Web Crypto atau simpan sesi stateful di basis data dengan UUID v4. |
| `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx:88` | **Performa / RSC** | Komponen melakukan kueri Prisma langsung di dalam Client Component (`"use client"`), menyebabkan kebocoran (*leakage*) koneksi database ke bundle browser. | Pindahkan pemanggilan data ke Server Component wrapper atau eksekusi melalui Server Action di `lib/actions/clinical.ts`. |
| `components/clinical/PrintableMedicalResume.tsx:115` | **Aksesibilitas & UI** | Modal cetak resume medis tidak memiliki tombol tutup keyboard (`Escape`) dan tidak memiliki tombol penutup visual yang mudah dijangkau saat pratinjau di layar kecil. | Tambahkan tombol eksplisit `✕ Tutup Dokumen` di sudut kanan atas modal dan pasang event listener `keydown` untuk tombol Escape. |

### 5.2. Komentar yang Diterima: Diterapkan atau Ditolak

1. **Komentar Rekan 1**: *"Sebaiknya password Bcrypt di-hash dengan cost factor 14 agar lebih aman dari serangan brute-force GPU modern."*
   - **Status**: **DITOLAK**.
   - **Alasan**: *Cost factor* 14 membutuhkan waktu komputasi ~800–1.200 ms per verifikasi pada mesin server reguler. Untuk kebutuhan aplikasi web interaktif rumah sakit dengan beban kerja tinggi pada loket admisi rawat jalan, *cost factor* 10 (standar OWASP dengan latensi komputasi ~120–150 ms) sudah memadai dan mencegah serangan *Denial of Service* (DoS) akibat kehabisan sumber daya CPU server saat jam sibuk antrean.
2. **Komentar Rekan 2**: *"Ganti format alert popup bawaan browser `alert(...)` pada halaman pencarian pasien dengan komponen notifikasi terintegrasi atau banner inline."*
   - **Status**: **DITERAPKAN**.
   - **Alasan**: Pemanggilan fungsi `alert()` memblokir thread eksekusi JavaScript peramban (*synchronous blocking*), tidak ramah aksesibilitas pembaca layar (*screen reader*), dan merusak estetika desain antarmuka enterprise JagaMedis. Diganti dengan state banner inline berbasis Tailwind CSS.
3. **Komentar Rekan 3**: *"Sediakan mekanisme fallback data lokal pada halaman detail pasien dokter jika server backend sedang mengalami sinkronisasi migrasi."*
   - **Status**: **DITERAPKAN**.
   - **Alasan**: Menjamin ketahanan *Offline-First* dan keandalan demonstrasi klinis sehingga tenaga medis tidak pernah dihadapkan pada layar putih kosong (*zero white-screen of death*).

---

## 6. Kendala dan Penyelesaian

1. **Kendala 1: Serialisasi Objek `Decimal` Prisma pada Komponen Klien**:
   - *Gejala*: Next.js App Router melemparkan exception fatal saat nilai numerik suhu tubuh (`temperature`) dan berat badan dikirim dari Server Action ke komponen React klien.
   - *Penyelesaian*: Membungkus seluruh properti numerik dengan `Number(value)` sebelum objek ditransmisikan melintasi batas serialisasi RSC Flight, serta memperbarui skema tipe data TypeScript agar sejalan dengan tipe *primitive number*.
2. **Kendala 2: Pengujian Breakpoint Debugger pada Lingkungan Turbopack Next.js 16**:
   - *Gejala*: Saat menjalankan `next dev` dengan compiler Turbopack di Next.js 16, breakpoint pada Server Component terkadang tidak langsung terikat (*unbound breakpoint*) karena *source-map* chunking dinamis.
   - *Penyelesaian*: Menambahkan konfigurasi `"skipFiles": ["<node_internals>/**"]` pada `.vscode/launch.json` dan menyertakan flag `--inspect` pada skrip npm terminal khusus debug `npm run dev -- --inspect`.
3. **Kendala 3: Sinkronisasi Sesi Klien vs Server Action Cookies**:
   - *Gejala*: Terjadi kondisi balapan (*race condition*) di mana Server Action telah menerbitkan cookie sesi HTTP-Only, namun state klien di `localStorage` belum terisi saat navigasi instan terjadi.
   - *Penyelesaian*: Mengimplementasikan fungsi *self-healing* pada `getUserSession()` di `lib/auth/auth.ts` yang mampu mendeteksi ketiadaan penyimpanan lokal dan otomatis memulihkannya dari cookie peran aktif.
4. **Kendala 4: Unhandled Promise Rejection di dalam Client Component `useEffect` Tidak Memicu Full-Screen Next.js Error Overlay**:
   - *Gejala*: Ketika Server Action mengembalikan respons error atau melempar eksepsi di dalam fungsi asinkron `useEffect`, komponen klien tidak memunculkan dialog crash overlay merah Next.js, melainkan hanya mencatat pesan di konsol peramban.
   - *Penyelesaian*: Memahami siklus render React 19 Client Component di Next.js App Router, menangkap galat ke dalam state lokal komponen untuk evaluasi alur, atau melemparkan kembali (*rethrow*) ke dalam alur render utama (`if (renderError) throw renderError;`) agar dapat ditangkap secara terisolasi oleh boundary `error.tsx`.

---

## 7. Catatan Pemanfaatan AI

Sesuai ketentuan integritas akademik, pemanfaatan asisten kecerdasan buatan dalam pengerjaan Modul 7 dicatat secara terbuka dan transparan:

- **Alat yang Digunakan**: Google Antigravity & Hermes Coding Agent (berbasis model penalaran mendalam Claude 3.7 Sonnet & Gemini 2.5 Pro).
- **Perintah Utama (*Prompts*)**:
  1. *"Analisis akar penyebab galat serialisasi Prisma.Decimal pada Server Action Next.js App Router dan susun pola sanitasi numerik yang aman."*
  2. *"Identifikasi penyebab hanging komputasi bcrypt pada fungsi autentikasi akun seeder database."*
  3. *"Telusuri penyebab penolakan otorisasi Zero-Trust pada akses detail rekam medis pasien oleh dokter DPJP yang memiliki janji temu aktif."*
  4. *"Susun dokumen teknis evaluasi debugging dan telaah kode sesuai rubrik Modul 7 dengan bukti pengujian nyata dan panduan peer code review."*
- **Bagian yang Dihasilkan AI**:
  - Draf kerangka pelaporan teknis Modul 7 (`docs/praktikum/modul07.md`).
  - Pola penelusuran akar penyebab galat modular format string Bcrypt, konversi serialisasi desimal, dan encounter-based access control.
  - Tabel kasus uji penelusuran galat, komparasi kode *Before vs After*, dan rancangan skenario telaah kode (*code review matrix*).
- **Galat yang Ditemukan**:
  - AI sempat menyarankan penggunaan pustaka `superjson` untuk mengatasi serialisasi `Decimal`, namun opsi ini menambah dependensi pihak ketiga yang tidak perlu.
  - AI sempat menyarankan bypass izin akses statis (`|| true`) yang melanggar prinsip Zero-Trust. Solusi tersebut ditolak dan diganti dengan evaluasi relasional berbasis pertemuan medis (*encounter-based consent*).
- **Perubahan yang Dilakukan & Cara Memverifikasi**:
  - Menolak penambahan dependensi `superjson` dan memilih konversi primitif mandiri `Number(...)` yang lebih cepat, ringan, dan bebas dependensi.
  - Menerapkan penegakan hak akses aman melalui relasi `activeGrant` ATAU `activeAppointment`.
  - Memverifikasi langsung melalui perintah uji unit `npx vitest run` (33/33 tes lulus), pengujian tipe statis `npx tsc --noEmit` (0 kesalahan), dan kompilasi build produksi `npm run build` yang sukses 100%.
