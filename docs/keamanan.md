# Kebijakan Keamanan, Matriks Akses & Evaluasi OWASP — Resilio-Health

Dokumen ini mendefinisikan matriks kontrol akses berbasis peran (*Role-Based Access Control* / RBAC), postur pertahanan terhadap OWASP Top 10 (Web & API), serta prinsip arsitektur keamanan *Zero-Trust* pada Resilio-Health.

---

## 1. Matriks Kontrol Akses Berbasis Peran (*Access Control Matrix*)

Sistem menerapkan prinsip *Least Privilege* (hak akses minimum yang memadai) dan pemisahan wewenang (*Separation of Duties*) sesuai Permenkes No. 24/2022 dan UU PDP No. 27/2022:

| Operasi / Sumber Daya Sistem | Pasien (Pemilik Data) | Dokter (Ada Izin / Booking) | Dokter (Tanpa Izin / Lain) | Admin Regulator (Kemenkes) |
| :--- | :---: | :---: | :---: | :---: |
| **Registrasi NIK & Unggah KTP (KYC)** | Diizinkan | Ditolak | Ditolak | Ditolak |
| **Pendaftaran STR & SIP (KYD)** | Ditolak | Diizinkan | Diizinkan | Ditolak |
| **Verifikasi KYC Pasien & KYD Dokter** | Ditolak | Ditolak | Ditolak | Diizinkan |
| **Pencarian Faskes & Booking Jadwal** | Diizinkan | Ditolak | Ditolak | Ditolak |
| **Pemberian & Pencabutan Izin (1-Click Revoke)** | Diizinkan | Ditolak | Ditolak | Ditolak |
| **Membaca Plaintext Diagnosa & Resep** | Diizinkan (Kunci Privat) | Diizinkan (Ada Consent) | Ditolak (BOLA Guard) | **Ditolak (Zero-Knowledge)** |
| **Input & Enkripsi Rekam Medis (SOAP)** | Ditolak | Diizinkan | Ditolak (BOLA Guard) | Ditolak |
| **Membaca Ciphertext & Metadata Transaksi** | Diizinkan | Diizinkan | Ditolak | Diizinkan (Untuk Observabilitas) |
| **Menerbitkan Surat Rujukan Digital** | Ditolak | Diizinkan | Ditolak | Ditolak |
| **Akses Antrean Offline (IndexedDB)** | Ditolak | Diizinkan (Stasiun Kerja) | Ditolak | Ditolak |
| **Monitoring SIEM & Deteksi IDOR** | Ditolak | Ditolak | Ditolak | Diizinkan |
| **Aktivasi Ransomware Kill-Switch Faskes** | Ditolak | Ditolak | Ditolak | Diizinkan |
| **Melihat Audit Trail Pribadi** | Diizinkan (Milik Sendiri) | Ditolak | Ditolak | Diizinkan (Global SIEM) |
| **Mengirim Tiket Kendala Teknis** | Diizinkan | Diizinkan | Diizinkan | Ditolak (Sebagai Resolver) |

> **Prinsip Zero-Knowledge Admin**: Administrator sistem dan staf TI pemerintah mengelola integritas operasional, verifikasi identitas, dan penahanan malware, namun **secara kriptografis mustahil membaca isi diagnosis atau resep pasien** karena enkripsi dan dekripsi berlangsung murni di peramban pengguna (*Client-Side Encryption*).

---

## 2. Penyelarasan Terhadap OWASP Top 10 API Security (2023)

Berdasarkan fakta bahwa 96% kerentanan sistem kesehatan berasal dari aplikasi web dan API, Resilio-Health mengimplementasikan kontrol mitigasi ketat:

| Kategori OWASP API | Skenario Ancaman Dunia Nyata | Kontrol Mitigasi pada Resilio-Health |
| :--- | :--- | :--- |
| **API1:2023 Broken Object Level Authorization (BOLA / IDOR)** | Penyerang menebak parameter `id_pasien` di URL API untuk mengunduh rekam medis orang lain. | **Zero-Trust Consent Guard**: Setiap pemanggilan data pasien memverifikasi tiket izin aktif (`access_grants`) antara ID dokter dan ID pasien. Akses tanpa izin diblokir HTTP 403 Forbidden dan dicatat ke SIEM. |
| **API2:2023 Broken Authentication** | Penyusupan akun dokter gadungan atau pencurian token sesi yang tidak kedaluwarsa. | **KYD Verification & Secure Session**: Akun dokter berstatus `PENDING` dikunci dari pemanggilan API klinis sampai nomor STR/SIP diverifikasi Admin; token sesi diproteksi kebijakan *HttpOnly*. |
| **API3:2023 Broken Object Property Level Authorization** | Dokter membaca properti kependudukan sensitif atau Admin membaca properti klinis pasien. | **Separation of Concerns**: Endpoint RME hanya menyajikan ciphertext opaque; data kependudukan hanya menampilkan status `VERIFIED` tanpa membocorkan nomor dokumen internal. |
| **API4:2023 Unrestricted Resource Consumption** | Serangan DoS berupa pemanggilan berulang enkripsi atau pengiriman payload teks masif. | **Client Sanitization & Rate Limiting**: Validasi rentang nilai fisiologis tanda vital di peramban dan pembatasan frekuensi request ke gateway. |
| **API5:2023 Broken Function Level Authorization (BFLA)** | Pengguna biasa memicu endpoint pemulihan karantina faskes atau Admin memanggil endpoint RME. | **Strict Edge RBAC**: Edge Middleware memutus akses sebelum mencapai Route Handlers; Admin langsung diblokir 403 Forbidden jika mencoba mengakses `/api/rme`. |
| **API8:2023 Security Misconfiguration** | Informasi error *stack trace* bocor saat proses verifikasi atau dekripsi gagal. | **Fail-Closed Architecture**: Kesalahan dekripsi atau ketidakcocokan HMAC hanya memunculkan pesan peringatan umum tanpa mengekspos kunci atau konfigurasi server. |
| **API10:2023 Unsafe Consumption of APIs** | Server pusat disusupi paket data rekam medis palsu dari faskes yang terinfeksi ransomware. | **HMAC-SHA256 Integrity Verification & Faskes Kill-Switch**: Server pusat memverifikasi digest HMAC atas ciphertext sebelum data diterima; faskes terinfeksi dapat langsung diisolasi (*quarantine*). |

---

## 3. Penyelarasan Terhadap OWASP Top 10 Web (2021)

| Kategori OWASP Web | Potensi Risiko pada Aplikasi HIS | Kontrol Mitigasi pada Resilio-Health |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | Pasien membuka menu dokter atau sebaliknya melalui manipulasi URL langsung. | **Route Group Protection**: Proteksi rute pada `app/(dashboard)/layout.tsx` yang memvalidasi `session.role` terhadap rute aktif; pelanggaran langsung menampilkan panel blokir Zero-Trust. |
| **A02: Cryptographic Failures** | Rekam medis tersimpan sebagai teks terang (*plaintext*) di database terpusat. | **AES-256-GCM + W3C Web Crypto**: Enkripsi AES-256-GCM dengan IV acak 96-bit (CSPRNG `crypto.getRandomValues()`) unik per catatan medis; kunci 256-bit unik per pasien. |
| **A03: Injection (XSS & Data)** | Masukan keluhan atau instruksi obat disusupi skrip berbahaya (`<script>`). | **JSX Auto-Escaping & TypeScript Schemas**: Seluruh data masukan di-render sebagai teks aman; struktur data divalidasi dengan tipe TypeScript ketat. |
| **A04: Insecure Design** | Ketiadaan perlindungan integritas saat data rekam medis disimpan secara offline di browser. | **Anti-Tampering HMAC-SHA256**: Mengunci ciphertext dengan digest HMAC. Jika ada bit yang diubah via DevTools, sistem menolak dekripsi (*Fail-Closed*). |
| **A07: Identification & Auth Failures** | Sesi dokter tertinggal di komputer bangsal saat pergantian shift. | **Dialog Konfirmasi Logout Aksesibel**: Menghapus seluruh token dan kunci sesi di memori peramban secara tuntas saat tombol keluar ditekan. |
| **A08: Software & Data Integrity Failures** | Pustaka kriptografi eksternal memuat celah keamanan rantai pasok (*supply chain*). | **Native W3C Web Crypto API**: Menggunakan implementasi kriptografi bawaan runtime modern browser tanpa dependensi pustaka eksternal yang tidak terpelihara. |

---

## 4. Protokol Mitigasi Ransomware & Kejadian Darurat

1. **Ransomware Kill-Switch (Isolasi Jaringan Faskes)**:
   - Jika suatu faskes (misal Puskesmas atau RS Mitra) terdeteksi terserang malware, Admin Regulator Kemenkes dapat mengaktifkan status `QUARANTINED` pada master faskes.
   - Status ini langsung membekukan seluruh jalur API sinkronisasi data dari faskes tersebut, mencegah ransomware menyebarkan muatan berbahaya ke server RME nasional.
2. **Ketahanan Downtime Operasional (Offline-First Resilience)**:
   - Ketika faskes terisolasi atau kabel jaringan terputus, operasional klinik tetap berjalan normal menggunakan Service Worker dan IndexedDB.
   - Dokter tetap dapat melayani pasien darurat, membaca riwayat medis yang telah di-cache, dan menulis catatan rekam medis baru yang tersimpan aman secara kriptografis.
