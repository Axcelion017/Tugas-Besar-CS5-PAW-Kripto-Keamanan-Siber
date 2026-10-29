# Matriks Keterlacakan Antarmata Kuliah — Resilio-Health

Dokumen ini memetakan benang merah keterhubungan antara **Kebutuhan Pengguna (PAW)**, **Fondasi Kriptografi (Kriptografi)**, serta **Model Ancaman & Kontrol Risiko (Keamanan Komputasi dan Siber)** guna menjamin konsistensi pengembangan produk terpadu sepanjang semester.

---

## 1. Matriks Keterlacakan Komprehensif (Traceability Matrix)

| ID Kebutuhan | Deskripsi Fitur Produk | Ancaman STRIDE (KKS) | Risiko Prioritas (KKS) | Solusi Kriptografi (Kripto) | Komponen Implementasi | Bukti Verifikasi Uji |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UR-P01** | Registrasi Pasien NIK (16 digit) & Unggah KTP | **THR-01 (Spoofing)**: Akun fiktif / duplikasi identitas. | **RSK-05**: Manipulasi identitas kependudukan. | Validasi keaslian berkas KYC & enkripsi data profil di memori. | `app/(auth)/register/pasien/page.tsx` | Validasi 16 digit NIK & status PENDING |
| **UR-P02** & **UR-P03** | Pencarian Faskes Pintar & Profil Kuota Dokter | **THR-05 (DoS)**: Manipulasi parameter pencarian. | **RSK-03**: Faskes palsu. | Verifikasi status Faskes (`ACTIVE` vs `QUARANTINED`). | `app/(dashboard)/pasien/faskes/` | Filtering gejala & pembatasan kuota dokter |
| **UR-P04** | Booking Konsultasi & Auto-Consent Ticket | **THR-06 (Privilege Escalation)**: Akses tanpa hak aktif. | **RSK-03**: Pelanggaran izin akses. | Pembuatan relasi izin berbatas waktu di `access_grants`. | `app/(dashboard)/pasien/booking/page.tsx` | Penerbitan tiket consent saat booking |
| **UR-P05** | Portabilitas RME & Perpindahan Faskes | **THR-04 (Info Disclosure)**: Kebocoran saat rujukan. | **RSK-01**: Kebocoran rekam medis (EHR). | Transfer ciphertext terenkripsi; pembagian hak via 1-Click Consent. | `app/(dashboard)/pasien/consent/page.tsx` | Delegasi izin antar faskes tanpa berkas fisik |
| **UR-P06** | Tracking RME, Grafik Tensi & Dekripsi Klien | **THR-04 (Info Disclosure)** & **THR-02 (Tampering)** | **RSK-01** (EHR Leak) & **RSK-02** (Tampering) | **AES-256-GCM** + **HMAC-SHA256**. Dekripsi *Zero-Knowledge* di browser. | `app/(dashboard)/pasien/rekam-medis/page.tsx` | Uji Vitest Enkripsi/Dekripsi & grafik tensi |
| **UR-P07** | 1-Click Revoke Access & Audit Trail Pribadi | **THR-01 (Spoofing)** & **THR-03 (Repudiation)** | **RSK-05**: Akses dokter pasca rujukan. | Pencatatan event audit log otomatis dan pemutusan izin seketika. | `app/(dashboard)/pasien/consent/page.tsx` | Pencabutan izin & verifikasi blokir seketika |
| **UR-P08** | Manajemen Biodata & Tiket Kendala | **THR-05 (Bug/Error)**: Kesalahan sistem tak terdeteksi. | **RSK-02**: Kesalahan data medis. | Pemisahan metadata tiket teknis dari isi payload medis. | `app/(dashboard)/pasien/tiket-kendala/page.tsx` | Pengiriman tiket laporan ke incident center |
| **UR-P09** | e-KYC KTP & Swafoto Ber-Watermark Otomatis | **THR-01 (Spoofing)**: Pencurian foto KTP untuk pinjol. | **RSK-05**: Penyalahgunaan identitas. | Auto-watermark teks digital di canvas sebelum unggah. | `app/(auth)/register/pasien/page.tsx` | Watermark transparan di atas foto KTP |
| **UR-P10** | Persetujuan DPJP & 6-Digit PIN Admisi | **THR-06 (BOLA / IDOR)**: Dokter luar membuka data. | **RSK-03**: Akses dokter non-DPJP. | Penerbitan *Active Encounter Ticket* terkunci pada DPJP. | `app/(dashboard)/pasien/page.tsx`, `/staf/assign-dpjp/` | Verifikasi PIN 6 digit di meja admisi |
| **UR-P11** | Akun Tanggungan Keluarga (Family Proxy) | **THR-06 (Unauthorized Proxy)**: Akses akun anak ilegal. | **RSK-05**: Pembajakan data anak/lansia. | Relasi perwalian terikat pada nomor Kartu Keluarga (KK). | `app/(dashboard)/pasien/page.tsx` | Pengalihan profil pasien anak/wali |
| **UR-P12** | Akses Citra Medis Terdekripsi (Rontgen/USG/Lab) | **THR-04 (Info Disclosure Citra)** | **RSK-01**: Kebocoran foto rontgen/lab. | Dekripsi biner Blob terenkripsi menggunakan Web Crypto API. | `app/(dashboard)/pasien/rekam-medis/page.tsx` | Penampil citra radiologi terdekripsi di browser |
| **UR-S01** | Admisi Pasien (Check-in) & Antrean Walk-in | **THR-05 (Downtime Chaos)**: Antrean loket macet. | **RSK-04**: Pasien terlantar di faskes. | Penjadwalan lokal dengan status `WAITING_TRIAGE`. | `app/(dashboard)/staf/page.tsx` | Check-in kedatangan & pendaftaran walk-in |
| **UR-S02** | Input Triase Awal (Hijau/Kuning/Merah) & Vitals | **THR-05 (Emergency Delay)**: Salah urutan penanganan. | **RSK-02**: Keterlambatan pasien kritis. | Pengelompokan kegawatan triase terikat tanda vital. | `app/(dashboard)/staf/triase/page.tsx` | Form triase fisik & pengelompokan warna |
| **UR-S03** | Penugasan Dokter Penanggung Jawab (Assign DPJP) | **THR-06 (BOLA)**: Akses acak antar dokter poli. | **RSK-03**: Kebocoran diagnosa ke dokter lain. | Penerbitan tiket *Active Encounter* terikat DPJP bertugas. | `app/(dashboard)/staf/assign-dpjp/page.tsx` | Penetapan DPJP & isolasi dokter non-DPJP |
| **UR-S04** | Administrasi Rujukan Masuk & Keluar Faskes | **THR-03 (Repudiation)**: Rujukan tanpa jejak resmi. | **RSK-03**: Rujukan liar antar faskes. | Pencatatan tiket rujukan faskes di basis data persetujuan. | `app/(dashboard)/staf/rujukan/page.tsx` | Pendaftaran rujukan masuk & keluar faskes |
| **UR-T01** | Onboarding Kredensial Medis (STR & SIP Nakes) | **THR-01 (Spoofing)**: Dokter gadungan. | **RSK-05**: Malpraktik medis. | Validasi nomor STR ke Konsil Kedokteran Indonesia (KKI). | `app/(auth)/register/nakes/page.tsx` | Penguncian akun berstatus PENDING |
| **UR-T02** | Antrean Pasien Hari Ini & Prefetch Offline | **THR-05 (DoS)**: Lumpuh saat internet mati. | **RSK-04**: Kehilangan antrean pasien. | Prefetch payload terenkripsi disimpan di IndexedDB lokal. | `app/(dashboard)/nakes/page.tsx` | Antrean pasien siap periksa & alert alergi |
| **UR-T03** | Lookup Pasien NIK & Pertahanan BOLA/IDOR | **THR-06 (BOLA / IDOR)**: Dokter menebak URL pasien lain. | **RSK-03**: Kebocoran rekam medis massal. | Gateway memverifikasi izin aktif sebelum data dibuka. | `app/(dashboard)/nakes/pasien-lookup/page.tsx` | Blokir HTTP 403 Forbidden & log SIEM |
| **UR-T04** | Input SOAP, ICD-10, Zod & Tanda Tangan Kripto | **THR-02 (Tampering)** & **THR-04 (Info Disclosure)** | **RSK-01** & **RSK-02**: Modifikasi dosis / kebocoran EHR. | Validasi skema Zod v4 (tensi, ICD-10, medikolegal) + Enkripsi AES-256-GCM + tag HMAC-SHA256. | `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx`, `lib/validations/clinical.ts` | Input SOAP klinis & tanda tangan kripto |
| **UR-T05** | Ketahanan Offline PWA (IndexedDB Engine) | **THR-05 (Ransomware Downtime)** | **RSK-04**: Pelayanan gawat darurat terhenti. | Service Worker mengantrekan ciphertext ke IndexedDB. | `app/(dashboard)/nakes/offline-sync/page.tsx` | Penyimpanan antrean lokal saat internet putus |
| **UR-T06** | Background Sync & Surat Rujukan Digital | **THR-02 (Data Tampering in Transit)** | **RSK-02**: Manipulasi berkas offline. | Validasi HMAC sebelum sync; penerbitan tiket rujukan. | `app/(dashboard)/nakes/offline-sync/page.tsx` | Verifikasi HMAC saat sync & rujukan digital |
| **UR-T07** | Unggah & Enkripsi Citra Medis (Rontgen/USG/Lab) | **THR-04 (Info Disclosure Citra)** & **THR-02** | **RSK-01**: Modifikasi foto rontgen / pencurian. | Enkripsi biner AES-256-GCM + HMAC digest pada file citra. | `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx` | Lampiran citra medis terenkripsi di IndexedDB |
| **UR-T08** | Protokol Akses Darurat IGD (Break-Glass Access) | **THR-05 (Emergency Lockout)**: Pasien koma tanpa izin. | **RSK-02**: Keterlambatan penanganan darurat. | Bypass terkontrol dengan alasan klinis wajib & notifikasi SIEM. | `app/(dashboard)/nakes/pasien-lookup/page.tsx` | Tombol Break-Glass IGD & High-Severity Alert |
| **UR-T09** | Koreksi Rekam Medis Berbasis Addendum | **THR-02 (Tampering Record)**: Hapus diagnosa lama. | **RSK-02**: Hilangnya jejak audit hukum medis. | Immutable versioning (versi 1, versi 2) dengan alasan revisi. | `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx` | Addendum revisi bertingkat Permenkes 24/2022 |
| **UR-T10** | Peringatan Otomatis Kontraindikasi Alergi Obat | **THR-02 (Malpractice Injury)**: Salah resep obat alergi. | **RSK-02**: Syok anafilaktik fatal. | Real-time text match alergen pada input resep obat. | `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx` | Alert kontraindikasi klinis otomatis |
| **UR-A01** | Verifikasi Dokumen Kependudukan Pasien (KYC) | **THR-01 (Spoofing)**: Pendaftaran akun tiruan. | **RSK-05**: Duplikasi rekam medis. | Validasi visual NIK terhadap dokumen KTP asli. | `app/(dashboard)/admin/verifikasi-kyc/page.tsx` | Persetujuan & penolakan berkas KYC |
| **UR-A02** | Verifikasi Lisensi Dokter (KYD - STR & SIP) | **THR-01 (Spoofing)**: Akun dokter palsu. | **RSK-05**: Malpraktik dokter gadungan. | Validasi nomor STR dan SIP ke pangkalan data Kemenkes. | `app/(dashboard)/admin/verifikasi-kyd/page.tsx` | Validasi lisensi dokter konsil kedokteran |
| **UR-A03** | Master Faskes & Ransomware Kill-Switch | **THR-05 (DoS)** & **THR-02 (Malware Propagation)** | **RSK-01** & **RSK-04**: Penyebaran malware antar RS. | Saklar darurat pembekuan akses (*Network Quarantine*). | `app/(dashboard)/admin/faskes/page.tsx` | Tombol isolasi faskes terinfeksi ransomware |
| **UR-A04** | SIEM Security Monitor & Deteksi Serangan | **THR-06 (BOLA)** & **THR-02 (HMAC Mismatch)** | **RSK-03**: Pencurian data API tak terdeteksi. | Live Security Event Stream; severity CRITICAL/WARN/INFO. | `app/(dashboard)/admin/siem-monitor/page.tsx` | Monitoring event IDOR, HMAC, & Break-Glass |
| **UR-A05** | Observabilitas Failed Sync & Pusat Kendala | **THR-05 (System Failure)** | **RSK-04**: Berkas offline tertinggal. | Pemantauan metadata antrean gagal sync tanpa buka isi medis. | `app/(dashboard)/admin/incident-center/page.tsx` | Investigasi kendala sinkronisasi faskes |
| **UR-A06** | Verifikasi Visual e-KYC/KYD Ber-Watermark | **THR-01 (Spoofing)**: Pemalsuan foto KTP/wajah. | **RSK-05**: Akun fiktif lolos verifikasi. | Peninjau visual dokumen berdampingan (KTP + Selfie Liveness). | `app/(dashboard)/admin/verifikasi-kyc/page.tsx` | Modal visual viewer e-KYC aman |
| **UR-A07** | Pengawasan Log Break-Glass & Investigasi | **THR-06 (Privilege Abuse)**: Dokter salah guna tombol IGD. | **RSK-03**: Pelanggaran privasi internal. | Notifikasi alarm khusus setiap kali Break-Glass diaktifkan. | `app/(dashboard)/admin/siem-monitor/page.tsx` | Audit forensik akses darurat IGD |

---

## 2. Kepatuhan Terhadap Regulasi Medis & Siber

1. **Undang-Undang Pelindungan Data Pribadi (UU PDP No. 27/2022)**:
   - **Pasal 20 (Explicit Consent)**: Terpenuhi melalui `UR-P04`, `UR-P05`, `UR-P07`, dan `UR-P10` (6-digit PIN DPJP).
   - **Hak Menarik Persetujuan (Right to Revoke)**: Terpenuhi melalui `1-Click Revoke` (`UR-P07`).
   - **Transparansi Pemrosesan**: Terpenuhi melalui `Audit Trail Pribadi` (`UR-P07`).
2. **Permenkes No. 24 Tahun 2022 tentang Rekam Medis**:
   - **Format SOAP & ICD-10**: Terpenuhi melalui `UR-T04`.
   - **Citra Medis Digital**: Terpenuhi melalui `UR-T07` dan `UR-P12`.
   - **Atribusi STR/SIP & Triase Keperawatan**: Terpenuhi melalui `UR-S02`, `UR-T01`, dan `UR-T04`.
   - **Prinsip Immutable (Addendum)**: Terpenuhi melalui `UR-T09`.
3. **Standar Keamanan Internasional (ISO 27799 / HIPAA)**:
   - **Protokol Break-Glass Emergency Access**: Terpenuhi melalui `UR-T08` dan `UR-A07`.

---

## 3. Rencana Milestone Sepanjang Semester

| Tahapan Evaluasi | Mata Kuliah PAW | Mata Kuliah Kriptografi | Mata Kuliah KKS | Penanda Rilis Git |
| :--- | :--- | :--- | :--- | :---: |
| **Milestone 1 (v0.1 / sec-0.1)** | Antarmuka Responsif & Aksesibel, Form Validasi, Mock Data Sederhana | Kebutuhan Kripto, Fondasi AES-GCM + HMAC, $\ge 4$ Unit Test Vitest | Asset Inventory, DFD 2 Trust Boundary, STRIDE, Risk Register Dasar | `v0.1` & `sec-0.1` |
| **Milestone 2 (v0.2 / sec-0.2)** | **Arsitektur Modular 30 Rute (4 Role)**, Triase & Admisi Staf, Offline PWA (IndexedDB Blob), **Skema Validasi Zod v4 & Server Actions** | **Zero-Knowledge Storage**, Enkripsi Citra Medis Biner (Rontgen/USG), HMAC-SHA256 Fail-Closed, **19 Unit Test Vitest (100% Lulus)** | **Zero-Trust BOLA Guard**, Break-Glass Protocol, Visual e-KYC Watermark, Ransomware Kill-Switch, **Stateful Cookie Sessions (HttpOnly)** | `v0.2` & `sec-0.2` |
| **Milestone 3 (v0.3 / sec-0.3)** | Integrasi Database PostgreSQL Prisma, Background Sync Otomatis, OpenAPI Spec | Pertukaran Kunci Asimetris (ECDH/KEM) untuk Portabilitas Lintas Faskes | Edge Middleware JWT Guard, Pentest OWASP Top 10 API, Hardening Secure Cookies | `v0.3` & `sec-0.3` |
| **Final Project (v1.0)** | Rilis Penuh Terintegrasi, Evaluasi Kualitas Perangkat Lunak & PWA Audit Skor 100 | Evaluasi Kinerja Kriptografi Klien, Uji Ketahanan Manipulasi Skala Besar | Evaluasi Keamanan Komprehensif, Laporan Kepatuhan UU PDP & Ciptaan | `v1.0` |
