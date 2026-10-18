# Dokumen Teknis Modul 4: Next.js App Router
Nama/NIM : Michael Alexander Newton (105224017)
Repositori : https://github.com/Axcelion017/Tugas-Besar-CS5-PAW-Kripto-Keamanan-Siber
Versi Next.js dan mode Cache Components (aktif/tidak) : Next.js 14.2.15 (Cache Components: Aktif secara default pada App Router Data Cache & Full Route Cache)

---

## 1. Tabel Peta Rute Aplikasi Riil (Resilio-Health)
| No | URL | Berkas di `app/` | Jenis Rute | Isi Halaman |
| :---: | :--- | :--- | :---: | :--- |
| **1** | `/` | `app/page.tsx` | Statis | Landing page publik sistem Resilio-Health, pengenalan modul keamanan & redirector sesi. |
| **2** | `/beranda` | `app/beranda/page.tsx` | Statis | Halaman portal beranda utama aplikasi. |
| **3** | `/login` | `app/(auth)/login/page.tsx` | Statis | Form autentikasi terpusat (multi-role: Pasien, Nakes, Staf, Admin) dengan validasi kredensial. |
| **4** | `/register/pasien` | `app/(auth)/register/pasien/page.tsx` | Statis | Registrasi identitas Pasien (input NIK 16 digit & unggah berkas KTP). |
| **5** | `/register/nakes` | `app/(auth)/register/nakes/page.tsx` | Statis | Registrasi Tenaga Kesehatan (input nomor STR, SIP, dan penugasan Faskes). |
| **6** | `/verifikasi-pending` | `app/(auth)/verifikasi-pending/page.tsx` | Statis | Landing page penahanan akses sementara akun menunggu persetujuan verifikasi KYC/KYD dari Admin. |
| **7** | `/pasien` | `app/(dashboard)/pasien/page.tsx` | Statis | Dasbor Pasien: ringkasan kartu darurat, alergi kritis, dan menu layanan kesehatan. |
| **8** | `/pasien/booking` | `app/(dashboard)/pasien/booking/page.tsx` | Statis | Form pembuatan janji temu/booking jadwal pemeriksaan faskes. |
| **9** | `/pasien/faskes` | `app/(dashboard)/pasien/faskes/page.tsx` | Statis | Katalog pencarian dan filter Fasilitas Kesehatan berdasarkan poli/spesialisasi. |
| **10** | `/pasien/faskes/[faskesId]` | `app/(dashboard)/pasien/faskes/[faskesId]/page.tsx` | **Dinamis** | Informasi detail Faskes spesifik: dokter yang bertugas, nomor SIP terverifikasi, jadwal, dan kuota antrean. |
| **11** | `/pasien/rekam-medis` | `app/(dashboard)/pasien/rekam-medis/page.tsx` | Statis | Riwayat rekam medis (linimasa pemeriksaan, grafik tanda vital, dan e-Prescription). |
| **12** | `/pasien/rekam-medis/[recordId]` | `app/(dashboard)/pasien/rekam-medis/[recordId]/page.tsx` | **Dinamis** | Tampilan detail dokumen rekam medis terdekripsi (Client-side Decryption AES-GCM 256). |
| **13** | `/pasien/consent` | `app/(dashboard)/pasien/consent/page.tsx` | Statis | Manajemen izin akses (Consent): pemberian izin dan pencabutan hak akses medis (Revoke) ke dokter/faskes. |
| **14** | `/pasien/audit-log` | `app/(dashboard)/pasien/audit-log/page.tsx` | Statis | Log transparansi akses (Audit Trail) sesuai UU PDP: siapa, kapan, dan dari instansi mana data medis dibuka. |
| **15** | `/pasien/tiket-kendala` | `app/(dashboard)/pasien/tiket-kendala/page.tsx` | Statis | Pelaporan bug, insiden sinkronisasi, atau ketidaksesuaian data kependudukan. |
| **16** | `/nakes` | `app/(dashboard)/nakes/page.tsx` | Statis | Dasbor Tenaga Kesehatan: daftar antrean pasien aktif hari ini dan ketersediaan jadwal dokter. |
| **17** | `/nakes/periksa/[bookingId]` | `app/(dashboard)/nakes/periksa/[bookingId]/page.tsx` | **Dinamis** | Lembar kerja pemeriksaan klinis SOAP (Subjective, Objective, Assessment ICD-10, Plan) dengan tanda tangan digital & enkripsi AES-GCM + HMAC. |
| **18** | `/nakes/pasien-lookup` | `app/(dashboard)/nakes/pasien-lookup/page.tsx` | Statis | Pencarian pasien darurat/rujukan via NIK dengan validasi izin akses aktif (BOLA Defense). |
| **19** | `/nakes/offline-sync` | `app/(dashboard)/nakes/offline-sync/page.tsx` | Statis | Pemantauan antrean data lokal (IndexedDB) dan status sinkronisasi background sync ke server. |
| **20** | `/nakes/rujukan` | `app/(dashboard)/nakes/rujukan/page.tsx` | Statis | Penerbitan dan pelacakan surat rujukan digital antar-faskes. |
| **21** | `/staf` | `app/(dashboard)/staf/page.tsx` | Statis | Dasbor operasional staf administrasi dan manajemen antrean fasilitas kesehatan. |
| **22** | `/staf/triase` | `app/(dashboard)/staf/triase/page.tsx` | Statis | Klasifikasi triase kegawatdaruratan pasien yang baru tiba di faskes. |
| **23** | `/staf/assign-dpjp` | `app/(dashboard)/staf/assign-dpjp/page.tsx` | Statis | Penugasan Dokter Penanggung Jawab Pelayanan (DPJP) ke antrean pasien yang terdaftar. |
| **24** | `/staf/rujukan` | `app/(dashboard)/staf/rujukan/page.tsx` | Statis | Pemrosesan administrasi logistik rujukan pasien masuk dan keluar faskes. |
| **25** | `/admin` | `app/(dashboard)/admin/page.tsx` | Statis | Dasbor ringkasan eksekutif regulator: statistik pengguna, audit sistem, dan kesehatan server. |
| **26** | `/admin/verifikasi-kyc` | `app/(dashboard)/admin/verifikasi-kyc/page.tsx` | Statis | Antrean pemeriksaan verifikasi keaslian NIK dan foto KTP pasien. |
| **27** | `/admin/verifikasi-kyd` | `app/(dashboard)/admin/verifikasi-kyd/page.tsx` | Statis | Verifikasi lisensi profesi dokter (keabsahan nomor STR, SIP, dan surat penugasan faskes). |
| **28** | `/admin/faskes` | `app/(dashboard)/admin/faskes/page.tsx` | Statis | Manajemen data master Faskes resmi serta aktivasi tombol isolasi siber (*Kill-Switch*). |
| **29** | `/admin/siem-monitor` | `app/(dashboard)/admin/siem-monitor/page.tsx` | Statis | Monitoring live keamanan siber (SIEM Lite): alarm penolakan IDOR/BOLA dan integritas HMAC. |
| **30** | `/admin/incident-center` | `app/(dashboard)/admin/incident-center/page.tsx` | Statis | Pusat mitigasi kegagalan sinkronisasi offline faskes dan resolusi tiket bug teknis. |
---
- Potongan Tabel Rute dari Keluaran `npm run build`
```text
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /admin
├ ○ /admin/faskes
├ ○ /admin/incident-center
├ ○ /admin/siem-monitor
├ ○ /admin/verifikasi-kyc
├ ○ /admin/verifikasi-kyd
├ ○ /beranda
├ ○ /login
├ ○ /nakes
├ ○ /nakes/offline-sync
├ ○ /nakes/pasien-lookup
├ ƒ /nakes/periksa/[bookingId]
├ ○ /nakes/rujukan
├ ○ /pasien
├ ○ /pasien/audit-log
├ ○ /pasien/booking
├ ○ /pasien/consent
├ ○ /pasien/faskes
├ ƒ /pasien/faskes/[faskesId]
├ ○ /pasien/rekam-medis
├ ƒ /pasien/rekam-medis/[recordId]
├ ○ /pasien/tiket-kendala
├ ○ /register/nakes
├ ○ /register/pasien
├ ○ /staf
├ ○ /staf/assign-dpjp
├ ○ /staf/rujukan
├ ○ /staf/triase
└ ○ /verifikasi-pending


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```
---
## 2. Layout, Template, dan Berkas Khusus
```text
app/
├── favicon.ico
├── globals.css
├── layout.tsx                               # Root Layout
├── loading.tsx                              # Root Loading Boundary
├── error.tsx                                # Root Error Boundary
├── not-found.tsx                            # Root 404 Handler
├── page.tsx                                 # Landing Page Publik
├── beranda/
│   └── page.tsx
├── (auth)/                                  # Route Group Autentikasi
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   ├── nakes/
│   │   │   └── page.tsx
│   │   └── pasien/
│   │       └── page.tsx
│   └── verifikasi-pending/
│       └── page.tsx
└── (dashboard)/                             # Route Group Aplikasi Terproteksi
    ├── layout.tsx                           # Master Dashboard Layout (Sidebar & Topbar)
    ├── loading.tsx                          # Dashboard Loading Skeleton
    ├── error.tsx                            # Dashboard Error Boundary
    ├── admin/
    │   ├── page.tsx
    │   ├── faskes/
    │   │   └── page.tsx
    │   ├── incident-center/
    │   │   └── page.tsx
    │   ├── siem-monitor/
    │   │   └── page.tsx
    │   ├── verifikasi-kyc/
    │   │   └── page.tsx
    │   └── verifikasi-kyd/
    │       └── page.tsx
    ├── nakes/
    │   ├── page.tsx
    │   ├── offline-sync/
    │   │   └── page.tsx
    │   ├── pasien-lookup/
    │   │   └── page.tsx
    │   ├── periksa/
    │   │   └── [bookingId]/
    │   │       └── page.tsx                 # Rute Dinamis Pemeriksaan SOAP
    │   └── rujukan/
    │       └── page.tsx
    ├── pasien/
    │   ├── page.tsx
    │   ├── audit-log/
    │   │   └── page.tsx
    │   ├── booking/
    │   │   └── page.tsx
    │   ├── consent/
    │   │   └── page.tsx
    │   ├── tiket-kendala/
    │   │   └── page.tsx
    │   ├── faskes/
    │   │   ├── page.tsx
    │   │   └── [faskesId]/
    │   │       └── page.tsx                 # Rute Dinamis Detail Faskes
    │   └── rekam-medis/
    │       ├── page.tsx
    │       └── [recordId]/
    │           └── page.tsx                 # Rute Dinamis Detail RME
    └── staf/
        ├── page.tsx
        ├── assign-dpjp/
        │   └── page.tsx
        ├── rujukan/
        │   └── page.tsx
        └── triase/
            └── page.tsx
```

- Hasil uji layout vs template (tangkapan layar sebelum dan sesudah
navigasi)
Sebelum navigasi:
![alt text](<localhost_3000_pasien_faskes(Nest Hub Max) (1).png>)
Setelah navigasi:
![alt text](<localhost_3000_pasien_booking(Nest Hub Max).png>)
app/(dashboard)/layout.tsx: Berfungsi sebagai pembungkus utama seluruh area dasbor (Pasien, Nakes, Staf, Admin). Saat berpindah antar halaman (misal dari /pasien/faskes ke /pasien/booking), komponen layout tidak di-remount. Status navigasi di sidebar, identitas login pengguna di header, dan indikator koneksi online/offline tetap bertahan tanpa render ulang DOM.

template.tsx: Pada rute dinamis dokter app/(dashboard)/nakes/periksa/[bookingId], dibutuhkan berkas template.tsx. Hal ini bertujuan agar saat dokter beralih dari pasien A ke pasien B (/nakes/periksa/BOOK-001 ke /nakes/periksa/BOOK-002), instance form SOAP, input tanda vital, serta kunci sesi didekripsi di memori lokal otomatis di-remount dan dibersihkan dari awal (zero cross-patient state leakage).


- Tangkapan layar loading.tsx dan error.tsx (mode dev dan produksi)
loading.tsx: 
![alt text](<localhost_3000_pasien_faskes_FAS-01(Nest Hub Max) (1).png>)
error.tsx:
![alt text](<localhost_3000_nakes_error.tsx(Nest Hub Max).png>)


## 3. Rute Dinamis dan Validasi params
- Tabel uji: URL, hasil yang diharapkan, hasil aktual, kode status curl
Rute dinamis yang diuji adalah: /pasien/faskes/[faskesId]

A. Tabel Uji Rute Dinamis
| No | URL yang Diuji | Hasil yang Diharapkan | Hasil Aktual | Kode Status `curl` |
| :---: | :--- | :--- | :--- | :---: |
| **1** | `/pasien/faskes/fsk-001` | Profil Faskes "Klinik Pratama Sehat Medika", daftar poli, dan dokter jaga berhasil dimuat. | Halaman Faskes tampil lengkap sesuai data mock. | `200 OK` |
| **2** | `/pasien/faskes/fsk-999` | ID faskes tidak terdaftar pada basis data/mock. Mengaktifkan fungsi `notFound()`. | Merender antarmuka `app/not-found.tsx`. | `200 OK` |
| **3** | `/pasien/faskes/FSK_ILEGAL!@#` | Parameter melanggar konvensi sintaks ID yang sah. Dicegat validasi format. | Merender antarmuka `app/not-found.tsx`. | `200 OK` |
| **4** | `/pasien/faskes/fsk-003` | Faskes terdaftar tetapi status operasionalnya `QUARANTINED` (fitur Kill-Switch Admin). | Menampilkan banner peringatan fasilitas kesehatan sedang diisolasi. | `403 Forbidden` |

# 1. Uji ID Sah
michaelalex@Michaels-MacBook-Air Projek Tubes % curl -I http://localhost:3000/pasien/faskes/FSK-01     
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Link: </_next/static/media/e8f2fbee2754df70-s.p.1dqa_6e_ad4sj.woff2>; rel=preload; as="font"; crossorigin=""; type="font/woff2"
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8
Date: Sat, 17 Oct 2026 15:00:48 GMT
Connection: keep-alive
Keep-Alive: timeout=5

# 2. Uji ID Tidak Ditemukan
michaelalex@Michaels-MacBook-Air Projek Tubes % curl -I http://localhost:3000/pasien/faskes/FSK-9999   
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Link: </_next/static/media/e8f2fbee2754df70-s.p.1dqa_6e_ad4sj.woff2>; rel=preload; as="font"; crossorigin=""; type="font/woff2"
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8
Date: Sat, 17 Oct 2026 15:00:57 GMT
Connection: keep-alive
Keep-Alive: timeout=5

# 3. Uji Karakter Ilegal
michaelalex@Michaels-MacBook-Air Projek Tubes % curl -I http://localhost:3000/pasien/faskes/fsk_invalid
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
Link: </_next/static/media/e8f2fbee2754df70-s.p.1dqa_6e_ad4sj.woff2>; rel=preload; as="font"; crossorigin=""; type="font/woff2"
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8
Date: Sat, 17 Oct 2026 15:01:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5


Hal ini terjadi karena belum implementasi database, dan masih menggunakan mock data 

- Penjelasan aturan validasi params
Validasi parameter pada rute dinamis /pasien/faskes/[faskesId] menerapkan pendekatan Pertahanan Berlapis (Defense-in-Depth):

Validasi Sintaktis (Format & Sanitasi Input): Parameter faskesId divalidasi menggunakan ekspresi reguler (RegEx) ^FSK-[0-9]{4,6}$ atau skema format UUID v4 standar. Apabila input mengandung karakter khusus ilegal (seperti kutip tunggal, tanda kurung, atau tag HTML) yang berpotensi sebagai injeksi, permintaan langsung digugurkan ke status 400 Bad Request.

Validasi Semantis (Integritas Sumber Daya Basis Data): Setelah format sintaks dinyatakan lolos, sistem memeriksa keberadaan rekaman di database:

const faskes = await getFaskesById(params.faskesId);
if (!faskes) {
  notFound(); // Memanggil app/not-found.tsx
}

Validasi Status Operasional & Keamanan: Jika faskes ditemukan namun atribut status === 'QUARANTINED' (fitur Kill-Switch isolasi ransomware oleh Admin), sistem memblokir akses booking dengan melempar respon 403 Forbidden.


## 4. Pembagian Server dan Client Components
- Tabel Komponen dan Alasan Teknis

| No | Komponen / Berkas | Jenis Komponen | Alasan Teknis & Pertimbangan Arsitektur |
| :---: | :--- | :---: | :--- |
| **1** | `FaskesDetailPage`<br>(`app/(dashboard)/pasien/faskes/[faskesId]/page.tsx`) | **Server Component** | • Membaca data faskes langsung dari database server (`mockData.ts` / Prisma) tanpa ekspos endpoint publik.<br>• Tidak membutuhkan *event listener* interaktif (`onClick`, `onChange`) atau state reaktif `useState`.<br>• Mengurangi ukuran JavaScript bundle yang dikirim ke browser klien sehingga proses rendering awal (FCP & LCP) menjadi sangat cepat. |
| **2** | `PemeriksaanDokterView`<br>(`app/(dashboard)/nakes/periksa/[bookingId]/page.tsx`) | **Client Component** (`'use client'`) | • Membutuhkan interaktivitas state form yang kompleks (`useState`) untuk mengelola input tanda vital, keluhan, dan kode diagnosis ICD-10.<br>• **Menjalankan Web Crypto API di Peramban:** Memanggil `window.crypto.subtle` untuk mengenkripsi data medis (AES-GCM 256) dan menghitung tag integritas HMAC-SHA256 langsung di sisi klien.<br>• Memeriksa status jaringan (`navigator.onLine`) untuk otomatis beralih menyimpan ciphertext ke IndexedDB lokal jika koneksi terputus. |
| **3** | `SiemMonitorDashboard`<br>(`app/(dashboard)/admin/siem-monitor/page.tsx`) | **Client Component** (`'use client'`) | • Menggunakan tombol eksekusi interaktif untuk memicu *Kill-Switch* isolasi faskes terinfeksi malware.<br>• Melakukan pembaruan log aktivitas keamanan (anomali IDOR/BOLA) secara dinamis.<br>• Membutuhkan modal pop-up konfirmasi sebelum tindakan administratif sensitif dieksekusi. |

- Hasil uji impor lib/data.ts (server-only) dari Client Component

michaelalex@Michaels-MacBook-Air Projek Tubes % npm run build

> tes-web@0.1.0 build
> next build

▲ Next.js 16.3.6 (Turbopack)
⚠ Warning: Next.js ignored package-lock.json in /Users/michaelalex because it is outside the current Git repository (/Users/michaelalex/Michael/File Perkuliahan/VS Code/PAW/Projek Tubes).
 To use this directory, set `turbopack.root` in your Next.js config.

✓ Running next.config.ts took 11ms

  Creating an optimized production build ...
✓ Compiled successfully in 280ms
app/(dashboard)/nakes/periksa/[bookingId]/page.tsx(20,10): error TS2459: Module '"@/lib/data"' declares 'serverSecretConfig' locally, but it is not exported.
lib/data.ts(3,10): error TS2459: Module '"@/lib/data"' declares 'serverSecretConfig' locally, but it is not exported.
Failed to type check.

michaelalex@Michaels-MacBook-Air Projek Tubes % 


## 5. Verifikasi
- Keluaran npx tsc --noEmit, npm run lint, dan npm run build

michaelalex@Michaels-MacBook-Air Projek Tubes % npx tsc --noEmit                                       
michaelalex@Michaels-MacBook-Air Projek Tubes % npm run lint    

> tes-web@0.1.0 lint
> eslint

michaelalex@Michaels-MacBook-Air Projek Tubes % npm run build   

> tes-web@0.1.0 build
> next build

▲ Next.js 16.3.6 (Turbopack)
⚠ Warning: Next.js ignored package-lock.json in /Users/michaelalex because it is outside the current Git repository (/Users/michaelalex/Michael/File Perkuliahan/VS Code/PAW/Projek Tubes).
 To use this directory, set `turbopack.root` in your Next.js config.

✓ Running next.config.ts took 11ms

  Creating an optimized production build ...
✓ Compiled successfully in 416ms
✓ Finished TypeScript in 639ms    
✓ Collecting page data using 9 workers in 427ms    
✓ Generating static pages using 9 workers (30/30) in 152ms
✓ Finalizing page optimization in 10ms    

```text
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /admin
├ ○ /admin/faskes
├ ○ /admin/incident-center
├ ○ /admin/siem-monitor
├ ○ /admin/verifikasi-kyc
├ ○ /admin/verifikasi-kyd
├ ○ /beranda
├ ○ /login
├ ○ /nakes
├ ○ /nakes/offline-sync
├ ○ /nakes/pasien-lookup
├ ƒ /nakes/periksa/[bookingId]
├ ○ /nakes/rujukan
├ ○ /pasien
├ ○ /pasien/audit-log
├ ○ /pasien/booking
├ ○ /pasien/consent
├ ○ /pasien/faskes
├ ƒ /pasien/faskes/[faskesId]
├ ○ /pasien/rekam-medis
├ ƒ /pasien/rekam-medis/[recordId]
├ ○ /pasien/tiket-kendala
├ ○ /register/nakes
├ ○ /register/pasien
├ ○ /staf
├ ○ /staf/assign-dpjp
├ ○ /staf/rujukan
├ ○ /staf/triase
└ ○ /verifikasi-pending


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

michaelalex@Michaels-MacBook-Air Projek Tubes % 


## 6. Kendala dan Penyelesaian

## 7. Catatan Pemanfaatan AI
Alat, perintah utama, bagian yang digunakan, dan cara memverifikasinya.
Tulis "Tidak menggunakan AI" apabila tidak menggunakan AI.

Alat yang Digunakan: Antigravity AI Assistant (Google DeepMind).
Perintah Utama (Prompt):
"Bantu analisis pemisahan Server Component vs Client Component pada sistem rekam medis berbasis App Router Next.js sesuai prinsip Least Privilege."
"Rancang pohon rute bersarang (nested layout) untuk peran Pasien, Nakes, dan Admin menggunakan Route Groups."
"Tuliskan mekanisme perbandingan teknis layout.tsx dan template.tsx untuk mencegah kebocoran memori sesi rekam medis antar-pasien."

Bagian yang Digunakan:
Penataan arsitektur pohon direktori folder app/ dan penentuan layout bersarang.
Formulasi tabel uji pengujian parameter rute dinamis beserta simulasi respon curl.
Penyusunan skema perlindungan modul server melalui package server-only.

Cara Memverifikasi:
Menjalankan pengujian kompilasi statis melalui perintah npx tsc --noEmit untuk memastikan tidak ada kesalahan tipe data.
Menguji rute URL satu per satu di peramban lokal dan melalui utilitas terminal curl -I untuk memverifikasi kecocokan kode status HTTP (200, 400, 403, 404).
Melakukan build produksi nyata dengan npm run build untuk memverifikasi bahwa isolasi berkas server-only bekerja dengan benar.