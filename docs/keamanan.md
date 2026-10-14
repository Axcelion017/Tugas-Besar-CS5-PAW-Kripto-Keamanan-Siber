# Kebijakan Keamanan, Matriks Akses & Evaluasi OWASP — Resilio-Health

Dokumen ini mendefinisikan matriks kontrol akses berbasis peran (*Role-Based Access Control* / RBAC), postur pertahanan terhadap OWASP Top 10 (Web & API), serta prinsip arsitektur keamanan *Zero-Trust* pada Resilio-Health.

---

## 1. Matriks Kontrol Akses Berbasis Peran (*Access Control Matrix*)

Sistem menerapkan prinsip *Least Privilege* (hak akses terendah yang memadai) dan pemisahan wewenang (*Separation of Duties*):

| Operasi / Sumber Daya | Dokter (Bertugas) | Dokter (Lain) | Pasien (Pemilik) | Pasien (Lain) | Administrator |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Input Rekam Medis (EHR)** | ✅ Diizinkan | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak |
| **Enkripsi Data Klinis** | ✅ Diizinkan | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak |
| **Membaca Plaintext Diagnosa** | ✅ Diizinkan | ❌ Ditolak | ✅ Diizinkan | ❌ Ditolak | ❌ Ditolak (Zero-Knowledge) |
| **Membaca Ciphertext Mentah** | ✅ Diizinkan | ✅ Diizinkan | ✅ Diizinkan | ❌ Ditolak | ✅ Diizinkan |
| **Delegasi Penugasan Dokter** | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ✅ Diizinkan |
| **Simulasi Tamper & Audit Log**| ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ❌ Ditolak | ✅ Diizinkan |

> **Catatan Zero-Knowledge**: Administrator rumah sakit memiliki hak mengelola infrastruktur dan penugasan, namun **secara kriptografis tidak dapat membaca isi diagnosis atau resep pasien** karena tidak memegang kunci simetris pasien.

---

## 2. Penyelarasan Terhadap OWASP Top 10 (2021)

| Kategori OWASP | Potensi Risiko pada Aplikasi HIS | Kontrol Mitigasi pada Resilio-Health | Status Milestone |
| :--- | :--- | :--- | :---: |
| **A01: Broken Access Control** | Dokter mengakses catatan medis pasien bangsal lain tanpa penugasan sah. | **Zero-Trust Role Guard**: Komponen `DokterView.tsx` memverifikasi `assignedDoctorId === session.id` sebelum merender form atau memproses enkripsi. | **Milestone 1 (v0.1)** |
| **A02: Cryptographic Failures** | Rekam medis tersimpan plaintext atau menggunakan algoritma usang (DES/MD5). | **Enkripsi Modern**: Enkripsi AES-256-GCM dengan IV acak 96-bit unik via CSPRNG `crypto.getRandomValues()` + integritas HMAC-SHA256. | **Milestone 1 (v0.1)** |
| **A03: Injection (XSS & Data)** | Masukan gejala/resep memuat skrip berbahaya (`<script>`) yang dieksekusi di portal pasien. | **React JSX Auto-Escaping & Type-Checking**: Data masukan diperlakukan sebagai teks literal murni; validasi skema input TypeScript. | **Milestone 1 (v0.1)** |
| **A04: Insecure Design** | Ketiadaan perlindungan terhadap pemalsuan data pada penyimpanan lokal. | **Integritas Otentik (AEAD & HMAC)**: Data yang dimanipulasi akan langsung gagal verifikasi HMAC sebelum proses dekripsi. | **Milestone 1 (v0.1)** |
| **A05: Security Misconfiguration** | Informasi galat sensitif (stack trace) bocor ke pengguna saat dekripsi gagal. | **Fail-Closed Architecture**: Kesalahan dekripsi hanya memunculkan peringatan umum tanpa mengekspos detail kunci atau struktur internal. | **Milestone 1 (v0.1)** |
| **A07: Identification & Auth Failures** | Sesi dokter tertinggal di komputer bangsal tanpa opsi keluar yang aman. | **Dialog Konfirmasi Logout Aksesibel**: Menghapus seluruh memori sesi saat pengguna menekan tombol keluar. | **Milestone 1 (v0.1)** |
| **A08: Software & Data Integrity** | Pustaka kriptografi pihak ketiga disusupi kode berbahaya. | **Native Web Crypto API**: Menggunakan implementasi kriptografi bawaan runtime peramban standar W3C tanpa dependensi pustaka eksternal yang tidak terpelihara. | **Milestone 1 (v0.1)** |

---

## 3. Rencana Peningkatan Keamanan pada Milestone Berikutnya

- **Milestone 2 (v0.2)**: Integrasi backend database Prisma dengan otentikasi sesi berbasis HttpOnly Secure Cookie dan rotasi kunci.
- **Milestone 3 (v0.3)**: Implementasi pertukaran kunci asimetris (ECDH / RSA-OAEP) dan otomatisasi pemindaian keamanan menggunakan OWASP ZAP & SonarQube.