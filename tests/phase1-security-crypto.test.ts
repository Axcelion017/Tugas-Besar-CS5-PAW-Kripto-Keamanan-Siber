import { describe, test, expect } from "vitest";
import {
  CanonicalSoapPayload,
  EMPTY_SHA256_HMAC,
  STATIC_FORBIDDEN_IV,
  decryptMedicalRecordPayload,
  encryptMedicalRecordPayload,
} from "../features/medical-records/crypto-service";
import { verifyBinaryAttachmentHMAC, encryptBinaryAttachment } from "../lib/crypto/aes";
import { verifyHMAC } from "../lib/crypto/hmac";
import {
  SERVER_ACTIVE_SESSIONS,
  registerSessionAsync,
  getSessionFromStoreAsync,
  revokeSessionAsync,
} from "../lib/auth/sessionStore";
import { AssignDpjpSchema } from "../lib/validations/triage";
import { toggleFaskesKillSwitchServerAction } from "../lib/actions/faskes";
import { approveKycServerAction } from "../lib/actions/auth";
import { revokeAccessServerAction } from "../lib/actions/consent";
import { getSingleMedicalRecordServerAction } from "../lib/actions/clinical";
import nextConfig from "../next.config";
import { FaskesStatus } from "@prisma/client";

describe("Fase 1 Quality Gates — Keamanan Server-Side, Sesi Persisten & Kriptografi Nyata", () => {
  const masterKeyHex = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

  describe("F1.1 — Sesi Persisten PostgreSQL & Penolakan Cookie Tanpa Sesi", () => {
    test("1. Sesi persisten bertahan di PostgreSQL meskipun cache RAM server dibersihkan (simulasi restart)", async () => {
      const testToken = `test-session-${crypto.randomUUID()}`;
      await registerSessionAsync(
        testToken,
        {
          id: "P-101",
          name: "Budi Santoso",
          username: "budi",
          role: "pasien",
          status: "VERIFIED",
        },
        3600
      );

      // Simulasikan server restart dengan mengosongkan RAM cache sepenuhnya
      SERVER_ACTIVE_SESSIONS.delete(testToken);
      expect(SERVER_ACTIVE_SESSIONS.has(testToken)).toBe(false);

      // Wajib tetap pulih dari tabel `sessions` PostgreSQL
      const recovered = await getSessionFromStoreAsync(testToken);
      expect(recovered).not.toBeNull();
      expect(recovered?.id).toBe("P-101");
      expect(recovered?.role).toBe("pasien");

      // Setelah dicabut (logout), wajib tidak dapat diakses lagi
      await revokeSessionAsync(testToken);
      SERVER_ACTIVE_SESSIONS.delete(testToken);
      const afterRevoke = await getSessionFromStoreAsync(testToken);
      expect(afterRevoke).toBeNull();
    });
  });

  describe("F1.2 — Penegakan Otorisasi Server Actions (Anti-BOLA) & PIN 6-Digit", () => {
    test("2. Server Actions sensitif menolak tegas permintaan tanpa sesi cookie (401 Unauthorized)", async () => {
      const killSwitchRes = await toggleFaskesKillSwitchServerAction(
        "FAS-01",
        FaskesStatus.QUARANTINED
      );
      expect(killSwitchRes.success).toBe(false);
      expect(killSwitchRes.message).toContain("401");

      const approveKycRes = await approveKycServerAction("KYC-NONEXISTENT");
      expect(approveKycRes.success).toBe(false);
      expect(approveKycRes.message).toContain("401");

      const revokeRes = await revokeAccessServerAction("AG-NONEXISTENT");
      expect(revokeRes.success).toBe(false);
      expect(revokeRes.message).toContain("401");

      const singleRmeRes = await getSingleMedicalRecordServerAction("REC-2026-001");
      expect(singleRmeRes.success).toBe(false);
      expect(singleRmeRes.data).toBeNull();
    });

    test("3. AssignDpjpSchema menolak keras PIN kosong atau format bukan 6 digit (OWASP ASVS V2.1)", () => {
      const emptyPin = AssignDpjpSchema.safeParse({
        aptId: "APT-2026-001",
        doctorId: "DOC-01",
        inputPin: "",
      });
      expect(emptyPin.success).toBe(false);

      const missingPin = AssignDpjpSchema.safeParse({
        aptId: "APT-2026-001",
        doctorId: "DOC-01",
      });
      expect(missingPin.success).toBe(false);

      const shortPin = AssignDpjpSchema.safeParse({
        aptId: "APT-2026-001",
        doctorId: "DOC-01",
        inputPin: "1234",
      });
      expect(shortPin.success).toBe(false);
    });
  });

  describe("F1.3 — Kriptografi AEAD + HKDF + AAD, Anti-Timing & Fail-Closed Murni", () => {
    const sampleSoap: CanonicalSoapPayload = {
      subjective: "Nyeri kepala hebat disertai tensi tinggi sejak 2 hari.",
      vitalSigns: { systolic: 150, diastolic: 95, heartRate: 84, temperature: 36.7, spo2: 98 },
      assessment: { icd10: "I10", desc: "Hipertensi Esensial" },
      plan: { resep: ["Amlodipine 10mg 1x1"], tindakan: "Observasi tekanan darah" },
    };

    test("4. Enkripsi 2 kali menghasilkan IV 96-bit berbeda (anti IV-reuse) dan bukan Base64/Hex plaintext", async () => {
      const ctx = { patientId: "P-101", recordId: "REC-TEST-01", version: 1 };
      const b1 = await encryptMedicalRecordPayload(sampleSoap, masterKeyHex, ctx);
      const b2 = await encryptMedicalRecordPayload(sampleSoap, masterKeyHex, ctx);

      expect(b1.ivHex).toHaveLength(24);
      expect(b2.ivHex).toHaveLength(24);
      expect(b1.ivHex).not.toBe(b2.ivHex);
      expect(b1.ivHex).not.toBe(STATIC_FORBIDDEN_IV);
      expect(b1.hmacDigest).not.toBe(EMPTY_SHA256_HMAC);

      // Pastikan ciphertext bukan Hex JSON plaintext
      const rawDecoded = Buffer.from(b1.encryptedPayload, "hex").toString("utf-8");
      expect(rawDecoded.trim().startsWith("{")).toBe(false);

      // Dekripsi dengan konteks yang benar berhasil 100%
      const dec = await decryptMedicalRecordPayload(b1, masterKeyHex, ctx);
      expect(dec.ok).toBe(true);
      if (dec.ok) {
        expect(dec.mode).toBe("hkdf-aead");
        expect(dec.data.subjective).toBe(sampleSoap.subjective);
      }
    });

    test("5. Fail-Closed: Modifikasi 1 byte ciphertext atau salah AAD pasien wajib ditolak tanpa data fiktif", async () => {
      const ctx = { patientId: "P-101", recordId: "REC-TEST-02", version: 1 };
      const bundle = await encryptMedicalRecordPayload(sampleSoap, masterKeyHex, ctx);

      // 5a. Modifikasi 1 byte ciphertext
      const tampered = {
        ...bundle,
        encryptedPayload:
          bundle.encryptedPayload.slice(0, -2) +
          (bundle.encryptedPayload.slice(-2) === "ff" ? "00" : "ff"),
      };
      const tamperedRes = await decryptMedicalRecordPayload(tampered, masterKeyHex, ctx);
      expect(tamperedRes.ok).toBe(false);
      if (!tamperedRes.ok) {
        expect(tamperedRes.errorCode).toBe("HMAC_MISMATCH");
      }

      // 5b. Percobaan pengalihan konteks ke pasien lain (AAD mismatch)
      const wrongPatientRes = await decryptMedicalRecordPayload(bundle, masterKeyHex, {
        patientId: "P-999",
        recordId: "REC-TEST-02",
        version: 1,
      });
      expect(wrongPatientRes.ok).toBe(false);

      // 5c. Menolak plaintext hex JSON dengan static IV & empty HMAC (tidak lagi fail-open)
      const fakeLegacyRes = await decryptMedicalRecordPayload(
        {
          encryptedPayload: Buffer.from(JSON.stringify(sampleSoap)).toString("hex"),
          ivHex: STATIC_FORBIDDEN_IV,
          hmacDigest: EMPTY_SHA256_HMAC,
        },
        masterKeyHex,
        ctx
      );
      expect(fakeLegacyRes.ok).toBe(false);
      if (!fakeLegacyRes.ok) {
        expect(fakeLegacyRes.errorCode).toBe("INVALID_FORMAT");
      }
    });

    test("6. Constant-time HMAC & HKDF Key Separation pada enkripsi berkas biner", async () => {
      expect(await verifyHMAC("data-medis", "not-a-valid-hex", masterKeyHex)).toBe(false);

      const rawBytes = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]).buffer;
      const aad = "ATTACHMENT:XRAY-TEST|PATIENT:P-101";
      const enc = await encryptBinaryAttachment(rawBytes, masterKeyHex, aad);

      expect(await verifyBinaryAttachmentHMAC(enc.ciphertextBuffer, enc.binaryHmac, masterKeyHex, aad)).toBe(
        true
      );
      expect(
        await verifyBinaryAttachmentHMAC(enc.ciphertextBuffer, enc.binaryHmac, masterKeyHex, "WRONG_AAD")
      ).toBe(false);
    });
  });

  describe("F1.4 — HTTP Security Headers (OWASP Secure Headers)", () => {
    test("7. next.config.ts mendefinisikan CSP, X-Frame-Options, X-Content-Type-Options, dan Referrer-Policy", async () => {
      expect(typeof nextConfig.headers).toBe("function");
      const rules = await nextConfig.headers!();
      expect(rules.length).toBeGreaterThan(0);

      const headerKeys = rules[0].headers.map((h) => h.key);
      expect(headerKeys).toContain("Content-Security-Policy");
      expect(headerKeys).toContain("X-Frame-Options");
      expect(headerKeys).toContain("X-Content-Type-Options");
      expect(headerKeys).toContain("Referrer-Policy");
      expect(headerKeys).toContain("Permissions-Policy");

      const xFrame = rules[0].headers.find((h) => h.key === "X-Frame-Options");
      expect(xFrame?.value).toBe("DENY");
    });
  });
});
