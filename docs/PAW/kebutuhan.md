# Spesifikasi Kebutuhan Pengguna & Kriteria Penerimaan — Resilio-Health

Dokumen ini mendefinisikan kebutuhan pengguna (*User Requirements*) bernomor serta kriteria penerimaan (*Acceptance Criteria*) untuk pengembangan antarmuka produk web Resilio-Health pada Milestone 1 (Tag `v0.1`).

---

## 1. Daftar Kebutuhan Pengguna (*User Requirements*)

### REQ-01: Autentikasi Peran & Gerbang Masuk Cepat (Quick Demo)
- **Sebagai**: Pengguna sistem (Dokter, Pasien, atau Administrator).
- **Saya ingin**: Melakukan autentikasi kredensial atau memilih tombol jalan pintas peran (*Quick Demo*) pada satu halaman masuk yang bersih.
- **Sehingga**: Saya dapat langsung diarahkan ke lingkungan stasiun kerja yang sesuai dengan hak akses saya tanpa harus melakukan konfigurasi manual.

### REQ-02: Gerbang Terpadu Antarmuka Berdasarkan Peran (*Role-Based Hub*)
- **Sebagai**: Pengguna yang telah berhasil masuk ke sistem.
- **Saya ingin**: Mengakses satu alamat URL yang sama (`/beranda`) dan sistem secara otomatis merender antarmuka yang tepat sesuai peran aktif saya.
- **Sehingga**: Navigasi aplikasi konsisten, terpusat, dan mencegah kebocoran antarmuka peran lain.

### REQ-03: Formulir Pemeriksaan Klinis & Validasi Sisi Klien (Dokter)
- **Sebagai**: Dokter pemeriksa rawat inap.
- **Saya ingin**: Memilih pasien bangsal dan mengisi formulir rekam medis (keluhan, tanda vital numerik, diagnosa, resep) yang dilengkapi validasi sebelum disimpan.
- **Sehingga**: Kesalahan masukan (kolom kosong atau angka tanda vital di luar batas wajar) dicegah di memori peramban sebelum proses enkripsi.

### REQ-04: Pembatasan Otorisasi Penugasan Bangsal (*Zero-Trust Restriction*)
- **Sebagai**: Dokter pemeriksa.
- **Saya ingin**: Sistem mengunci formulir pemeriksaan jika pasien yang dipilih belum ditugaskan kepada saya oleh Administrator.
- **Sehingga**: Saya tidak dapat menulis atau membuka data medis pasien yang bukan merupakan tanggung jawab klinis saya.

### REQ-05: Visualisasi Tren Fluktuasi Tanda Vital (Dokter)
- **Sebagai**: Dokter penanggung jawab pasien.
- **Saya ingin**: Melihat diagram visual perubahan tekanan darah sistolik dan diastolik pasien dari riwayat pemeriksaan sebelumnya.
- **Sehingga**: Fluktuasi kondisi klinis pasien dapat dievaluasi secara cepat tanpa harus membaca log teks mentah.

### REQ-06: Portal Rekam Medis Mandiri & Dekripsi Sisi Klien (Pasien)
- **Sebagai**: Pasien rawat inap.
- **Saya ingin**: Melihat daftar riwayat rekam medis pribadi saya dan melakukan dekripsi data secara *on-demand* menggunakan kunci saya sendiri.
- **Sehingga**: Privasi rekam medis saya terlindungi dari pihak internal rumah sakit dan hanya dapat dibaca oleh saya sendiri.

### REQ-07: Penugasan Dokter Bangsal & Simulasi Pengawasan Integritas (Admin)
- **Sebagai**: Administrator sistem rumah sakit.
- **Saya ingin**: Mengatur delegasi penugasan dokter terhadap pasien bangsal serta memiliki alat simulasi pemalsuan (*Tamper Simulation*) untuk menguji integritas data HMAC.
- **Sehingga**: Tata kelola penugasan bangsal berjalan tertib dan ketahanan sistem terhadap manipulasi data dapat diaudit.

### REQ-08: Tata Letak Responsif Lintas Perangkat
- **Sebagai**: Pengguna dengan perangkat beragam (ponsel pintar perawat/dokter saat visit, tablet bangsal, komputer meja stasiun dokter).
- **Saya ingin**: Antarmuka beradaptasi secara optimal pada lebar layar ponsel ($\le 640$px), tablet ($768$px), dan desktop ($\ge 1024$px).
- **Sehingga**: Seluruh fungsionalitas tetap terbaca, elemen tidak bertumpuk (*no overflow*), dan mudah dioperasikan.

### REQ-09: Aksesibilitas Web (WCAG 2.1 AA)
- **Sebagai**: Pengguna dengan keterbatasan visual atau pengguna teknologi pembaca layar (*screen reader*).
- **Saya ingin**: Antarmuka memiliki kontras warna yang memadai, label kontrol formulir yang eksplisit, dan struktur heading yang runtut.
- **Sehingga**: Aplikasi memenuhi standar aksesibilitas web dengan skor Google Lighthouse Accessibility minimal 85.

---

## 2. Kriteria Penerimaan (*Acceptance Criteria*)

| ID Kebutuhan | Kriteria Penerimaan (*Acceptance Criteria*) | Metode Verifikasi |
| :--- | :--- | :--- |
| **AC-01** (dari REQ-01) | - Tersedia form input username dan password.<br>- Tersedia 3 tombol jalan pintas peran (Dokter, Pasien, Admin).<br>- Pengguna dialihkan ke `/beranda` setelah sesi terbentuk. | Uji fungsional navigasi rute |
| **AC-02** (dari REQ-02) | - Mengakses `/beranda` tanpa sesi mengalihkan ke `/`.<br>- Sesi dokter merender `DokterView`.<br>- Sesi pasien merender `PasienView`.<br>- Sesi admin merender `AdminView`. | Uji pergantian sesi di memori |
| **AC-03** (dari REQ-03) | - Form menolak submit jika keluhan, diagnosa, atau resep kosong.<br>- Nilai tanda vital (sistolik, diastolik, suhu, nadi) divalidasi tipe dan range numerik.<br>- Menampilkan pesan kesalahan yang jelas kepada dokter. | Uji pengosongan form (*negative testing*) |
| **AC-04** (dari REQ-04) | - Pasien yang `assignedDoctorId`-nya berbeda dengan akun dokter aktif menampilkan panel peringatan *"Akses Dibatasi oleh Protokol Zero-Trust"*.<br>- Tombol enkripsi & simpan dinonaktifkan/disembunyikan. | Simulasi pemilihan pasien tidak sah |
| **AC-05** (dari REQ-05) | - Riwayat rekam medis pasien terfilter dirender dalam grafik batang adaptif.<br>- Batang merah merepresentasikan sistolik dan abu-abu merepresentasikan diastolik beserta label waktu periksa. | Uji visual grafik pada tab data |
| **AC-06** (dari REQ-06) | - Pasien hanya melihat rekam medis miliknya sendiri.<br>- Plaintext diagnosa hanya tampil saat fungsi dekripsi dieksekusi dengan kunci yang cocok. | Uji inspeksi DOM & dekripsi mandiri |
| **AC-07** (dari REQ-07) | - Dropdown penugasan memperbarui `resilio_patients` di penyimpanan lokal.<br>- Tombol simulasi manipulasi data mengubah bit payload dan memicu status verifikasi integritas merah (*Gagal*). | Uji simulasi manipulasi data |
| **AC-08** (dari REQ-08) | - Pada lebar $\le 640$px: Sidebar desktop tersembunyi, bilah navigasi bawah (*bottom bar*) aktif.<br>- Pada lebar $\ge 1024$px: Sidebar vertikal aktif penuh, formulir dan bukti kripto tampil multi-kolom berdampingan. | Uji inspeksi peramban (DevTools responsive mode) |
| **AC-09** (dari REQ-09) | - Rasio kontras teks terhadap latar belakang mencapai $\ge 4.5:1$ (WCAG AA).<br>- Seluruh elemen `<input>` dan `<select>` memiliki pasangan `<label htmlFor="...">` dan `id` yang cocok.<br>- Skor audit Google Lighthouse Accessibility mencapai minimal $\ge 85$. | Audit otomatis Google Lighthouse |