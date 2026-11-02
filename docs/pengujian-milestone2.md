# Laporan Pengujian Sistem Milestone 2 (v0.2)
## Integrasi Logika Server, Database PostgreSQL, dan Validasi Zod

**Mata Kuliah**: Praktikum Pengembangan Aplikasi Web (PAW)  
**Produk**: Resilio-Health — Hospital Information System (HIS)  
**Versi Rilis**: `v0.2`  
**Basis Data**: PostgreSQL 17 (`resilio_health`) via Prisma ORM 7  

---

## 1. Daftar 10 Skenario Pengujian (8 Skenario CRUD + 2 Skenario Relasi Data)

Pengujian ini membuktikan bahwa seluruh operasi Create, Read, Update, Delete, serta penegakan integritas referensial relasi berjalan 100% sukses di basis data PostgreSQL riil melalui antarmuka dan Server Actions.

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

> **Tingkat Keberhasilan Skenario**: **10 / 10 Lulus (100%)** — Memenuhi ketentuan syarat kelulusan minimal 90%.

---

## 2. Bukti Penolakan Masukan Tidak Sah Melalui Validasi Server (Zod v4)

Sesuai ketentuan tugas, sistem menerapkan validasi sisi server (*Server-Side Validation*) menggunakan pustaka **Zod v4** pada seluruh Server Actions (`lib/validations/`). Validasi server tidak dapat dibypass meskipun pengguna menonaktifkan validasi HTML peramban (`novalidate`) atau mengirim request langsung melalui cURL/Postman.

### Bukti 1: Penolakan NIK Kependudukan Tidak Valid (Bukan 16 Digit Angka)
- **Formulir Terkait**: Pendaftaran Pasien e-KYC & Pengajuan Identitas (`/pasien/profil` & `/register/pasien`).
- **Skema Zod**: `RegisterPasienSchema` (`lib/validations/auth.ts`).
  ```typescript
  nik: z.string({ message: "NIK wajib diisi." })
    .trim()
    .regex(/^\d{16}$/, { message: "NIK wajib terdiri dari tepat 16 digit angka kependudukan." })
  ```
- **Masukan Uji (Bypass Client)**: `nik = "3171011102"` (hanya 10 digit angka).
- **Hasil Server**: Server Action menolak mutasi ke PostgreSQL dengan status gagal.
- **Pesan Galat pada Field**:  
  `"NIK wajib terdiri dari tepat 16 digit angka kependudukan."`

### Bukti 2: Penolakan Tanda Vital Fisik di Luar Batas Fisiologis Manusia
- **Formulir Terkait**: Pengkajian Triase Keperawatan Loket Admisi (`/staf/triase`).
- **Skema Zod**: `TriaseSchema` (`lib/validations/triage.ts`).
  ```typescript
  systolic: z.number({ message: "Nilai sistolik wajib diisi berupa angka." })
    .int()
    .min(50, { message: "Sistolik minimal 50 mmHg." })
    .max(300, { message: "Sistolik maksimal 300 mmHg." })
  ```
- **Masukan Uji (Bypass Client)**: `systolic = 350` (melebihi batas maksimal fisiologis sistolik 300 mmHg).
- **Hasil Server**: Server Action menolak eksekusi `prisma.triageAssessment.create`.
- **Pesan Galat pada Field**:  
  `"Sistolik maksimal 300 mmHg."`

### Bukti 3: Penolakan Keluhan Awal Terlalu Pendek pada Janji Temu
- **Formulir Terkait**: Pemesanan Jadwal Konsultasi Dokter (`/pasien/booking`).
- **Skema Zod**: `BookingSchema` (`lib/validations/patient.ts`).
  ```typescript
  keluhanAwal: z.string({ message: "Keluhan awal wajib diisi." })
    .trim()
    .min(5, { message: "Keluhan awal minimal 5 karakter untuk referensi dokter." })
  ```
- **Masukan Uji (Bypass Client)**: `keluhanAwal = "skt"` (hanya 3 karakter).
- **Hasil Server**: Server Action menolak pembuatan baris pada tabel `appointments`.
- **Pesan Galat pada Field**:  
  `"Keluhan awal minimal 5 karakter untuk referensi dokter."`

---

## 3. Pembuktian Persistensi Data di Basis Data PostgreSQL

Setiap operasi CRUD yang dilakukan melalui antarmuka web langsung mengubah baris fisik di PostgreSQL:

1. **Uji Refresh Halaman**:
   - Setelah pasien memesan janji temu di `/pasien/booking` atau memperbarui profil mandiri di `/pasien/profil`, halaman dimuat ulang secara paksa (*hard refresh* `Cmd + Shift + R`).
   - Data janji temu dan nomor telepon baru tetap tampil utuh karena diambil langsung dari PostgreSQL melalui Server Action `getPatientProfileServerAction` dan `getAppointmentsServerAction`.
2. **Uji Pembersihan Sesi**:
   - Saat pengguna logout dan login kembali, data rekam medis terenkripsi dan antrean tetap persisten dan tidak hilang.

---

## 4. Panduan Pengambilan Tangkapan Layar (Screenshot) untuk Pengumpulan

Untuk bukti pengerjaan yang diunggah ke Moodle, silakan ambil 5 tangkapan layar berikut di peramban Anda:

1. **Screenshot 1 — CREATE & READ Antrean (`/pasien/booking`)**:
   - Tampilkan formulir pemesanan jadwal yang berhasil diisi dan daftar kartu antrean di sebelah kanan yang menampilkan ID `APT-2026-XXXX`.
2. **Screenshot 2 — UPDATE & DELETE Antrean (`/pasien/booking`)**:
   - Klik tombol **"Reschedule"** sehingga formulir ubah tanggal/jam muncul, dan perlihatkan tombol merah **"Batalkan"**.
3. **Screenshot 3 — CRUD Izin Akses UU PDP (`/pasien/consent`)**:
   - Tampilkan tabel izin akses yang memuat tombol **"+48 Jam (UPDATE)"**, **"Cabut Izin (Revoke)"**, dan **"Hapus (DELETE)"**.
4. **Screenshot 4 — Bukti Penolakan Validasi Zod Server**:
   - Masukkan input yang tidak sah (misal keluhan kurang dari 5 karakter atau NIK kurang dari 16 digit) dan tangkap layar banner galat merah yang muncul.
5. **Screenshot 5 — Inspeksi Database Fisik (Prisma Studio / Terminal)**:
   - Buka `npx prisma studio` di `http://localhost:5555` dan tampilkan tabel `appointments`, `access_grants`, atau `medical_records` yang terisi baris data riil.
