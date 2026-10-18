# CHANGELOG — Resilio-Health

Semua perubahan besar pada proyek Resilio-Health didokumentasikan di sini.

---

## [v0.2] - 2026-10-17 — Milestone 2 (Transformasi Modular 4 Peran, Zero-Trust & Ketahanan Offline-First)

### Pengembangan Aplikasi Web (PAW)
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
