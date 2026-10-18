# Dokumentasi Praktikum & Wireframe Antarmuka — Resilio-Health

Dokumen ini memetakan struktur arsitektur antarmuka, wireframe 4 peran pengguna (*Separation of Duties*), serta hierarki komponen UI pada Resilio-Health.

---

## 1. Wireframe Arsitektur 4 Peran Pengguna

### 1.1 Halaman Autentikasi Publik (`app/(auth)/login/page.tsx`)
```text
┌──────────────────────────────────────────────────────────┐
│                      [LOGO R]                            │
│                   RESILIO-HEALTH                         │
│       Zero-Trust Hospital Information System             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Masukkan NIK / Username / Email: [ ............. ] │  │
│  │ Kata Sandi:                      [ ••••••••••••• ] │  │
│  │ [ TOMBOL: MASUK KE SISTEM ]                        │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ Akses Cepat Demo 4 Peran:                          │  │
│  │ [ Dokter DPJP ] [ Staf Triase ] [ Pasien ] [ Admin ]│  │
│  └────────────────────────────────────────────────────┘  │
│  Daftar Akun Baru: [ Pasien (NIK) ] | [ Nakes (STR) ]    │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Portal Mandiri Pasien (`app/(dashboard)/pasien/page.tsx`)
```text
┌──────────────────────────────────────────────────────────┐
│ [LOGO] RESILIO-HEALTH        │ Profil: Budi Santoso      │
├───────────────┬──────────────────────────────────────────┤
│ SIDEBAR       │ HEADER: Halo, Budi Santoso (NIK: 3171..) │
│ - Ringkasan   │ Family Proxy: [ Budi Santoso (Akun Utama)▼]│
│ - Cari Faskes ├──────────────────────────────────────────┤
│ - Booking     │ [BANNER ACTIVE ENCOUNTER: PIN: 884120]   │
│ - Rekam Medis ├──────────────────────────────────────────┤
│ - Izin Consent│ KARTU DARURAT MEDIS (RESILIO ID)         │
│ - Audit Trail │ Gol. Darah: O+ | Alergi: Penicillin      │
│ - Keluar Sesi │ Kunci Kripto: [ a1b2c3d4... ] (Zero-Know)│
│               ├──────────────────────────────────────────┤
│               │ JADWAL MENDATANG & MENU LAYANAN          │
└───────────────┴──────────────────────────────────────────┘
```

### 1.3 Meja Staf Nakes Triase & Admisi (`app/(dashboard)/staf/page.tsx`)
```text
┌──────────────────────────────────────────────────────────┐
│ [LOGO] RESILIO-HEALTH        │ Ners Maya Kartika, S.Kep  │
├───────────────┬──────────────────────────────────────────┤
│ SIDEBAR       │ LOKET ADMISI & CHECK-IN ANTREAN (UR-S01) │
│ - Admisi Antre│ [ + Daftarkan Pasien Walk-in (Loket) ]   │
│ - Triase Fisik├──────────────────────────────────────────┤
│ - Assign DPJP │ STATISTIK LOKET:                         │
│ - Rujukan     │ Menunggu Check-in | Menunggu Triase      │
│ - Keluar Sesi ├──────────────────────────────────────────┤
│               │ TABEL ANTREAN HARIAN:                    │
│               │ NIK | Pasien | Status | Aksi: [Check-in] │
└───────────────┴──────────────────────────────────────────┘
```

### 1.4 Stasiun Kerja Dokter DPJP (`app/(dashboard)/nakes/page.tsx`)
```text
┌──────────────────────────────────────────────────────────┐
│ [LOGO] RESILIO-HEALTH        │ dr. Andi Pratama, Sp.PD   │
├───────────────┬──────────────────────────────────────────┤
│ SIDEBAR       │ STASIUN KLINIS DOKTER DPJP (UR-T01..10)  │
│ - Antrean     │ Sesi Praktik: [Aktif] | [Lookup NIK Pasien]│
│ - Lookup NIK  ├──────────────────────────────────────────┤
│ - Surat Rujuk │ FORM PEMERIKSAAN SOAP & ICD-10           │
│ - Offline Sync│ Subjective (S): Keluhan awal             │
│ - Keluar Sesi │ Objective (O): Tensi | Nadi | Suhu | SpO2│
│               │ Assessment (A): ICD-10 [ I10 - Hipertensi]│
│               │ Plan (P): e-Prescription (Real-Time Alert│
│               │ Lampiran Citra: [Foto Rontgen Thorax Blob]│
│               │ Mode Addendum: [Revisi Bertingkat V2]    │
│               │ [ SIMPAN & ENKRIPSI AES-256-GCM + HMAC ] │
└───────────────┴──────────────────────────────────────────┘
```

### 1.5 Konsol Pengawas Admin Regulator (`app/(dashboard)/admin/page.tsx`)
```text
┌──────────────────────────────────────────────────────────┐
│ [LOGO] RESILIO-HEALTH        │ Admin Regulator Kemenkes  │
├───────────────┬──────────────────────────────────────────┤
│ SIDEBAR       │ DASBOR EKSEKUTIF TATA KELOLA KESEHATAN   │
│ - Ringkasan   │ KYC Pending: 1 | KYD Pending: 1          │
│ - e-KYC Visual├──────────────────────────────────────────┤
│ - e-KYD Nakes │ VERIFIKASI VISUAL BERKAS KTP BER-WATERMARK│
│ - Master RS   │ Peninjau Dokumen KTP + Swafoto Berdampingan│
│ - SIEM Monitor├──────────────────────────────────────────┤
│ - Incident Ctr│ LIVE SIEM FEED:                          │
│ - Keluar Sesi │ BOLA/IDOR Blocked | HMAC Check | Break-Glass│
│               │ [ SAKLAR RANSOMWARE KILL-SWITCH FASKES ] │
└───────────────┴──────────────────────────────────────────┘
```

---

## 2. Struktur Komponen Antarmuka Terstandarisasi

1. **`components/ui/Icons.tsx`**: Kumpulan 18 ikon SVG monokrom profesional menggantikan simbol dekoratif.
2. **`components/ui/Skeleton.tsx`**: Kerangka shimmer loading berkilau saat terjadi transisi halaman atau gangguan koneksi offline.
3. **`components/shared/RoleNav.tsx`**: Navigasi sidebar dinamis 4 peran dengan dukungan mobile responsive drawer.
4. **`components/shared/NetworkStatusBanner.tsx`**: Kontrol pemutus jaringan lokal (*Simulasi Putus*) dan pemantauan antrean IndexedDB.
5. **`components/ui/LogoutModal.tsx`**: Dialog konfirmasi penghapusan kunci kriptografi sesi sebelum keluar.
