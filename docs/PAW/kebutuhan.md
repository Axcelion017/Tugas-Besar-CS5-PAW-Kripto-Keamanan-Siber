# Spesifikasi Kebutuhan Pengguna & Kriteria Penerimaan — Resilio-Health

Dokumen ini mendefinisikan latar belakang masalah dunia nyata, prinsip integrasi 3 mata kuliah (Pengembangan Aplikasi Web, Kriptografi, Keamanan Komputasi dan Siber), spesifikasi kebutuhan pengguna (*User Requirements*), serta kriteria penerimaan (*Acceptance Criteria*) pada sistem informasi rumah sakit Resilio-Health.

---

## 1. Latar Belakang & Permasalahan Nyata Dunia Medis

Berdasarkan data insiden nyata hingga tahun 2026, sektor kesehatan menjadi sasaran empuk serangan siber secara global maupun nasional:
1. **Kasus Change Healthcare (AS)**: Kebocoran rekam medis terbesar dalam sejarah yang berdampak pada lebih dari 190 juta individu akibat serangan *ransomware* dan kelumpuhan sistem terpusat.
2. **Data BSSN & Insiden Faskes Indonesia**: Sebanyak 96% permasalahan keamanan digital bersumber dari kerentanan aplikasi web (seperti kesalahan konfigurasi otorisasi, *Insecure Direct Object Reference* / IDOR, dan kebocoran token sesi). Ketika server pusat lumpuh akibat serangan siber atau pemadaman internet, dokter kehilangan akses terhadap data pasien sehingga pelayanan gawat darurat terhenti total (*Downtime Chaos*).
3. **Kelemahan Integrasi API Nasional**: Kewajiban integrasi Rekam Medis Elektronik (RME) melalui API (misal platform SATUSEHAT) sering memicu dua ancaman besar:
   - **Single Point of Failure (SPOF)**: Jika server pusat terganggu, klinik dan puskesmas daerah tidak dapat membaca atau menulis riwayat berobat.
   - **BOLA / IDOR Vulnerability**: Kegagalan memvalidasi hak akses objek pada level API memungkinkan penyerang menebak parameter `id_pasien` di URL untuk mengunduh rekam medis orang lain secara ilegal.

### Gagasan Solusi Resilio-Health
Resilio-Health hadir sebagai *Web-based Hospital Information System* (HIS) masa depan yang dilengkapi fitur **Cryptographic Offline-First Resilience** dan **Zero-Trust API Gateway**:
- **PAW (Pengembangan Aplikasi Web)**: Membangun arsitektur PWA (*Progressive Web Apps*), Service Worker, dan antrean lokal IndexedDB sehingga dokter tetap dapat berpindah halaman dan menginput rekam medis saat jaringan putus, lalu otomatis tersinkronisasi saat koneksi pulih.
- **Kriptografi**: Menerapkan enkripsi simetris sisi klien (AES-256-GCM) dengan kunci unik pasien (*Zero-Knowledge Storage*) dan verifikasi integritas data menggunakan digest HMAC-SHA256 untuk mendeteksi manipulasi sekecil 1 bit (Fail-Closed).
- **Keamanan Komputasi dan Siber (KKS)**: Menegakkan pertahanan BOLA/IDOR melalui verifikasi relasi izin aktif (*Consent Ticket*), pemisahan peran mutlak (*Separation of Duties* & *Least Privilege* sesuai UU PDP No. 27/2022 & Permenkes No. 24/2022), mitigasi *kill-switch* isolasi faskes terinfeksi, dan pemantauan SIEM *real-time*.

---

## 2. Pemisahan Peran (Separation of Duties)

Pemisahan peran antara **Pasien**, **Tenaga Kesehatan (Dokter/Perawat)**, dan **Admin (Regulator Kemenkes)** merupakan syarat mutlak dalam regulasi medis dan keamanan siber:

| Aspek / Hak Akses | Pasien (Pengguna Faskes) | Tenaga Kesehatan (Nakes) | Admin (Regulator Kemenkes) |
| :--- | :--- | :--- | :--- |
| **Fokus Utama** | Pemilik sah data medis & pencari layanan faskes | Pemeriksaan klinis, diagnosis, & input RME (Online/Offline) | Verifikasi identitas (KYC/KYD), master faskes, SIEM log & isolasi malware |
| **Akses Data Kependudukan (NIK & KTP)** | Mengisi NIK & mengunggah foto KTP milik sendiri | Melihat biodata dasar & status verifikasi kependudukan | Akses Penuh memvalidasi kecocokan NIK, foto KTP, dan nomor STR/SIP |
| **Akses Isi Rekam Medis (Dekripsi AES-GCM)** | Membaca seluruh riwayat medis sendiri via kunci privat | Membaca & menulis (Hanya jika memiliki tiket consent aktif dari pasien) | **TIDAK BISA MEMBACA ISI MEDIS** (*Zero-Knowledge*, hanya melihat metadata transaksi) |
| **Manajemen Izin Akses (Consent)** | Memberikan & mencabut (*Revoke*) izin faskes/dokter secara instan (1-Click) | Meminta izin saat pemeriksaan / rujukan pasien | Tidak dapat mengubah atau mengintervensi izin medis pasien |
| **Akses Audit Trail & Pusat Kendala** | Melihat log siapa dan kapan data medisnya diakses | Melihat status antrean sinkronisasi lokal ke server | Akses Penuh ke log keamanan SIEM, anomali IDOR, & resolusi tiket kendala |

---

## 3. Standar Validitas Dokumen Rekam Medis Klinis

Agar dokumen medis sah secara klinis dan hukum pembuktian elektronik (Permenkes No. 24/2022), sistem menerapkan 5 pilar standar:
1. **Format Klinis SOAP**:
   - **Subjective (S)**: Keluhan utama pasien, onset, riwayat penyakit terdahulu, dan riwayat alergi obat/makanan (ditampilkan sebagai peringatan mencolok).
   - **Objective (O)**: Pemeriksaan tanda-tanda vital (Tekanan Darah Sistolik/Diastolik, Detak Jantung, Suhu Tubuh, Laju Pernapasan, SPO2).
   - **Assessment (A)**: Diagnosis terstandarisasi menggunakan kode internasional **ICD-10** (contoh: I10 untuk Hipertensi, J06.9 untuk ISPA, E11 untuk Diabetes Melitus) agar informasi tidak bias saat rujukan.
   - **Plan (P)**: Rencana terapi, resep obat elektronik (*e-Prescription* berisikan dosis dan aturan minum), serta rencana kontrol lanjutan.
2. **Atribusi Kredensial Medis Resmi**: Setiap berkas mencantumkan Nomor STR (Surat Tanda Registrasi) dan Nomor SIP (Surat Izin Praktik) dokter yang memeriksa serta kode Faskes bertugas.
3. **Integritas Kriptografis (HMAC-SHA256 & Timestamp)**: Ciphertext rekam medis diberi tag HMAC menggunakan kunci rahasia simetris. Jika terjadi modifikasi bit pada database atau jaringan lokal, tag HMAC akan rusak dan sistem menolak dekripsi (*Fail-Closed*).
4. **Sifat Immutable (Append-Only / Addendum)**: Berkas rekam medis yang telah disahkan dokter tidak boleh dihapus atau ditimpa sembarangan; koreksi dilakukan melalui mekanisme revisi addendum bertingkat (*versioning*).
5. **Kedaulatan Persetujuan (Consent-Driven Access)**: Dokter hanya dapat membuka riwayat RME lintas faskes jika ada tiket persetujuan digital aktif dari pasien (UU PDP Pasal 20).

---

## 4. Daftar Lengkap Kebutuhan Pengguna (User Requirements)

### A. Role: Pasien (Pengguna Layanan Faskes)

| Kode | Fitur / Kebutuhan | Deskripsi Kebutuhan Nyata | Aspek Mata Kuliah |
| :--- | :--- | :--- | :--- |
| **UR-P01** | Registrasi Berbasis NIK & Verifikasi KYC | Pasien mendaftar menggunakan NIK (16 digit), mengisi biodata, kontak darurat, riwayat alergi, dan mengunggah foto KTP agar seluruh riwayat medis nasional terikat pada satu identitas tunggal sah. | PAW (Form Validasi), KKS (Single Identity & KYC Verification) |
| **UR-P02** | Pencarian Faskes Pintar (Gejala/Penyakit & Poli) | Pasien dapat mencari dan memfilter fasilitas kesehatan (RS, Klinik, Puskesmas) berdasarkan keluhan penyakit (Hipertensi, Jantung, Gigi, ISPA), spesialisasi, atau wilayah. | PAW (Filtering Dinamis, UI Responsif) |
| **UR-P03** | Profil Faskes, Dokter & Kuota Praktik | Pasien dapat melihat daftar dokter bertugas, nomor SIP terverifikasi, jadwal operasional mingguan, dan sisa kuota antrean harian. | PAW (Relasi Many-to-Many Faskes & Dokter) |
| **UR-P04** | Booking Pemeriksaan & Auto-Consent | Pasien memesan jadwal konsultasi dokter. Konfirmasi booking otomatis menerbitkan Tiket Izin Akses Medis sementara bagi dokter pemeriksa pada hari periksa. | KKS (Pertahanan BOLA/IDOR melalui tabel `access_grants`) |
| **UR-P05** | Portabilitas RME & Perpindahan Faskes | Saat berpindah klinik/RS rujukan, pasien dapat membagikan hak baca rekam medis ke faskes baru hanya dengan 1-Click Consent tanpa membawa map fisik atau mengulang lab dasar. | Kriptografi (Sharing Ciphertext Terotorisasi), PAW |
| **UR-P06** | Tracking Rekam Medis, Tanda Vital & Resep | Pasien dapat melihat linimasa riwayat penyakit, diagram fluktuasi tekanan darah sistolik/diastolik, daftar obat, dan mendekripsi rekam medis secara mandiri menggunakan kuncinya. | PAW (Chart Visualisasi), Kriptografi (Client-side AES-GCM) |
| **UR-P07** | Kontrol Izin (Revoke Access) & Audit Trail Pribadi | Pasien dapat mencabut hak akses faskes/dokter kapan saja (1-Click Revoke) serta memantau log siapa, kapan, dan dari perangkat apa datanya dibuka sesuai UU PDP. | KKS (Transparansi Jejak Audit UU PDP & Real-time Revoke) |
| **UR-P08** | Manajemen Biodata & Pelaporan Kendala | Pasien dapat memperbarui data non-kritis dan mengirimkan tiket bantuan (laporan bug / ketidaksesuaian data medis) ke Admin Regulator. | PAW (Helpdesk Ticket Management) |

### B. Role: Tenaga Kesehatan (Dokter & Perawat)

| Kode | Fitur / Kebutuhan | Deskripsi Kebutuhan Nyata | Aspek Mata Kuliah |
| :--- | :--- | :--- | :--- |
| **UR-T01** | Onboarding Kredensial Medis (STR & SIP) | Dokter mendaftarkan NIK, Nomor STR Konsil Kedokteran Indonesia (KKI), Nomor SIP Dinkes, dan bukti dokumen STR untuk divalidasi Admin sebelum akun diaktifkan. | KKS (Role-Based Access Control, akun PENDING terkunci) |
| **UR-T02** | Manajemen Antrean & Jadwal Praktik Harian | Dokter dapat melihat daftar antrean pasien hari ini, status periksa (Menunggu, Sedang Diperiksa, Selesai), dan sistem melakukan *prefetch* data terenkripsi untuk kesiapan *offline*. | PAW (PWA Prefetch & Local Cache), Kriptografi |
| **UR-T03** | Pencarian Pasien NIK & Pertahanan BOLA/IDOR | Dokter dapat mencari pasien via NIK. Sistem memeriksa keabsahan relasi *consent* aktif; jika tidak ada izin sah, akses langsung diblokir (403 Forbidden) dan dicatat ke SIEM. | KKS (Pertahanan BOLA/IDOR Tingkat API) |
| **UR-T04** | Input Dokumen Rekam Medis Klinis (SOAP, ICD-10) | Dokter mengisi keluhan (S), tanda vital fisik (O), kode diagnosis ICD-10 (A), dan resep/anjuran (P). Saat disimpan, data dienkripsi dengan AES-256-GCM dan diberi tag HMAC-SHA256 di browser. | Kriptografi (AEAD Client-Side Encryption + HMAC Integrity) |
| **UR-T05** | Operasional Penuh saat Offline Mode | Ketika internet rumah sakit terputus atau server pusat diserang ransomware, dokter tetap dapat membuka data antrean dan menginput rekam medis ke IndexedDB lokal tanpa galat. | PAW (PWA Service Worker & IndexedDB Engine) |
| **UR-T06** | Sinkronisasi Otomatis & Surat Rujukan Digital | Saat internet pulih, antrean data lokal otomatis disinkronkan ke server setelah validasi HMAC lolos. Dokter juga dapat menerbitkan Surat Rujukan Digital ke RS lain. | PAW (Background Sync API), Kriptografi (Verifikasi HMAC) |

### C. Role: Admin (Regulator Pemerintah & Pengawas Sistem)

| Kode | Fitur / Kebutuhan | Deskripsi Kebutuhan Nyata | Aspek Mata Kuliah |
| :--- | :--- | :--- | :--- |
| **UR-A01** | Verifikasi Dokumen Kependudukan Pasien (KYC) | Admin memiliki antrean verifikasi untuk memvalidasi kesesuaian NIK dan dokumen KTP asli pasien sebelum status akun menjadi VERIFIED. | KKS (KYC Verification Management) |
| **UR-A02** | Verifikasi Lisensi Dokter (KYD - STR & SIP) | Admin memeriksa keabsahan lisensi praktik STR dan SIP tenaga medis pada pangkalan data resmi sebelum memberikan wewenang penginputan data klinis. | KKS (Know Your Doctor / Pre-employment Trust) |
| **UR-A03** | Master Faskes & Ransomware Kill-Switch | Admin mengelola direktori faskes dan memiliki tombol saklar darurat (*Kill-Switch*) untuk mengisolasi klinik/RS yang terinfeksi malware agar tidak menulari server pusat. | KKS (Incident Containment / Network Quarantine) |
| **UR-A04** | SIEM Security Monitor & Deteksi Serangan | Admin memantau feed log keamanan real-time yang menyoroti percobaan akses IDOR ilegal, kegagalan validasi HMAC (indikasi tampering), dan anomali jaringan. | KKS (Security Information and Event Management Lite) |
| **UR-A05** | Pusat Penanganan Kendala & Failed Sync Queue | Admin mengelola tiket laporan bug serta memantau antrean sinkronisasi yang gagal secara observabilitas teknis tanpa pernah dapat membaca isi penyakit pasien. | PAW & KKS (Separation of Concerns: Metadata vs Medical Payload) |

---

## 5. Kriteria Penerimaan (*Acceptance Criteria*)

| ID Kebutuhan | Kriteria Penerimaan (*Acceptance Criteria*) | Metode Verifikasi |
| :--- | :--- | :--- |
| **AC-P01** (UR-P01) | - Form registrasi menolak NIK selain 16 digit numerik.<br>- Wajib mengunggah berkas foto KTP.<br>- Akun baru masuk status PENDING dan dialihkan ke `/verifikasi-pending`. | Uji validasi input & inspeksi state |
| **AC-P02** (UR-P02) | - Filter faskes berdasarkan kategori penyakit (cth: "Jantung", "Hipertensi") memperbarui daftar instan.<br>- Tipe faskes (RS, Klinik, Puskesmas) dapat difilter multi-kategori. | Uji fungsional pencarian UI |
| **AC-P03** (UR-P03) | - Profil faskes menampilkan daftar dokter, nomor STR, jadwal mingguan, dan kuota sisa.<br>- Kuota penuh menonaktifkan tombol pemesanan. | Pengujian batas kuota |
| **AC-P04** (UR-P04) | - Pemesanan konsultasi otomatis membuat record pada `appointments` dan entri `access_grants` aktif untuk dokter terkait.<br>- Sesi dokter pemeriksa dapat langsung melihat nama pasien di antrean hari itu. | Uji keterkaitan data booking |
| **AC-P05** (UR-P05) | - Form pemberian izin transfer memungkinkan pasien memilih dokter/faskes tujuan dan durasi hari.<br>- Pasien dapat berpindah faskes tanpa kehilangan akses riwayat rekam medis sebelumnya. | Simulasi rujukan multi-faskes |
| **AC-P06** (UR-P06) | - Tanda vital tekanan darah dirender dalam grafik visual yang membedakan sistolik dan diastolik.<br>- Diagnosa dan resep hanya muncul setelah tombol dekripsi ditekan menggunakan kunci simetris yang valid. | Uji render grafik & inspeksi DOM kripto |
| **AC-P07** (UR-P07) | - Tombol "Cabut Izin (Revoke)" mengubah status grant menjadi REVOKED secara instan.<br>- Upaya dokter mengakses pasien pasca-revoke menghasilkan blokir 403 Forbidden. | Uji pencabutan hak akses real-time |
| **AC-P08** (UR-P08) | - Formulir tiket kendala mencatat laporan ke `resilio_trouble_tickets` dan tampil di konsol incident center admin. | Uji alur tiket helpdesk |
| **AC-T01** (UR-T01) | - Form registrasi nakes memvalidasi kelengkapan NIK, Nomor STR, Nomor SIP, dan berkas bukti.<br>- Akun dokter berstatus PENDING tidak dapat mengakses stasiun kerja sebelum diverifikasi admin. | Uji pembatasan akun non-aktif |
| **AC-T02** (UR-T02) | - Halaman `/nakes` menampilkan ringkasan antrean, status sesi praktik, dan alert alergi merah mencolok untuk pasien yang memiliki riwayat alergi berbahaya. | Uji respons antarmuka antrean |
| **AC-T03** (UR-T03) | - Pencarian NIK pasien yang memiliki *consent* aktif menampilkan ringkasan profil medis.<br>- Pencarian NIK tanpa izin memicu pesan penolakan BOLA/IDOR dan mengirim log CRITICAL ke SIEM. | Uji penetrasi IDOR / BOLA Guard |
| **AC-T04** (UR-T04) | - Form SOAP memvalidasi keluhan, tanda vital numerik, kode diagnosis ICD-10, dan resep.<br>- Tombol simpan memicu enkripsi AES-256-GCM dan kalkulasi HMAC-SHA256 sebelum data disimpan. | Uji submit SOAP & verifikasi kripto |
| **AC-T05** (UR-T05) | - Ketika simulasi offline diaktifkan, penyimpanan rekam medis tidak gagal melainkan masuk ke `resilio_offline_queue` (IndexedDB).<br>- Indikator jaringan berubah menjadi kuning dengan penghitung antrean lokal. | Uji simulasi pemutusan koneksi |
| **AC-T06** (UR-T06) | - Tombol sinkronisasi mengirimkan berkas antrean lokal ke server pusat setelah verifikasi HMAC lolos.<br>- Form surat rujukan digital langsung membagikan tiket akses ke faskes tujuan. | Uji pemulihan sinkronisasi offline |
| **AC-A01** (UR-A01) | - Admin dapat meninjau antrean KYC, menyetujui (mengaktifkan akun pasien), atau menolak beserta alasan tertulis. | Uji workflow KYC |
| **AC-A02** (UR-A02) | - Admin dapat memeriksa berkas STR/SIP dokter dan memvalidasi kredensial menjadi status VERIFIED. | Uji workflow KYD |
| **AC-A03** (UR-A03) | - Tombol Kill-Switch mengubah status faskes menjadi QUARANTINED dan mengisolasi akses booking/sinkronisasinya dari jaringan nasional. | Uji penahanan malware faskes |
| **AC-A04** (UR-A04) | - SIEM Live Feed merekam event IDOR_BLOCKED, HMAC_MISMATCH, LOGIN, dan QUARANTINE_FASKES secara *real-time* dengan visualisasi tingkat keparahan. | Uji pemantauan event audit SIEM |
| **AC-A05** (UR-A05) | - Incident Center menampilkan antrean failed sync queue dan tiket kendala pengguna dengan pemisahan mutlak: admin tidak dapat membaca isi medis rahasia pasien. | Uji observabilitas teknis tanpa bocor data |
