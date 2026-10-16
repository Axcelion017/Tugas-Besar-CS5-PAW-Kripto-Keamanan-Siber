# Risk Register & Rencana Kontrol — Resilio-Health

Dokumen ini mendokumentasikan analisis kemungkinan, tingkat dampak, serta rencana kontrol mitigasi dari **5 Risiko Prioritas Utama** pada sistem Resilio-Health, didasarkan pada data insiden nyata (kasus Change Healthcare dan data kerentanan BSSN 2026).

---

## Tabel Risiko Prioritas Sistem

| No | ID Risiko | Ancaman Terkait | Alasan Kemungkinan & Dampak Nyata | Nilai Risiko | Rencana Kontrol & Alokasi Milestone |
| :-: | :--- | :--- | :--- | :-: | :--- |
| **1** | **RSK-01** | THR-04 (Info Disclosure EHR) | **Kemungkinan Sedang**: Basis data pusat rumah sakit sering menjadi target eksfiltrasi peretas internal/eksternal.<br>**Dampak Kritis**: Kebocoran riwayat penyakit, diagnosis HIV/kanker, dan resep obat melanggar UU PDP dan menghancurkan reputasi faskes secara permanen. | **Kritis** | **Milestone 1 & 2**: Penerapan **AES-256-GCM** sisi klien. Server pusat dan admin basis data hanya menyimpan *opaque ciphertext* (*Zero-Knowledge Storage*). Data hanya bisa didekripsi di browser pasien atau dokter berizin. |
| **2** | **RSK-02** | THR-02 (Data Tampering EHR) | **Kemungkinan Tinggi**: Data yang disimpan di perangkat lokal (saat offline) atau saat transit jaringan rentan disunting melalui DevTools atau malware *man-in-the-middle*.<br>**Dampak Kritis**: Manipulasi dosis obat atau riwayat alergi memicu malpraktik medis dan kematian pasien. | **Kritis** | **Milestone 1 & 2**: Penerapan **HMAC-SHA256** (RFC 2104). Setiap ciphertext diberi tag integritas; server pusat menolak sinkronisasi dan klien menolak dekripsi jika terjadi perubahan 1 bit (*Fail-Closed*). |
| **3** | **RSK-03** | THR-06 (BOLA / IDOR API Breach) | **Kemungkinan Sangat Tinggi**: Mendominasi 96% celah web kesehatan di Indonesia; penyerang cukup menebak ID pasien di URL `/api/v1/records/pasien-123` untuk mengunduh rekam medis orang lain.<br>**Dampak Kritis**: Eksfiltrasi rekam medis ratusan ribu pasien sekaligus tanpa memicu alarm otentikasi standar. | **Kritis** | **Milestone 2 & 3**: Penerapan **Zero-Trust BOLA / IDOR Guard**. Setiap permintaan data medis memverifikasi token dokter DAN memeriksa relasi izin aktif (`access_grants`) terhadap pasien terkait. Akses tidak sah diblokir 403 Forbidden dan dicatat ke SIEM. |
| **4** | **RSK-04** | THR-05 (Downtime Chaos / Ransomware) | **Kemungkinan Tinggi**: Ketergantungan faskes pada server cloud pusat (seperti SATUSEHAT) menyebabkan klinik lumpuh total saat internet mati atau server diserang ransomware.<br>**Dampak Kritis**: Dokter kehilangan akses ke riwayat pasien gawat darurat, penanganan medis terhenti total. | **Tinggi** | **Milestone 2**: Arsitektur **Offline-First PWA** dengan Service Worker dan IndexedDB lokal. Stasiun kerja dokter tetap dapat membuka data antrean terenkripsi dan menulis RME saat koneksi putus, lalu otomatis disinkronkan saat pulih. |
| **5** | **RSK-05** | THR-01 & THR-08 (Spoofing / Dokter Gadungan) | **Kemungkinan Sedang**: Ketiadaan verifikasi dokumen kependudukan memungkinkan akun pasien fiktif; dokter gadungan menyusup tanpa STR/SIP resmi.<br>**Dampak Tinggi**: Polusi data medis nasional, malpraktik oleh pihak tidak berwenang, dan pencurian identitas. | **Tinggi** | **Milestone 2**: Sistem **Verifikasi KYC (KTP/NIK)** dan **KYD (STR & SIP)** oleh Admin Regulator Kemenkes. Akun baru berstatus `PENDING` dan dibatasi secara ketat hingga dokumen fisiknya divalidasi sah. |

---

## Matriks Evaluasi Risiko (Risk Heatmap)

```text
Dampak (Impact)
  ▲
K | [RSK-04]          | [RSK-01, RSK-02]  | [RSK-03: BOLA/IDOR]
T |                   | [RSK-05: KYC/KYD] |
S |                   |                   |
R |                   |                   |
  +------------------------------------------------►
    Rendah              Sedang              Tinggi
                   Kemungkinan (Likelihood)
```

- **Kritis (Merah)**: RSK-01 (Kebocoran EHR), RSK-02 (Manipulasi Rekam Medis), RSK-03 (BOLA / IDOR).
- **Tinggi (Kuning/Oranye)**: RSK-04 (Downtime Chaos / Ransomware), RSK-05 (Akun Fiktif & Dokter Gadungan).
