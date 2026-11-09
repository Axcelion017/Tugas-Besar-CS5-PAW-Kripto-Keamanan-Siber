# Laporan Pengerjaan Tugas 2 Keamanan Komputasi dan Siber (sec-0.2)
## Kontrol Akses, Slow Hashing, Hardening OS/Container & Pemindaian Kerentanan

- **Mata Kuliah**: Keamanan Komputasi dan Siber (KKS)
- **Produk Web**: Resilio-Health — Hospital Information System (HIS) Berdaulat
- **Penanda Rilis**: `sec-0.2`

---

## 1. Autentikasi, Otorisasi, dan Least Privilege (K1: 35 Poin)

### 1.1 Matriks Kontrol Akses per Peran & Uji Akses
- Matriks akses lengkap untuk 4 peran pengguna (*Pasien, Dokter DPJP, Staf Nakes, Admin Kemenkes*) terdokumentasi di berkas:  
  `docs/Tugas2/KKS/security/access-tests.md`
- **Hasil Pengujian Akses Seimbang**: Memenuhi ketentuan KKS di mana **jumlah uji akses negatif (4 ditolak) sama banyaknya dengan uji akses positif (4 diizinkan)**:
  - Positif (Diizinkan): Pasien membuka rekam medisnya, dokter membuka SOAP tiketnya, staf memproses triase, admin memeriksa berkas e-KYC.
  - Negatif (Ditolak Keras): Pasien dilarang membuka konsol admin (*403 Forbidden*), pasien dilarang membuka stasiun kerja dokter, dokter dilarang mengakses Kill-Switch SIEM, staf dilarang menandatangani SOAP medis.
  - Seluruh pengujian otomatis dijalankan melalui Vitest (`tests/access-control.test.ts`) dengan hasil **8/8 Lulus 100%**.

### 1.2 Penyimpanan Kata Sandi dengan Fungsi Hash Lambat (Bcrypt)
- **Implementasi**: Modul `lib/actions/auth.ts` mengintegrasikan pustaka `bcryptjs` dengan faktor kerja **Salt Rounds = 10** (standar memory-hard OWASP Password Storage).
- **Verifikasi**: Tidak ada kata sandi yang disimpan dalam bentuk teks biasa di PostgreSQL; kolom `password_hash` pada tabel `users` murni berupa string modular `$2b$10$...`.
- **Ketahanan**: Kebal dari serangan *Precomputed Rainbow Tables* dan *GPU-accelerated brute force attacks*.

---

## 2. Hardening Sistem Operasi dan Container (K2: 30 Poin)

### 2.1 Pengerasan Sistem Operasi Host (VM & Node Hardening)
Berdasarkan hasil pemindaian audit keamanan **Lynis 3.0.7 / 3.1.2** pada lingkungan node virtual Ubuntu 22.04 LTS (`resilio-node`):
- **Sebelum Perbaikan (`security/lynis-before.txt`)**: Skor Hardening Index = **58 / 100** (Ditemukan peringatan login root aktif, password SSH aktif, dan firewall tidak aktif).
- **Langkah Hardening yang Diterapkan**:
  1. **Penegakan Login SSH Hanya dengan Kunci Publik**:
     ```bash
     docker exec resilio-node sshd -T | grep -E 'passwordauthentication|permitrootlogin'
     # Menghasilkan nilai patuh:
     # permitrootlogin no
     # passwordauthentication no
     ```
  2. **Pengaktifan Firewall UFW dengan kebijakan *Default Incoming DROP***.
  3. **Konfigurasi Parameter Kernel & Limits (`/etc/sysctl.d/99-security-hardening.conf` & limits.conf)**:
     - Mematikan ICMP redirect & broadcast.
     - Membatasi core dump: `* hard core 0` pada `/etc/security/limits.conf`.
     - Memberlakukan `umask 027` dan batas timeout sesi `TMOUT=900`.
  4. **Pemasangan Paket Pertahanan Tambahan**: `rkhunter`, `libpam-pwquality`, `auditd`, `inetutils-syslogd`, `needrestart`, `debsums`, dan banner peringatan hukum UU PDP No. 27/2022 pada `/etc/issue`.
- **Setelah Perbaikan (`security/lynis-after.txt` & Live Node)**: Skor Hardening Index mencapai **72 / 100** pada live container node dan **74 / 100** pada VM multipass (Keduanya resmi memenuhi ambang batas minimal kelulusan rubrik $\ge 70$).

### 2.2 Pengerasan Docker Container (Container Hardening)
Konfigurasi pada `Dockerfile` dan `docker-compose.yml`:
1. **Pengguna Non-Root (`USER node`)**:
   - Container runner tidak dijalankan sebagai `root` (UID 0), melainkan sebagai pengguna non-root `node` (UID 1000). Mencegah eskalasi hak akses ke host Linux jika container ditembus penyerang.
2. **Pembatasan Capability Kernel (`cap_drop: ALL`)**:
   - Menghapus seluruh Linux root capabilities di `docker-compose.yml` serta memasang opsi `security_opt: no-new-privileges:true`.
3. **Isolasi Jaringan Database (Port DB Tidak Dipublikasikan)**:
   - Port PostgreSQL `5432` **TIDAK dipublikasikan ke publik (tidak ada `ports: "5432:5432"`)**.
   - Port hanya dideklarasikan melalui instruksi `expose: 5432` pada jaringan bridge internal (`resilio_internal_net`), sehingga hanya container aplikasi `app` yang dapat berkomunikasi dengan database.

### 2.3 Skrip Otomatisasi & Pembuktian Evaluasi
Untuk memudahkan verifikasi mandiri dan demonstrasi di depan dosen/asisten lab:
- **`./scripts/setup-docker-node.sh`**: Membangun dan mengonfigurasi hardened node Ubuntu 22.04 LTS secara instan.
- **`./scripts/verify-hardening.sh`**: Menjalankan pengecekan otomatis seluruh 3 pilar KKS (SSH daemon `sshd -T`, Dockerfile `USER node`, `cap_drop: ALL`, port PostgreSQL terisolasi, dan berkas bukti di `security/`).

---

## 3. Pemindaian Kerentanan Container Sebelum–Sesudah & SBOM (K3: 20 Poin)

Pemindaian citra container dilakukan menggunakan alat pemindai kerentanan standar industri **Trivy v0.56.2**:
- **Citra Sebelum Perbaikan (`image-scan-before.txt`)**:
  - Menggunakan base image Debian lama (`resilio-health-app:v0.1-monolith`, single-stage).
  - Terdeteksi **34 kerentanan**, termasuk **2 Kerentanan CRITICAL** (CVE-2023-0286 pada libssl1.1 dan CVE-2022-37434 pada zlib1g).
- **Citra Setelah Perbaikan (`image-scan-after.txt`)**:
  - Migrasi ke citra minimal **Alpine Linux (`node:20-alpine`)** dengan arsitektur **Multi-Stage Build**.
  - Seluruh compiler pembangunan dibuang pada tahap final runner.
  - Hasil pemindaian akhir membuktikan: **0 KERENTANAN CRITICAL** dan **0 KERENTANAN HIGH** (*Zero Critical Vulnerabilities*).
- **Software Bill of Materials (SBOM)**:
  - Berkas SBOM berstandar internasional **CycloneDX 1.5** telah dihasilkan dan disimpan di:  
    `docs/Tugas2/KKS/security/sbom.cdx.json`

---

## 4. Keterkaitan dengan Register Risiko & Demonstrasi (K4: 15 Poin)

Seluruh kontrol pengerasan keamanan di atas merujuk secara konsisten ke **ID Risiko Tugas 1 (Milestone 1)** di berkas `docs/security/risk-register.md`:

| ID Kontrol Keamanan | Deskripsi Kontrol | Rujukan ID Risiko Tugas 1 | Dampak Mitigasi |
| :--- | :--- | :--- | :--- |
| **SEC-CTL-01** | Enkripsi AEAD Sisi Klien (AES-256-GCM + AAD) | **`RSK-01`** (Info Disclosure EHR) | Mencegah kebocoran data jika database diretas (*Zero-Knowledge*). |
| **SEC-CTL-02** | Integritas HMAC-SHA256 Fail-Closed | **`RSK-02`** (Data Tampering) | Menolak pemrosesan jika rekam medis diubah 1 bit data. |
| **SEC-CTL-03** | Matriks RBAC & Active Encounter Gate | **`RSK-03`** (BOLA / IDOR Breach) | Memblokir dokter mengintip rekam medis tanpa izin pasien (403). |
| **SEC-CTL-04** | Saklar Darurat Faskes (Kill-Switch) | **`RSK-04`** (Downtime & Ransomware) | Mengisolasi faskes terinfeksi malware dari server pusat. |
| **SEC-CTL-05** | Verifikasi e-KYC/KYD Dokumen Asli | **`RSK-05`** (Akun Fiktif & Dokter Palsu)| Menahan status akun hingga diverifikasi Admin Kemenkes. |
| **SEC-CTL-06** | Canvas Client-Side Auto-Watermarking | **`RSK-06`** (Penyalahgunaan Foto KTP) | Menghindari penyalahgunaan KTP untuk pinjaman online ilegal. |
| **SEC-CTL-07** | Validasi Server Zod v4 & Bcrypt Salt 10 | **`RSK-10`** & **`RSK-11`** (Bypass & XSS) | Mencegah injeksi payload form dan cracking password. |

---

## 5. Ringkasan Pengumpulan Teks Daring (sec-0.2)
Saat mengumpulkan di kolom teks daring Moodle KKS:
- **Tautan Repositori**: `https://github.com/Axcelion017/...`
- **Penanda Rilis**: `sec-0.2` (Tag: `v0.2`)
- **Hash Commit**: Dapat dilihat melalui perintah `git rev-parse HEAD`.
