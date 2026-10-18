# Spesifikasi Kebutuhan Pengguna & Kriteria Penerimaan — Resilio-Health

Dokumen ini mendefinisikan latar belakang masalah dunia nyata, prinsip integrasi 3 mata kuliah (Pengembangan Aplikasi Web, Kriptografi, Keamanan Komputasi dan Siber), spesifikasi kebutuhan pengguna (*User Requirements*), serta kriteria penerimaan (*Acceptance Criteria*) pada ekosistem 4-Role Resilio-Health.

---

## 1. Latar Belakang & Permasalahan Nyata Dunia Medis

Berdasarkan data insiden nyata hingga tahun 2026, sektor kesehatan menjadi sasaran empuk serangan siber secara global maupun nasional:
1. **Kasus Change Healthcare (AS)**: Kebocoran rekam medis terbesar dalam sejarah yang berdampak pada lebih dari 190 juta individu akibat serangan *ransomware* dan kelumpuhan sistem terpusat.
2. **Data BSSN & Insiden Faskes Indonesia**: Sebanyak 96% permasalahan keamanan digital bersumber dari kerentanan aplikasi web (seperti kesalahan konfigurasi otorisasi, *Insecure Direct Object Reference* / IDOR, dan kebocoran token sesi). Ketika server pusat lumpuh akibat serangan siber atau pemadaman internet, dokter kehilangan akses terhadap data pasien sehingga pelayanan gawat darurat terhenti total (*Downtime Chaos*).
3. **Kelemahan Integrasi API Nasional (SATUSEHAT)**:
   - **Single Point of Failure (SPOF)**: Jika server pusat terganggu, klinik dan puskesmas daerah tidak dapat membaca atau menulis riwayat berobat.
   - **BOLA / IDOR Vulnerability**: Kegagalan memvalidasi hak akses objek pada level API memungkinkan penyerang menebak parameter `id_pasien` di URL untuk mengunduh rekam medis orang lain secara ilegal.
4. **Dilema Pasien Darurat IGD (Koma/Trauma)**: Ketiadaan mekanisme *Break-Glass* darurat menyebabkan dokter tidak bisa membaca riwayat alergi pasien yang tidak sadarkan diri tanpa izin, sementara pembukaan akses tanpa audit memicu pelanggaran privasi.
5. **Kebutuhan Citra Medis Berukuran Besar**: Dokumen klinis nyata membutuhkan lampiran citra biner (Foto Rontgen, USG, scan Lab, grafik EKG) yang tidak dapat ditampung oleh media biasa (`localStorage` dibatasi 5 MB), membutuhkan media penyimpanan biner terenkripsi di peramban (**IndexedDB Blob**).

---

## 2. Struktur 4-Role & Pemisahan Wewenang (Separation of Duties)

Resilio-Health membagi wewenang secara ketat ke dalam 4 peran independen:

| Aspek / Hak Akses | Pasien (& Wali Keluarga) | Staf Nakes (Triase & Admisi) | Dokter (DPJP Pemeriksa) | Admin Regulator (Kemenkes) |
| :--- | :--- | :--- | :--- | :--- |
| **Fokus Utama** | Pemilik sah data medis & pencari layanan faskes | Penerimaan pasien, check-in, triase awal, & penugasan DPJP | Pemeriksaan klinis mendalam, SOAP, resep, analisis citra medis | Verifikasi identitas e-KYC/KYD, master faskes, SIEM log & kill-switch |
| **Akses Data Kependudukan** | Melihat & mengunggah NIK, foto KTP, & swafoto wajah | Memvalidasi NIK saat pendaftaran walk-in & check-in antrean | Melihat biodata dasar & status verifikasi NIK | Akses Penuh memvalidasi kesesuaian NIK, foto KTP, dan STR/SIP |
| **Akses Rekam Medis (SOAP & Citra)** | Membaca seluruh riwayat medis sendiri via kunci privat | **TIDAK DAPAT MEMBACA** riwayat diagnosa sensitif masa lalu | Membaca & menulis penuh selama sesi periksa aktif (Active Encounter) | **TIDAK DAPAT MEMBACA** isi medis (*Zero-Knowledge Storage*) |
| **Pemeriksaan Awal (Tanda Vital)** | Melihat visualisasi grafik riwayat tanda vital | Input tensi, suhu, berat/tinggi badan, & triase Hijau/Kuning/Merah | Mengonfirmasi tanda vital & melakukan pemeriksaan fisik lanjutan | Melihat agregat statistik non-klinis |
| **Manajemen Izin (Consent & DPJP)** | Memberikan & mencabut (*1-Click Revoke*) izin dokter/faskes | Memvalidasi 6-digit PIN pasien & menetapkan DPJP | Menerima wewenang periksa (Active Encounter Ticket) | Mengawasi kepatuhan persetujuan & audit log akses |
| **Penanganan Rujukan** | Menyetujui rujukan digital antar faskes | Memproses administrasi rujukan masuk & keluar faskes | Mengeluarkan instruksi klinis & alasan medis rujukan | Memantau lalu lintas rujukan antar faskes |
| **Protokol Darurat (Break-Glass)** | Menerima notifikasi darurat saat break-glass dipicu | Mendaftarkan pasien gawat darurat langsung ke IGD | Mengaktifkan tombol *Break-Glass* dengan alasan klinis darurat | Menerima high-priority alert & melakukan audit investigasi |

---

## 3. Standar Validitas Dokumen Rekam Medis Klinis

Sistem mengacu pada Permenkes No. 24/2022, UU PDP No. 27/2022, dan standar internasional ISO 27799 / HL7 FHIR:
1. **Format Klinis SOAP**: Subjective (keluhan), Objective (tanda vital & triase), Assessment (kodefikasi standar internasional ICD-10), dan Plan (e-Prescription & anjuran).
2. **Dukungan Citra Medis Terenkripsi**: Foto Rontgen (X-Ray), USG, hasil scan Lab, dan EKG dikompresi, dienkripsi menggunakan AES-256-GCM, dan diverifikasi dengan HMAC-SHA256 pada media IndexedDB Blob.
3. **Peringatan Kontraindikasi Alergi Obat (Clinical Alert)**: Sistem otomatis memblokir atau memperingatkan dokter jika resep obat yang diketik memuat alergen yang tercatat pada riwayat pasien.
4. **Sifat Immutable & Revisi Addendum**: Catatan medis yang telah ditandatangani secara kriptografis tidak dapat dihapus; koreksi dilakukan melalui penambahan Addendum baru (*versioning*).
5. **Kedaulatan Persetujuan (Consent-Driven DPJP Access)**: Dokter hanya dapat mendekripsi rekam medis jika memiliki *Active Encounter Ticket* yang sah dari pasien atau melalui *Protokol Darurat Break-Glass*.

---

## 4. Daftar Lengkap Kebutuhan Pengguna (User Requirements)

### A. Role: Pasien (Pengguna Layanan Faskes)

| Kode | Fitur / Kebutuhan | Deskripsi Kebutuhan Nyata | Aspek Mata Kuliah |
| :--- | :--- | :--- | :--- |
| **UR-P01** | Registrasi Berbasis NIK & Verifikasi KYC | Pasien mendaftar menggunakan NIK (16 digit), mengisi biodata, kontak darurat, riwayat alergi, dan mengunggah dokumen KTP. | PAW (Form Validasi), KKS (Single Identity) |
| **UR-P02** | Pencarian Faskes Pintar (Gejala & Spesialisasi) | Pasien memfilter faskes berdasarkan gejala penyakit (Hipertensi, Jantung, Gigi, ISPA) atau poliklinik. | PAW (Dynamic Filter & Responsive UI) |
| **UR-P03** | Profil Faskes, Dokter & Sisa Kuota | Pasien melihat jadwal operasional, nomor SIP dokter terverifikasi, dan ketersediaan kuota antrean harian. | PAW (Relasi Faskes & Dokter) |
| **UR-P04** | Booking Pemeriksaan & Auto-Consent | Pasien memesan jadwal konsultasi dan sistem otomatis menyiapkan tiket izin sementara untuk dokter terkait. | KKS (Pertahanan BOLA/IDOR) |
| **UR-P05** | Portabilitas RME & Perpindahan Faskes | Pasien membagikan hak akses riwayat RME ke faskes baru hanya dengan 1-Click Consent tanpa berkas fisik. | Kriptografi (Sharing Ciphertext Terotorisasi) |
| **UR-P06** | Tracking RME, Grafik Tensi & Dekripsi Klien | Pasien melihat linimasa riwayat medis, diagram fluktuasi tensi sistolik/diastolik, dan mendekripsi RME via kunci privat. | PAW (Chart Recharts), Kriptografi (AES-GCM) |
| **UR-P07** | Kontrol Izin (1-Click Revoke) & Audit Trail Pribadi | Pasien mencabut hak akses faskes/dokter kapan saja secara instan serta memantau log siapa dan kapan datanya diakses. | KKS (Transparansi Jejak Audit UU PDP) |
| **UR-P08** | Manajemen Biodata & Tiket Pelaporan Kendala | Pasien memperbarui biodata dan mengirim tiket laporan kesalahan data medis atau bug aplikasi ke Admin. | PAW (Helpdesk Ticket Management) |
| **UR-P09** | Verifikasi e-KYC dengan Foto KTP & Selfie Ber-Watermark | Pasien mengunggah foto KTP asli dan swafoto wajah (liveness check) yang otomatis dibubuhi digital watermark anti-penyalahgunaan identitas. | KKS (Client-side Watermarking & Anti-Fraud) |
| **UR-P10** | Persetujuan DPJP & 6-Digit PIN Admisi | Pasien menampilkan kode PIN 6-digit di aplikasinya saat tiba di faskes untuk mengonfirmasi persetujuan dokter pemeriksa (DPJP). | KKS (Contextual Authorization & BOLA Defense) |
| **UR-P11** | Akun Tanggungan Keluarga (Family Proxy Access) | Pasien dapat menautkan profil anak di bawah umur atau lansia ke dalam akunnya untuk pemesanan jadwal dan pengelolaan rekam medis. | Standar SATUSEHAT & Manajemen Akun Perwalian |
| **UR-P12** | Akses Citra Medis (Rontgen, USG, Lab, EKG) | Pasien dapat melihat dan mendekripsi lampiran berkas citra medis yang disertakan oleh dokter pemeriksa. | PAW (IndexedDB Blob) & Kriptografi (AES-GCM) |

### B. Role: Staf Nakes Faskes (Perawat Triase & Admisi) — [ROLE BARU]

| Kode | Fitur / Kebutuhan | Deskripsi Kebutuhan Nyata | Aspek Mata Kuliah |
| :--- | :--- | :--- | :--- |
| **UR-S01** | Penerimaan Pasien (Check-in) & Antrean Walk-in | Staf Nakes memvalidasi kedatangan pasien booking maupun mendaftarkan pasien walk-in via NIK, mengaktifkan status antrean ke ruang triase. | Alur SIMRS Nasional & PAW (State Queue Management) |
| **UR-S02** | Input Pemeriksaan Awal (Triase & Tanda Vital) | Perawat triase menginput tensi, suhu, nadi, laju napas, berat/tinggi badan, dan memilah kegawatan pasien (Hijau/Kuning/Merah). | PAW (Offline PWA Form Triage), Kriptografi |
| **UR-S03** | Pengarahan Pasien & Penugasan DPJP | Staf Nakes mengarahkan pasien ke poli dan menetapkan Dokter Penanggung Jawab Pelayanan (DPJP) dengan menerbitkan *Active Encounter Ticket*. | KKS (Least Privilege & Envelope Encryption Gate) |
| **UR-S04** | Pengelolaan Administrasi Rujukan Masuk & Keluar | Staf Nakes memproses surat rujukan keluar ke RS lain serta menerima dan mendaftarkan pasien rujukan masuk ke poli spesialis. | Standar Rujukan Berjenjang Kemenkes |

### C. Role: Dokter (Tenaga Medis Pemeriksa / DPJP)

| Kode | Fitur / Kebutuhan | Deskripsi Kebutuhan Nyata | Aspek Mata Kuliah |
| :--- | :--- | :--- | :--- |
| **UR-T01** | Onboarding Kredensial Medis (STR & SIP Nakes) | Dokter mendaftarkan NIK, Nomor STR KKI, Nomor SIP Dinkes, dan berkas bukti sebelum wewenang periksa diaktifkan. | KKS (Role-Based Access Control, akun PENDING terkunci) |
| **UR-T02** | Antrean Pasien Hari Ini & Prefetch Data Offline | Dokter melihat antrean pasien siap periksa; sistem melakukan prefetch data terenkripsi untuk kesiapan jika koneksi internet terputus. | PAW (PWA Local Cache & Prefetch Engine) |
| **UR-T03** | Pencarian Pasien NIK & Pertahanan BOLA/IDOR | Dokter mencari pasien via NIK; sistem memeriksa izin aktif. Akses tanpa izin diblokir 403 Forbidden dan dicatat ke SIEM. | KKS (Pertahanan BOLA/IDOR Tingkat API) |
| **UR-T04** | Input Dokumen Rekam Medis Klinis (SOAP, ICD-10) | Dokter mengisi keluhan (S), tanda vital fisik (O), diagnosis ICD-10 (A), dan resep (P) yang dienkripsi AES-256-GCM + tag HMAC-SHA256. | Kriptografi (AEAD Client-Side Encryption + HMAC) |
| **UR-T05** | Operasional Penuh saat Offline Mode | Ketika internet faskes putus atau server pusat down, dokter tetap dapat melayani pasien dan menyimpan RME ke IndexedDB tanpa error. | PAW (Service Worker & IndexedDB Engine) |
| **UR-T06** | Background Sync & Surat Rujukan Digital | Saat internet pulih, antrean data lokal otomatis disinkronkan ke server; dokter dapat menerbitkan rujukan digital ke RS lain. | PAW (Background Sync API), Kriptografi (HMAC Verifier) |
| **UR-T07** | Unggah & Enkripsi Citra Medis (Rontgen/USG/Lab/EKG) | Dokter melampirkan file gambar medis biner yang dienkripsi AES-256-GCM dan disimpan di IndexedDB komputer faskes. | PAW (ArrayBuffer/Blob di IndexedDB) & Kriptografi |
| **UR-T08** | Protokol Akses Darurat IGD (Break-Glass Protocol) | Pada pasien gawat darurat tidak sadarkan diri, dokter IGD dapat membuka rekam medis darurat dengan memilih indikasi medis kritis. | Standar Internasional ISO 27799 / HIPAA |
| **UR-T09** | Koreksi Rekam Medis Berbasis Addendum | Rekam medis yang telah disahkan bersifat immutable; koreksi dilakukan melalui Addendum revisi baru tanpa menghapus berkas lama. | Permenkes No. 24/2022 (Alat Bukti Hukum yang Sah) |
| **UR-T10** | Peringatan Otomatis Kontraindikasi Alergi Obat | Sistem menampilkan peringatan merah mencolok saat dokter mengetikkan resep yang memuat obat yang ditandai alergi oleh pasien. | Patient Safety Standard (Pencegahan Malpraktik) |

### D. Role: Admin (Regulator Pemerintah & Pengawas Sistem)

| Kode | Fitur / Kebutuhan | Deskripsi Kebutuhan Nyata | Aspek Mata Kuliah |
| :--- | :--- | :--- | :--- |
| **UR-A01** | Verifikasi Dokumen Kependudukan Pasien (KYC) | Admin memvalidasi kesesuaian NIK dan dokumen KTP asli pasien sebelum mengaktifkan akun menjadi status VERIFIED. | KKS (KYC Verification Management) |
| **UR-A02** | Verifikasi Lisensi Dokter (KYD - STR & SIP) | Admin memeriksa keabsahan STR dan SIP tenaga medis pada pangkalan data resmi sebelum memberikan wewenang klinis. | KKS (Know Your Doctor / Lisensi Praktik) |
| **UR-A03** | Master Faskes & Ransomware Kill-Switch | Admin mengelola direktori faskes dan memiliki saklar darurat (*Kill-Switch*) untuk mengisolasi faskes yang terinfeksi malware. | KKS (Network Quarantine & Incident Containment) |
| **UR-A04** | SIEM Security Monitor & Deteksi Serangan | Admin memantau feed log keamanan real-time (IDOR, HMAC failure, percobaan akses ilegal, anomali jaringan). | KKS (Security Information and Event Management Lite) |
| **UR-A05** | Pusat Penanganan Kendala & Failed Sync Queue | Admin mengelola tiket kendala teknis dan memantau antrean sinkronisasi yang gagal tanpa melihat data klinis pasien. | PAW & KKS (Separation of Concerns: Metadata vs Payload) |
| **UR-A06** | Verifikasi Visual e-KYC & e-KYD Ber-Watermark | Admin meninjau dokumen visual foto KTP ber-watermark, selfie wajah liveness, dan berkas STR melalui peninjau dokumen aman. | Keamanan Siber (Presigned URL & Anti-Watermark Leak) |
| **UR-A07** | Pengawasan Log Break-Glass & Investigasi Insiden | Admin menerima peringatan khusus setiap kali fitur Akses Darurat (Break-Glass) diaktifkan untuk audit forensik akuntabilitas. | Cyber Security Governance & Insider Threat Detection |

---

## 5. Kriteria Penerimaan (*Acceptance Criteria*)

| ID Kebutuhan | Kriteria Penerimaan (*Acceptance Criteria*) | Metode Verifikasi |
| :--- | :--- | :--- |
| **AC-P01..08** | - Form registrasi menolak NIK non-16 digit.<br>- Pencarian faskes memfilter instan berdasarkan gejala penyakit.<br>- Booking menghasilkan tiket izin sementara.<br>- Grafik tensi membedakan sistolik dan diastolik.<br>- Tombol Revoke memutus akses secara instan. | Uji navigasi, validasi input, dan DOM inspection |
| **AC-P09..12** | - Form pendaftaran pasien mewajibkan foto KTP dan swafoto wajah (e-KYC) dengan digital watermark otomatis.<br>- Layar pasien menampilkan PIN persetujuan 6-digit saat sesi pemeriksaan aktif.<br>- Pasien dapat beralih melihat rekam medis anak/wali (Family Proxy).<br>- Pasien dapat melihat lampiran citra medis (Rontgen/USG) terdekripsi. | Uji canvas watermarking, visual proxy & image viewer |
| **AC-S01..04** | - Staf Nakes dapat melakukan check-in antrean booking dan mendaftarkan pasien walk-in loket.<br>- Input triase mencatat tanda vital fisik dan mengelompokkan kategori Hijau/Kuning/Merah.<br>- Penetapan DPJP menerbitkan *Active Encounter Ticket* ke dokter pemeriksa.<br>- Pengelolaan administrasi rujukan masuk dan keluar faskes tercatat di tabel izin akses. | Uji workflow loket triase & penerbitan tiket DPJP |
| **AC-T01..06** | - Akun dokter PENDING terkunci dari sistem.<br>- Antrean pasien memunculkan alert alergi merah jika ada riwayat berbahaya.<br>- Pencarian NIK tanpa izin diblokir 403 Forbidden.<br>- Form SOAP mengenkripsi data klinis via AES-256-GCM + tag HMAC.<br>- Mode offline mengalihkan penyimpanan ke IndexedDB lokal.<br>- Sinkronisasi memvalidasi HMAC sebelum diterima server. | Uji enkripsi klien, penetrasi IDOR, & simulasi offline |
| **AC-T07..10** | - Dokter dapat melampirkan file citra medis (Rontgen, USG, Lab, EKG) biner terenkripsi.<br>- Tombol Break-Glass IGD membuka rekam medis darurat pasien koma dengan alasan klinis wajib.<br>- Form RME mendukung mode Addendum revisi bertingkat tanpa menghapus data lama.<br>- Sistem menampilkan peringatan otomatis merah jika resep memuat zat alergi pasien. | Uji enkripsi citra, simulasi break-glass, & contraindication alert |
| **AC-A01..07** | - Admin dapat meninjau berkas e-KYC (KTP ber-watermark + selfie) berdampingan.<br>- Validasi STR/SIP mengaktifkan akun nakes.<br>- Tombol Kill-Switch mengisolasi faskes terinfeksi malware.<br>- SIEM mencatat event IDOR, HMAC mismatch, dan Break-Glass darurat secara real-time.<br>- Admin menangani tiket kendala dan antrean gagal sinkron tanpa pernah melihat isi diagnosa pasien. | Uji visual KYC viewer, kill-switch isolation, & audit SIEM |
