"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import { encryptAES } from "@/lib/crypto/aes";
import { generateHMAC } from "@/lib/crypto/hmac";
import { deriveSubKeysHKDF } from "@/lib/crypto/hkdf";
import {
  encryptMedicalRecordPayload,
  isValidMasterKeyHex,
} from "@/features/medical-records/crypto-service";
import { Appointment, Patient, EncryptedMedicalImage } from "@/lib/db/mockData";
import { PemeriksaanKlinisSchema } from "@/lib/validations/clinical";
import {
  submitPemeriksaanKlinisAction,
  getAppointmentForExamServerAction,
} from "@/lib/actions/clinical";
import { saveToOutbox } from "@/lib/storage/indexedDb";
import {
  ICD10_MAP,
  buildCanonicalSoapPayload,
} from "@/features/medical-records/exam/exam-builders";

export { ICD10_MAP };

function generateRecordId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

export function useExamForm(bookingId: string) {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);

  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [gcsEye, setGcsEye] = useState("4");
  const [gcsVerbal, setGcsVerbal] = useState("5");
  const [gcsMotor, setGcsMotor] = useState("6");
  const [icd9Procedure, setIcd9Procedure] = useState("89.52");
  const [dischargeDisposition, setDischargeDisposition] = useState("PULANG_SEHAT_KONTROL");
  const [subjective, setSubjective] = useState("");
  const [systolic, setSystolic] = useState("120");
  const [diastolic, setDiastolic] = useState("80");
  const [heartRate, setHeartRate] = useState("75");
  const [temperature, setTemperature] = useState("36.5");
  const [spo2, setSpo2] = useState("98");
  const [icd10, setIcd10] = useState("I10");
  const [planPrescription, setPlanPrescription] = useState("");
  const [planAction, setPlanAction] = useState("");

  const [attachedImages, setAttachedImages] = useState<EncryptedMedicalImage[]>([]);
  const [selectedImageType, setSelectedImageType] = useState<"RONTGEN" | "USG" | "LAB" | "EKG">("RONTGEN");
  const [imageTitle, setImageTitle] = useState("");

  const [isAddendum, setIsAddendum] = useState(false);
  const [addendumReason, setAddendumReason] = useState("");
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [berikanSuratSakit, setBerikanSuratSakit] = useState(false);
  const [lamaHariSakit, setLamaHariSakit] = useState("3");
  const [isRujukan, setIsRujukan] = useState(false);
  const [rujukanFaskesId, setRujukanFaskesId] = useState("FAS-02");
  const [rujukanDokterId, setRujukanDokterId] = useState("DOC-02");
  const [rujukanUrgensi, setRujukanUrgensi] = useState("Mendesak (24 Jam)");
  const [rujukanTujuan, setRujukanTujuan] = useState("RS Harapan Sehat");
  const [rujukanAlasan, setRujukanAlasan] = useState("Evaluasi lanjut spesialis");
  const [jadwalKontrol, setJadwalKontrol] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split("T")[0];
  });

  const [isMedicallyConfirmed, setIsMedicallyConfirmed] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllergyConfirmModal, setShowAllergyConfirmModal] = useState(false);

  const hasUnsavedChanges =
    !isSubmitting &&
    !submitStatus?.startsWith("SUKSES") &&
    !submitStatus?.startsWith("MODE OFFLINE") &&
    (planPrescription.trim().length > 0 || planAction.trim().length > 0 || attachedImages.length > 0);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    let mounted = true;
    async function loadExamContext() {
      const s = getUserSession();
      if (!s) {
        if (mounted) setIsLoading(false);
        return;
      }
      if (mounted) setSession(s);

      try {
        const dbRes = await getAppointmentForExamServerAction(bookingId);
        if (mounted && dbRes.success && dbRes.data) {
          const { appointment: dbApt, patient: dbPatient } = dbRes.data;
          setAppointment(dbApt as unknown as Appointment);
          setSubjective(dbApt.keluhanAwal || "");
          if (dbApt.triaseVitals) {
            setSystolic(String(dbApt.triaseVitals.systolic));
            setDiastolic(String(dbApt.triaseVitals.diastolic));
            setHeartRate(String(dbApt.triaseVitals.heartRate));
            setTemperature(String(dbApt.triaseVitals.temperature));
            setSpo2(String(dbApt.triaseVitals.spo2));
          }
          setPatient(dbPatient as unknown as Patient);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Exam DB load error:", err);
      }

      if (mounted) {
        setNotFound(true);
        setIsLoading(false);
      }
    }

    void loadExamContext();
    return () => {
      mounted = false;
    };
  }, [bookingId]);

  const patientAllergies = Array.isArray(patient?.allergies) ? patient.allergies : [];
  const detectedAllergies = patientAllergies.filter((al) =>
    planPrescription.toLowerCase().includes(al.toLowerCase())
  );

  const clearFieldError = (field: string) => {
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const cp = { ...prev };
        delete cp[field];
        return cp;
      });
    }
  };

  const handleAddSampleImage = async () => {
    if (!patient) return;
    const title = imageTitle.trim() || `Pemeriksaan ${selectedImageType} Klinis`;
    if (!isValidMasterKeyHex(patient.encryptionKeyHex)) {
      setSubmitStatus("GALAT KRIPTOGRAFI (Fail-Closed): Kunci enkripsi 256-bit pasien tidak tersedia.");
      return;
    }

    const imgId = `IMG-${Date.now().toString().slice(-6)}`;
    const aad = `ATTACHMENT:${imgId}|PATIENT:${patient.id}`;
    const { encKeyHex, macKeyHex } = await deriveSubKeysHKDF(patient.encryptionKeyHex, patient.id);
    const { ciphertext, iv } = await encryptAES(`BINARY_${selectedImageType}_${Date.now()}`, encKeyHex, aad);
    const hmacTag = await generateHMAC(ciphertext, macKeyHex);

    setAttachedImages((prev) => [
      ...prev,
      {
        id: imgId,
        title,
        type: selectedImageType,
        encryptedBlobHex: ciphertext,
        ivHex: iv,
        hmacDigest: hmacTag,
        mimeType: "image/jpeg",
        timestamp: new Date().toLocaleTimeString("id-ID"),
        notes: "Terenkripsi HKDF + AES-256-GCM + AAD + HMAC",
      },
    ]);
    setImageTitle("");
  };

  const executeSaveAndSign = async () => {
    if (!session || !appointment || !patient) return;
    setShowAllergyConfirmModal(false);

    if (!isValidMasterKeyHex(patient.encryptionKeyHex)) {
      setSubmitStatus("GALAT KRIPTOGRAFI (Fail-Closed): Kunci 256-bit pasien tidak tersedia.");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const newRecordId = generateRecordId("REC");
      const version = isAddendum ? 2 : 1;
      const payloadObj = buildCanonicalSoapPayload({
        session, appointment, patient, subjective, systolic, diastolic, heartRate, temperature,
        spo2, icd10, planPrescription, planAction, gcsEye, gcsVerbal, gcsMotor, icd9Procedure,
        dischargeDisposition, berikanSuratSakit, lamaHariSakit, isRujukan, rujukanFaskesId,
        rujukanDokterId, rujukanUrgensi, rujukanTujuan, rujukanAlasan, jadwalKontrol,
        isAddendum, addendumReason,
      });

      const bundle = await encryptMedicalRecordPayload(payloadObj, patient.encryptionKeyHex, {
        patientId: patient.id,
        recordId: newRecordId,
        version,
      });

      const isOfflineMode =
        localStorage.getItem("resilio_network_mode") === "offline" || !navigator.onLine;

      if (isOfflineMode) {
        await saveToOutbox({
          recordId: newRecordId,
          encounterId: appointment.id,
          patientId: patient.id,
          patientName: patient.name,
          faskesId: appointment.faskesId,
          faskesNama: appointment.faskesNama,
          dokterNama: session.name,
          primaryIcd10: icd10,
          diagnosisShort: ICD10_MAP[icd10] || "Pemeriksaan Rawat Jalan",
          encryptedPayload: bundle.encryptedPayload,
          ivHex: bundle.ivHex,
          hmacDigest: bundle.hmacDigest,
          version,
          clientCreatedAt: new Date().toISOString(),
          status: "PENDING_SYNC",
          retryCount: 0,
        });

        setSubmitStatus(
          `MODE OFFLINE (IndexedDB): Berkas ${newRecordId} terenkripsi AEAD+HMAC tersimpan aman di resilio_offline_db dan siap disinkronkan via /api/sync/outbox.`
        );
      } else {
        const fd = new FormData();
        fd.append("recordId", newRecordId);
        fd.append("patientId", patient.id);
        fd.append("bookingId", appointment.id);
        fd.append("subjective", subjective);
        fd.append("systolic", String(systolic));
        fd.append("diastolic", String(diastolic));
        fd.append("heartRate", String(heartRate));
        fd.append("temperature", String(temperature));
        fd.append("respiratoryRate", "20");
        fd.append("spo2", String(spo2));
        fd.append("icd10", icd10);
        fd.append("assessment", ICD10_MAP[icd10] || "Pemeriksaan Medis Rawat Jalan");
        fd.append("planPrescription", planPrescription);
        fd.append("planAction", planAction || "Kontrol 1 minggu kemudian");
        fd.append("encryptedPayload", bundle.encryptedPayload);
        fd.append("ivHex", bundle.ivHex);
        fd.append("hmacDigest", bundle.hmacDigest);
        fd.append("isAddendum", isAddendum ? "true" : "false");
        if (addendumReason) fd.append("addendumReason", addendumReason);
        if (detectedAllergies.length > 0) fd.append("forceOverrideAllergy", "true");
        fd.append("isMedicallyConfirmed", "true");
        fd.append("skipRedirect", "true");

        const saRes = await submitPemeriksaanKlinisAction(null, fd);
        if (!saRes.success) {
          setSubmitStatus(`GAGAL SIMPAN SERVER: ${saRes.message || "Terjadi kesalahan otorisasi."}`);
          return;
        }

        setSubmitStatus(
          "SUKSES: Rekam medis berhasil dienkripsi (HKDF + AES-256-GCM + AAD + HMAC-SHA256) dan disimpan ke PostgreSQL."
        );
      }

      setTimeout(() => router.push("/nakes"), 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitStatus(`GALAT: Gagal memproses kriptografi / penyimpanan: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAndSign = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    const validationResult = PemeriksaanKlinisSchema.safeParse({
      subjective,
      systolic: Number(systolic),
      diastolic: Number(diastolic),
      heartRate: Number(heartRate),
      temperature: Number(temperature),
      spo2: Number(spo2),
      icd10,
      planPrescription,
      planAction: planAction || undefined,
      isMedicallyConfirmed,
    });

    if (!validationResult.success) {
      const formattedErrors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        const key = issue.path[0]?.toString() || "form";
        if (!formattedErrors[key]) formattedErrors[key] = issue.message;
      }
      setValidationErrors(formattedErrors);
      return;
    }

    if (detectedAllergies.length > 0) {
      setShowAllergyConfirmModal(true);
      return;
    }

    await executeSaveAndSign();
  };

  return {
    session, appointment, patient, activeTab, setActiveTab,
    gcsEye, setGcsEye, gcsVerbal, setGcsVerbal, gcsMotor, setGcsMotor,
    icd9Procedure, setIcd9Procedure, dischargeDisposition, setDischargeDisposition,
    subjective, setSubjective, systolic, setSystolic, diastolic, setDiastolic,
    heartRate, setHeartRate, temperature, setTemperature, spo2, setSpo2,
    icd10, setIcd10, planPrescription, setPlanPrescription, planAction, setPlanAction,
    attachedImages, selectedImageType, setSelectedImageType, imageTitle, setImageTitle,
    isAddendum, setIsAddendum, addendumReason, setAddendumReason,
    isPrintOpen, setIsPrintOpen, berikanSuratSakit, setBerikanSuratSakit,
    lamaHariSakit, setLamaHariSakit, isRujukan, setIsRujukan,
    rujukanFaskesId, setRujukanFaskesId, rujukanDokterId, setRujukanDokterId,
    rujukanUrgensi, setRujukanUrgensi, rujukanTujuan, setRujukanTujuan,
    rujukanAlasan, setRujukanAlasan, jadwalKontrol, setJadwalKontrol,
    isMedicallyConfirmed, setIsMedicallyConfirmed, validationErrors, clearFieldError,
    isSubmitting, submitStatus, setSubmitStatus, notFound, isLoading,
    showAllergyConfirmModal, setShowAllergyConfirmModal,
    patientAllergies, detectedAllergies,
    handleAddSampleImage, handleSaveAndSign, executeSaveAndSign,
  };
}
