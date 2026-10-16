# Matriks Keterlacakan Antarmata Kuliah — Resilio-Health

Dokumen ini memetakan benang merah keterhubungan antara **Kebutuhan Pengguna (PAW)**, **Fondasi Kriptografi (Kriptografi)**, serta **Model Ancaman & Kontrol Risiko (Keamanan Komputasi dan Siber)** guna menjamin konsistensi pengembangan produk terpadu sepanjang semester.

---

## 1. Matriks Keterlacakan Komprehensif (Traceability Matrix)

| ID Kebutuhan | Deskripsi Fitur Produk | Ancaman STRIDE (KKS) | Risiko Prioritas (KKS) | Solusi Kriptografi (Kripto) | Komponen Implementasi | Bukti Verifikasi Uji |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UR-P01** | Registrasi Pasien NIK (16 digit) & Unggah KTP | **THR-01 (Spoofing)**: Pembuatan akun pasien fiktif / duplikasi identitas. | **RSK-05**: Manipulasi identitas kependudukan. | Validasi keaslian berkas KYC & enkripsi data profil di memori. | `app/(auth)/register/pasien/page.tsx`, `lib/db/mockData.ts` | Uji validasi 16 digit NIK & pendaftaran status PENDING |
| **UR-P02** & **UR-P03** | Pencarian Faskes Pintar & Profil Kuota Dokter | **THR-05 (DoS)**: Manipulasi query parameter pencarian. | **RSK-03**: Penipuan faskes palsu. | Verifikasi status Faskes (`ACTIVE` vs `QUARANTINED`). | `app/(dashboard)/pasien/faskes/page.tsx`, `[faskesId]/page.tsx` | Uji filtering gejala & pembatasan kuota dokter |
| **UR-P04** | Booking Konsultasi & Auto-Consent Ticket | **THR-06 (Elevation of Privilege)**: Akses rekam medis tanpa hak aktif. | **RSK-03**: Pelanggaran izin akses medis. | Pembuatan relasi kriptografis berbatas waktu pada tabel `access_grants`. | `app/(dashboard)/pasien/booking/page.tsx` | Penerbitan tiket consent saat booking dikonfirmasi |
| **UR-P05** | Portabilitas RME & Perpindahan Faskes | **THR-04 (Information Disclosure)**: Kebocoran riwayat penyakit saat transfer faskes. | **RSK-01**: Kebocoran rekam medis (EHR). | Transfer ciphertext terenkripsi; pembagian hak baca berbasis 1-Click Consent. | `app/(dashboard)/pasien/consent/page.tsx` | Pengujian delegasi izin antar faskes tanpa berkas fisik |
| **UR-P06** | Tracking RME, Grafik Tensi & Dekripsi Klien | **THR-04 (Info Disclosure)** & **THR-02 (Tampering)** | **RSK-01** (Kebocoran EHR) & **RSK-02** (Data Tampering) | **AES-256-GCM** (NIST SP 800-38D) + **HMAC-SHA256** (RFC 2104). Dekripsi *Zero-Knowledge* di browser. | `app/(dashboard)/pasien/rekam-medis/page.tsx`, `lib/crypto/aes.ts` | Uji Vitest Enkripsi/Dekripsi & grafik tensi |
| **UR-P07** | 1-Click Revoke Access & Audit Trail Pribadi | **THR-01 (Spoofing)** & **THR-03 (Repudiation)** | **RSK-05**: Akses dokter setelah masa rujukan usai. | Pencatatan event audit log otomatis dan pemutusan izin seketika (UU PDP Pasal 20). | `app/(dashboard)/pasien/consent/page.tsx`, `audit-log/page.tsx` | Uji pencabutan izin dan verifikasi blokir seketika |
| **UR-P08** | Manajemen Biodata & Tiket Pelaporan Kendala | **THR-05 (DoS/Bug)**: Kerusakan sistem tidak terdeteksi. | **RSK-02**: Kesalahan data medis tidak teridentifikasi. | Pemisahan metadata tiket teknis dari isi payload rekam medis pasien. | `app/(dashboard)/pasien/tiket-kendala/page.tsx` | Uji pengiriman tiket laporan ke incident center |
| **UR-T01** | Onboarding Kredensial Medis (STR & SIP Nakes) | **THR-01 (Spoofing)**: Dokter gadungan menginput rekam medis. | **RSK-03**: Malpraktik oleh akun palsu. | Verifikasi nomor STR/SIP ke pangkalan data Konsil Kedokteran (KKI). | `app/(auth)/register/nakes/page.tsx` | Uji penguncian akun berstatus PENDING |
| **UR-T02** | Manajemen Antrean & Prefetch Data Terenkripsi | **THR-05 (DoS)**: Lumpuh saat pemadaman internet. | **RSK-02**: Hilangnya riwayat pasien saat offline. | Prefetch payload terenkripsi disimpan aman di memori lokal stasiun kerja. | `app/(dashboard)/nakes/page.tsx` | Tampilan antrean pasien hari ini & alert alergi |
| **UR-T03** | Lookup Pasien NIK & Pertahanan BOLA/IDOR | **THR-06 (BOLA / IDOR)**: Dokter menebak ID pasien lain via URL. | **RSK-03**: Kebocoran rekam medis lintas bangsal. | **BOLA / IDOR Defense**: Gateway memvalidasi relasi izin aktif sebelum mengembalikan data pasien. | `app/(dashboard)/nakes/pasien-lookup/page.tsx` | Simulasi akses NIK tanpa izin memicu blokir 403 & log SIEM |
| **UR-T04** | Input SOAP, ICD-10 & Tanda Tangan Kripto | **THR-02 (Tampering)** & **THR-04 (Info Disclosure)** | **RSK-01** & **RSK-02**: Modifikasi dosis obat / kebocoran diagnosa. | Enkripsi AES-256-GCM + pembangkitan tag HMAC-SHA256 sebelum data disimpan (*Client-Side*). | `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx` | Uji input SOAP, kode ICD-10 & kalkulasi HMAC digest |
| **UR-T05** | Ketahanan Offline PWA (IndexedDB Engine) | **THR-05 (DoS / Ransomware Downtime)** | **RSK-02**: Terhentinya pelayanan gawat darurat. | Service Worker mencegat kegagalan jaringan; ciphertext disimpan ke `resilio_offline_queue`. | `app/(dashboard)/nakes/offline-sync/page.tsx` | Uji simulasi offline & penambahan antrean lokal |
| **UR-T06** | Background Sync & Surat Rujukan Digital | **THR-02 (Data Tampering in Transit)** | **RSK-02**: Penyusupan paket data palsu saat online kembali. | Validasi HMAC-SHA256 oleh server sebelum data offline diserap; penerbitan tiket rujukan. | `app/(dashboard)/nakes/offline-sync/page.tsx`, `rujukan/page.tsx` | Uji verifikasi HMAC saat sync & penerbitan rujukan |
| **UR-A01** | Verifikasi Dokumen Kependudukan Pasien (KYC) | **THR-01 (Spoofing)**: Pendaftaran akun tiruan. | **RSK-05**: Duplikasi rekam medis. | Validasi visual foto KTP fisik terhadap data NIK kependudukan. | `app/(dashboard)/admin/verifikasi-kyc/page.tsx` | Alur persetujuan / penolakan KYC admin |
| **UR-A02** | Verifikasi Lisensi Dokter (KYD - STR & SIP) | **THR-01 (Spoofing)**: Akun nakes tidak terdaftar. | **RSK-03**: Malpraktik diagnosis medis. | Pemeriksaan berkas STR/SIP resmi sebelum mengaktifkan wewenang tulis RME. | `app/(dashboard)/admin/verifikasi-kyd/page.tsx` | Alur validasi lisensi dokter admin |
| **UR-A03** | Master Faskes & Ransomware Kill-Switch | **THR-05 (DoS)** & **THR-02 (Malware Propagation)** | **RSK-01** & **RSK-02**: Penyebaran ransomware lintas faskes. | Saklar darurat pembekuan akses (*Network Quarantine*) untuk memutus sinkronisasi faskes terinfeksi. | `app/(dashboard)/admin/faskes/page.tsx` | Uji isolasi faskes terinfeksi malware |
| **UR-A04** | SIEM Security Monitor & Deteksi Serangan | **THR-06 (BOLA)** & **THR-02 (HMAC Mismatch)** | **RSK-03**: Eksfiltrasi data API yang tidak terdeteksi. | Pencatatan Security Event Log otomatis; klasifikasi severity CRITICAL / WARN / INFO. | `app/(dashboard)/admin/siem-monitor/page.tsx` | Uji simulasi serangan IDOR & HMAC mismatch |
| **UR-A05** | Observabilitas Failed Sync & Pusat Kendala | **THR-05 (System Failure)** | **RSK-02**: Berkas offline tertinggal di klinik. | Pemantauan antrean gagal sinkron dengan isolasi data (Admin dilarang membaca data medis). | `app/(dashboard)/admin/incident-center/page.tsx` | Investigasi tiket kendala & pemantauan antrean sync |

---

## 2. Kepatuhan Terhadap Regulasi Medis & Siber

1. **Undang-Undang Pelindungan Data Pribadi (UU PDP No. 27/2022)**:
   - **Pasal 20 (Dasar Pemrosesan Data Spesifik)**: Data kesehatan adalah data pribadi spesifik yang wajib memiliki persetujuan eksplisit (*Explicit Consent*). Terpenuhi melalui fitur `UR-P04`, `UR-P05`, dan `UR-P07`.
   - **Hak Menarik Persetujuan (*Right to Revoke*)**: Pasien berhak mencabut akses pihak mana pun kapan saja secara instan. Terpenuhi melalui fitur `1-Click Revoke` (`UR-P07`).
   - **Transparansi Pemrosesan**: Pasien berhak mengetahui siapa saja yang membuka data medisnya. Terpenuhi melalui fitur `Audit Trail Pribadi` (`UR-P07`).
2. **Permenkes No. 24 Tahun 2022 tentang Rekam Medis**:
   - **Standarisasi Rekam Medis Elektronik (RME)**: Mewajibkan format terstruktur (SOAP) dan kodefikasi internasional (ICD-10). Terpenuhi melalui fitur `UR-T04`.
   - **Kerahasiaan & Keutuhan Data**: Mewajibkan enkripsi dan perlindungan integritas data medis. Terpenuhi melalui `AES-256-GCM` dan `HMAC-SHA256`.
   - **Atribusi Tenaga Medis**: Wajib mencatat identitas dan nomor izin tenaga kesehatan pemeriksa (STR & SIP). Terpenuhi melalui `UR-T01` dan `UR-T04`.
   - **Prinsip Immutable (Addendum)**: Rekam medis tidak boleh dihapus melainkan ditambahkan catatan koreksi bertingkat (*versioning*).

---

## 3. Rencana Milestone Sepanjang Semester

| Tahapan Evaluasi | Mata Kuliah PAW | Mata Kuliah Kriptografi | Mata Kuliah KKS | Penanda Rilis Git |
| :--- | :--- | :--- | :--- | :---: |
| **Milestone 1 (v0.1 / sec-0.1)** | Antarmuka Responsif & Aksesibel, Form Validasi, Mock Data Sederhana | Kebutuhan Kripto, Fondasi AES-GCM + HMAC, $\ge 4$ Unit Test Vitest | Asset Inventory, DFD 2 Trust Boundary, STRIDE, Risk Register Dasar | `v0.1` & `sec-0.1` |
| **Milestone 2 (v0.2 / sec-0.2)** | **Arsitektur Modular 26 Rute**, Offline PWA (IndexedDB + Service Worker), Role Segregation | **Zero-Knowledge Storage**, Client-Side AES-256-GCM + HMAC-SHA256 Verification, Fail-Closed | **Zero-Trust BOLA/IDOR Defense**, KYC/KYD Management, SIEM Monitor, Ransomware Kill-Switch | `v0.2` & `sec-0.2` |
| **Milestone 3 (v0.3 / sec-0.3)** | Integrasi Database PostgreSQL Prisma, Background Sync Otomatis, OpenAPI Spec | Pertukaran Kunci Asimetris (ECDH/KEM) untuk Portabilitas Lintas Faskes | Edge Middleware JWT Guard, Pentest OWASP Top 10 API, Hardening Secure Cookies | `v0.3` & `sec-0.3` |
| **Final Project (v1.0)** | Rilis Penuh Terintegrasi, Evaluasi Kualitas Perangkat Lunak & PWA Audit Skor 100 | Evaluasi Kinerja Kriptografi Klien, Uji Ketahanan Manipulasi Skala Besar | Evaluasi Keamanan Komprehensif, Laporan Kepatuhan UU PDP & Ciptaan | `v1.0` |
