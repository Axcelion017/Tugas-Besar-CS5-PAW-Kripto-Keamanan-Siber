"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserSession, UserSession } from "@/lib/auth/auth";
import { encryptAES } from "@/lib/crypto/aes";
import { generateHMAC } from "@/lib/crypto/hmac";
import { deriveSubKeysHKDF } from "@/lib/crypto/hkdf";
import {
  CanonicalSoapPayload,
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
import { PrintableMedicalResume } from "@/components/clinical/PrintableMedicalResume";
import { StickyPatientBanner } from "@/features/medical-records/exam/StickyPatientBanner";
import { ExamTabs1To3 } from "@/features/medical-records/exam/ExamTabs1To3";
import {
  AVAILABLE_REFERRAL_DOCTORS,
  ExamTabs4To5,
} from "@/features/medical-records/exam/ExamTabs4To5";

const ICD10_MAP: Record<string, string> = {
  I10: "Hipertensi Esensial (Primer)",
  "J06.9": "Infeksi Saluran Pernapasan Akut (ISPA)",
  E11: "Diabetes Melitus Tipe 2",
  "K29.7": "Gastritis, Unspecified",
  "I20.9": "Angina Pectoris (Nyeri Dada Iskemik)",
};

function generateRecordId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

export function ExamWorkspace({ bookingId }: { bookingId: string }) {
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
  const biayaKonsultasi = 100000;
  const biayaTindakan = 50000;
  const biayaObat = 85000;

  const [isMedicallyConfirmed, setIsMedicallyConfirmed] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  if (notFound) {
    return (
      <div className="p-8 md:p-12 rounded-3xl bg-white border border-red-200 shadow-xl max-w-2xl mx-auto my-12 text-center space-y-5">
        <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
          404 - DATA TIDAK DITEMUKAN
        </span>
        <h2 className="text-2xl font-black text-slate-900">Jadwal Pemeriksaan Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500">
          ID <span className="font-mono font-bold text-slate-800">{bookingId}</span> tidak terdaftar
          atau bukan merupakan wewenang DPJP Anda.
        </p>
        <Link
          href="/nakes"
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider"
        >
          ← Kembali ke Stasiun Nakes
        </Link>
      </div>
    );
  }

  if (isLoading || !session || !appointment || !patient) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center font-sans">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">
          Memverifikasi Otorisasi Sesi Pemeriksaan dari PostgreSQL...
        </p>
      </div>
    );
  }

  const patientAllergies = Array.isArray(patient.allergies) ? patient.allergies : [];
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

    if (
      detectedAllergies.length > 0 &&
      !confirm(`PERINGATAN KLINIS: Pasien alergi terhadap (${detectedAllergies.join(", ")}). Lanjutkan?`)
    ) {
      return;
    }

    if (!isValidMasterKeyHex(patient.encryptionKeyHex)) {
      setSubmitStatus("GALAT KRIPTOGRAFI (Fail-Closed): Kunci 256-bit pasien tidak tersedia.");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const newRecordId = generateRecordId("REC");
      const version = isAddendum ? 2 : 1;
      const payloadObj: CanonicalSoapPayload = {
        subjective,
        vitalSigns: {
          systolic: Number(systolic),
          diastolic: Number(diastolic),
          heartRate: Number(heartRate),
          temperature: Number(temperature),
          respiratoryRate: 20,
          spo2: Number(spo2),
        },
        assessment: { icd10, desc: ICD10_MAP[icd10] || "Diagnosis Umum" },
        plan: {
          resep: planPrescription.split("\n").map((r) => r.trim()).filter(Boolean),
          tindakan: `[ICD-9: ${icd9Procedure}] ${planAction || "Observasi klinis"}`,
        },
        gcs: {
          eye: Number(gcsEye),
          verbal: Number(gcsVerbal),
          motor: Number(gcsMotor),
          total: Number(gcsEye) + Number(gcsVerbal) + Number(gcsMotor),
        },
        icd9Procedure,
        dischargeDisposition,
        suratSakit: berikanSuratSakit ? { lamaHari: Number(lamaHariSakit) } : null,
        rujukan: isRujukan
          ? {
              faskesId: rujukanFaskesId,
              faskesNama: rujukanTujuan,
              dokterId: rujukanDokterId,
              urgensi: rujukanUrgensi,
              alasan: rujukanAlasan,
            }
          : null,
        jadwalKontrol,
        meta: {
          dokterId: session.id,
          dokterNama: session.name,
          dokterStr: session.strNumber || "",
          faskesNama: appointment.faskesNama,
          timestamp: new Date().toISOString(),
        },
      };

      const bundle = await encryptMedicalRecordPayload(payloadObj, patient.encryptionKeyHex, {
        patientId: patient.id,
        recordId: newRecordId,
        version,
      });

      const isOfflineMode =
        localStorage.getItem("resilio_network_mode") === "offline" || !navigator.onLine;

      if (isOfflineMode) {
        // Simpan langsung ke IndexedDB (`resilio_offline_db`) + jadwalkan PWA Background Sync
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
        <Link href="/nakes" className="hover:underline">
          Stasiun Nakes
        </Link>
        <span>/</span>
        <span>Pemeriksaan Klinis SOAP ({appointment.id})</span>
      </div>

      <StickyPatientBanner
        appointment={appointment}
        patient={patient}
        session={session}
        patientAllergies={patientAllergies}
        onOpenPrint={() => setIsPrintOpen(true)}
      />

      {submitStatus && (
        <div
          role={submitStatus.startsWith("GALAT") || submitStatus.startsWith("GAGAL") ? "alert" : "status"}
          className={`p-4 rounded-2xl border text-xs font-bold ${
            submitStatus.startsWith("GALAT") || submitStatus.startsWith("GAGAL")
              ? "bg-red-50 border-red-300 text-red-900"
              : "bg-emerald-50 border-emerald-300 text-emerald-800"
          }`}
        >
          {submitStatus}
        </div>
      )}

      {Object.keys(validationErrors).length > 0 && (
        <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs space-y-1">
          <p className="font-bold uppercase text-[10px]">Validasi Medis (Zod v4):</p>
          <ul className="list-disc list-inside text-[11px]">
            {Object.values(validationErrors).map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={handleSaveAndSign}
        className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Dokumen Rekam Medis Elektronik Terpadu (Permenkes RI No. 24/2022)
            </h2>
            <p className="text-[11px] text-slate-500">
              Format 5-Tab: Administratif, Anamnesis/Fisik, ICD-10/Penunjang, Terapi/ICD-9, & CPPT/Resume
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={isAddendum}
              onChange={(e) => setIsAddendum(e.target.checked)}
              className="rounded text-emerald-600"
            />
            <span>Mode Addendum</span>
          </label>
        </div>

        {isAddendum && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1 text-xs">
            <label htmlFor="addendum-reason" className="block font-bold text-amber-900 uppercase text-[10px]">
              Alasan Klinis Revisi Addendum *
            </label>
            <input
              id="addendum-reason"
              type="text"
              required={isAddendum}
              value={addendumReason}
              onChange={(e) => setAddendumReason(e.target.value)}
              placeholder="Contoh: Koreksi dosis obat setelah hasil rontgen paru diterima..."
              className="w-full px-3 py-2 border rounded-xl bg-white text-sm"
            />
          </div>
        )}

        <div role="tablist" className="flex border-b border-slate-200 overflow-x-auto gap-2 pb-2">
          {(
            [
              [1, "Tab 1: Administratif & Alergi"],
              [2, "Tab 2: Anamnesis & Fisik"],
              [3, "Tab 3: Diagnosis & Citra Medis"],
              [4, "Tab 4: Penatalaksanaan & Resep"],
              [5, "Tab 5: CPPT & Pengesahan"],
            ] as const
          ).map(([tabNum, label]) => (
            <button
              key={tabNum}
              type="button"
              role="tab"
              aria-selected={activeTab === tabNum}
              onClick={() => setActiveTab(tabNum)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer ${
                activeTab === tabNum
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <ExamTabs1To3
          activeTab={activeTab}
          appointment={appointment}
          patient={patient}
          patientAllergies={patientAllergies}
          subjective={subjective}
          setSubjective={setSubjective}
          gcsEye={gcsEye}
          setGcsEye={setGcsEye}
          gcsVerbal={gcsVerbal}
          setGcsVerbal={setGcsVerbal}
          gcsMotor={gcsMotor}
          setGcsMotor={setGcsMotor}
          systolic={systolic}
          setSystolic={setSystolic}
          diastolic={diastolic}
          setDiastolic={setDiastolic}
          heartRate={heartRate}
          setHeartRate={setHeartRate}
          temperature={temperature}
          setTemperature={setTemperature}
          spo2={spo2}
          setSpo2={setSpo2}
          icd10={icd10}
          setIcd10={setIcd10}
          attachedImages={attachedImages}
          selectedImageType={selectedImageType}
          setSelectedImageType={setSelectedImageType}
          imageTitle={imageTitle}
          setImageTitle={setImageTitle}
          onAddSampleImage={() => void handleAddSampleImage()}
          validationErrors={validationErrors}
          clearFieldError={clearFieldError}
        />

        <ExamTabs4To5
          activeTab={activeTab}
          session={session}
          planPrescription={planPrescription}
          setPlanPrescription={setPlanPrescription}
          detectedAllergies={detectedAllergies}
          icd9Procedure={icd9Procedure}
          setIcd9Procedure={setIcd9Procedure}
          planAction={planAction}
          setPlanAction={setPlanAction}
          biayaKonsultasi={biayaKonsultasi}
          biayaTindakan={biayaTindakan}
          biayaObat={biayaObat}
          berikanSuratSakit={berikanSuratSakit}
          setBerikanSuratSakit={setBerikanSuratSakit}
          lamaHariSakit={lamaHariSakit}
          setLamaHariSakit={setLamaHariSakit}
          isRujukan={isRujukan}
          setIsRujukan={setIsRujukan}
          rujukanFaskesId={rujukanFaskesId}
          setRujukanFaskesId={setRujukanFaskesId}
          rujukanDokterId={rujukanDokterId}
          setRujukanDokterId={setRujukanDokterId}
          rujukanUrgensi={rujukanUrgensi}
          setRujukanUrgensi={setRujukanUrgensi}
          setRujukanTujuan={setRujukanTujuan}
          rujukanAlasan={rujukanAlasan}
          setRujukanAlasan={setRujukanAlasan}
          dischargeDisposition={dischargeDisposition}
          setDischargeDisposition={setDischargeDisposition}
          jadwalKontrol={jadwalKontrol}
          setJadwalKontrol={setJadwalKontrol}
          isAddendum={isAddendum}
          addendumReason={addendumReason}
          isMedicallyConfirmed={isMedicallyConfirmed}
          setIsMedicallyConfirmed={setIsMedicallyConfirmed}
          validationErrors={validationErrors}
          clearFieldError={clearFieldError}
        />

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {activeTab > 1 && (
              <button
                type="button"
                onClick={() => setActiveTab((p) => (p > 1 ? ((p - 1) as 1 | 2 | 3 | 4 | 5) : 1))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                ← Tab Sebelumnya
              </button>
            )}
            {activeTab < 5 && (
              <button
                type="button"
                onClick={() => setActiveTab((p) => (p < 5 ? ((p + 1) as 1 | 2 | 3 | 4 | 5) : 5))}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Lanjut ke Tab {activeTab + 1} →
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition cursor-pointer disabled:bg-slate-400"
          >
            {isSubmitting
              ? "Mengenkripsi & Mengesahkan..."
              : isAddendum
              ? "Sahkan Revisi Addendum (Versi 2)"
              : "Simpan & Tanda Tangani Berkas RME"}
          </button>
        </div>
      </form>

      {isPrintOpen && (
        <PrintableMedicalResume
          data={{
            recordId: `REC-${appointment.id}`,
            faskesNama: appointment.faskesNama || "RSUP Dr. Sardjito",
            patientNama: patient.name,
            patientNik: patient.nik,
            patientMrn: patient.mrn,
            patientBloodType: patient.bloodType,
            patientAge: patient.age,
            penjaminBiaya: "BPJS Kesehatan (JKN)",
            tanggalPeriksa: new Date().toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            poli: appointment.poli,
            dokterNama: session.name,
            dokterSpecialty: session.specialization || "Spesialis Penyakit Dalam",
            dokterStr: session.strNumber,
            triaseLevel: appointment.triaseLevel || "HIJAU (Non-Urgent)",
            triageVitals: {
              systolic: Number(systolic),
              diastolic: Number(diastolic),
              heartRate: Number(heartRate),
              temperature: Number(temperature),
              spo2: Number(spo2),
            },
            subjective,
            diagnosisIcd10: icd10,
            diagnosisShort: ICD10_MAP[icd10] || "Hipertensi Esensial",
            prosedurIcd9: icd9Procedure,
            prescriptions: planPrescription.split("\n").map((r) => r.trim()).filter(Boolean),
            edukasiDokter: planAction,
            suratKeteranganSakit: {
              diberikan: berikanSuratSakit,
              lamaHari: Number(lamaHariSakit),
              mulaiTanggal: new Date().toLocaleDateString("id-ID"),
            },
            suratRujukan: {
              isRujukan,
              tujuanFaskes: `${rujukanTujuan} (${
                AVAILABLE_REFERRAL_DOCTORS.find((d) => d.id === rujukanDokterId)?.name || "DPJP"
              } [${rujukanUrgensi}])`,
              alasanRujukan: rujukanAlasan,
            },
            billing: {
              biayaKonsultasi,
              biayaTindakan,
              biayaObat,
              totalBiaya: biayaKonsultasi + biayaTindakan + biayaObat,
              statusKlaim: "DITANGGUNG JKN (BPJS KESEHATAN)",
            },
            version: isAddendum ? 2 : 1,
            addendumReason: isAddendum ? addendumReason : undefined,
          }}
          onClose={() => setIsPrintOpen(false)}
        />
      )}
    </div>
  );
}
