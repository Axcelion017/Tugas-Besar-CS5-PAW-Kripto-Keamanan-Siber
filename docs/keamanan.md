# Kebijakan Keamanan, Matriks Akses & Evaluasi OWASP — JagaMedis (`v0.3.4`)

Dokumen ini mendefinisikan matriks kontrol akses berbasis peran (*Role-Based Access Control* / RBAC 4-Role), postur pertahanan terhadap OWASP Top 10 (Web & API 2023) dan OWASP ASVS v4.0, protokol darurat *Break-Glass*, serta prinsip arsitektur keamanan *Zero-Trust* pada **JagaMedis** (sebelumnya Resilio-Health).

---

## 1. Matriks Kontrol Akses Berbasis 4-Role (*Access Control Matrix*)

Sistem menerapkan prinsip *Least Privilege* (hak akses minimum yang memadai) dan pemisahan wewenang (*Separation of Duties*) sesuai Permenkes No. 24/2022 dan UU PDP No. 27/2022:

| Operasi / Sumber Daya Sistem | Pasien (Pemilik Data) | Staf Nakes (Triase/Admisi) | Dokter (DPJP Bertugas) | Dokter Lain (Non-DPJP) | Admin Regulator (Kemenkes) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Registrasi NIK & Unggah KTP/Selfie (e-KYC)** | Diizinkan | Ditolak | Ditolak | Ditolak | Ditolak |
| **Pendaftaran STR & SIP Nakes (e-KYD)** | Ditolak | Diizinkan | Diizinkan | Diizinkan | Ditolak |
| **Verifikasi Visual e-KYC & e-KYD Ber-Watermark** | Ditolak | Ditolak | Ditolak | Ditolak | Diizinkan |
| **Penerimaan Pasien (Check-in) & Antrean Walk-in** | Ditolak | Diizinkan | Ditolak | Ditolak | Ditolak |
| **Input Triase Awal & Tanda Vital Fisik** | Ditolak | Diizinkan | Diizinkan | Ditolak | Ditolak |
| **Penetapan DPJP (Active Encounter Ticket)** | Ditolak | Diizinkan | Ditolak | Ditolak | Ditolak |
| **Pemberian Izin (PIN) & 1-Click Revoke** | Diizinkan | Ditolak | Ditolak | Ditolak | Ditolak |
| **Membaca Plaintext Diagnosa & Resep Masa Lalu** | Diizinkan | Ditolak (Least Privilege) | Diizinkan (Ada Encounter) | Ditolak (BOLA Guard) | **Ditolak (Zero-Knowledge)** |
| **Input & Enkripsi Rekam Medis (SOAP + Citra)** | Ditolak | Ditolak | Diizinkan | Ditolak (BOLA Guard) | Ditolak |
| **Unggah & Enkripsi Citra Medis (Rontgen/USG)** | Ditolak | Ditolak | Diizinkan | Ditolak | Ditolak |
| **Akses Darurat IGD (Break-Glass Protocol)** | Ditolak | Ditolak | Diizinkan (Koma/IGD) | Diizinkan (Koma/IGD) | Ditolak (Sebagai Pengawas) |
| **Menerbitkan Addendum Revisi Rekam Medis** | Ditolak | Ditolak | Diizinkan | Ditolak | Ditolak |
| **Administrasi Rujukan Antar Faskes** | Ditolak | Diizinkan | Ditolak (Klinis saja) | Ditolak | Ditolak |
| **Akses Antrean Offline (IndexedDB Engine)** | Ditolak | Diizinkan (Lokal Loket) | Diizinkan (Lokal Poli) | Ditolak | Ditolak |
| **Monitoring SIEM & Audit Break-Glass** | Ditolak | Ditolak | Ditolak | Ditolak | Diizinkan |
| **Aktivasi Ransomware Kill-Switch Faskes** | Ditolak | Ditolak | Ditolak | Ditolak | Diizinkan |
| **Melihat Audit Trail Pribadi (UU PDP)** | Diizinkan (Data Sendiri) | Ditolak | Ditolak | Ditolak | Diizinkan (Global SIEM) |
| **Mengirim Tiket Kendala Teknis** | Diizinkan | Diizinkan | Diizinkan | Diizinkan | Ditolak (Sebagai Resolver) |

> **Prinsip Zero-Knowledge Admin**: Administrator sistem dan staf TI pemerintah mengelola integritas operasional, verifikasi identitas, dan penahanan malware, namun **secara kriptografis mustahil membaca isi diagnosis atau resep pasien** karena enkripsi dan dekripsi berlangsung murni di peramban pengguna (*Client-Side Encryption*).

---

## 2. Penyelarasan Terhadap OWASP Top 10 API Security (2023)

Berdasarkan fakta bahwa 96% kerentanan sistem kesehatan berasal dari aplikasi web dan API, Resilio-Health mengimplementasikan kontrol mitigasi ketat:

| Kategori OWASP API | Skenario Ancaman Dunia Nyata | Kontrol Mitigasi pada Resilio-Health |
| :--- | :--- | :--- |
| **API1:2023 Broken Object Level Authorization (BOLA / IDOR)** | Penyerang menebak parameter `id_pasien`, `familyMemberId`, atau `attachmentId` untuk mengakses/mengubah data orang lain. | **Server-Side Auth Guard (`features/auth/guard.ts`) & Zero-Trust Ownership Guard**: 52+ pemanggilan `requireSession(allowedRoles)` di seluruh Server Actions & REST API (`/api/attachments`, `/api/sync/outbox`, `features/auth/family-actions.ts`), mengambil `actorId` dari sesi server persisten, memverifikasi kepemilikan `patientId` / `validUntil > now` / *Active Encounter*, memblokir akses tanpa izin (`401`/`403`), tidak membocorkan PII/`encryptionKeyHex`, dan mencatat `IDOR_BLOCKED` ke SIEM. |
| **API2:2023 Broken Authentication** | Penyusupan akun dokter gadungan, *brute force* login, *account enumeration*, atau pencurian token sesi. | **Persistent PostgreSQL Sessions (`sessions`), 100% Bcrypt, Anti-Enumeration (`CWE-204`), Rate Limit (`429`) & PIN 6-Digit**: Autentikasi 100% memakai `bcrypt.compare` + dummy `bcrypt.compare` & pesan gagal seragam (`UNIFORM_LOGIN_ERROR`); *sliding-window rate limiter* (`lib/auth/rateLimit.ts`, 10x/menit $\rightarrow$ HTTP `429`); tombol *Quick Demo* dikendalikan `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`; token sesi HTTP-Only persisten di tabel `sessions` PostgreSQL; penugasan DPJP mewajibkan PIN 6-digit persis. |
| **API3:2023 Broken Object Property Level Authorization** | Dokter membaca properti kependudukan sensitif atau Admin membaca properti klinis pasien. | **Separation of Concerns & Server-Side Masking**: Endpoint RME hanya menyajikan ciphertext HKDF+AES-256-GCM+AAD; NIK di-mask di sisi server (`3171••••••••0001`), `encryptionKeyHex` tidak pernah dikirim di daftar pasien atau saat `accessAllowed === false`, dan `consentPin` hanya dikembalikan ke pasien pemilik tiket. |
| **API4:2023 Unrestricted Resource Consumption** | Serangan DoS / *brute force* autentikasi atau pengiriman payload medis/citra tidak sah. | **Sliding-Window Rate Limiter (`lib/auth/rateLimit.ts`) & Zod v4 Validation**: Pembatasan 10 percobaan login/menit per IP+identifier (HTTP `429` + `Retry-After`) serta validasi ketat skema Zod v4 di klien & server (`lib/validations/`). |
| **API5:2023 Broken Function Level Authorization (BFLA)** | Pengguna biasa memicu endpoint pemulihan karantina faskes atau Admin memanggil endpoint RME. | **Next.js 16 Network Boundary (`proxy.ts`) + `requireSession`**: `proxy.ts` memutus permintaan tanpa cookie HTTP-Only sebelum render; seluruh aksi sensitif (Kill-Switch, e-KYC/e-KYD, Consent, Family Proxy, RME) menegakkan peran secara ketat di server. |
| **API8:2023 Security Misconfiguration** | Informasi error *stack trace* bocor, header keamanan browser kosong, atau kontainer berjalan sebagai root. | **Fail-Closed Architecture, OWASP Security Headers (`next.config.ts`) & CIS Docker Hardening**: Kesalahan dekripsi/HMAC memblokir tampilan (0 data fiktif) + log `HMAC_MISMATCH`; 6 header OWASP (`CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control`) aktif; `Dockerfile` `node:24-alpine` + `USER node` + `HEALTHCHECK` + tanpa password hardcoded di `docker-compose.yml`. |
| **API10:2023 Unsafe Consumption of APIs** | Server pusat disusupi paket data rekam medis palsu dari faskes yang terinfeksi ransomware. | **Constant-Time HMAC-SHA256 (`crypto.subtle.verify`) & Faskes Kill-Switch Server-Side (`HTTP 423`)**: Integritas ciphertext diverifikasi *constant-time* (anti-CWE-208) dengan sub-kunci HKDF terpisah; faskes berstatus `QUARANTINED` langsung diblokir pada booking, seluruh 5 aksi tulis klinis, dan `POST /api/sync/outbox` (`HTTP 423`). |

---

## 3. Protokol Darurat Break-Glass (ISO 27799 / HIPAA)

Dalam situasi gawat darurat (misal: pasien kecelakaan lalu lintas tidak sadarkan diri, syok anafilaktik, atau koma di IGD):
1. Dokter IGD dapat mengakses rekam medis darurat (golongan darah, riwayat alergi berbahaya, penyakit kronis) tanpa menunggu persetujuan PIN pasien.
2. Dokter **wajib memilih indikasi klinis darurat** sebelum tombol *Break-Glass* dieksekusi.
3. Begitu diaktifkan:
   - Akses darurat berbatas waktu (12 jam) diterbitkan.
   - Sistem **seketika memicu High-Severity Alert** ke Dashboard SIEM Admin Regulator dan mencatat alamat IP terminal IGD.
   - Peringatan darurat dikirimkan ke kontak darurat keluarga pasien.
   - Seluruh tindakan dokter selama mode Break-Glass tercatat di Audit Trail forensik yang tidak dapat disangkal (*Non-Repudiation*).

---

## 4. Perlindungan Visual e-KYC (Anti-Penyalahgunaan Identitas)

1. **Client-Side Auto-Watermarking**:
   - Foto KTP fisik dan swafoto wajah yang diunggah pengguna secara otomatis dibubuhi teks digital watermark transparan di peramban: `"HANYA UNTUK VERIFIKASI RESILIO-HEALTH - [TANGGAL]"`.
   - Mencegah dokumen KTP disalahgunakan oleh pihak luar untuk kejahatan (seperti pinjaman online ilegal) apabila terjadi kebocoran transit.
2. **Short-Lived Presigned URLs**:
   - Dokumen visual identitas tidak pernah memiliki URL publik statis; Admin hanya dapat melihat dokumen melalui URL bertanda tangan yang kedaluwarsa dalam 5 menit.
