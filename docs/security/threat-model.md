# Threat Model STRIDE — Resilio-Health

Model ancaman ini menganalisis risiko sistem menggunakan metode STRIDE berdasarkan komponen DFD dan aset yang diidentifikasi.

| ID Ancaman | Kategori STRIDE | Elemen DFD Terdampak | Aset Terdampak | Deskripsi Skenario Ancaman | Dampak |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **THR-01** | **Spoofing** | EXT-01, PRC-02 | AST-03 | Pengguna mengubah ID dokter di local storage agar dianggap sebagai dokter spesialis lain. | Pencurian identitas dan akses ke rekam medis pasien lain. |
| **THR-02** | **Tampering** | DS-01, TB-2 | AST-01, AST-04 | Penyerang atau malware mengubah ciphertext atau bit tanda vital rekam medis di tempat penyimpanan. | Kerusakan data klinis dan malpraktik diagnosa. |
| **THR-03** | **Repudiation** | EXT-01, PRC-01 | AST-04 | Dokter menyangkal pernah mendiagnosa atau memasukkan obat tertentu kepada pasien. | Sengketa hukum medis tanpa jejak audit otentik. |
| **THR-04** | **Information Disclosure** | TB-2, DS-01 | AST-01 | Administrator atau pihak ketiga membaca plaintext diagnosa atau obat pasien secara langsung. | Kebocoran rahasia medis pasien (pelanggaran UU PDP). |
| **THR-05** | **Denial of Service** | PRC-01, PRC-03 | AST-05 | Injeksi payload teks keluhan medis berukuran masif (megabytes) yang membekukan thread Web Crypto. | Antarmuka browser crash, penanganan pasien darurat terhambat. |
| **THR-06** | **Elevation of Privilege** | PRC-02, DS-02 | AST-01, AST-03 | Pasien memanipulasi session role menjadi "admin" untuk menetapkan dokter dan mengakses menu pengawasan. | Pasien memperoleh kontrol administratif sistem HIS. |
| **THR-07** | **Tampering** | PRC-03, DS-01 | AST-02 | Penggunaan kembali Initialization Vector (IV Reuse) pada enkripsi AES-GCM dengan kunci yang sama. | Melemahkan jaminan keaslian GCM, pembobolan kunci simetris. |
| **THR-08** | **Spoofing** | PRC-05, DS-02 | AST-03 | Akun dokter yang tidak ditugaskan berpura-pura memiliki hubungan penanganan aktif terhadap pasien bangsal. | Akses tidak sah ke berkas rahasia medis bangsal lain. |
| **THR-09** | **Information Disclosure** | AST-02, PRC-03 | AST-02 | Kunci enkripsi tersimpan dalam format hardcoded di repositori kode publik. | Kompromi total terhadap seluruh data terenkripsi. |
| **THR-10** | **Repudiation** | PRC-02, AST-04 | AST-04 | Manipulasi log penugasan dokter oleh administrator tanpa jejak verifikasi integritas. | Ketidakmampuan melacak wewenang penugasan pasien. |