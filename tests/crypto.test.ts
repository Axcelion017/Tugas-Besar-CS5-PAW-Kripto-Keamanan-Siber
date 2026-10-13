import { describe, test, expect } from "vitest";
import { encryptAES, decryptAES } from "../lib/crypto/aes";
import { generateHMAC, verifyHMAC } from "../lib/crypto/hmac";

describe("Resilio-Health Cryptographic Tests", () => {
  // Kunci heksadesimal 256-bit (64 karakter hex) yang valid untuk AES-GCM & HMAC
  const keyHex = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const payload = JSON.stringify({ patientId: "P-101", diagnosis: "Hipertensi Primer Derajat 1" });

  test("1. Positif: Enkripsi & dekripsi AES-256-GCM valid", async () => {
    const { ciphertext, iv } = await encryptAES(payload, keyHex);
    expect(ciphertext).toBeDefined();
    expect(iv).toBeDefined();

    const decrypted = await decryptAES(ciphertext, iv, keyHex);
    expect(decrypted).toBe(payload);
  });

  test("2. Positif: Validasi HMAC-SHA256 data utuh", async () => {
    const hmac = await generateHMAC(payload, keyHex);
    expect(hmac).toBeDefined();

    const isMatch = await verifyHMAC(payload, hmac, keyHex);
    expect(isMatch).toBe(true);
  });

  test("3. Negatif: Manipulasi data merusak HMAC", async () => {
    const hmac = await generateHMAC(payload, keyHex);
    const tamperedPayload = payload + "tampered";

    const isMatch = await verifyHMAC(tamperedPayload, hmac, keyHex);
    expect(isMatch).toBe(false);
  });

  test("4. Batas: IV salah menggagalkan dekripsi (Fail-Closed)", async () => {
    const { ciphertext } = await encryptAES(payload, keyHex);
    // IV buatan/korup dengan panjang 12 bytes hex (24 karakter)
    const corruptedIV = "000000000000000000000000";

    await expect(decryptAES(ciphertext, corruptedIV, keyHex)).rejects.toThrow();
  });
});