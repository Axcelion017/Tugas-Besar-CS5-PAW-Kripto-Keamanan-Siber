# Risk Register & Rencana Kontrol — Resilio-Health

Dokumen ini mendokumentasikan analisis kemungkinan, tingkat dampak, serta rencana kontrol mitigasi dari **Risiko Prioritas Utama** pada sistem Resilio-Health, didasarkan pada data insiden nyata (kasus Change Healthcare 190 juta rekam medis bocor dan data BSSN 2026 bahwa 96% kerentanan berasal dari aplikasi web/IDOR).

---

## Tabel Risiko Prioritas Sistem (RSK-01 s.d. RSK-09)

| No | ID Risiko | Ancaman Terkait | Alasan Kemungkinan & Dampak Nyata | Nilai Risiko | Rencana Kontrol Mitigasi Sistem |
| :-: | :--- | :--- | :--- | :-: | :--- |
| **1** | **RSK-01** | THR-04 (Info Disclosure EHR & Citra Medis) | **Kemungkinan Sedang**: Basis data pusat rumah sakit sering menjadi target eksfiltrasi peretas internal/eksternal.<br>**Dampak Kritis**: Kebocoran riwayat penyakit, diagnosis HIV/kanker, foto rontgen/lab melanggar UU PDP dan menghancurkan reputasi faskes secara permanen. | **Kritis** | **AES-256-GCM Sisi Klien**: Server pusat dan admin basis data hanya menyimpan *opaque ciphertext* (*Zero-Knowledge Storage*). Data teks SOAP dan citra biner radiologi didekripsi murni di peramban pengguna. |
| **2** | **RSK-02** | THR-02 (Data Tampering EHR & Citra Radiologi) | **Kemungkinan Tinggi**: Data yang disimpan di perangkat lokal (saat offline) atau saat transit jaringan rentan disunting melalui DevTools atau malware *man-in-the-middle*.<br>**Dampak Kritis**: Manipulasi dosis obat, riwayat alergi, atau pemotongan bayangan fraktur rontgen memicu malpraktik medis dan kematian pasien. | **Kritis** | **HMAC-SHA256 Fail-Closed**: Setiap ciphertext dan lampiran citra diberi tag integritas; server pusat menolak sinkronisasi dan peramban menolak menampilkan data jika terjadi perubahan 1 bit data. |
| **3** | **RSK-03** | THR-06 (BOLA / IDOR API Breach) | **Kemungkinan Sangat Tinggi**: Mendominasi 96% celah web kesehatan di Indonesia; penyerang cukup menebak ID pasien di URL `/api/v1/records/pasien-123` untuk mengunduh rekam medis orang lain.<br>**Dampak Kritis**: Eksfiltrasi rekam medis ratusan ribu pasien sekaligus tanpa memicu alarm otentikasi standar. | **Kritis** | **Zero-Trust Active Encounter Gate**: Setiap permintaan data medis memverifikasi token dokter DAN memeriksa relasi tiket sesi aktif (`access_grants`) terhadap pasien terkait. Akses tidak sah diblokir 403 Forbidden dan dicatat ke SIEM. |
| **4** | **RSK-04** | THR-05 (Downtime Chaos / Ransomware) | **Kemungkinan Tinggi**: Ketergantungan faskes pada server cloud pusat (seperti SATUSEHAT) menyebabkan klinik lumpuh total saat internet mati atau server diserang ransomware.<br>**Dampak Kritis**: Dokter kehilangan akses ke riwayat pasien gawat darurat, penanganan medis terhenti total. | **Tinggi** | **Offline-First PWA & IndexedDB**: Stasiun kerja dokter tetap dapat membuka data antrean terenkripsi dan menulis RME saat koneksi putus, tersimpan aman di IndexedDB ratusan MB, lalu otomatis disinkronkan saat koneksi pulih. |
| **5** | **RSK-05** | THR-01 & THR-08 (Spoofing / Dokter Gadungan) | **Kemungkinan Sedang**: Ketiadaan verifikasi dokumen memungkinkan akun pasien fiktif; dokter gadungan menyusup tanpa STR/SIP resmi.<br>**Dampak Tinggi**: Polusi data medis nasional, malpraktik oleh pihak tidak berwenang, dan pencurian identitas. | **Tinggi** | **Sistem e-KYC & e-KYD Admin Kemenkes**: Akun baru berstatus `PENDING` dan dibatasi secara ketat hingga dokumen fisik KTP dan STR/SIP divalidasi keabsahannya oleh Admin Regulator. |
| **6** | **RSK-06** | THR-01 (Penyalahgunaan Foto KTP / Pinjol) | **Kemungkinan Tinggi**: Foto KTP pengguna yang diunggah mentah rentan dicuri oknum staf atau disadap untuk pengajuan pinjaman online ilegal.<br>**Dampak Kritis**: Kerugian finansial pasien dan tuntutan hukum pidana atas kegagalan pelindungan data pribadi. | **Kritis** | **Client-Side Canvas Auto-Watermarking**: Sebelum berkas meninggalkan peramban pengguna, sistem otomatis membubuhkan watermark dinamis permanen *"HANYA UNTUK VERIFIKASI RESILIO-HEALTH - [TANGGAL]"*. |
| **7** | **RSK-07** | THR-06 (Penyalahgunaan Break-Glass IGD) | **Kemungkinan Rendah**: Dokter yang memiliki wewenang Break-Glass terdorong mengintip data selebritas atau pejabat tanpa pasien berada di IGD.<br>**Dampak Tinggi**: Pelanggaran kerahasiaan medis pejabat publik dan penurunan kepercayaan masyarakat. | **Tinggi** | **Mandatory Clinical Indication & SIEM Alert**: Dokter wajib memilih indikasi kegawatan klinis; sistem seketika membunyikan High-Severity Alarm di dasbor SIEM Admin Kemenkes dan meneruskan notifikasi darurat ke keluarga pasien. |
| **8** | **RSK-08** | THR-02 (Penghapusan Diagnosa Malpraktik) | **Kemungkinan Sedang**: Dokter atau manajemen faskes mencoba mengubah atau menghapus diagnosis lama untuk menutupi kesalahan penanganan medis.<br>**Dampak Kritis**: Hilangnya barang bukti hukum medikolegal pada investigasi malpraktik klinis. | **Kritis** | **Immutable Addendum (Permenkes 24/2022)**: Rekam medis yang telah ditandatangani bersifat permanen. Koreksi wajib dilakukan melalui penerbitan revisi bertingkat (*Addendum Versi 2*) dengan stempel waktu dan alasan klinis wajib. |
| **9** | **RSK-09** | THR-02 (Kontraindikasi Alergi Fatal) | **Kemungkinan Tinggi**: Dokter terburu-buru atau lupa memeriksa daftar alergi pasien, meresepkan antibiotik Penisilin pada pasien alergi.<br>**Dampak Kritis**: Syok anafilaktik akut, henti nafas, hingga kematian pasien di ruang periksa. | **Kritis** | **Real-Time Contraindication Engine (UR-T10)**: Input resep obat secara aktif memindai daftar alergen pasien; memunculkan banner peringatan merah berkedip seketika saat ada zat yang bertentangan. |

---

## Matriks Evaluasi Risiko (Risk Heatmap)

```text
Dampak (Impact)
  ▲
K | [RSK-04]          | [RSK-01, RSK-02]  | [RSK-03: BOLA/IDOR]
  |                   | [RSK-06, RSK-08]  | [RSK-09: Alergi Obat]
T |                   | [RSK-05: KYC/KYD] |
  |                   | [RSK-07: Break-Glass]
S |                   |                   |
R |                   |                   |
  +------------------------------------------------►
    Rendah              Sedang              Tinggi
                   Kemungkinan (Likelihood)
```

- **Kritis (Merah)**: RSK-01 (Kebocoran EHR), RSK-02 (Manipulasi Rekam Medis), RSK-03 (BOLA / IDOR), RSK-06 (Penyalahgunaan Identitas KTP), RSK-08 (Penghapusan Diagnosa Malpraktik), RSK-09 (Kontraindikasi Alergi Fatal).
- **Tinggi (Kuning/Oranye)**: RSK-04 (Downtime Chaos / Ransomware), RSK-05 (Akun Fiktif & Dokter Gadungan), RSK-07 (Penyalahgunaan Break-Glass IGD).
