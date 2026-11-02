# CHANGELOG — Resilio-Health

Semua perubahan besar pada proyek Resilio-Health didokumentasikan di sini.

---

## [v0.2] - 2026-10-17 — Milestone 2 (Transformasi Modular 4 Peran, Zero-Trust & Ketahanan Offline-First)

### Pengembangan Aplikasi Web (PAW)
- **Penyelesaian Berkas Bukti Tugas 2 Tiga Mata Kuliah Terintegrasi (PAW, Kriptografi, KKS)**:
  - **Tugas 2 Kriptografi (Tag `v0.2`, Sub-CPMK 3)**:
    - Pembangunan laporan resmi `docs/Tugas2/Kriptografi/LaporanTugas2_Kripto.md` (Spesifikasi parameter AES-256-GCM, IV CSPRNG 96-bit, AAD context binding, HMAC-SHA256, panduan demonstrasi 3 menit).
    - Penyempurnaan `lib/crypto/aes.ts` dengan parameter AAD eksplisit dan pembuktian 5 skenario uji unit otomatis di `tests/crypto.test.ts` (100% lulus).
  - **Tugas 2 Keamanan Komputasi dan Siber (KKS, Penanda `sec-0.2`, Sub-CPMK 3)**:
    - Pembangunan berkas bukti pengerasan: `docs/Tugas2/KKS/LaporanTugas2_KKS.md`, `security/access-tests.md` (Matriks RBAC 4 peran & 8 skenario uji akses seimbang), `security/lynis-before.txt` (skor 58) & `security/lynis-after.txt` (skor 74), `security/image-scan-before.txt` (2 critical) & `security/image-scan-after.txt` (0 critical), serta SBOM CycloneDX `security/sbom.cdx.json`.
    - Integrasi pustaka `bcryptjs` (salt rounds 10) di `lib/actions/auth.ts` untuk slow hashing password di PostgreSQL, penyediaan `Dockerfile` non-root (`USER node`), dan `docker-compose.yml` dengan port database terisolasi.
    - Penambahan automated test suite matriks akses kontrol di `tests/access-control.test.ts` (8 tes lolos).
- **Penyempurnaan Halaman Notifikasi Akses Medis (Transformasi Audit Log ke Tampilan Pesan Transparansi)**:
  - Mengubah antarmuka `/pasien/audit-log` dari tabel log teknis yang kaku menjadi **Kotak Masuk Pesan Pemberitahuan Medis (*Notification Inbox & Message Viewer*)** yang mudah dipahami oleh pasien awam.
  - Setiap kali dokter membuka rekam medis, perawat menyelesaikan triase, izin akses diberikan, atau ada ancaman akses ilegal diblokir, sistem menampilkan surat pemberitahuan:
    - **Siapa yang melakukan** (Nama dokter/perawat, jabatan, faskes).
    - **Apa yang terjadi** (Uraian bahasa manusia yang ramah, bukan kode teknis SIEM).
    - **Target berkas** dan timestamp kejadian.
    - **Pilihan aksi**: Tombol pintas untuk langsung mencabut hak akses faskes bersangkutan (*1-Click Revoke*).
  - Pembangunan Server Action `getPatientAuditLogsServerAction` dan `createAuditLogServerAction` (`lib/actions/audit.ts`) untuk mengambil notifikasi langsung dari tabel `security_audit_logs` di PostgreSQL.
- **Dokumentasi Pengujian Lengkap & Bukti Milestone 2**:
  - Pembangunan berkas resmi laporan penugasan di `docs/Tugas2/PAW/LaporanTugas2.md` dan `docs/pengujian-milestone2.md` yang memuat deskripsi produk, perkembangan v0.1 ke v0.2, pemodelan database CDM/LDM Mermaid, bukti implementasi CRUD 2 entitas berelasi, 3 bukti penolakan validasi server Zod v4, tabel 10 skenario pengujian (100% lulus), pembuktian persistensi PostgreSQL, panduan 5 tangkapan layar, dan petunjuk instalasi lokal.
  - Penyempurnaan tombol aksi CRUD penuh pada antarmuka web:
    - Entitas `Appointment`: Pasien dapat melakukan *Reschedule* (UPDATE tanggal & jam) dan *Cancel* (DELETE tiket antrean) di `/pasien/booking`.
    - Entitas `AccessGrant`: Pasien dapat memperpanjang masa berlaku (+48 Jam UPDATE) dan menghapus permanen (DELETE rekaman izin) di `/pasien/consent`.
- **Penyempurnaan Dokumentasi Sistem (`README.md`)**:
  - Penambahan tabel rincian **Teknologi yang Digunakan (Tech Stack)** yang memetakan lapisan *Frontend*, *Runtime*, *Styling*, *Typography*, *Server Actions*, *PostgreSQL & Prisma ORM*, *Zod Schema Engine*, *W3C Web Crypto*, *PWA Service Worker*, *Vitest*, dan *ESLint*.
- **Penyempurnaan Alur Onboarding Cepat, Fitur Edit Data Diri & Restricted Mode Guard**:
  - **Perbaikan Bug Umur Dinamis**: menghapus nilai umur statis `age: 30`, kini umur dihitung secara dinamis dan presisi berdasarkan kolom `birthDate` dari database fisik (`calculateAge()`). Akun baru yang belum melengkapi tanggal lahir menampilkan status `"Belum diisi"`.
  - **Pembersihan Kebocoran Data Mock Lintas Akun**: seluruh halaman dasbor (`/pasien`, `/pasien/booking`, `/pasien/consent`, `/pasien/tiket-kendala`, `/nakes`, dan `/staf`) kini mengambil data antrean, izin akses, dan pengaduan murni dari basis data PostgreSQL via Server Actions, sehingga akun baru tidak lagi menampilkan riwayat milik akun lain.
  - **Standarisasi Ukuran Tulisan & Tipografi Enterprise**: merapikan ukuran font di seluruh kartu dan halaman dasbor, mengganti micro-font tidak terbaca (`text-[9px]`, `text-[10px]`, `text-[11px]`) dengan ukuran terstandar WCAG (`text-xs` 12px dan `text-sm` 14px) yang nyaman dibaca.
  - Pendaftaran Cepat Pasien Baru (`/register/pasien`): formulir awal disederhanakan hanya memerlukan Username unik, Nama Lengkap, Email, dan Kata Sandi (`RegisterPasienCepatSchema`).
  - Login Langsung Tanpa Tertahan (`loginServerAction`): akun baru berstatus `PENDING` langsung diizinkan login ke dasbor masing-masing.
  - Perbaikan Bug *Retrieve Data*: menghapus seluruh fallback statis (NIK Budi Santoso dan ID dokter demo `DOC-01`), pengambilan profil kini secara ketat membaca data unik pengguna aktif via `getPatientProfileServerAction(session.id)`.
  - Pembangunan Halaman Kelola Profil & e-KYC (`app/(dashboard)/pasien/profil/page.tsx`):
    - Bagian 1: Data Mandiri (Nomor HP, Golongan Darah, Riwayat Alergi, Kontak Darurat) dapat diubah kapan saja secara langsung ke database via `updatePatientProfileServerAction`.
    - Bagian 2: Data Sensitif (NIK 16 digit, Nama KTP, Tgl Lahir, Unggah KTP + Selfie ber-watermark) diajukan ke Admin Kemenkes via `submitKycVerificationServerAction`.
  - Mode Akses Terbatas (*Restricted Mode Guard*): jika akun belum berstatus `VERIFIED`, fitur booking dokter dan linimasa rekam medis dikunci dengan gembok visual dan banner peringatan edukatif.
- **Integrasi 100% Seluruh Skema Prisma ke Transaksi Basis Data PostgreSQL**:
  - Pembangunan suite Server Actions lengkap di `lib/actions/`:
    - `appointment.ts`: `createAppointmentServerAction`, `getAppointmentsServerAction`, `assignDpjpServerAction`, `updateAppointmentStatusServerAction` (tabel `appointments` & `active_encounters`).
    - `triage.ts`: `submitTriageServerAction` (tabel `triage_assessments`).
    - `consent.ts`: `getAccessGrantsServerAction`, `grantAccessServerAction`, `revokeAccessServerAction` (tabel `access_grants`).
    - `faskes.ts`: `getFaskesListServerAction`, `getFaskesDetailServerAction`, `toggleFaskesKillSwitchServerAction` (tabel `faskes`).
    - `ticket.ts`: `createTroubleTicketServerAction`, `getTroubleTicketsServerAction`, `resolveTroubleTicketServerAction` (tabel `trouble_tickets`).
  - Seluruh interaksi formulir pengguna di peramban (Booking antrean, Triase fisik, Penugasan DPJP ber-PIN, 1-Click Revoke, Pelaporan kendala, dan Saklar Ransomware Kill-Switch) kini langsung menulis dan membaca ke PostgreSQL fisik.
- **Alur Pendaftaran Pasien Baru & Siklus e-KYC Terintegrasi Basis Data (`User` & `KycSubmission`)**:
  - Penambahan kolom masukan **Kata Sandi Akun** dan **Konfirmasi Kata Sandi** (minimal 6 karakter) pada `RegisterPasienSchema` (`lib/validations/auth.ts`) dan form antarmuka `/register/pasien`.
  - Pembangunan Server Action `registerPasienServerAction`: melakukan mutasi transaksional ke PostgreSQL yang menyimpan akun `User` (dengan status `PENDING`), profil `Patient` (nomor MRN otomatis), dan berkas `KycSubmission` ber-watermark.
  - Pembangunan Server Action `approveKycServerAction` & `rejectKycServerAction`: saat Admin Kemenkes menyetujui e-KYC di `/admin/verifikasi-kyc`, status akun `User` di PostgreSQL seketika berubah menjadi `VERIFIED`.
  - Pembaruan `loginServerAction`: memvalidasi kredensial pengguna baru langsung terhadap database PostgreSQL; jika akun masih berstatus `PENDING`, sistem menolak masuk dengan pesan informatif kepatuhan verifikasi Kemenkes.
- **Integrasi Basis Data PostgreSQL Riil & Prisma 7 ORM (`prisma/` & `lib/db/`)**:
  - Konfigurasi Prisma 7 ORM (`prisma@7.10.1`, `@prisma/client@7.10.1`, `@prisma/adapter-pg`) dengan connection pool PostgreSQL (`pg`).
  - Pemodelan skema relasional 16 entitas (`prisma/schema.prisma`) dengan pemisahan folder backend yang terisolasi dari UI (`prisma/`, `lib/db/prisma.ts`, `lib/actions/`).
  - Eksekusi migrasi fisik SQL (`prisma/migrations/`) ke database PostgreSQL lokal `resilio_health`.
  - Pembangunan dan eksekusi skrip seeder idempoten (`prisma/seed.ts`) menggunakan pola **`upsert`** pada 16 model entitas untuk memastikan keamanan eksekusi berulang tanpa pelanggaran batasan unik.
- **Implementasi Server Actions ("use server") & Stateful Session Cookies**:
  - Pembangunan modul Server Action `lib/actions/clinical.ts`: mengimplementasikan pipeline mutasi klinis 6-tahap (Sesi -> Validasi Bentuk Zod -> Validasi Semantik Alergi UR-T10 -> Mutasi Enkripsi AES-GCM/HMAC -> `revalidatePath` -> `redirect`).
  - Pembangunan modul Server Action `lib/actions/auth.ts`: autentikasi server dengan penerbitan cookie sesi `resilio_session_token` berstatus `HttpOnly: true`, `SameSite: "lax"`, `Max-Age: 14400` (4 jam) yang terintegrasi dengan *Stateful Session Store* di server (`SERVER_ACTIVE_SESSIONS`) untuk mendukung *Instant Revocation* (UU PDP No. 27/2022).
  - Penghapusan sesi dan pemusnahan cookie via `logoutServerAction()` saat pengguna keluar.
- **Implementasi Skema Validasi Tipe Aman Zod v4 (`lib/validations/`)**:
  - Instalasi pustaka `zod` (^4.6.7) dan implementasi layer skema validasi terpusat:
    - `clinical.ts`: `PemeriksaanKlinisSchema` memvalidasi keluhan (S) 10–1.000 karakter, batas rentang fisiologis tanda vital (sistolik 70–250, diastolik 40–150, detak 40–220 bpm, suhu 30–45°C, SpO2 50–100%), daftar diagnosis resmi ICD-10 (`z.enum`), dan kotak centang konfirmasi medikolegal sebelum enkripsi.
    - `auth.ts`: `LoginSchema`, `RegisterPasienSchema` (validasi NIK regex 16 digit & kelengkapan berkas KYC), dan `RegisterNakesSchema` (validasi STR & SIP KKI/Dinkes).
    - `triage.ts`: `TriaseSchema` (parameter triase nakes), `WalkInAdmisiSchema` (pendaftaran loket), dan `AssignDpjpSchema` (pencocokan 6-digit PIN persetujuan).
    - `patient.ts`: `BookingSchema`, `TroubleTicketSchema`, dan `ConsentGrantSchema`.
  - Integrasi validasi formulir sisi klien dengan penanganan galat inline interaktif dan banner kesalahan informatif pada 7 modul utama.
  - Penambahan berkas uji unit otomatis `tests/validations.test.ts` (15 skenario uji positif, negatif, dan batas; total 19 unit test lulus 100%).
- **Arsitektur Modular 30 Rute Next.js**:
  - Restrukturisasi total dari prototipe monolitik ke Next.js 15 App Router dengan pemisahan wilayah publik `(auth)` dan 4 domain peran terproteksi `(dashboard)`.
  - Pembangunan subsistem baru: **Staf Nakes Faskes** (`app/(dashboard)/staf/`) yang mencakup admisi antrean walk-in, triase tanda vital fisik (Hijau/Kuning/Merah), penugasan DPJP, dan administrasi rujukan antar faskes.
  - Implementasi *Progressive Web App (PWA)* dengan engine IndexedDB lokal berkapasitas besar untuk mengatasi batas 5 MB `localStorage`.
- **Pengalaman Pengguna & Aksesibilitas Enterprise**:
  - Pustaka komponen vektor SVG monokrom profesional (`components/ui/Icons.tsx`) menggantikan seluruh emoji/simbol dekoratif.
  - Pustaka *Shimmer Skeleton* animasi berkilau (`components/ui/Skeleton.tsx`) dan konvensi resmi `loading.tsx` serta `error.tsx` untuk mencegah *layout shift* saat transisi rute.
  - Penanganan gangguan jaringan (*Offline-First Banner Notice*) dengan saklar simulasi pemutus koneksi (*Simulasi Putus* & *Pulihkan*).
  - Tampilan sepenuhnya responsif pada perangkat seluler (iPhone SE 375px), tablet, hingga layar monitor desktop tanpa *horizontal overflow*.

### Kriptografi (Kripto & KKS)
- **Enkripsi Citra Medis Biner (Blob Engine)**:
  - Dukungan berkas citra radiologi klinis (Foto Rontgen Thorax, USG Abdomen, Scan Lab, EKG). Berkas biner dienkripsi menggunakan AES-256-GCM dan diverifikasi dengan tag HMAC-SHA256 tersendiri di sisi peramban.
- **Zero-Knowledge Architecture**:
  - Seluruh isi formulir SOAP medis dan citra radiologi dienkripsi di peramban sebelum tersimpan di server. Admin regulator dan penyedia database hanya mengelola *opaque ciphertext*.
- **Prinsip Fail-Closed**:
  - Modifikasi sekecil 1 bit pada ciphertext atau IV korup seketika menolak proses dekripsi demi menjamin integritas data hukum medikolegal.
- **Pengujian Kriptografi Otomatis**:
  - 4 skenario unit test Vitest lulus 100% (`tests/crypto.test.ts`).

### Keamanan Komputasi dan Siber (KKS)
- **Zero-Trust BOLA / IDOR Gatekeeper & Active Encounter Ticket**:
  - Akses dokter terhadap rekam medis pasien dikunci secara atomik melalui tiket pertemuan aktif (*Active Encounter Ticket*) yang diverifikasi via PIN 6-digit pasien di loket triase. Dokter non-DPJP diblokir HTTP 403 Forbidden dan dicatat ke SIEM.
- **Protokol Akses Darurat IGD (Break-Glass Protocol)**:
  - Dokter IGD dapat membuka rekam medis pasien koma/kritis dengan wajib memilih indikasi kegawatan klinis (ISO 27799 / HIPAA); sistem seketika memicu alarm prioritas tinggi (*High-Severity Alert*) ke dasbor SIEM Admin Kemenkes.
- **Perlindungan Identitas e-KYC (Auto-Watermarking Canvas)**:
  - Kanvas peramban membubuhkan teks digital permanen *"HANYA UNTUK VERIFIKASI RESILIO-HEALTH - [TANGGAL]"* di atas foto KTP asli dan swafoto wajah sebelum berkas diunggah.
- **Integritas Medis & Immutable Addendum (Permenkes No. 24/2022)**:
  - Rekam medis yang telah ditandatangani bersifat permanen. Koreksi wajib menggunakan revisi bertingkat (*Addendum Versi 2*) berstempel waktu.
- **Deteksi Otomatis Kontraindikasi Alergi Klinis (UR-T10)**:
  - Peringatan merah berkedip saat dokter mengetik resep obat yang bertentangan dengan alergi pasien.
- **Ransomware Kill-Switch**:
  - Saklar pembeku akses faskes terinfeksi malware dari gateway RME nasional.

---

## [v0.1] - 2026-10-13 — Milestone 1 (Fondasi Responsif & Kriptografi Awal)
- Implementasi AES-256-GCM menggunakan Web Crypto API native (`lib/crypto/aes.ts`).
- Implementasi HMAC-SHA256 untuk verifikasi integritas data (`lib/crypto/hmac.ts`).
- Penambahan 4 skenario unit test otomatis pada `tests/crypto.test.ts` (uji positif, negatif, dan batas).
- Pembuatan antarmuka hub multi-peran awal di `/beranda`.
- Optimasi aksesibilitas WCAG 2.1 AA mencapai skor Lighthouse Accessibility $\ge 90$.
- Penyusunan dokumen STRIDE awal, Risk Register, DFD, dan Keterlacakan.
