# SYSTEM SPECIFICATION & TECHNICAL BLUEPRINT: RESILIO-HEALTH
**Project Type:** Cryptographic Offline-First Hospital Information System (HIS) & Integrated Electronic Health Record (EHR / RME)
**Regulatory Standard:** Permenkes RI No. 24 Tahun 2022 (Rekam Medis), UU PDP No. 27 Tahun 2022, & Standar Interoperabilitas SATUSEHAT (HL7 FHIR Readiness)
**Core Pillars:**
1. **Web Development (PAW):** Progressive Web App (PWA), Service Workers, IndexedDB Offline Queue, Background Sync API, Real-Time Multi-Role Dashboards.
2. **Cryptography:** Client-Side Encryption AES-GCM 256 (Web Crypto API), PBKDF2 / Envelope Key Management, HMAC-SHA256 Payload & Binary Image Integrity, HKDF (RFC 5869) Key Separation.
3. **Cyber Security:** Zero-Trust API Gateway, Contextual BOLA/IDOR Defense, Break-Glass Emergency Access Protocol, Auto-Watermarked e-KYC/e-KYD, Immutable Addendum-Only Audit Trail.

---

## 1. ROLE-BASED ACCESS CONTROL (RBAC) & SEPARATION OF DUTIES

Sistem menerapkan 4 Role pengguna dengan pemisahan wewenang ketat (Least Privilege):

1. **`PATIENT` (Pasien / Wali Keluarga):**
   - Mengelola akun berbasis NIK (termasuk sub-profil anak/tanggungan dalam 1 Kartu Keluarga).
   - Mencari faskes berdasarkan lokasi, spesialisasi, atau keluhan penyakit, melihat jadwal dokter, dan melakukan booking pemeriksaan.
   - Mengelola izin akses rekam medis (*Active Consent* / *Revoke Access*), melihat riwayat medis lengkap (termasuk grafik tanda vital & gambar penunjang), serta memantau *Personal Audit Trail*.
2. **`NURSE_STAFF` (Staf Nakes Faskes - Admisi, Perawat Triase, & Staf Rujukan):**
   - Mengelola *check-in* antrean pasien, mengisi & memvalidasi **Dokumentasi Administratif Pendaftaran** (asal rujukan, penjamin BPJS/Asuransi).
   - Menginput pemeriksaan awal (**Triase, Tanda Vital dasar, & Anamnesis awal**) di dalam mode Online maupun Offline.
   - Mengarahkan pasien ke Dokter Penanggung Jawab Pelayanan (**Assign DPJP**) untuk mengaktifkan tiket akses dokter, serta memproses administrasi rujukan masuk/keluar dan pemberkasan klaim.
   - **Batasan Keamanan:** Hanya dapat melihat biodata administratif, tanda vital kunjungan saat ini, dan *alert* alergi. Dilarang mendekripsi riwayat diagnosis/klinis masa lalu yang bersifat sensitif.
3. **`DOCTOR` (Dokter Pemeriksa / DPJP - Dokter Penanggung Jawab Pelayanan):**
   - Membaca dan menginput **Dokumentasi Klinis Lengkap** (Anamnesis, Fisik, Alergi, Diagnosis ICD-10, Penunjang/Gambar Medis, Resep Obat, Tindakan ICD-9-CM, CPPT/SOAP, Resume Medis, dan Data Medis Klaim) baik saat **Online** maupun **Offline Mode**.
   - **Batasan Keamanan (Anti-BOLA/IDOR):** Hanya dapat mengakses dan mendekripsi RME pasien apabila memiliki `ACTIVE_ENCOUNTER_TICKET` (dari booking/triase yang disetujui pasien) ATAU mengeksekusi protokol darurat **`BREAK_GLASS`** di IGD.
   - Rekam medis yang telah disahkan bersifat *immutable* (tidak dapat dihapus/ditimpa); koreksi wajib menggunakan mekanisme **Addendum** (penambahan versi baru).
4. **`ADMIN` (Regulator Pemerintah / Verifikator Sistem & Pengawas Keamanan):**
   - Memverifikasi keaslian identitas pengguna melalui dokumen bergambar: **e-KYC Pasien** (Foto KTP + Selfie Wajah) dan **e-KYD Nakes/Dokter** (Foto KTP, Wajah, Scan STR, Scan SIP, SK Faskes).
   - Mengelola master data Faskes, memantau log keamanan siber (percobaan serangan BOLA/IDOR, kegagalan validasi HMAC, aktivasi *Break-Glass*), serta menangani antrean kendala sinkronisasi (*Failed Sync Queue*) dan laporan *bug*.
   - **Batasan Keamanan (Zero-Knowledge Clinical Data):** Admin **TIDAK MEMILIKI KUNCI DEKRIPSI** untuk membaca isi Dokumentasi Klinis pasien. Admin hanya melihat metadata sistem, status sinkronisasi, dan dokumen verifikasi identitas.

---

## 2. STRUKTUR DATA REKAM MEDIS ELEKTRONIK (STANDAR PERMENKES NO. 24 TAHUN 2022)

Struktur data RME terbagi secara tegas menjadi **2 Kelompok Besar**: **Dokumentasi Administratif** dan **Dokumentasi Klinis**, lengkap dengan pemetaan kesiapan integrasi **SATUSEHAT**.

### A. KELOMPOK 1: DOKUMENTASI ADMINISTRATIF (`AdministrativeRecord`)
Disimpan sebagai data terstruktur di database pusat untuk keperluan identifikasi, pencarian berbasis hash NIK, manajemen antrean faskes, rujukan, dan administrasi klaim pembiayaan.

```typescript
export interface AdministrativeRecord {
  // 1. Identitas Lengkap Pasien
  patientIdentity: {
    patientId: string;              // UUID internal
    satusehatIhsNumber?: string;    // ID Pasien Nasional (SATUSEHAT IHS Number)
    nik: string;                    // 16 digit (Di-indeks menggunakan HMAC-SHA256 blind index untuk pencarian cepat & aman)
    kkNumber?: string;              // Nomor Kartu Keluarga (untuk relasi akun tanggungan anak/lansia)
    fullName: string;
    birthDate: string;              // ISO 8601 (YYYY-MM-DD)
    birthPlace: string;
    gender: 'MALE' | 'FEMALE';
    bloodType?: 'A' | 'B' | 'AB' | 'O' | 'UNKNOWN';
    rhesus?: '+' | '-' | 'UNKNOWN';
    address: {
      ktpAddress: string;
      domicileAddress: string;
      province: string;
      cityRegency: string;
      district: string;
      subDistrict: string;
      postalCode: string;
    };
    phoneNumber: string;
    email?: string;
    emergencyContact: {
      name: string;
      relationship: 'SPOUSE' | 'PARENT' | 'CHILD' | 'SIBLING' | 'OTHER';
      phoneNumber: string;
    };
  };

  // 2. Data Demografis dan Sosial
  demographicSocial: {
    maritalStatus: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
    religion: string;
    educationLevel: string;
    occupation: string;
    citizenship: 'WNI' | 'WNA';
    ethnicity?: string;
    preferredLanguage: string;
  };

  // 3. Dokumentasi Pendaftaran Kunjungan (Encounter Registration)
  registrationData: {
    encounterId: string;            // UUID Kunjungan
    satusehatEncounterId?: string;  // ID Encounter SATUSEHAT
    faskesId: string;               // Kode Faskes (RS/Klinik/Puskesmas)
    registrationTimestamp: string;  // ISO 8601 Date-Time
    visitType: 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY_IGD' | 'REFERRAL';
    polyclinicTarget: string;       // Poli Tujuan (misal: Poli Penyakit Dalam, Kardiologi, Umum)
    assignedDpjpDoctorId: string;   // ID Dokter Penanggung Jawab Pelayanan (DPJP)
    attendingNurseStaffId?: string; // ID Staf Nakes Triase/Admisi yang memproses pendaftaran
    referralOrigin?: {
      isReferred: boolean;
      originFaskesId?: string;
      originFaskesName?: string;
      referralLetterNumber?: string;
      referralDoctorName?: string;
      referralInitialDiagnosisIcd10?: string;
    };
    paymentGuarantor: {
      guarantorType: 'UMUM_MANDIRI' | 'BPJS_KESEHATAN' | 'ASURANSI_SWASTA' | 'JAMINAN_PERUSAHAAN';
      bpjsNumber?: string;          // Nomor Kartu BPJS
      sepNumber?: string;           // Nomor Surat Eligibilitas Peserta (SEP BPJS)
      insuranceProviderName?: string;
      insurancePolicyNumber?: string;
    };
  };
}
```

### B. KELOMPOK 2: DOKUMENTASI KLINIS (`ClinicalRecordPayload`)

Berisi seluruh catatan pelayanan medis yang diberikan oleh tenaga kesehatan (dokter, perawat, bidan, dan tenaga medis lain).
**ATURAN KRIPTOGRAFI WAJIB:** Seluruh objek `ClinicalRecordPayload` di bawah ini **WAJIB dienkripsi di sisi klien (Browser)** menggunakan **AES-GCM 256** sebelum disimpan ke `IndexedDB` (saat *offline*) maupun sebelum dikirim ke PostgreSQL Server (saat *online*), serta wajib ditandatangani dengan **HMAC-SHA256** untuk verifikasi integritas.

```typescript
export interface ClinicalRecordPayload {
  recordId: string;                 // UUID Rekam Medis
  encounterId: string;              // Relasi ke Dokumentasi Pendaftaran
  patientId: string;
  faskesId: string;
  createdAt: string;                // ISO 8601 Timestamp
  version: number;                  // Dimulai dari 1. Jika ada koreksi (Addendum), naik menjadi 2, dst.
  parentRecordId?: string;          // Mengacu ke recordId sebelumnya jika dokumen ini adalah Addendum
  addendumReason?: string;          // Alasan revisi medis (Wajib diisi jika version > 1)

  // Atribusi Kredensial Tenaga Kesehatan (Wajib untuk Keabsahan Hukum RME)
  practitionerAttribution: {
    dpjpDoctorId: string;
    dpjpDoctorName: string;
    dpjpStrNumber: string;          // Nomor Surat Tanda Registrasi Dokter
    dpjpSipNumber: string;          // Nomor Surat Izin Praktik Dokter
    triageNurseId?: string;
    triageNurseName?: string;
    triageNurseStrNumber?: string;
  };

  // 1. Anamnesis / Keluhan
  anamnesis: {
    chiefComplaint: string;         // Keluhan Utama
    historyOfPresentIllness: string;// Riwayat Penyakit Sekarang (RPS)
    pastMedicalHistory: string[];   // Riwayat Penyakit Dahulu (RPD)
    familyMedicalHistory: string[]; // Riwayat Penyakit Keluarga (RPK)
    socialHabitHistory?: string;    // Riwayat kebiasaan (merokok, aktivitas fisik, dll.)
  };

  // 2. Hasil Pemeriksaan Fisik & Tanda-Tanda Vital (Vital Signs)
  physicalExamination: {
    triageLevel: 'GREEN_NON_URGENT' | 'YELLOW_URGENT' | 'RED_EMERGENCY' | 'BLACK_DECEASED';
    generalCondition: 'BAIK' | 'SEDANG' | 'LEMAH' | 'KRITIS';
    consciousnessLevel: 'COMPOS_MENTIS' | 'APATIS' | 'SOMNOLEN' | 'SOPOR' | 'COMA';
    gcsScore: { eye: number; verbal: number; motor: number; total: number }; // Skor GCS (3-15)
    vitalSigns: {
      systolicBpMmHg: number;       // Tekanan Darah Sistolik
      diastolicBpMmHg: number;      // Tekanan Darah Diastolik
      heartRateBpm: number;         // Frekuensi Nadi / Detak Jantung (x/menit)
      respiratoryRateRpm: number;   // Laju Pernapasan (x/menit)
      temperatureCelsius: number;   // Suhu Tubuh (°C)
      oxygenSaturationSpO2: number; // Saturasi Oksigen (%)
      weightKg: number;             // Berat Badan (kg)
      heightCm: number;             // Tinggi Badan (cm)
      bmi: number;                  // Indeks Massa Tubuh
      painScale: number;            // Skala Nyeri (0-10)
    };
    systemicPhysicalFindings: {
      headNeck?: string;
      thoraxCardioPulmo?: string;
      abdomen?: string;
      extremities?: string;
      neurologicalStatus?: string;
      localizedStatusNotes: string; // Temuan klinis spesifik dari pemeriksaan dokter
    };
  };

  // 3. Riwayat Alergi dan Pengobatan
  allergyAndMedicationHistory: {
    hasKnownAllergies: boolean;
    allergies: Array<{
      allergenCategory: 'DRUG' | 'FOOD' | 'ENVIRONMENT' | 'BIOLOGIC';
      allergenName: string;         // Contoh: "Amoxicillin", "Seafood", "NSAID"
      reactionDescription: string;  // Contoh: "Syok Anafilaktik", "Urtikaria / Ruam Kulit"
      severity: 'MILD' | 'MODERATE' | 'SEVERE_LIFE_THREATENING';
    }>;
    routineMedications: Array<{
      medicationName: string;
      dosage: string;
      frequency: string;
      status: 'ACTIVE_CONSUMING' | 'DISCONTINUED' | 'COMPLETED';
    }>;
  };

  // 4. Diagnosis / Assessment (Standar Kodefikasi ICD-10)
  diagnosisAssessment: {
    primaryDiagnosis: {
      icd10Code: string;            // Contoh: "I10" atau "J06.9"
      icd10DisplayName: string;     // Contoh: "Essential (primary) hypertension"
      clinicalNotes?: string;
    };
    secondaryDiagnoses: Array<{
      icd10Code: string;
      icd10DisplayName: string;
      type: 'COMORBIDITY' | 'COMPLICATION';
    }>;
    differentialDiagnosis?: string; // Diagnosis Banding
    prognosis?: 'BONAM' | 'DUBIA_AD_BONAM' | 'DUBIA_AD_MALAM' | 'MALAM';
  };

  // 5. Hasil Pemeriksaan Penunjang (Lab, Radiologi/Rontgen, USG, MRI, EKG)
  supportingExaminations: Array<{
    examId: string;
    examCategory: 'LABORATORY' | 'RADIOLOGY_XRAY' | 'ULTRASOUND_USG' | 'MRI_CT' | 'ECG' | 'OTHER_DIAGNOSTIC';
    examName: string;               // Contoh: "Rontgen Thorax PA", "Darah Lengkap"
    performedAt: string;
    quantitativeResults?: Array<{
      parameterName: string;        // Contoh: "Hemoglobin", "Leukosit"
      value: string | number;
      unit: string;
      referenceRange: string;
      isAbnormalFlag: boolean;
    }>;
    clinicalInterpretation: string; // Kesan / Ekspertise Dokter Radiologi atau Patologi Klinik
    encryptedAttachments: Array<{
      attachmentId: string;         // Mengacu ke lampiran terenkripsi
      fileName: string;
      mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
      fileSizeBytes: number;
      binaryCiphertextIv: string;   // IV untuk dekripsi AES-GCM file gambar
      binaryHmacSha256: string;     // Hash integritas file biner gambar
    }>;
  }>;

  // 6. Rencana Penatalaksanaan & Pengobatan (Resep Obat & Tindakan Medis)
  treatmentAndManagementPlan: {
    prescriptions: Array<{
      prescriptionItemId: string;
      kfaDrugCode?: string;         // Kode Kamus Farmasi & Alat Kesehatan (SATUSEHAT)
      drugName: string;
      activeIngredient: string;     // Pengecekan otomatis kontraindikasi/alergi obat
      dosageForm: 'TABLET' | 'CAPSULE' | 'SYRUP' | 'INJECTION' | 'TOPICAL' | 'INHALER' | 'DROPS';
      dosageStrength: string;
      signaFrequency: string;
      routeOfAdministration: 'ORAL' | 'INTRAVENOUS' | 'INTRAMUSCULAR' | 'TOPICAL' | 'SUBLINGUAL';
      quantity: number;
      durationDays: number;
      pharmacistNotes?: string;
    }>;
    medicalProcedures: Array<{
      icd9CmCode: string;           // Standar Kode Tindakan Medis ICD-9-CM (Contoh: "89.52" untuk EKG)
      procedureName: string;
      performedByDoctorId: string;
      procedureTimestamp: string;
      procedureReportNotes: string;
      informedConsentSigned: boolean;
    }>;
    patientEducationAndFollowUp: {
      dietAndLifestyleAdvice: string;
      nextControlScheduledDate?: string;
      warningSignsToReturnImmediately: string;
    };
  };

  // 7. Catatan Perkembangan Pasien Terintegrasi (CPPT / Format SOAP)
  cpptEntries: Array<{
    cpptId: string;
    recordedAt: string;
    authorRole: 'DOCTOR' | 'NURSE_STAFF' | 'PHARMACIST' | 'NUTRITIONIST';
    authorId: string;
    authorName: string;
    soap: {
      subjective: string;           // S: Keluhan perkembangan pasien saat ini
      objective: string;            // O: Tanda vital terbaru & hasil observasi fisik/lab
      assessment: string;           // A: Analisis perkembangan status klinis
      plan: string;                 // P: Rencana lanjutan / penyesuaian terapi
    };
    ppaInstructions: string;        // Instruksi khusus untuk Profesional Pemberi Asuhan
    verifiedByDpjp: boolean;
    dpjpVerificationTimestamp?: string;
  }>;

  // 8. Resume Medis (Discharge / Transfer / Referral Summary)
  medicalResume: {
    isFinalized: boolean;
    dischargeDisposition: 'PULANG_SEHAT_KONTROL' | 'PINDAH_RUANG_RAWAT' | 'DIRUJUK_FASKES_LAIN' | 'PULANG_ATAS_PERMINTAAN_SENDIRI' | 'MENINGGAL';
    admissionSummary: string;
    significantFindingsSummary: string;
    finalPrimaryDiagnosisIcd10: string;
    finalProceduresIcd9Cm: string[];
    therapyGivenDuringCare: string;
    conditionAtDischarge: {
      generalState: string;
      vitalSignsSummary: string;
    };
    takeHomeMedicationsSummary: string;
    referralDetails?: {
      destinationFaskesId: string;
      destinationFaskesName: string;
      destinationSpecialistPoly: string;
      clinicalReasonForReferral: string;
      transferStabilityStatus: string;
    };
  };

  // 9. Data Klaim Pembiayaan (BPJS INA-CBGs / Asuransi)
  financingClaimData: {
    claimId: string;
    guarantorType: 'UMUM_MANDIRI' | 'BPJS_KESEHATAN' | 'ASURANSI_SWASTA';
    sepNumber?: string;
    inaCbgsGrouperCode?: string;
    claimedIcd10Codes: string[];
    claimedIcd9CmCodes: string[];
    severityLevel: 'I_RINGAN' | 'II_SEDANG' | 'III_BERAT';
    billingComponents: {
      consultationFeeIdr: number;
      procedureFeeIdr: number;
      laboratoryRadiologyFeeIdr: number;
      medicationFeeIdr: number;
      roomCareFeeIdr: number;
      totalClaimAmountIdr: number;
    };
    claimVerificationStatus: 'DRAFT' | 'READY_FOR_SUBMISSION' | 'SUBMITTED' | 'APPROVED' | 'DISPUTED';
  };
}
```
