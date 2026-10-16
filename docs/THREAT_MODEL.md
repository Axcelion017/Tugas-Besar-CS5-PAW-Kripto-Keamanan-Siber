# Model Ancaman & Analisis Risiko: Resilio-Health

Dokumen ringkasan eksekutif pemodelan ancaman dan analisis risiko sistem informasi rekam medis Resilio-Health.

## 1. Kasus Acuan Nyata (Tahun 2026)
- **Insiden Global**: Kasus Change Healthcare (190 juta rekam medis bocor akibat kelumpuhan ransomware terpusat).
- **Insiden Nasional**: Data BSSN menunjukkan 96% kerentanan aplikasi web kesehatan bersumber dari kesalahan konfigurasi otorisasi (BOLA / IDOR) dan ketiadaan ketahanan *offline* saat server pusat lumpuh (*Downtime Chaos*).

## 2. Lima Risiko Prioritas Utama
1. **BOLA / IDOR API Breach (RSK-03)**: Pencurian data pasien melalui manipulasi parameter URL.
   - *Mitigasi*: Zero-Trust BOLA Guard yang memverifikasi tiket izin aktif (`access_grants`) sebelum mengembalikan rekam medis.
2. **Ransomware & Downtime Chaos (RSK-04)**: Kelumpuhan faskes saat internet mati atau server pusat diserang.
   - *Mitigasi*: Arsitektur Offline-First PWA (Service Worker + IndexedDB Local Queue).
3. **Manipulasi Data Medis Lokal / Transit (RSK-02)**: Modifikasi bit diagnosa/dosis obat di memori lokal.
   - *Mitigasi*: HMAC-SHA256 Integrity Verification berprinsip *Fail-Closed*.
4. **Kebocoran Rekam Medis oleh Pihak Ketiga / Admin (RSK-01)**: Eksfiltrasi data database pusat.
   - *Mitigasi*: Enkripsi simetris sisi klien AES-256-GCM (*Zero-Knowledge Storage*).
5. **Akun Fiktif & Penyusupan Dokter Gadungan (RSK-05)**: Pendaftaran identitas tanpa verifikasi.
   - *Mitigasi*: Sistem Verifikasi Kependudukan KYC (KTP/NIK) & KYD (STR/SIP) oleh Admin Regulator Kemenkes.
