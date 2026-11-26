import { encryptAES, decryptAES } from "@/lib/crypto/aes";
import { generateHMAC, verifyHMAC } from "@/lib/crypto/hmac";
import { deriveSubKeysHKDF } from "@/lib/crypto/hkdf";

/**
 * Format Kanonikal Tunggal Payload SOAP Rekam Medis JagaMedis (Permenkes 24/2022).
 * Seluruh alur penulisan (periksa dokter, tambah resep/lab/tindakan) dan pembacaan
 * (portal pasien & pasien-lookup dokter) wajib menggunakan struktur seragam ini.
 */
export interface CanonicalSoapPayload {
  subjective: string;
  vitalSigns?: {
    systolic?: number;
    diastolic?: number;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    spo2?: number;
  };
  assessment?: {
    icd10?: string;
    desc?: string;
  };
  plan?: {
    resep?: string[];
    tindakan?: string;
  };
  labResults?: Array<{
    test: string;
    value: string;
    ref: string;
    notes?: string;
  }>;
  meta?: {
    dokterId?: string;
    dokterNama?: string;
    dokterStr?: string;
    faskesNama?: string;
    timestamp?: string;
  };
  [key: string]: unknown;
}

export interface RecordCryptoContext {
  patientId: string;
  recordId: string;
  version: number;
}

export interface EncryptedMedicalPayloadBundle {
  encryptedPayload: string;
  ivHex: string;
  hmacDigest: string;
  aad: string;
}

export type DecryptMedicalRecordResult =
  | {
      ok: true;
      hmacValid: true;
      mode: "hkdf-aead" | "legacy-aes";
      data: CanonicalSoapPayload;
    }
  | {
      ok: false;
      hmacValid: boolean;
      errorCode: "MISSING_KEY" | "INVALID_FORMAT" | "HMAC_MISMATCH" | "DECRYPT_FAILED";
      message: string;
    };

export const STATIC_FORBIDDEN_IV = "1234567890abcdef12345678";
export const EMPTY_SHA256_HMAC =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export function isValidMasterKeyHex(keyHex?: string | null): keyHex is string {
  return typeof keyHex === "string" && /^[0-9a-fA-F]{64}$/.test(keyHex.trim());
}

/**
 * Membangun Additional Authenticated Data (AAD) deterministik untuk mengikat ciphertext
 * ke konteks pasien, nomor berkas, dan versi addendum tertentu (NIST SP 800-38D).
 */
export function buildRecordAad(ctx: RecordCryptoContext): string {
  return `PATIENT:${ctx.patientId}|RECORD:${ctx.recordId}|V:${ctx.version}`;
}

/**
 * Mengenkripsi payload SOAP menggunakan:
 * 1. HKDF-SHA256 (RFC 5869) untuk memisahkan encKey dan macKey dari masterKey pasien.
 * 2. AES-256-GCM (NIST SP 800-38D) dengan IV acak 96-bit CSPRNG dan AAD terikat.
 * 3. Encrypt-then-MAC HMAC-SHA256 atas ciphertext menggunakan macKey terpisah.
 */
export async function encryptMedicalRecordPayload(
  payload: CanonicalSoapPayload,
  masterKeyHex: string,
  ctx: RecordCryptoContext
): Promise<EncryptedMedicalPayloadBundle> {
  if (!isValidMasterKeyHex(masterKeyHex)) {
    throw new Error(
      "Kunci enkripsi 256-bit (64 karakter hex) milik pasien tidak tersedia atau tidak valid."
    );
  }

  const aad = buildRecordAad(ctx);
  const { encKeyHex, macKeyHex } = await deriveSubKeysHKDF(masterKeyHex.trim(), ctx.patientId);
  const plaintext = JSON.stringify(payload);

  const { ciphertext, iv } = await encryptAES(plaintext, encKeyHex, aad);
  const hmacDigest = await generateHMAC(ciphertext, macKeyHex);

  return {
    encryptedPayload: ciphertext,
    ivHex: iv,
    hmacDigest,
    aad,
  };
}

/**
 * Mendekripsi dan memverifikasi integritas berkas RME dengan prinsip FAIL-CLOSED MURNI.
 * - Tidak pernah menerima Base64/Hex JSON plaintext.
 * - Tidak pernah menampilkan data klinis fiktif/fallback saat verifikasi gagal.
 * - Wajib memverifikasi HMAC-SHA256 (constant-time) sebelum membuka ciphertext AES-256-GCM + AAD.
 */
export async function decryptMedicalRecordPayload(
  record: {
    encryptedPayload: string;
    ivHex: string;
    hmacDigest: string;
  },
  masterKeyHex: string | null | undefined,
  ctx: RecordCryptoContext
): Promise<DecryptMedicalRecordResult> {
  if (!isValidMasterKeyHex(masterKeyHex)) {
    return {
      ok: false,
      hmacValid: false,
      errorCode: "MISSING_KEY",
      message:
        "Kunci enkripsi Zero-Knowledge 256-bit pasien tidak tersedia. Konten rekam medis dikunci (Fail-Closed).",
    };
  }

  const cleanPayload = (record.encryptedPayload || "").trim();
  const cleanIv = (record.ivHex || "").trim();
  const cleanHmac = (record.hmacDigest || "").trim();

  if (
    !cleanPayload ||
    !/^[0-9a-fA-F]+$/.test(cleanPayload) ||
    cleanPayload.length % 2 !== 0 ||
    !/^[0-9a-fA-F]{24}$/.test(cleanIv) ||
    !/^[0-9a-fA-F]{64}$/.test(cleanHmac) ||
    cleanIv.toLowerCase() === STATIC_FORBIDDEN_IV ||
    cleanHmac.toLowerCase() === EMPTY_SHA256_HMAC
  ) {
    return {
      ok: false,
      hmacValid: false,
      errorCode: "INVALID_FORMAT",
      message:
        "Format ciphertext, IV 96-bit, atau digest HMAC-SHA256 tidak memenuhi standar AEAD. Dekripsi ditolak (Fail-Closed).",
    };
  }

  const cleanMaster = masterKeyHex.trim();
  const aad = buildRecordAad(ctx);

  // 1. Jalur Utama: HKDF Key Separation + AES-256-GCM + AAD + Constant-Time HMAC
  const { encKeyHex, macKeyHex } = await deriveSubKeysHKDF(cleanMaster, ctx.patientId);
  const hkdfHmacValid = await verifyHMAC(cleanPayload, cleanHmac, macKeyHex);

  if (hkdfHmacValid) {
    try {
      const plaintext = await decryptAES(cleanPayload, cleanIv, encKeyHex, aad);
      const parsed = JSON.parse(plaintext) as CanonicalSoapPayload;
      return {
        ok: true,
        hmacValid: true,
        mode: "hkdf-aead",
        data: parsed,
      };
    } catch {
      return {
        ok: false,
        hmacValid: false,
        errorCode: "DECRYPT_FAILED",
        message:
          "Tag autentikasi AES-256-GCM atau AAD konteks pasien tidak cocok. Konten rekam medis diblokir (Fail-Closed).",
      };
    }
  }

  // 2. Jalur Kompatibilitas Terbatas: hanya untuk berkas AES-GCM asli pra-HKDF yang HMAC-nya valid
  const legacyHmacValid = await verifyHMAC(cleanPayload, cleanHmac, cleanMaster);
  if (legacyHmacValid) {
    try {
      const plaintext = await decryptAES(cleanPayload, cleanIv, cleanMaster);
      const parsed = JSON.parse(plaintext) as CanonicalSoapPayload;
      return {
        ok: true,
        hmacValid: true,
        mode: "legacy-aes",
        data: parsed,
      };
    } catch {
      return {
        ok: false,
        hmacValid: false,
        errorCode: "DECRYPT_FAILED",
        message:
          "Dekripsi AES-256-GCM gagal memverifikasi keaslian ciphertext. Konten diblokir (Fail-Closed).",
      };
    }
  }

  return {
    ok: false,
    hmacValid: false,
    errorCode: "HMAC_MISMATCH",
    message:
      "PERINGATAN INTEGRITAS: Tanda tangan HMAC-SHA256 tidak cocok! Data diduga telah dimanipulasi atau rusak. Konten medis diblokir (Fail-Closed).",
  };
}
