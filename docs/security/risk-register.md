# Risk Register & Rencana Kontrol — Resilio-Health

Analisis kemungkinan dan dampak dari 5 risiko prioritas utama pada sistem Resilio-Health beserta rencana kontrol mitigasinya.

## Tabel Risiko Prioritas

| No | ID Risiko | Ancaman Terkait | Alasan Kemungkinan & Dampak Sesuai Kondisi Produk | Nilai Risiko | Rencana Kontrol & Alokasi Milestone |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **RSK-01** | THR-04 (Info Disclosure EHR) | **Kemungkinan Sedang**: Media browser storage rentan diakses skrip pihak ketiga.<br>**Dampak Kritis**: Kebocoran riwayat penyakit merusak privasi pasien secara permanen. | **Tinggi** | **Tugas 1 (v0.1) & Tugas 2 (v0.2)**: Enkripsi AES-256-GCM sisi klien sehingga media simpan hanya memuat ciphertext opaque (Zero-Knowledge Admin). |
| **2** | **RSK-02** | THR-02 (Data Tampering EHR) | **Kemungkinan Tinggi**: Penyimpanan lokal tanpa proteksi integritas mudah disunting secara manual via DevTools.<br>**Dampak Kritis**: Data medis palsu dapat memicu kesalahan fatal dosis obat. | **Tinggi** | **Tugas 1 (v0.1)**: Penggunaan HMAC-SHA256 untuk verifikasi integritas data sebelum didekripsi; tolak dekripsi jika hash tidak valid. |
| **3** | **RSK-03** | THR-06 (Privilege Escalation) | **Kemungkinan Sedang**: Pengaturan role berbasis state klien tanpa validasi server pada versi awal.<br>**Dampak Tinggi**: Pengguna biasa dapat mengambil alih fungsi admin/dokter. | **Tinggi** | **Tugas 1 (v0.1) & Tugas 2 (v0.2)**: Pemisahan view ketat di `/beranda` dan validasi otorisasi ganda (Zero-Trust Guard) pada penugasan pasien. |
| **4** | **RSK-04** | THR-07 (IV Reuse Attack) | **Kemungkinan Rendah-Sedang**: Kesalahan generator keacakan semu dapat menghasilkan IV duplikat.<br>**Dampak Kritis**: Kunci simetris AES-GCM dapat dipulihkan oleh penyerang jika IV berulang. | **Tinggi** | **Tugas 1 (v0.1)**: Menggunakan `window.crypto.getRandomValues(new Uint8Array(12))` untuk menjamin 96-bit nonce unik per operasi enkripsi. |
| **5** | **RSK-05** | THR-01 (Session Hijacking) | **Kemungkinan Sedang**: Ketiadaan token expiry dan rotasi session key pada penyimpanan frontend.<br>**Dampak Sedang-Tinggi**: Sesi dokter tertinggal di komputer bangsal dapat disalahgunakan staf lain. | **Sedang** | **Tugas 2 (v0.2) & Tugas 3 (v0.3)**: Implementasi HTTP-Only Cookie, token expiry otomatis, dan audit log sesi terproteksi HMAC. |