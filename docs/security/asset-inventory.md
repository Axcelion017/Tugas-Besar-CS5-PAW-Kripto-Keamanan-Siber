# Inventaris Aset Keamanan (*Asset Inventory*) — Resilio-Health

Inventaris aset sistem informasi rumah sakit Resilio-Health mencakup data klinis sensitif, kunci kriptografi, kredensial otorisasi, dokumen identitas kependudukan, lisensi medis, dan infrastruktur ketahanan *offline*.

---

## Tabel Inventaris Aset Sistem

| ID Aset | Nama Aset | Kategori | Deskripsi | Klasifikasi Kerahasiaan | Dampak Kehilangan / Kebocoran | Kontrol Perlindungan Saat Ini |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AST-01** | Rekam Medis Elektronik (EHR - SOAP Payload) | Data Klinis | Data keluhan (S), tanda vital fisik (O), diagnosa ICD-10 (A), dan resep obat (P) | Sangat Rahasia (Confidential / PII Medis) | **Kritis**: Pelanggaran berat privasi pasien (UU PDP), malpraktik medis, tuntutan hukum pidana | Enkripsi AES-256-GCM sisi klien, verifikasi digest HMAC-SHA256, Zero-Knowledge Admin |
| **AST-02** | Kunci Enkripsi Pasien (DEK 256-bit) | Kriptografi | Kunci heksadesimal 256-bit unik per pasien untuk proses enkripsi & dekripsi data medis | Sangat Rahasia (Strict Secret) | **Kritis**: Seluruh riwayat medis pasien terkait dapat didekripsi dan dibaca oleh penyerang | Isolasi memori runtime sesi, pembersihan otomatis saat logout, Zero-Knowledge Storage |
| **AST-03** | Token Sesi & Status Peran Pengguna | Kredensial | Data identitas sesi aktif pengguna (Pasien, Nakes, Admin Regulator) | Rahasia (Secret) | **Tinggi**: Pembajakan akun (*Session Hijacking*), eskalasi hak akses (*Privilege Escalation*) | Validasi sesi runtime, Edge Middleware Guard, pemisahan rute `(dashboard)` |
| **AST-04** | Log Audit Keamanan & Jejak SIEM | Data Audit | Jejak pencatatan akses dokter, penolakan IDOR, kegagalan HMAC, dan aktivasi kill-switch | Internal Terbatas | **Tinggi**: Penyangkalan tindakan medis (*Repudiation*), kegagalan forensik serangan siber | Pencatatan otomatis waktu, IP, dan severity; append-only storage |
| **AST-05** | Antrean Sinkronisasi Lokal (IndexedDB Queue) | Penyimpanan Lokal | Berkas rekam medis terenkripsi yang mengantre di browser saat koneksi faskes terputus | Sangat Rahasia [TERENKRIPSI] | **Tinggi**: Kehilangan data saat browser crash, modifikasi data offline secara ilegal | Disimpan dalam bentuk ciphertext AES-GCM + tag HMAC; verifikasi HMAC wajib sebelum sync |
| **AST-06** | Dokumen Kependudukan & Lisensi Medis (KYC/KYD) | Data Identitas | Foto fisik KTP pasien (NIK) serta dokumen Surat Tanda Registrasi (STR) & SIP dokter | Rahasia (Restricted PII) | **Tinggi**: Pencurian identitas nasional, pemalsuan akun dokter spesialis | Akses dibatasi hanya untuk verifikator Admin Kemenkes; status terkunci `PENDING` |
| **AST-07** | Tiket Persetujuan Akses Medis (Consent Grants) | Otorisasi | Relasi izin aktif antara pasien dan dokter/faskes (`access_grants`) beserta masa berlaku | Rahasia | **Tinggi**: Pelanggaran hak kedaulatan data medis pasien (UU PDP Pasal 20) | Pertahanan BOLA/IDOR Gatekeeper; mekanisme 1-Click Revoke seketika |
| **AST-08** | Status Jaringan Faskes & Ransomware Kill-Switch | Konfigurasi | Pengaturan status operasional faskes (`ACTIVE` vs `QUARANTINED`) | Internal Kritis | **Kritis**: Masuknya payload malware dari faskes terinfeksi ke server RME nasional | Otoritas eksklusif Admin Regulator; isolasi faskes instan dari API gateway |
