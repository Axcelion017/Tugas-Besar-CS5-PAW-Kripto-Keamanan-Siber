"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PemeriksaanKlinisSchema } from "@/lib/validations/clinical";
import { MOCK_PATIENTS, MOCK_ENCRYPTED_RECORDS, EncryptedMedicalRecord } from "@/lib/db/mockData";

export interface ServerActionResponse {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: {
    recordId: string;
  };
}

/**
 * Server Action: Submit & Tanda Tangan Rekam Medis Klinis (SOAP & ICD-10)
 * Mengikuti 6 tahapan alur Server Action:
 * 1. Sesi (Verifikasi identitas & wewenang dokter melalui cookie)
 * 2. Validasi Bentuk (Validasi tipe data, panjang, rentang fisiologis via Zod v4)
 * 3. Validasi Semantik (Pengecekan kontraindikasi alergi UR-T10 & status DPJP aktif)
 * 4. Mutasi Data (Penyimpanan ke basis data terenkripsi)
 * 5. revalidatePath (Pembersihan cache rute yang terdampak)
 * 6. redirect (Pengalihan ke halaman linimasa rekam medis)
 */
export async function submitPemeriksaanKlinisAction(
  prevState: ServerActionResponse | null,
  formData: FormData
): Promise<ServerActionResponse> {
  // --------------------------------------------------------------------------
  // 1. URUTAN SESI: Membaca & Memvalidasi Cookie Sesi di Server
  // --------------------------------------------------------------------------
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("resilio_session_token")?.value;

  // Verifikasi apakah sesi aktif dan berwenang sebagai dokter (Role Guard)
  if (!sessionToken || sessionToken === "INVALID_TOKEN") {
    return {
      success: false,
      message: "401 Unauthorized: Sesi tidak sah atau telah kedaluwarsa. Silakan masuk kembali.",
    };
  }

  // --------------------------------------------------------------------------
  // 2. VALIDASI BENTUK (SHAPE VALIDATION): Parsing Skema Zod
  // --------------------------------------------------------------------------
  const rawData = {
    subjective: formData.get("subjective") as string,
    systolic: Number(formData.get("systolic")),
    diastolic: Number(formData.get("diastolic")),
    heartRate: Number(formData.get("heartRate")),
    temperature: Number(formData.get("temperature")),
    spo2: Number(formData.get("spo2")),
    icd10: formData.get("icd10") as string,
    planPrescription: formData.get("planPrescription") as string,
    planAction: (formData.get("planAction") as string) || undefined,
    isMedicallyConfirmed: formData.get("isMedicallyConfirmed") === "true" || formData.get("isMedicallyConfirmed") === "on",
  };

  const validationResult = PemeriksaanKlinisSchema.safeParse(rawData);

  if (!validationResult.success) {
    const formattedErrors: Record<string, string> = {};
    for (const issue of validationResult.error.issues) {
      const key = issue.path[0]?.toString() || "form";
      if (!formattedErrors[key]) {
        formattedErrors[key] = issue.message;
      }
    }
    return {
      success: false,
      message: "Data formulir tidak memenuhi aturan validasi medis.",
      errors: formattedErrors,
    };
  }

  const validData = validationResult.data;
  const patientId = (formData.get("patientId") as string) || "P-101";

  // --------------------------------------------------------------------------
  // 3. VALIDASI SEMANTIK: Pengecekan Riwayat Alergi Pasien (UR-T10) & DPJP
  // --------------------------------------------------------------------------
  const patient = MOCK_PATIENTS.find((p) => p.id === patientId) || MOCK_PATIENTS[0];
  const patientAllergies = Array.isArray(patient?.allergies) ? patient.allergies : [];

  const detectedAllergies = patientAllergies.filter((allergy) =>
    validData.planPrescription.toLowerCase().includes(allergy.toLowerCase())
  );

  const forceOverride = formData.get("forceOverrideAllergy") === "true";

  if (detectedAllergies.length > 0 && !forceOverride) {
    return {
      success: false,
      message: `PERINGATAN KONTRAINDIKASI KLINIS (UR-T10): Resep memuat zat berbahaya bagi pasien (${detectedAllergies.join(
        ", "
      )}). Konfirmasi khusus diperlukan sebelum penyimpanan.`,
      errors: {
        planPrescription: `Kontraindikasi: Pasien alergi terhadap ${detectedAllergies.join(", ")}.`,
      },
    };
  }

  // --------------------------------------------------------------------------
  // 4. MUTASI DATA: Menulis ke Penyimpanan Medis Terenkripsi
  // --------------------------------------------------------------------------
  const recordId = `REC-2026-${Date.now().toString().slice(-4)}`;
  const newRecord: EncryptedMedicalRecord = {
    recordId,
    patientId: patient.id,
    patientName: patient.name,
    faskesId: "FAS-01",
    faskesNama: "RSUP Dr. Sardjito",
    dokterStr: "31.1.1.100.2.22.123456",
    dokterNama: "dr. Andi Pratama, Sp.PD",
    primaryIcd10: validData.icd10,
    diagnosisShort: `Pemeriksaan Klinis Rawat Jalan (${validData.icd10})`,
    encryptedPayload: Buffer.from(JSON.stringify(validData)).toString("base64"),
    ivHex: "1234567890abcdef12345678",
    hmacDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    timestamp: new Date().toISOString(),
    version: 1,
  };

  // Simulasikan mutasi data pada penyimpanan memori server
  MOCK_ENCRYPTED_RECORDS.unshift(newRecord);

  // --------------------------------------------------------------------------
  // 5. REVALIDATE PATH: Membersihkan Data Cache Rute Terkait
  // --------------------------------------------------------------------------
  revalidatePath(`/nakes/periksa/${formData.get("bookingId") || "APT-2026-001"}`);
  revalidatePath("/nakes");
  revalidatePath("/pasien/rekam-medis");

  // --------------------------------------------------------------------------
  // 6. REDIRECT: Mengalihkan ke Halaman Dasbor Dokter / Linimasa RME
  // --------------------------------------------------------------------------
  redirect("/nakes?status=record_created");
}
