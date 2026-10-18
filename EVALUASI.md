# EVALUASI.md — Hasil Evaluasi, Pengujian & Kelaikan Sistem

Dokumen evaluasi pengujian komprehensif komponen kriptografi, antarmuka responsif Next.js, dan postur keamanan *Zero-Trust* Resilio-Health (Milestone `v0.1` dan `v0.2`).

---

## 1. Matriks Skenario Uji Otomatis Kriptografi (Vitest)

Pengujian dijalankan pada berkas `tests/crypto.test.ts` menggunakan runtime Vitest:

| ID Uji | Kategori | Skenario Uji | Masukan | Ekspektasi | Hasil Riil | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **UJI-01** | Positif | Enkripsi dan Dekripsi AES-256-GCM | Plaintext diagnosa medis sintetis + Kunci 256-bit Hex valid | Plaintext hasil dekripsi identik 100% dengan masukan awal | Plaintext cocok secara byte-by-byte | **LULUS (PASS)** |
| **UJI-02** | Positif | Integritas HMAC-SHA256 Data Asli | Payload klinis + Kunci rahasia | `verifyHMAC()` mengembalikan `true` | Validasi sukses bernilai boolean `true` | **LULUS (PASS)** |
| **UJI-03** | Negatif | Deteksi Manipulasi Data (Tampering) | Payload klinis sengaja dimodifikasi + digest lama | `verifyHMAC()` mengembalikan `false` | Modifikasi terdeteksi, digest tidak cocok | **LULUS (PASS)** |
| **UJI-04** | Batas | Dekripsi GCM dengan IV Rusak / Korup | Ciphertext valid + IV "000000000000000000000000" | Operasi melempar error (`rejects.toThrow()`) | Web Crypto API melempar `OperationError` (Fail-closed) | **LULUS (PASS)** |

---

## 2. Matriks Pengujian Fungsional & Keamanan Sistem (Milestone v0.2)

| Area Pengujian | Skenario Uji | Metode & Lingkungan | Hasil Pengujian | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Kompilasi Antarmuka** | Kompilasi produksi 30 rute Next.js App Router | `npm run build` (Turbopack) | Seluruh 30 rute terkompilasi bersih tanpa kesalahan TypeScript | **LULUS (PASS)** |
| **Kualitas Kode** | Analisis statis linter ESLint | `npm run lint` | 0 errors, 0 warnings di seluruh basis kode | **LULUS (PASS)** |
| **Pertahanan BOLA/IDOR** | Akses ID tidak terdaftar (`/nakes/periksa/APT-999`, `/pasien/faskes/FAS-999`) | Browser Test & Headless | Menampilkan kartu error 404 terisolasi tanpa membocorkan data entitas lain dan sesi tetap utuh | **LULUS (PASS)** |
| **Protokol Break-Glass** | Pembukaan darurat pasien koma di IGD | Modal Break-Glass | Rekam medis darurat terbuka, alarm High-Severity terkirim ke SIEM Kemenkes | **LULUS (PASS)** |
| **Deteksi Alergi Klinis** | Resep obat memuat alergen pasien (Penicillin) | Text Input Match | Banner merah berkedip seketika saat kata kunci alergen terdeteksi (UR-T10) | **LULUS (PASS)** |
| **Auto-Watermarking** | Unggah KTP & Selfie e-KYC | Canvas API Peramban | Foto otomatis dibubuhi teks watermark permanen sebelum dikirim | **LULUS (PASS)** |
| **Shimmer Skeleton** | Simulasi pemutusan koneksi internet faskes | Banner Status & Skeleton | Banner offline muncul, shimmer effect aktif, data tetap terbaca via IndexedDB | **LULUS (PASS)** |
| **Aksesibilitas Mobile** | Navigasi pada resolusi 375x667 px | Chrome Emulation | Drawer menu responsif, bebas horizontal overflow (`scrollWidth = innerWidth`) | **LULUS (PASS)** |

---

## 3. Temuan, Refaktorisasi & Perbaikan Kritis (Bug Fixes)

1. **Temuan 1: Celah BOLA Fallback `|| list[0]`**:
   - *Masalah*: Saat ID di URL tidak ditemukan, kode lama mengalihkan ke `list[0]`, membocorkan data orang lain.
   - *Perbaikan*: Menghapus seluruh fallback `|| list[0]` dan menggantinya dengan penanganan kartu kesalahan 404 terisolasi di dalam dashboard.
2. **Temuan 2: TypeError `allergies.filter` Undefined**:
   - *Masalah*: Objek pasien tanpa properti `allergies` memicu crash runtime di stasiun kerja dokter.
   - *Perbaikan*: Menerapkan pengecekan defensif `Array.isArray(patient?.allergies) ? patient.allergies : []`.
3. **Temuan 3: Sesi Login Hilang saat Menemui 404**:
   - *Masalah*: Pengalihan paksa server membuang pengguna ke halaman login saat salah mengetik ID.
   - *Perbaikan*: Menyediakan *In-Dashboard Error Boundary* (`app/(dashboard)/error.tsx`) dan 404 global pintar (`app/not-found.tsx`) yang mempertahankan sesi login.
4. **Temuan 4: Animasi Transisi & Skeleton Shimmer**:
   - *Perbaikan*: Mengimplementasikan CSS keyframe `shimmer-effect` dan konvensi resmi Next.js `app/(dashboard)/loading.tsx`.

---

## 4. Kesimpulan Kelaikan Sistem

Resilio-Health v0.2 telah memenuhi seluruh kriteria evaluasi integrasi tiga mata kuliah (PAW, Kriptografi, KKS). Sistem siap dipresentasikan dengan arsitektur 4 peran lengkap, ketahanan *Offline-First* berdaya tahan tinggi, dan kepatuhan regulasi UU PDP No. 27/2022 serta Permenkes No. 24/2022.
