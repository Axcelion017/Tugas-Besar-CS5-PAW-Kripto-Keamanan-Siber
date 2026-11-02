import { describe, test, expect } from "vitest";
import { encryptAES, decryptAES } from "../lib/crypto/aes";
import { generateHMAC, verifyHMAC } from "../lib/crypto/hmac";

describe("Resilio-Health Cryptographic & AEAD Tests (Sub-CPMK 3 / NIST SP 800-38D)", () => {
  // Kunci CSPRNG heksadesimal 256-bit (32 bytes = 64 karakter hex) yang valid
  const keyHex = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const wrongKeyHex = "f9e8d7c6b5a403928172635445362718f9e8d7c6b5a403928172635445362718";

  const payload = JSON.stringify({
    patientId: "P-101",
    diagnosis: "Hipertensi Primer Derajat 1",
    prescription: "Amlodipine 5mg",
  });

  // AAD (Additional Authenticated Data) untuk mengikat konteks identitas pasien
  const aad = "PATIENT:P-101|FASKES:FAS-01|YEAR:2026";

  test("1. Positif: Enkripsi & Dekripsi AES-256-GCM dengan AAD terikat berhasil", async () => {
    const { ciphertext, iv } = await encryptAES(payload, keyHex, aad);
    expect(ciphertext).toBeDefined();
    expect(iv).toBeDefined();
    expect(iv.length).toBe(24); // 12 bytes = 24 karakter hex

    const decrypted = await decryptAES(ciphertext, iv, keyHex, aad);
    expect(decrypted).toBe(payload);
  });

  test("2. Positif: Verifikasi Keutuhan HMAC-SHA256 data utuh lolos", async () => {
    const hmac = await generateHMAC(payload, keyHex);
    expect(hmac).toBeDefined();
    expect(hmac.length).toBe(64); // SHA-256 = 32 bytes = 64 karakter hex

    const isMatch = await verifyHMAC(payload, hmac, keyHex);
    expect(isMatch).toBe(true);
  });

  test("3. Negatif: Manipulasi data (Ciphertext Tampered) ditolak keras oleh AEAD & HMAC", async () => {
    // Uji HMAC Tamper
    const hmac = await generateHMAC(payload, keyHex);
    const tamperedPayload = payload + " [MODIFIED]";
    const isHmacMatch = await verifyHMAC(tamperedPayload, hmac, keyHex);
    expect(isHmacMatch).toBe(false);

    // Uji GCM Tag Authentication Failure saat ciphertext diubah 1 byte
    const { ciphertext, iv } = await encryptAES(payload, keyHex, aad);
    const tamperedCiphertext =
      ciphertext.substring(0, ciphertext.length - 2) +
      (ciphertext.slice(-2) === "00" ? "ff" : "00");

    await expect(decryptAES(tamperedCiphertext, iv, keyHex, aad)).rejects.toThrow();
  });

  test("4. Negatif: Dekripsi dengan Kunci yang Salah ditolak (Fail-Closed)", async () => {
    const { ciphertext, iv } = await encryptAES(payload, keyHex, aad);

    // Mencoba mendekripsi dengan kunci yang salah harus melempar error dan menolak output
    await expect(decryptAES(ciphertext, iv, wrongKeyHex, aad)).rejects.toThrow();
  });

  test("5. Negatif: Dekripsi dengan AAD yang Tidak Cocok ditolak (Context Mismatch)", async () => {
    const { ciphertext, iv } = await encryptAES(payload, keyHex, aad);
    const wrongAad = "PATIENT:P-999|FASKES:FAS-UNKNOWN|YEAR:2026";

    // Tag autentikasi GCM memverifikasi AAD; jika AAD berbeda, dekripsi wajib ditolak
    await expect(decryptAES(ciphertext, iv, keyHex, wrongAad)).rejects.toThrow();
  });
});
