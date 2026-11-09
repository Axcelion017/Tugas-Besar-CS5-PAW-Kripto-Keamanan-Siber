// types/ehr.ts
// Standardized Electronic Health Record (RME / EHR) Type Definitions
// Compliant with Permenkes RI No. 24 Tahun 2022 & SATUSEHAT HL7 FHIR Readiness

// =============================================================================
// KELOMPOK 1: DOKUMENTASI ADMINISTRATIF
// =============================================================================

export interface PatientIdentity {
  patientId: string;              // UUID internal
  satusehatIhsNumber?: string;    // ID Pasien Nasional (SATUSEHAT IHS Number)
  nik: string;                    // 16 digit angka
  kkNumber?: string;              // Nomor Kartu Keluarga (relasi tanggungan)
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
}

export interface DemographicSocial {
  maritalStatus: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
  religion: string;
  educationLevel: string;
  occupation: string;
  citizenship: 'WNI' | 'WNA';
  ethnicity?: string;
  preferredLanguage: string;
}

export interface EncounterRegistrationData {
  encounterId: string;            // UUID Kunjungan
  satusehatEncounterId?: string;  // ID Encounter SATUSEHAT
  faskesId: string;               // Kode Faskes
  registrationTimestamp: string;  // ISO 8601 Date-Time
  visitType: 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY_IGD' | 'REFERRAL';
  polyclinicTarget: string;       // Poli Tujuan
  assignedDpjpDoctorId: string;   // ID Dokter DPJP
  attendingNurseStaffId?: string; // ID Staf Nakes Triase/Admisi
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
    bpjsNumber?: string;
    sepNumber?: string;
    insuranceProviderName?: string;
    insurancePolicyNumber?: string;
  };
}

export interface AdministrativeRecord {
  patientIdentity: PatientIdentity;
  demographicSocial: DemographicSocial;
  registrationData: EncounterRegistrationData;
}

// =============================================================================
// KELOMPOK 2: DOKUMENTASI KLINIS TERENKRIPSI (Permenkes 24/2022)
// =============================================================================

export interface PractitionerAttribution {
  dpjpDoctorId: string;
  dpjpDoctorName: string;
  dpjpStrNumber: string;          // Nomor STR Dokter
  dpjpSipNumber: string;          // Nomor SIP Dokter
  triageNurseId?: string;
  triageNurseName?: string;
  triageNurseStrNumber?: string;
}

export interface AnamnesisData {
  chiefComplaint: string;         // Keluhan Utama
  historyOfPresentIllness: string;// Riwayat Penyakit Sekarang (RPS)
  pastMedicalHistory: string[];   // Riwayat Penyakit Dahulu (RPD)
  familyMedicalHistory: string[]; // Riwayat Penyakit Keluarga (RPK)
  socialHabitHistory?: string;    // Riwayat kebiasaan
}

export interface VitalSignsData {
  systolicBpMmHg: number;       // Tekanan Darah Sistolik
  diastolicBpMmHg: number;      // Tekanan Darah Diastolik
  heartRateBpm: number;         // Detak Jantung / Nadi (x/menit)
  respiratoryRateRpm: number;   // Laju Pernapasan (x/menit)
  temperatureCelsius: number;   // Suhu Tubuh (°C)
  oxygenSaturationSpO2: number; // Saturasi Oksigen (%)
  weightKg: number;             // Berat Badan (kg)
  heightCm: number;             // Tinggi Badan (cm)
  bmi: number;                  // Indeks Massa Tubuh
  painScale: number;            // Skala Nyeri (0-10)
}

export interface PhysicalExaminationData {
  triageLevel: 'GREEN_NON_URGENT' | 'YELLOW_URGENT' | 'RED_EMERGENCY' | 'BLACK_DECEASED';
  generalCondition: 'BAIK' | 'SEDANG' | 'LEMAH' | 'KRITIS';
  consciousnessLevel: 'COMPOS_MENTIS' | 'APATIS' | 'SOMNOLEN' | 'SOPOR' | 'COMA';
  gcsScore: { eye: number; verbal: number; motor: number; total: number };
  vitalSigns: VitalSignsData;
  systemicPhysicalFindings: {
    headNeck?: string;
    thoraxCardioPulmo?: string;
    abdomen?: string;
    extremities?: string;
    neurologicalStatus?: string;
    localizedStatusNotes: string;
  };
}

export interface AllergyItem {
  allergenCategory: 'DRUG' | 'FOOD' | 'ENVIRONMENT' | 'BIOLOGIC';
  allergenName: string;         // e.g. "Amoxicillin", "NSAID"
  reactionDescription: string;  // e.g. "Syok Anafilaktik", "Urtikaria"
  severity: 'MILD' | 'MODERATE' | 'SEVERE_LIFE_THREATENING';
}

export interface RoutineMedicationItem {
  medicationName: string;
  dosage: string;
  frequency: string;
  status: 'ACTIVE_CONSUMING' | 'DISCONTINUED' | 'COMPLETED';
}

export interface AllergyAndMedicationHistoryData {
  hasKnownAllergies: boolean;
  allergies: AllergyItem[];
  routineMedications: RoutineMedicationItem[];
}

export interface DiagnosisAssessmentData {
  primaryDiagnosis: {
    icd10Code: string;            // e.g. "I10"
    icd10DisplayName: string;     // e.g. "Essential (primary) hypertension"
    clinicalNotes?: string;
  };
  secondaryDiagnoses: Array<{
    icd10Code: string;
    icd10DisplayName: string;
    type: 'COMORBIDITY' | 'COMPLICATION';
  }>;
  differentialDiagnosis?: string;
  prognosis?: 'BONAM' | 'DUBIA_AD_BONAM' | 'DUBIA_AD_MALAM' | 'MALAM';
}

export interface SupportingExaminationAttachment {
  attachmentId: string;
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  fileSizeBytes: number;
  binaryCiphertextIv: string;   // IV untuk dekripsi file biner
  binaryHmacSha256: string;     // Hash integritas biner
}

export interface SupportingExaminationItem {
  examId: string;
  examCategory: 'LABORATORY' | 'RADIOLOGY_XRAY' | 'ULTRASOUND_USG' | 'MRI_CT' | 'ECG' | 'OTHER_DIAGNOSTIC';
  examName: string;               // e.g. "Rontgen Thorax PA"
  performedAt: string;
  quantitativeResults?: Array<{
    parameterName: string;
    value: string | number;
    unit: string;
    referenceRange: string;
    isAbnormalFlag: boolean;
  }>;
  clinicalInterpretation: string;
  encryptedAttachments: SupportingExaminationAttachment[];
}

export interface PrescriptionItem {
  prescriptionItemId: string;
  kfaDrugCode?: string;         // Kode KFA SATUSEHAT
  drugName: string;
  activeIngredient: string;     // Digunakan untuk deteksi otomatis alergi
  dosageForm: 'TABLET' | 'CAPSULE' | 'SYRUP' | 'INJECTION' | 'TOPICAL' | 'INHALER' | 'DROPS';
  dosageStrength: string;
  signaFrequency: string;
  routeOfAdministration: 'ORAL' | 'INTRAVENOUS' | 'INTRAMUSCULAR' | 'TOPICAL' | 'SUBLINGUAL';
  quantity: number;
  durationDays: number;
  pharmacistNotes?: string;
}

export interface MedicalProcedureItem {
  icd9CmCode: string;           // Standar ICD-9-CM e.g. "89.52" (EKG)
  procedureName: string;
  performedByDoctorId: string;
  procedureTimestamp: string;
  procedureReportNotes: string;
  informedConsentSigned: boolean;
}

export interface TreatmentAndManagementPlanData {
  prescriptions: PrescriptionItem[];
  medicalProcedures: MedicalProcedureItem[];
  patientEducationAndFollowUp: {
    dietAndLifestyleAdvice: string;
    nextControlScheduledDate?: string;
    warningSignsToReturnImmediately: string;
  };
}

export interface CpptEntry {
  cpptId: string;
  recordedAt: string;
  authorRole: 'DOCTOR' | 'NURSE_STAFF' | 'PHARMACIST' | 'NUTRITIONIST';
  authorId: string;
  authorName: string;
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  ppaInstructions: string;
  verifiedByDpjp: boolean;
  dpjpVerificationTimestamp?: string;
}

export interface MedicalResumeData {
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
}

export interface FinancingClaimData {
  claimId: string;
  guarantorType: 'UMUM_MANDIRI' | 'BPJS_KESEHATAN' | 'ASURANSI_SWASTA';
  sepNumber?: string;
  inaCbgsGrouperCode?: string;    // Kode Grouper INA-CBGs
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
}

export interface ClinicalRecordPayload {
  recordId: string;                 // UUID Rekam Medis
  encounterId: string;              // Relasi ke Encounter
  patientId: string;
  faskesId: string;
  createdAt: string;                // ISO 8601 Timestamp
  version: number;                  // Dimulai dari 1; Addendum: 2, 3, dst.
  parentRecordId?: string;          // Jika Addendum
  addendumReason?: string;          // Alasan revisi jika version > 1

  practitionerAttribution: PractitionerAttribution;
  anamnesis: AnamnesisData;
  physicalExamination: PhysicalExaminationData;
  allergyAndMedicationHistory: AllergyAndMedicationHistoryData;
  diagnosisAssessment: DiagnosisAssessmentData;
  supportingExaminations: SupportingExaminationItem[];
  treatmentAndManagementPlan: TreatmentAndManagementPlanData;
  cpptEntries: CpptEntry[];
  medicalResume: MedicalResumeData;
  financingClaimData: FinancingClaimData;
}
