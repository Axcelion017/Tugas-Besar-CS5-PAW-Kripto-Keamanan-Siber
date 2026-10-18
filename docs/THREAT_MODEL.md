# Model Ancaman & Analisis Risiko: Resilio-Health

Dokumen ringkasan eksekutif pemodelan ancaman STRIDE dan analisis risiko sistem informasi rekam medis Resilio-Health 4-Role.

---

## 1. Kasus Acuan Nyata Dunia Kesehatan (Tahun 2026)
- **Insiden Global**: Kasus Change Healthcare (190 juta rekam medis bocor akibat kelumpuhan ransomware terpusat).
- **Insiden Nasional**: Data BSSN menunjukkan 96% kerentanan aplikasi web kesehatan bersumber dari kesalahan konfigurasi otorisasi (BOLA / IDOR) dan ketiadaan ketahanan *offline* saat server pusat lumpuh (*Downtime Chaos*).

---

## 2. Risiko Prioritas Utama & Kontrol Sistem
1. **BOLA / IDOR API Breach (RSK-03)**: Pencurian data pasien melalui manipulasi parameter ID pada URL.
   - *Mitigasi*: Zero-Trust BOLA Guard & Active Encounter Ticket DPJP; akses ilegal diblokir 403 Forbidden.
2. **Ransomware & Downtime Chaos (RSK-04)**: Kelumpuhan faskes saat internet mati atau server pusat diserang.
   - *Mitigasi*: Arsitektur Offline-First PWA (Service Worker + IndexedDB Local Blob Storage ratusan MB).
3. **Manipulasi Data Medis Lokal / Transit (RSK-02)**: Modifikasi bit diagnosa/dosis obat di memori lokal.
   - *Mitigasi*: HMAC-SHA256 Integrity Verification berprinsip *Fail-Closed*.
4. **Kebocoran Rekam Medis & Citra Radiologi (RSK-01)**: Eksfiltrasi data klinis dan foto rontgen di database pusat.
   - *Mitigasi*: Enkripsi simetris sisi klien AES-256-GCM (*Zero-Knowledge Storage*).
5. **Akun Fiktif & Penyusupan Dokter Gadungan (RSK-05)**: Pendaftaran identitas tanpa verifikasi resmi.
   - *Mitigasi*: Sistem Verifikasi Kependudukan KYC (KTP/NIK) & KYD (STR/SIP) oleh Admin Regulator Kemenkes.
6. **Penyalahgunaan Identitas KTP Pasien (RSK-06)**: Penyalahgunaan foto KTP fisik untuk kejahatan pinjol ilegal.
   - *Mitigasi*: Client-Side Auto-Watermarking Canvas permanen sebelum berkas diunggah.
7. **Penyalahgunaan Tombol Darurat IGD (RSK-07)**: Pembukaan data tanpa ada pasien gawat darurat di IGD.
   - *Mitigasi*: Protokol Break-Glass wajib memilih alasan klinis; memicu alarm instan High-Severity SIEM.
8. **Penghapusan Riwayat Malpraktik (RSK-08)**: Koreksi diagnosis lama secara ilegal untuk menghilangkan jejak.
   - *Mitigasi*: Prinsip Immutable Addendum bertingkat sesuai Permenkes No. 24/2022.
9. **Kesalahan Fatal Resep Alergenik (RSK-09)**: Peresepan obat yang memicu syok anafilaktik akut.
   - *Mitigasi*: Real-time contraindication text match engine yang memberi peringatan merah berkedip seketika.
