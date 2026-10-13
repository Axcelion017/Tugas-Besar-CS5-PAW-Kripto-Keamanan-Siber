# CHANGELOG — Resilio-Health

Semua perubahan besar pada proyek Resilio-Health didokumentasikan di sini.

## [v0.1] - 2026-10-13 — Milestone 1 (Tugas 1 Terintegrasi)

### Kriptografi (KKS & Kripto)
- Implementasi AES-256-GCM menggunakan Web Crypto API native (`lib/crypto/aes.ts`).
- Implementasi HMAC-SHA256 untuk verifikasi integritas data (`lib/crypto/hmac.ts`).
- Penambahan 4 skenario unit test otomatis pada `tests/crypto.test.ts` (uji positif, negatif, dan batas).
- Penyusunan dokumen arsitektur dan keputusan di `KEPUTUSAN.md` dan `EVALUASI.md`.

### Antarmuka & Responsivitas (PAW)
- Pembuatan antarmuka hub multi-peran di `/beranda` (Dokter, Pasien, Administrator).
- Implementasi 5 komponen reusable: `StatCard`, `InputField`, `StatusBadge`, `TopHeader`, dan `LogoutModal`.
- Form pemeriksaan klinis dokter dengan validasi sisi klien.
- Optimasi aksesibilitas WCAG 2.1 AA mencapai skor Lighthouse Accessibility $\ge 90$.

### Keamanan Siber (KKS)
- Penyusunan Threat Modeling STRIDE (10 ancaman) di `docs/threat-model.md`.
- Penyusunan Risk Register (5 risiko prioritas) di `docs/risk-register.md`.
- Pemetaan alur data dan Trust Boundary di `docs/dfd.md`.