# Asset Inventory — Resilio-Health

Inventaris aset sistem informasi rumah sakit Resilio-Health mencakup data klinis sensitif, kunci kriptografi, kredensial otentikasi, dan komponen infrastruktur aplikasi.

## Tabel Inventaris Aset

| ID Aset | Nama Aset | Kategori | Deskripsi | Klasifikasi Kerahasiaan | Dampak Kehilangan/Kebocoran | Perlindungan Saat Ini |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AST-01** | Rekam Medis Elektronik (EHR) | Data | Data diagnosis, keluhan, resep, dan tanda vital pasien | Rahasia (Confidential / PII Medis) | Sangat Tinggi (Pelanggaran privasi UU PDP, tuntutan hukum) | Enkripsi AES-256-GCM, Integritas HMAC-SHA256 |
| **AST-02** | Master Kunci Pasien (DEK) | Kriptografi | Kunci simetris 256-bit unik per pasien untuk dekripsi EHR | Sangat Rahasia (Strict Secret) | Kritis (Seluruh data pasien terkait dapat didekripsi) | Disimpan terisolasi per sesi / local vault |
| **AST-03** | Token Sesi & Status Peran | Kredensial | Data sesi pengguna aktif (Dokter, Pasien, Administrator) | Rahasia | Tinggi (Pembajakan akun, eskalasi hak akses) | Validasi sesi runtime, Zero-Trust Role Guard |
| **AST-04** | Log Audit Integritas & Akses | Data / Audit | Jejak pencatatan akses dokter, penugasan admin, verifikasi HMAC | Internal Terbatas | Sedang-Tinggi (Penolakan tindakan/Repudiation) | HMAC digest validation & append-only log |
| **AST-05** | Form & Gateway Web Client | Komponen UI | Antarmuka Next.js yang memproses input klinis sebelum transit | Publik / Front-end | Sedang (Injeksi input berbahaya, XSS sisi klien) | Validasi sisi klien, sanitasi form TypeScript |