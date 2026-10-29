# Data Flow Diagram (DFD) — Resilio-Health

Dokumen ini memetakan arsitektur aliran data, batas kepercayaan (*Trust Boundaries*), proses komputasi, dan penyimpanan data pada sistem Resilio-Health sesuai ketentuan Tugas Keamanan Komputasi dan Siber (Penanda `sec-0.1` dan `sec-0.2`).

---

## 1. Katalog Elemen Diagram Alir Data

### 1.1 Entitas Eksternal (*External Entities*)
| ID Entitas | Nama Entitas | Deskripsi Peran & Hak Akses |
| :--- | :--- | :--- |
| **EXT-01** | **Pasien (Patient)** | Pemilik sah data medis yang mengontrol izin akses (*Consent*), mencari faskes, memesan jadwal, menunjukkan PIN 6 digit ke perawat, dan mendekripsi rekam medis pribadi via kunci privat. |
| **EXT-02** | **Dokter DPJP (Physician in Charge)** | Dokter spesialis berlisensi (STR/SIP) yang memeriksa pasien via format SOAP, kode ICD-10, enkripsi citra medis (Rontgen/USG/Lab), koreksi Addendum, dan akses darurat Break-Glass IGD. |
| **EXT-03** | **Admin Regulator (Kemenkes)** | Pengawas sistem yang memvalidasi identitas visual e-KYC (KTP/Selfie ber-watermark), lisensi dokter (KYD), memantau log SIEM, dan mengaktifkan saklar darurat *kill-switch* isolasi faskes. |
| **EXT-04** | **Staf Nakes Faskes (Perawat Triase & Admisi)** | Petugas loket faskes yang memvalidasi kedatangan pasien (check-in), mencatat tanda-tanda vital awal, klasifikasi triase Hijau/Kuning/Merah, dan menerbitkan *Active Encounter Ticket* DPJP. |

### 1.2 Proses Komputasi (*Processes*)
| ID Proses | Nama Proses | Deskripsi Operasi |
| :--- | :--- | :--- |
| **PRC-01** | **KYC & KYD Identity Verification Gateway** | Memvalidasi keaslian dokumen NIK/KTP pasien dan lisensi STR/SIP dokter sebelum status akun diaktifkan. |
| **PRC-02** | **Zero-Trust BOLA / IDOR Gatekeeper** | Memeriksa kepemilikan data dan keabsahan tiket izin akses aktif (`access_grants`) sebelum mengembalikan rekam medis pasien. Akses tanpa izin diblokir 403 Forbidden. |
| **PRC-03** | **SOAP Clinical & Client Encryption Engine** | Memvalidasi masukan SOAP via skema Zod v4 (tensi, ICD-10), mengecek kontraindikasi alergi (UR-T10), membangkitkan IV 96-bit CSPRNG, mengenkripsi via AES-256-GCM, dan membuat digest HMAC-SHA256. |
| **PRC-04** | **Decryption & HMAC Integrity Verifier** | Memverifikasi keutuhan ciphertext via HMAC-SHA256 (Fail-Closed) dan mendekripsi plaintext klinis hanya di browser pasien/dokter berizin. |
| **PRC-05** | **Offline Queue & Background Sync Manager** | Menangkap kegagalan jaringan via Service Worker, mengantrekan ciphertext terenkripsi di IndexedDB, dan mengirimkannya ke server saat online. |
| **PRC-06** | **SIEM Logger & Faskes Kill-Switch Engine** | Mencatat log keamanan (IDOR, HMAC failure, login, Break-Glass) dan mengeksekusi karantina faskes untuk mengisolasi faskes yang terinfeksi ransomware. |
| **PRC-07** | **Client-Side Canvas Auto-Watermarking** | Mencetak watermark teks permanen *"HANYA UNTUK VERIFIKASI RESILIO-HEALTH"* di atas foto KTP dan selfie pada kanvas peramban sebelum berkas diunggah. |
| **PRC-08** | **Active Encounter Ticket & PIN Gatekeeper** | Memvalidasi 6-digit PIN persetujuan pasien di loket triase untuk menerbitkan tiket enkripsi sesi aktif yang mengunci DPJP bertugas. |
| **PRC-09** | **Binary Medical Image Encryption Engine** | Mengonversi citra medis (Rontgen/USG/Lab/EKG) menjadi biner Blob terenkripsi AES-256-GCM berkapasitas besar di IndexedDB. |
| **PRC-10** | **Stateful Cookie Session & Server Action Engine** | Menerbitkan dan memvalidasi cookie HTTP-Only (`resilio_session_token`) via Server Action `lib/actions/auth.ts`, mengelola stateful session store, dan mengeksekusi pembatalan sesi instan. |

### 1.3 Penyimpanan Data (*Data Stores*)
| ID Penyimpanan | Nama Penyimpanan | Tipe Media | Klasifikasi Data & Proteksi |
| :--- | :--- | :--- | :--- |
| **DS-01** | `resilio_records` | Basis Data Server / PostgreSQL | **Sangat Rahasia [TERENKRIPSI]**<br>Hanya menyimpan ciphertext AES-256-GCM, IV heksadesimal, HMAC digest, riwayat Addendum, dan metadata ICD-10 (Zero-Knowledge Admin). |
| **DS-02** | `resilio_patients` & `appointments` | Basis Data Server / PostgreSQL | **Internal Terbatas**<br>Menyimpan data identitas pasien, NIK, golongan darah, riwayat alergi, data triase tanda vital awal, dan jadwal antrean. |
| **DS-03** | `resilio_access_grants` | Basis Data Server / PostgreSQL | **Rahasia**<br>Tabel relasi izin akses medis aktif dan *Active Encounter Ticket* antara pasien dan dokter DPJP (pondasi pertahanan BOLA/IDOR). |
| **DS-04** | `resilio_offline_queue` | IndexedDB Browser Lokal | **Sangat Rahasia [TERENKRIPSI]**<br>Antrean data rekam medis dan citra biner Blob terenkripsi yang disimpan lokal di komputer klinik saat offline mode. |
| **DS-05** | `resilio_security_logs` & `faskes` | Storage / SIEM Stream | **Internal Kritis**<br>Jejak audit keamanan sistem, alert Break-Glass, anomali serangan IDOR, dan status isolasi faskes (`ACTIVE` / `QUARANTINED`). |

### 1.4 Batas Kepercayaan (*Trust Boundaries*)
| ID Boundary | Nama Batas Kepercayaan | Deskripsi Garis Demarkasi |
| :--- | :--- | :--- |
| **TB-1** | **User-to-Client Interface Boundary** | Memisahkan pengguna fisik di luar browser dengan runtime antarmuka React/Next.js. Rentan terhadap masukan berbahaya (XSS / malformed data). |
| **TB-2** | **Memory-to-Local Storage Boundary** | Memisahkan memori aplikasi terpercaya dengan media penyimpanan browser (`localStorage` / `IndexedDB`). **Data rekam medis wajib dalam bentuk Ciphertext + HMAC**. |
| **TB-3** | **Client-to-Server Network Boundary** | Jalur transmisi internet/LAN faskes ke server pusat cloud. Rentan terhadap Man-in-the-Middle (MitM) dan pemadaman jaringan (*Downtime*). |

---

## 2. Diagram Alir Data (DFD Visual — Mermaid)

```mermaid
flowchart TD
    %% Entitas Eksternal
    subgraph External_Entities ["Entitas Eksternal (Untrusted Zone)"]
        EXT01["EXT-01: Pasien"]
        EXT02["EXT-02: Dokter DPJP"]
        EXT03["EXT-03: Admin Regulator Kemenkes"]
        EXT04["EXT-04: Staf Nakes Triase & Admisi"]
    end

    %% Trust Boundary 1
    TB1{{"=== TB-1: User-to-Client Interface Boundary ==="}}

    %% Trusted Client Runtime
    subgraph Trusted_Client_Runtime ["Aplikasi Web Klien (Trusted Runtime Zone)"]
        PRC01["PRC-01: KYC/KYD Identity Verifier"]
        PRC02["PRC-02: Zero-Trust BOLA/IDOR Gate"]
        PRC03["PRC-03: SOAP & Client Crypto Engine\n(AES-256-GCM + HMAC-SHA256)"]
        PRC04["PRC-04: Decryption & HMAC Verifier"]
        PRC05["PRC-05: Offline Queue & Sync Manager"]
        PRC06["PRC-06: SIEM Logger & Kill-Switch"]
        PRC07["PRC-07: Canvas Watermark Engine"]
        PRC08["PRC-08: Active Encounter & PIN Gate"]
        PRC09["PRC-09: Medical Image Blob Crypto Engine"]
    end

    %% Trust Boundary 2 & 3
    TB2{{"=== TB-2: Memory-to-Local Storage Boundary (IndexedDB) ==="}}
    TB3{{"=== TB-3: Client-to-Server Network Boundary (REST API) ==="}}

    %% Data Stores
    subgraph Storage_Zone ["Penyimpanan Data Server & Lokal"]
        DS01[("DS-01: resilio_records\n[Zero-Knowledge Ciphertext + HMAC]")]
        DS02[("DS-02: patients & appointments\n(Data Identitas & Antrean)")]
        DS03[("DS-03: access_grants\n(Consent Tickets & Active Encounter)")]
        DS04[("DS-04: resilio_offline_queue\n(IndexedDB Antrean Offline Blob)")]
        DS05[("DS-05: security_logs & faskes\n(SIEM Events & Kill-Switch)")]
    end

    %% Alur Pasien
    EXT01 -->|"Registrasi NIK & Foto KTP/Selfie"| TB1
    TB1 -->|"Watermark Canvas Otomatis"| PRC07
    PRC07 -->|"Verifikasi KYC Ber-Watermark"| PRC01
    PRC01 -->|"Update Akun Terverifikasi"| DS02
    EXT01 -->|"Booking & Tampilkan 6-Digit PIN"| TB1
    TB1 -->|"Simpan Antrean Baru"| DS02
    EXT01 -->|"Request RME & Citra Medis"| TB1
    TB1 -->|"Kunci Pasien + Dekripsi"| PRC04
    DS01 -->|"Ambil Ciphertext + HMAC"| TB3
    TB3 -->|"Verifikasi HMAC & Dekripsi Klien"| PRC04
    PRC04 -->|"Plaintext SOAP & Foto Rontgen Terdekripsi"| EXT01

    %% Alur Staf Nakes Triase & Admisi
    EXT04 -->|"Check-in & Input PIN Pasien"| TB1
    TB1 -->|"Validasi PIN & Assign DPJP"| PRC08
    PRC08 -->|"Terbitkan Active Encounter Ticket"| DS03
    EXT04 -->|"Input Tanda Vital Triase (Hijau/Kuning/Merah)"| TB1
    TB1 -->|"Simpan Vitals Triase Awal"| DS02

    %% Alur Dokter (DPJP)
    EXT02 -->|"Lookup Pasien NIK"| TB1
    TB1 -->|"Cek Active Encounter (Anti-BOLA)"| PRC02
    PRC02 -.->|"Validasi Tiket DPJP Sah"| DS03
    PRC02 -->|"Jika Ilegal: Blokir 403 & Log SIEM"| PRC06
    PRC06 -->|"Catat Anomali IDOR"| DS05
    EXT02 -->|"Opsi Break-Glass Pasien Koma IGD"| PRC02
    PRC02 -->|"Trigger High-Severity Alert SIEM"| PRC06
    EXT02 -->|"Input SOAP, ICD-10, Addendum & Foto Rontgen"| TB1
    TB1 -->|"Enkripsi AES-GCM + Sign HMAC"| PRC03
    TB1 -->|"Enkripsi Citra Medis Blob"| PRC09
    PRC03 -->|"Jika Offline: Simpan ke IndexedDB"| TB2
    PRC09 -->|"Simpan Binary Blob Offline"| TB2
    TB2 -->|"Antrean Offline Lokal"| DS04
    PRC03 -->|"Jika Online: Kirim Ciphertext"| TB3
    TB3 -->|"Simpan RME & Citra Terenkripsi"| DS01

    %% Alur Admin
    EXT03 -->|"Validasi Visual KTP/Selfie e-KYC"| TB1
    TB1 -->|"Aktivasi Akun Pasien Sah"| PRC01
    EXT03 -->|"Validasi Berkas STR/SIP Dokter (KYD)"| TB1
    TB1 -->|"Aktivasi Akun Dokter Sah"| PRC01
    EXT03 -->|"Monitor Live SIEM Log & Break-Glass"| TB1
    TB1 -->|"Ambil Audit Trail"| DS05
    EXT03 -->|"Aktivasi Kill-Switch Faskes"| TB1
    TB1 -->|"Karantina Jaringan Faskes Terinfeksi"| PRC06
    PRC06 -->|"Update Status Faskes QUARANTINED"| DS05

    %% Styling
    classDef cryptoProtected fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef boundary fill:#fee2e2,stroke:#dc2626,stroke-width:2px,stroke-dasharray: 5 5;
    class DS01,DS04 cryptoProtected;
    class TB1,TB2,TB3 boundary;
```

---

## 3. Titik Penegakan Keamanan Kriptografi (*Enforcement Points*)

1. **Titik Enkripsi Sisi Klien (Enforcement Point 1 — PRC-03 & PRC-09)**:
   - Terjadi di browser dokter sebelum data klinis menembus `TB-2` (ke IndexedDB) atau `TB-3` (ke server pusat).
   - Menggunakan AES-256-GCM dengan pembangkitan IV baru per rekam medis melalui CSPRNG `window.crypto.getRandomValues()`.
2. **Titik Integritas Data (Enforcement Point 2 — PRC-03, PRC-04 & PRC-09)**:
   - Tag HMAC-SHA256 dihitung langsung atas string ciphertext dan binary buffer citra radiologi.
   - Saat pembacaan data di PRC-04, tag dihitung ulang dan dicocokkan; jika terdapat perbedaan sekecil 1 bit, proses dekripsi langsung dibatalkan (*Fail-Closed*).
3. **Titik Pertahanan BOLA / IDOR & Active Encounter (Enforcement Point 3 — PRC-02 & PRC-08)**:
   - Terjadi di pintu gerbang pemanggilan API data pasien.
   - Gateway secara atomik memeriksa tabel `access_grants`; jika tidak ditemukan tiket *Active Encounter* aktif yang cocok dengan ID dokter, sistem menolak pengembalian ciphertext dan mengirim notifikasi alert ke SIEM.
4. **Titik Karantina Faskes (Enforcement Point 4 — PRC-06)**:
   - Berfungsi sebagai saklar pembeku (*Kill-Switch*) yang memutus seluruh komunikasi API dari faskes yang terinfeksi ransomware.
