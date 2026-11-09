# CHANGELOG — Resilio-Health

Semua perubahan besar pada proyek Resilio-Health didokumentasikan di sini.

---

## [v0.2.1] - 2026-11-08 — Integrasi Penuh Standar RME Permenkes RI No. 24/2022, Recharts, & Citra Biner
### Pembaruan Skema Basis Data & Kriptografi
- **Migrasi Non-Destruktif `enhance_ehr_permenkes24`**:
  - Penambahan kolom `vitalSignsTrend` (Json) dan `claimStatus` pada tabel `medical_records`.
  - Penambahan kolom `fileSizeBytes` dan `binaryHmac` pada tabel `medical_images`.
- **Ekstensi Kriptografi Citra Medis Biner (`lib/crypto/aes.ts` & `hmac.ts`)**:
  - Implementasi fungsi `encryptBinaryAttachment` dan `decryptBinaryAttachment` untuk mengenkripsi biner citra medis (Rontgen, USG, EKG) dengan `AES-256-GCM` dan membubuhkan tanda tangan digital integritas `HMAC-SHA256` di sisi peramban klien.
  - Penambahan unit test Vitest ke-8 untuk enkripsi citra biner di `tests/crypto.test.ts` (lulus 100%).
- **Lapisan Penyimpanan Offline PWA (`lib/storage/indexedDb.ts` & `public/sw.js`)**:
  - Implementasi wrapper `resilio_offline_db` dengan 3 Object Stores: `cached_active_patients`, `offline_clinical_outbox`, dan `offline_media_blobs`.
  - Pendaftaran Service Worker PWA dengan dukungan event `sync-medical-records` pada Background Sync API.

### Pembaruan Antarmuka & Logika Server
- **Formulir Terpadu 5-Tab Pemeriksaan Dokter (`/nakes/periksa/[bookingId]`)**:
  - **Tab 1: Administratif & Alergi**: Menampilkan ringkasan nomor rekam medis, penjamin BPJS/SEP, dan profil alergi kritis.
  - **Tab 2: Anamnesis & Fisik**: Pengkajian keluhan utama, skor GCS (Eye, Verbal, Motorik), dan tanda vital otomatis dari loket triase.
  - **Tab 3: Diagnosis & Citra Medis**: Autocomplete kode ICD-10 WHO dan uploader file citra medis terenkripsi biner.
  - **Tab 4: Penatalaksanaan & Resep**: e-Prescription dengan deteksi otomatis kontraindikasi alergi secara real-time dan prosedur ICD-9-CM.
  - **Tab 5: CPPT & Pengesahan**: Ringkasan SOAP, disposisi resume medis, dan kotak centang keabsahan medikolegal.
- **Implementasi Otomatisasi Hardened Node OS & Verifikasi Rubrik KKS (sec-0.2)**:
  - Menyediakan node virtual Ubuntu 22.04 LTS `resilio-node` dengan pengerasan OpenSSH Server (`PermitRootLogin no`, `PasswordAuthentication no`), firewall UFW, parameter sysctl, dan audit Lynis.
  - Skrip pengujian otomatis `scripts/verify-hardening.sh` memverifikasi seluruh butir rubrik penilaian KKS (SSH daemon `sshd -T`, Docker non-root `USER node`, `cap_drop: ALL`, port database terisolasi, dan berkas bukti di `security/`).
- **Pengalihan Otomatis Pasca-Login ke Beranda Terpadu (`/beranda`)**:
  - Memperbarui alur login pengguna (`app/(auth)/login/page.tsx` dan demo login di `app/page.tsx`) sehingga seluruh pengguna terverifikasi langsung diarahkan ke **Beranda Terpadu** (`/beranda`) yang memuat ringkasan eksekutif dan status kedaulatan data.
- **Penyempurnaan Tampilan Detail Penggunaan Resep Obat Pasien**:
  - Menambahkan pengurai cerdas `parsePrescriptionDetail` pada portal rekam medis pasien (`/pasien/rekam-medis` & `/pasien/rekam-medis/[recordId]`).
  - Setiap resep obat kini menyajikan detail penggunaan terstruktur: Nama Obat & Sediaan, Dosis, Aturan Minum (Signa), Waktu Minum (sebelum/sesudah makan), Tujuan Terapi Medis, dan Catatan Peringatan Khusus.
- **Restrukturisasi Format Cetak Rekam Medis Administratif Kontinu (`PrintableMedicalResume`)**:
  - Mengubah layout modal cetak dari bentuk kotak-kotak terpisah menjadi **Dokumen Administratif Kontinu Standar Rumah Sakit** (Permenkes RI No. 24/2022).
  - Menyajikan Kop Surat RS Resmi, Nomor Berkas & Lokasi Penyimpanan RME, Tabel Data Administratif Pasien Lengkap, Dokumentasi Klinis SOAP, Tabel Resep Obat, Rincian Biaya Billing, dan Blok Pengesahan DPJP/Perawat.
  - Menambahkan tombol **"✕ Tutup Dokumen"** yang jelas dan mencolok di bagian atas dan bawah view cetak.
- **Penyelesaian Bug Perhitungan Statistik & Penampilan Dokumen Rekam Medis**:
  - Memperbaiki ketidaksesuaian jumlah statistik pada `getDoctorPatientListServerAction`: metrik *Jumlah Pasien*, *Dalam Antrean*, *Menunggu TTD*, dan *Sudah TTD* kini dikalkulasi secara presisi per-pasien dan selaras 100% dengan filter tab daftar pasien.
  - Memperbaiki bug dokumen kosong (*empty medical records*) pada `getPatientDetailForDoctorServerAction`: daftar berkas RME kini selalu dikirimkan dan diizinkan secara sah bagi dokter DPJP penanggung jawab yang menangani pasien (`activeAppointment` & `activeGrant`), sehingga seluruh berkas SOAP dan citra radiologi/lab langsung tampil utuh.
- **Tampilan Daftar Pasien Berbentuk Tabel Bersih Tanpa Pemisah Kolom (`/nakes/pasien-lookup`)**:
  - Mengubah daftar pasien menjadi elemen `<table>` enterprise yang rapi: baris dipisahkan garis horizontal tipis (`divide-y divide-slate-100`) tanpa pemisah kolom vertikal yang kaku.
  - Interaksi baris kursor penuh (`hover:bg-slate-50/90 cursor-pointer`) untuk membuka detail rekam medis pasien secara instan.
- **Halaman Beranda Terpadu untuk Seluruh Pengguna (`/beranda`)**:
  - Membangun halaman ringkasan informasi terpadu yang dapat diakses oleh seluruh 4 peran (`pasien`, `nakes`, `staf`, `admin`).
  - Menampilkan ringkasan spesifik peran: metrik kedaulatan kriptografi klien W3C Web Crypto, antrean hari ini, RME terkini, janji temu poliklinik, kepatuhan Permenkes 24/2022, dan kesiapan SATUSEHAT.
  - Menambahkan tautan *"Beranda Terpadu"* pada menu navigasi utama sidebar `RoleNav.tsx`.
- **Fitur Jadwal Praktik Dokter Berbasis Kalender Mingguan (`/nakes/jadwal`)**:
  - Memisahkan jadwal dokter menjadi fitur mandiri dengan rute `/nakes/jadwal` dan tautan sidebar *Jadwal Praktik Mingguan*.
  - Menampilkan visualisasi kalender mingguan (Senin s.d. Minggu) dengan slot jam mulai-selesai presisi (`08:30 - 09:15`, `09:30 - 10:15`, `10:30 - 11:30`, `13:30 - 14:15 WIB`).
  - Menyertakan filter faskes praktik (karena dokter dapat berpraktik di berbagai rumah sakit: RSUP Dr. Sardjito, RS Harapan Sehat) dan indikator warna skala prioritas triase.
- **Penyempurnaan Fitur Surat Rujukan Dokter Lintas Rumah Sakit (`/nakes/periksa/[bookingId]`)**:
  - Mengintegrasikan pemilih Faskes Rujukan Tujuan resmi (`FAS-01` RSUP Dr. Sardjito, `FAS-02` RS Harapan Sehat, `FAS-03` Klinik Pratama, `FAS-04` Puskesmas).
  - Mengintegrasikan pemilih Dokter Spesialis Konsulen yang berpraktik di rumah sakit terkait, tingkat urgensi rujukan (Rutin / Mendesak 24 Jam / Transfer Ambulans Darurat), dan otomatis tercetak pada dokumen resmi resume medis.
- **Integrasi Penuh Basis Data PostgreSQL & Seeder Komprehensif**:
  - Menghidupkan dan menyinkronkan data riil seluruh pasien (`P-101` Budi Santoso, `P-102` Siti Rahmawati, `P-103` Ahmad Dahlan, `P-104` Dewi Lestari) ke PostgreSQL dengan tabel relasional `patients`, `appointments`, `triage_assessments`, `medical_records`, dan `medical_images`.
  - Setiap data kunjungan memiliki slot jam mulai-selesai presisi, hasil pengukuran tanda vital lengkap, serta skala prioritas triase terkalibrasi.
- **Penyempurnaan List Pasien Bersih & Indikator Kursor Menyeluruh (`/nakes/pasien-lookup`)**:
  - Mengubah tampilan list terpisah menjadi satu kontainer bersih dengan pembatas garis tipis (`divide-y divide-slate-100`).
  - Indikator kursor aktif ke seluruh permukaan baris (`hover:bg-slate-50/90 cursor-pointer transition-colors`) tanpa bentuk pembatas luar terputus-putus.
- **Skala Prioritas Triase yang Diperkuat dengan Warna Tegas**:
  - **P1 • MERAH (Gawat Darurat / Resusitasi)**: Badge merah solid (`bg-red-600 text-white`) dengan indikator pulsing dot.
  - **P2 • KUNING (Mendesak / Gejala Akut)**: Badge kuning-oranye solid (`bg-amber-500 text-white`).
  - **P3 • HIJAU (Non-Urgent / Rawat Jalan Rutin)**: Badge hijau solid (`bg-emerald-600 text-white`).
  - Ditampilkan secara konsisten pada daftar pasien, kartu rekam medis, dan kalender jadwal.
- **Fitur Input Resep Obat Elektronik Otomatis Masuk RME (`addPrescriptionToMedicalRecordServerAction`)**:
  - Modal input resep digital bagi dokter (nama obat, sediaan, aturan pakai signa, durasi) dengan pengecekan kontraindikasi alergi instan dan mutasi langsung ke PostgreSQL.
- **Fitur Input Hasil Uji Laboratorium Otomatis Masuk RME (`addLabResultToMedicalRecordServerAction`)**:
  - Modal input pemeriksaan LAB (Darah Lengkap, Glukosa Darah, HbA1c, Enzim Jantung Troponin, Kolesterol, Urin Rutin) lengkap dengan nilai rujukan dan catatan analis yang tersimpan ke `medical_images` (tipe `LAB`) dan `medical_records`.
- **Fitur Input Tindakan Medis ICD-9-CM Dokter & Staf (`addProcedureToMedicalRecordServerAction`)**:
  - Form pencatatan prosedur medis terstandarisasi (89.52 EKG, 99.21 Terapi IV, 93.57 Hecting, 88.76 USG) dengan pemilihan wewenang pelaksana (Dokter DPJP / Staf Perawat) yang langsung terintegrasi ke rekam medis pasien.
- **Fitur Jadwal Dokter Berbasis Kalender Visual (`DoctorCalendarSchedule`)**:
  - Komponen kalender garis waktu visual (Timeline 08:00 - 17:00 WIB) dan mode Grid kartu blok waktu yang menampilkan jam mulai dan jam selesai pelayanan secara eksplisit.
  - Memvisualisasikan durasi janji temu pasien, identitas No. RM, poli tujuan, dan kode warna skala prioritas kegawatan.
- **Transformasi Fitur Dokter: Daftar Pasien, Metrik Dokumen & Riwayat RME Terpadu**:
  - Mengubah antarmuka pencarian pasien dokter (`/nakes/pasien-lookup`) menjadi **Daftar Pasien & Status Rekam Medis** terpadu.
  - Menyajikan **4 Kartu Metrik Ringkasan**:
    1. **Jumlah Pasien**: Total pasien terdaftar dalam basis data faskes.
    2. **Jumlah Antrean**: Jumlah pasien aktif dalam antrean poliklinik hari ini.
    3. **Belum Ditandatangani**: Jumlah kunjungan/dokumen draft yang menunggu verifikasi & pengesahan DPJP.
    4. **Sudah Ditandatangani**: Jumlah berkas rekam medis yang telah disahkan secara digital dengan stempel waktu dan tanda tangan sah.
  - Menampilkan seluruh pasien dalam bentuk **List View** interaktif dan bersih (*Clean UI*, tanpa emoji), lengkap dengan filter pencarian instan dan tab status dokumen (`Semua`, `Menunggu TTD`, `Sudah TTD`, `Dalam Antrean`).
  - **Navigasi Interaktif per Item**: Setiap baris pasien pada list dapat diklik langsung untuk menuju ke halaman detail rekam medis pasien (`/nakes/pasien-lookup/[patientId]`).
  - **Halaman Detail Rekam Medis Pasien untuk Dokter (`/nakes/pasien-lookup/[patientId]`)**:
    - Menampilkan ringkasan identitas pasien (NIK, MRN, Usia, Gender, Gol. Darah, Kontak Darurat, dan Peringatan Alergi Kritis).
    - Validasi hak akses Zero-Trust / BOLA dengan dukungan aktivasi protokol darurat Break-Glass IGD.
    - Riwayat berkas rekam medis kunjungan pasien lengkap dengan fitur dekripsi SOAP, tanda vital triase perawat, diagnosis ICD-10, resep obat farmasi, citra medis penunjang, dan tombol cetak resume medis resmi rumah sakit (`PrintableMedicalResume`).
- **Pembersihan Visual Simbol & Emoji Berwarna (Enterprise Clean UI)**:
  - Menghapus seluruh emotikon/simbol berwarna (`💊`, `🔍`, `📅`, `🏥`, `⚠️`, `🖨️`, `🔒`) pada antarmuka rekam medis pasien (`/pasien/rekam-medis`, `/pasien/rekam-medis/[recordId]`), stasiun dokter (`/nakes/periksa/[bookingId]`), stasiun perawat (`/staf/triase`), dan berkas resume medis (`PrintableMedicalResume.tsx`).
  - Menggantikan dengan badge monokrom rapi seperti pill `Rx` untuk resep farmasi, label teks formal, dan status integritas kriptografi yang elegan.
- **Konektivitas Basis Data Riil Pencarian NIK Dokter (`lookupPatientByNikServerAction`)**:
  - Menghubungkan fitur pencarian pasien dokter (`/nakes/pasien-lookup`) langsung ke PostgreSQL `prisma.patient` melalui Server Action.
  - Mengintegrasikan gatekeeper BOLA/IDOR otomatis: jika dokter tidak memiliki consent aktif dari pasien, akses RME ditolak dan insiden `IDOR_BLOCKED` langsung dicatat ke `security_audit_logs`.
  - Mengimplementasikan eksekusi Break-Glass darurat (`executeBreakGlassServerAction`) yang menerbitkan izin darurat 12 jam langsung di PostgreSQL dan mencatat insiden audit bertingkat `CRITICAL`.
- **Perbaikan & Penyempurnaan Dekripsi Rekam Medis Pasien (`smartDecryptPayload`)**:
  - Menyediakan fungsi `smartDecryptPayload` yang menangani dekripsi AES-256-GCM native, hex string JSON, Base64, maupun plain payload secara transparan.
  - Memastikan pasien dapat membuka dan melihat detail rekam medis pribadinya tanpa terhalang galat format, sembari tetap mempertahankan pembuktian *Fail-Closed* pada pengujian manipulasi (*Tamper Test*).
- **Fitur Cetak Rekam Medis Standar Rumah Sakit (`PrintableMedicalResume`)**:
  - Pembuatan komponen resmi cetak `components/clinical/PrintableMedicalResume.tsx` dengan dukungan `@media print` untuk menghasilkan lembar resume pelayanan rapi bebas dari navbar dan sidebar.
  - Fitur cetak dapat diakses langsung oleh **Dokter** (`/nakes/periksa/[bookingId]`), **Staf Perawat** (`/staf/triase`), dan **Pasien** (`/pasien/rekam-medis/[recordId]`).
- **Kelengkapan Fitur Pemeriksaan Dokter DPJP (`/nakes/periksa/[bookingId]`)**:
  - Rekam medis triase (tanda vital lengkap, kategori triase, catatan perawat triase).
  - Anamnesis lengkap (keluhan utama, skor GCS Eye/Verbal/Motorik).
  - Tindakan medis berkode ICD-9-CM.
  - Foto dan citra medis penunjang (Rontgen, USG, EKG, Lab) dengan enkripsi biner AES-GCM dan digest HMAC.
  - Resep digital & farmasi (aturan minum, status verifikasi apoteker, dan deteksi alergi).
  - Persetujuan medis (Informed Consent medikolegal).
  - Surat keterangan dokter (Surat Keterangan Istirahat/Sakit, Surat Rujukan Faskes Lanjutan, dan Jadwal Kontrol Ulang).
  - Rincian biaya pelayanan (Billing: Konsultasi, Tindakan, Farmasi, dan Status Klaim BPJS).
  - Riwayat perubahan rekam medis (*Addendum Audit Trail & Versioning*: Versi 1 $\rightarrow$ Versi 2 berstempel waktu dan alasan klinis).
- **Penyempurnaan Tampilan Rekam Medis Pasien (`/pasien/rekam-medis` & `/pasien/rekam-medis/[recordId]`)**:
  - Penambahan kartu atribusi resmi tenaga kesehatan yang jelas:
    - **Dokter yang Mendiagnosis (DPJP)**: Nama lengkap, gelar spesialisasi, nomor STR & SIP resmi, serta faskes tempat praktik.
    - **Staf Nakes Pelaksana Tindakan (Perawat Triase)**: Nama perawat, NIP, jabatan, dan deskripsi tindakan fisik awal yang dilakukan.
  - Tampilan detail yang ramah pasien: kartu anamnesis keluhan, kartu diagnosis ICD-10 dengan penjelasan nama penyakit, kotak 4 parameter tanda vital, resep obat digital e-Prescription berbentuk kartu obat individual, petunjuk dokter, serta galeri citra radiologi penunjang.
  - Integrasi Server Action `getMedicalRecordsServerAction` dan `getSingleMedicalRecordServerAction` langsung ke PostgreSQL.
- **Grafik Tren Tanda Vital Recharts pada Dasbor Pasien (`/pasien`)**:
  - Pembuatan komponen `components/clinical/VitalSignsTrendChart.tsx` berbasis `recharts` untuk visualisasi dinamis tekanan darah sistolik, diastolik, dan detak jantung.
  - Integrasi Server Action `getMedicalRecordsServerAction` untuk membaca histori tanda vital riil dari PostgreSQL.

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
