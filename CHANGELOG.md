# CHANGELOG — Resilio-Health

Semua perubahan besar pada proyek Resilio-Health didokumentasikan di sini.

---

## [v0.2] - 2026-10-17 — Milestone 2 (Transformasi Modular 4 Peran, Zero-Trust & Ketahanan Offline-First)

### Pengembangan Aplikasi Web (PAW)
- **Implementasi Server Actions ("use server") & Stateful Session Cookies**:
  - Pembangunan modul Server Action `lib/actions/clinical.ts`: mengimplementasikan pipeline mutasi klinis 6-tahap (Sesi -> Validasi Bentuk Zod -> Validasi Semantik Alergi UR-T10 -> Mutasi Enkripsi AES-GCM/HMAC -> `revalidatePath` -> `redirect`).
  - Pembangunan modul Server Action `lib/actions/auth.ts`: autentikasi server dengan penerbitan cookie sesi `resilio_session_token` berstatus `HttpOnly: true`, `SameSite: "lax"`, `Max-Age: 14400` (4 jam) yang terintegrasi dengan *Stateful Session Store* di server (`SERVER_ACTIVE_SESSIONS`) untuk mendukung *Instant Revocation* (UU PDP No. 27/2022).
  - Penghapusan sesi dan pemusnahan cookie via `logoutServerAction()` saat pengguna keluar.
- **Implementasi Skema Validasi Tipe Aman Zod v4 (`lib/validations/`)**:
  - Instalasi pustaka `zod` (^4.6.7) dan implementasi layer skema validasi terpusat:
    - `clinical.ts`: `PemeriksaanKlinisSchema` memvalidasi keluhan (S) 10–1.000 karakter, batas rentang fisiologis tanda vital (sistolik 70–250, diastolik 40–150, detak 40–220 bpm, suhu 30–45°C, SpO2 50–100%), daftar diagnosis resmi ICD-10 (`z.enum`), dan kotak centang konfirmasi medikolegal sebelum enkripsi.
    - `auth.ts`: `LoginSchema`, `RegisterPasienSchema` (validasi NIK regex 16 digit & kelengkapan berkas KYC), dan `RegisterNakesSchema` (validasi STR & SIP KKI/Dinkes).
    - `triage.ts`: `TriaseSchema` (parameter triase nakes), `WalkInAdmisiSchema` (pendaftaran loket), dan `AssignDpjpSchema` (pencocokan 6-digit PIN persetujuan).
    - `patient.ts`: `BookingSchema`, `TroubleTicketSchema`, dan `ConsentGrantSchema`.
  - Integrasi validasi formulir sisi klien dengan penanganan galat inline interaktif dan banner kesalahan informatif pada 7 modul utama.
  - Penambahan berkas uji unit otomatis `tests/validations.test.ts` (15 skenario uji positif, negatif, dan batas; total 19 unit test lulus 100%).
- **Arsitektur Modular 30 Rute Next.js**:
  - Restrukturisasi total dari prototipe monolitik ke Next.js 15 App Router dengan pemisahan wilayah publik `(auth)` dan 4 domain peran terproteksi `(dashboard)`.
  - Pembangunan subsistem baru: **Staf Nakes Faskes** (`app/(dashboard)/staf/`) yang mencakup admisi antrean walk-in, triase tanda vital fisik (Hijau/Kuning/Merah), penugasan DPJP, dan administrasi rujukan antar faskes.
  - Implementasi *Progressive Web App (PWA)* dengan engine IndexedDB lokal berkapasitas besar untuk mengatasi batas 5 MB `localStorage`.
- **Pengalaman Pengguna & Aksesibilitas Enterprise**:
  - Pustaka komponen vektor SVG monokrom profesional (`components/ui/Icons.tsx`) menggantikan seluruh emoji/simbol dekoratif.
  - Pustaka *Shimmer Skeleton* animasi berkilau (`components/ui/Skeleton.tsx`) dan konvensi resmi `loading.tsx` serta `error.tsx` untuk mencegah *layout shift* saat transisi rute.
  - Penanganan gangguan jaringan (*Offline-First Banner Notice*) dengan saklar simulasi pemutus koneksi (*Simulasi Putus* & *Pulihkan*).
  - Tampilan sepenuhnya responsif pada perangkat seluler (iPhone SE 375px), tablet, hingga layar monitor desktop tanpa *horizontal overflow*.

### Kriptografi (Kripto & KKS)
- **Enkripsi Citra Medis Biner (Blob Engine)**:
  - Dukungan berkas citra radiologi klinis (Foto Rontgen Thorax, USG Abdomen, Scan Lab, EKG). Berkas biner dienkripsi menggunakan AES-256-GCM dan diverifikasi dengan tag HMAC-SHA256 tersendiri di sisi peramban.
- **Zero-Knowledge Architecture**:
  - Seluruh isi formulir SOAP medis dan citra radiologi dienkripsi di peramban sebelum tersimpan di server. Admin regulator dan penyedia database hanya mengelola *opaque ciphertext*.
- **Prinsip Fail-Closed**:
  - Modifikasi sekecil 1 bit pada ciphertext atau IV korup seketika menolak proses dekripsi demi menjamin integritas data hukum medikolegal.
- **Pengujian Kriptografi Otomatis**:
  - 4 skenario unit test Vitest lulus 100% (`tests/crypto.test.ts`).

### Keamanan Komputasi dan Siber (KKS)
- **Zero-Trust BOLA / IDOR Gatekeeper & Active Encounter Ticket**:
  - Akses dokter terhadap rekam medis pasien dikunci secara atomik melalui tiket pertemuan aktif (*Active Encounter Ticket*) yang diverifikasi via PIN 6-digit pasien di loket triase. Dokter non-DPJP diblokir HTTP 403 Forbidden dan dicatat ke SIEM.
- **Protokol Akses Darurat IGD (Break-Glass Protocol)**:
  - Dokter IGD dapat membuka rekam medis pasien koma/kritis dengan wajib memilih indikasi kegawatan klinis (ISO 27799 / HIPAA); sistem seketika memicu alarm prioritas tinggi (*High-Severity Alert*) ke dasbor SIEM Admin Kemenkes.
- **Perlindungan Identitas e-KYC (Auto-Watermarking Canvas)**:
  - Kanvas peramban membubuhkan teks digital permanen *"HANYA UNTUK VERIFIKASI RESILIO-HEALTH - [TANGGAL]"* di atas foto KTP asli dan swafoto wajah sebelum berkas diunggah.
- **Integritas Medis & Immutable Addendum (Permenkes No. 24/2022)**:
  - Rekam medis yang telah ditandatangani bersifat permanen. Koreksi wajib menggunakan revisi bertingkat (*Addendum Versi 2*) berstempel waktu.
- **Deteksi Otomatis Kontraindikasi Alergi Klinis (UR-T10)**:
  - Peringatan merah berkedip saat dokter mengetik resep obat yang bertentangan dengan alergi pasien.
- **Ransomware Kill-Switch**:
  - Saklar pembeku akses faskes terinfeksi malware dari gateway RME nasional.

---

## [v0.1] - 2026-10-13 — Milestone 1 (Fondasi Responsif & Kriptografi Awal)
- Implementasi AES-256-GCM menggunakan Web Crypto API native (`lib/crypto/aes.ts`).
- Implementasi HMAC-SHA256 untuk verifikasi integritas data (`lib/crypto/hmac.ts`).
- Penambahan 4 skenario unit test otomatis pada `tests/crypto.test.ts` (uji positif, negatif, dan batas).
- Pembuatan antarmuka hub multi-peran awal di `/beranda`.
- Optimasi aksesibilitas WCAG 2.1 AA mencapai skor Lighthouse Accessibility $\ge 90$.
- Penyusunan dokumen STRIDE awal, Risk Register, DFD, dan Keterlacakan.
