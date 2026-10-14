# Data Flow Diagram (DFD) — Resilio-Health

Dokumen ini memetakan arsitektur aliran data, batas kepercayaan (*Trust Boundaries*), proses komputasi, dan penyimpanan data pada sistem Resilio-Health sesuai ketentuan Tugas 1 Keamanan Komputasi dan Siber (Penanda `sec-0.1`).

---

## 1. Katalog Elemen Diagram Alir Data

### 1.1 Entitas Eksternal (*External Entities*)
| ID Entitas | Nama Entitas | Deskripsi Peran & Tingkat Kepercayaan |
| :--- | :--- | :--- |
| **EXT-01** | **Dokter (Clinician)** | Tenaga medis terotentikasi yang menginput keluhan, diagnosa, resep, dan tanda vital pasien. |
| **EXT-02** | **Pasien (Patient)** | Pemilik data medis yang mengakses riwayat rekam medis pribadi dan memegang kunci dekripsi. |
| **EXT-03** | **Administrator** | Pengelola sistem yang mendelegasikan penugasan dokter-pasien dan mengawasi audit integritas. |

### 1.2 Proses Komputasi (*Processes*)
| ID Proses | Nama Proses | Deskripsi Operasi |
| :--- | :--- | :--- |
| **PRC-01** | **Client Form Validation & Sanitization** | Memvalidasi kelengkapan teks, tipe data, dan batas fisiologis tanda vital di memori peramban. |
| **PRC-02** | **Zero-Trust Access Gateway** | Memeriksa apakah dokter aktif memiliki hak penugasan terhadap pasien bangsal yang dipilih. |
| **PRC-03** | **Cryptographic Engine (Encrypt & Sign)** | Membangkitkan IV 96-bit (CSPRNG), mengenkripsi payload via AES-256-GCM, dan membuat digest HMAC-SHA256. |
| **PRC-04** | **Decryption & HMAC Verification Engine** | Memverifikasi keutuhan ciphertext via HMAC-SHA256 dan mendekripsi data menggunakan kunci pasien. |
| **PRC-05** | **Assignment & Session Manager** | Mengelola sesi login pengguna aktif dan pembaruan relasi penugasan dokter-pasien bangsal. |

### 1.3 Penyimpanan Data (*Data Stores*)
| ID Penyimpanan | Nama Penyimpanan | Tipe Media | Klasifikasi Data & Status Proteksi Kriptografi |
| :--- | :--- | :--- | :--- |
| **DS-01** | `resilio_records` | Local Storage / Persistensi Web | **Sangat Rahasia [DILINDUNGI KRIPTOGRAFI]**<br>Hanya menyimpan ciphertext heksadesimal, IV, digest HMAC, dan metadata waktu (Zero-Knowledge Admin). |
| **DS-02** | `resilio_patients` | Local Storage / Persistensi Web | **Internal Terbatas**<br>Menyimpan data identitas pasien, kamar rawat inap, dan ID dokter yang ditugaskan (`assignedDoctorId`). |
| **DS-03** | `resilio_session` | Local Storage / Session Memory | **Rahasia**<br>Menyimpan token sesi aktif, ID pengguna, peran (*role*), dan nama pengguna yang sedang masuk. |

### 1.4 Batas Kepercayaan (*Trust Boundaries*)
| ID Boundary | Nama Batas Kepercayaan | Deskripsi & Garis Demarkasi |
| :--- | :--- | :--- |
| **TB-1** | **User-to-Client Interface Boundary** | Memisahkan pengguna fisik eksternal (di luar peramban) dengan runtime aplikasi React/Next.js di memori peramban. Rentan terhadap kesalahan input pengguna (*User Input Error*). |
| **TB-2** | **Memory-to-Storage Boundary (Untrusted Storage Zone)** | Memisahkan memori aplikasi terpercaya (*Trusted Client Memory*) dengan media penyimpanan persisten (`localStorage` / transit jaringan). **Seluruh data yang melintasi TB-2 wajib dalam bentuk terenkripsi (Ciphertext + HMAC)**. |

---

## 2. Diagram Alir Data (DFD Visual — Mermaid)

```mermaid
flowchart TD
    %% Entitas Eksternal
    subgraph External_Entities ["Entitas Eksternal (Untrusted Zone)"]
        EXT01["EXT-01: Dokter"]
        EXT02["EXT-02: Pasien"]
        EXT03["EXT-03: Administrator"]
    end

    %% Trust Boundary 1
    TB1{{"=== TB-1: User-to-Client Interface Boundary ==="}}

    %% Trusted Client Runtime
    subgraph Trusted_Client_Runtime ["Aplikasi Web Klien (Trusted Runtime Zone)"]
        PRC01["PRC-01: Client Form Validation & Sanitization"]
        PRC02["PRC-02: Zero-Trust Access Gateway"]
        PRC03["PRC-03: Cryptographic Engine\n(AES-256-GCM + HMAC-SHA256)"]
        PRC04["PRC-04: Decryption & HMAC Integrity Verifier"]
        PRC05["PRC-05: Assignment & Session Manager"]
    end

    %% Trust Boundary 2
    TB2{{"=== TB-2: Memory-to-Storage Boundary (Untrusted Storage Zone) ==="}}

    %% Data Stores
    subgraph Persistent_Storage ["Penyimpanan Data Lokal / Transit"]
        DS01[("DS-01: resilio_records\n[DILINDUNGI KRIPTOGRAFI:\nCiphertext + IV + HMAC]")]
        DS02[("DS-02: resilio_patients\n(Relasi Penugasan Bangsal)")]
        DS03[("DS-03: resilio_session\n(Token Sesi & Status Peran)")]
    end

    %% Aliran Data Dokter
    EXT01 -->|"DF-01: Input Klinis (Plaintext)"| TB1
    TB1 -->|"DF-02: Raw Form Data"| PRC01
    PRC01 -->|"DF-03: Validated Clinical Data"| PRC02
    PRC02 -.->|"DF-04: Cek Penugasan Dokter"| DS02
    PRC02 -->|"DF-05: Approved Payload + Kunci Pasien"| PRC03
    PRC03 -->|"DF-06: Ciphertext + IV + HMAC Digest"| TB2
    TB2 -->|"DF-07: Tulis Record Aman"| DS01

    %% Aliran Data Admin
    EXT03 -->|"DF-08: Penugasan Dokter Bangsal"| TB1
    TB1 -->|"DF-09: Update Relasi Penugasan"| PRC05
    PRC05 -->|"DF-10: Tulis Status Penugasan"| DS02

    %% Aliran Data Pasien
    EXT02 -->|"DF-11: Permintaan Rekam Medis Pribadi"| TB1
    TB1 -->|"DF-12: Kunci Pasien + Permintaan Dekripsi"| PRC04
    DS01 -->|"DF-13: Baca Ciphertext + HMAC Digest"| TB2
    TB2 -->|"DF-14: Verifikasi & Dekripsi"| PRC04
    PRC04 -->|"DF-15: Plaintext Diagnosa Terverifikasi"| EXT02

    %% Styling
    classDef cryptoProtected fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef boundary fill:#fee2e2,stroke:#dc2626,stroke-width:2px,stroke-dasharray: 5 5;
    class DS01 cryptoProtected;
    class TB1,TB2 boundary;
```
3. Matriks Aliran Data (Data Flow Matrix)
    ![alt text](dataflowmatrix.png)

4. Titik Penegakan Keamanan Kriptografi (Cryptographic Enforcement Points)
Titik Enkripsi (Enforcement Point 1 — PRC-03):
Terjadi tepat sebelum data klinis menembus TB-2 menuju DS-01.
Menggunakan algoritma AES-256-GCM dengan pembangkitan IV baru per record menggunakan CSPRNG crypto.getRandomValues().
Titik Integritas (Enforcement Point 2 — PRC-03 & PRC-04):
Digest HMAC-SHA256 dihitung atas string ciphertext.
Saat pembacaan data di PRC-04, digest dihitung ulang dan dicocokkan; jika terdapat perbedaan, proses dekripsi dibatalkan seketika (Fail-Closed).
Titik Isolasi Kunci (Enforcement Point 3 — Memory Isolation):
Kunci enkripsi pasien tidak pernah disimpan secara permanen bersama ciphertext di DS-01, melainkan dikelola terpisah di sisi klien.