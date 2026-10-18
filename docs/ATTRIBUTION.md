# Attribution & Standar Referensi — Resilio-Health

Aplikasi Resilio-Health dibangun dengan mengacu pada standar regulasi nasional, internasional, serta pustaka kode terbuka berikut:

---

## 1. Regulasi & Standar Medis / Keamanan
- **UU Pelindungan Data Pribadi (UU PDP No. 27/2022)**: Standar kedaulatan data pasien, hak persetujuan eksplisit (*Consent*), hak mencabut akses (*1-Click Revoke*), dan transparansi audit trail.
- **Permenkes No. 24 Tahun 2022 tentang Rekam Medis Elektronik (RME)**: Format klinis SOAP, klasifikasi diagnosis internasional ICD-10 WHO, kewajiban atribusi STR/SIP nakes, prinsip *Immutable Addendum*, dan portabilitas rujukan faskes.
- **NIST SP 800-38D**: Rekomendasi algoritma enkripsi simetris mode Galois/Counter Mode (AES-256-GCM) dengan inisialisasi CSPRNG 96-bit unik tanpa daur ulang IV (*No IV Reuse*).
- **RFC 2104**: Algoritma autentikasi pesan berbasis hash kriptografis (HMAC-SHA256) untuk verifikasi keutuhan data (*Data Integrity*).
- **ISO 27799 & HIPAA**: Protokol akses kedaruratan medis darurat (*Break-Glass Protocol*) untuk penanganan gawat darurat pasien koma/kritis di Instalasi Gawat Darurat (IGD).
- **OWASP Top 10 API Security (2023)**: Khususnya mitigasi API1:2023 Broken Object Level Authorization (BOLA / IDOR) melalui penguncian *Active Encounter Ticket* DPJP.

---

## 2. Pustaka Kode & Dependensi Terbuka
- **Next.js & React (MIT License)**: Kerangka kerja aplikasi web modern berbasis React Server Component & Next.js App Router.
- **Tailwind CSS v4 (MIT License)**: Kerangka kerja styling berbasis utilitas tinggi.
- **W3C Web Crypto API**: Implementasi algoritma kriptografi asli peramban (*browser native*) tanpa dependensi eksternal pihak ketiga yang rentan disusupi supply chain attack.
- **Vitest (MIT License)**: Kerangka kerja pengujian unit kriptografi performa tinggi.
- **Google Font Montserrat (SIL Open Font License 1.1)**: Tipografi modern antarmuka enterprise medis.
- **Komponen Ikon Vektor Monokrom**: Didefinisikan secara mandiri dalam `components/ui/Icons.tsx` berbasis SVG murni tanpa modul eksternal.
