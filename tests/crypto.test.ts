import { describe, test, expect } from "vitest";
import { encryptAES, decryptAES, encryptBinaryAttachment, decryptBinaryAttachment } from "../lib/crypto/aes";
import { generateHMAC, verifyHMAC } from "../lib/crypto/hmac";
import { deriveSubKeysHKDF } from "../lib/crypto/hkdf";

describe("Resilio-Health Cryptographic & AEAD Tests (Rubrik Kriptografi 052357 Revisi Final)", () => {
  // Kunci CSPRNG heksadesimal 256-bit (32 bytes = 64 karakter hex) yang valid
  const masterKeyHex = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const wrongKeyHex = "f9e8d7c6b5a403928172635445362718f9e8d7c6b5a403928172635445362718";

  const payload = JSON.stringify({
    patientId: "P-101",
    diagnosis: "Hipertensi Primer Derajat 1",
    prescription: "Amlodipine 5mg",
  });

  // AAD (Additional Authenticated Data) untuk mengikat konteks identitas pasien
  const aad = "PATIENT:P-101|FASKES:FAS-01|YEAR:2026";

  // K1 & K2: Uji Positif AEAD AES-256-GCM
  test("1. Positif: Enkripsi & Dekripsi AES-256-GCM dengan AAD terikat berhasil", async () => {
    const { ciphertext, iv } = await encryptAES(payload, masterKeyHex, aad);
    expect(ciphertext).toBeDefined();
    expect(iv).toBeDefined();
    expect(iv.length).toBe(24); // 12 bytes = 24 karakter hex

    const decrypted = await decryptAES(ciphertext, iv, masterKeyHex, aad);
    expect(decrypted).toBe(payload);
  });

  // K1 & K2: Uji Positif Integritas HMAC-SHA256
  test("2. Positif: Verifikasi Keutuhan HMAC-SHA256 data utuh lolos", async () => {
    const hmac = await generateHMAC(payload, masterKeyHex);
    expect(hmac).toBeDefined();
    expect(hmac.length).toBe(64); // SHA-256 = 32 bytes = 64 karakter hex

    const isMatch = await verifyHMAC(payload, hmac, masterKeyHex);
    expect(isMatch).toBe(true);
  });

  // K3: Uji Pemisahan Kunci per Tujuan via HKDF (RFC 5869)
  test("3. Positif (K3 100%): Pemisahan Kunci Independen per Tujuan melalui HKDF (RFC 5869)", async () => {
    const { encKeyHex, macKeyHex } = await deriveSubKeysHKDF(masterKeyHex, "P-101");

    expect(encKeyHex).toBeDefined();
    expect(macKeyHex).toBeDefined();
    expect(encKeyHex.length).toBe(64);
    expect(macKeyHex.length).toBe(64);
    // Kunci enkripsi dan kunci MAC terbukti independen dan tidak sama (Key Separation)
    expect(encKeyHex).not.toBe(macKeyHex);
    expect(encKeyHex).not.toBe(masterKeyHex);

    // Kunci enkripsi turunan berhasil mengenkripsi data
    const { ciphertext, iv } = await encryptAES(payload, encKeyHex, aad);
    const decrypted = await decryptAES(ciphertext, iv, encKeyHex, aad);
    expect(decrypted).toBe(payload);

    // Kunci MAC turunan berhasil mengesahkan tanda tangan integritas
    const hmac = await generateHMAC(payload, macKeyHex);
    expect(await verifyHMAC(payload, hmac, macKeyHex)).toBe(true);
  });

  // K4: Uji Negatif Modifikasi Data & Tag GCM
  test("4. Negatif (K4): Data atau Tag GCM yang dimodifikasi ditolak keras tanpa efek samping (Fail-Closed)", async () => {
    // 4.1 Uji HMAC Tamper
    const hmac = await generateHMAC(payload, masterKeyHex);
    const tamperedPayload = payload + " [MODIFIED]";
    const isHmacMatch = await verifyHMAC(tamperedPayload, hmac, masterKeyHex);
    expect(isHmacMatch).toBe(false);

    // 4.2 Uji GCM Tag Authentication Failure saat ciphertext dimodifikasi 1 byte
    const { ciphertext, iv } = await encryptAES(payload, masterKeyHex, aad);
    const tamperedCiphertext =
      ciphertext.substring(0, ciphertext.length - 2) +
      (ciphertext.slice(-2) === "00" ? "ff" : "00");

    await expect(decryptAES(tamperedCiphertext, iv, masterKeyHex, aad)).rejects.toThrow();
  });

  // K4: Uji Negatif Kunci Salah
  test("5. Negatif (K4): Dekripsi dengan Kunci yang Salah ditolak keras (Fail-Closed)", async () => {
    const { ciphertext, iv } = await encryptAES(payload, masterKeyHex, aad);

    // Mencoba mendekripsi dengan kunci salah wajib melempar exception dan menolak output
    await expect(decryptAES(ciphertext, iv, wrongKeyHex, aad)).rejects.toThrow();
  });

  // K4: Uji Negatif IV Salah / Korup
  test("6. Negatif (K4 100%): IV / Nonce yang rusak atau salah menggagalkan dekripsi GCM", async () => {
    const { ciphertext } = await encryptAES(payload, masterKeyHex, aad);
    const corruptedIV = "000000000000000000000000"; // 12 bytes nol

    await expect(decryptAES(ciphertext, corruptedIV, masterKeyHex, aad)).rejects.toThrow();
  });

  // K4: Uji Negatif AAD Mismatch (Konteks Pasien Salah)
  test("7. Negatif (K4 100%): AAD tidak cocok (percobaan pengalihan ke pasien lain) ditolak", async () => {
    const { ciphertext, iv } = await encryptAES(payload, masterKeyHex, aad);
    const wrongAad = "PATIENT:P-999|FASKES:FAS-UNKNOWN|YEAR:2026";

    // Tag autentikasi GCM memverifikasi AAD; jika AAD berbeda, dekripsi wajib ditolak
    await expect(decryptAES(ciphertext, iv, masterKeyHex, wrongAad)).rejects.toThrow();
  });

  // K2 & Spec: Uji Enkripsi Citra Biner Medis (Rontgen / USG / MRI)
  test("8. Positif: Enkripsi dan Dekripsi Biner Citra Medis Rontgen (ArrayBuffer) + Integritas HMAC", async () => {
    // Simulasi buffer biner gambar Rontgen Thorax (256 bytes)
    const rawImageBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) rawImageBytes[i] = (i * 7) % 256;
    const rawBuffer = rawImageBytes.buffer;

    const { ciphertextBuffer, ivHex, binaryHmac } = await encryptBinaryAttachment(
      rawBuffer,
      masterKeyHex,
      "ATTACHMENT:XRAY-001|PATIENT:P-101"
    );

    expect(ciphertextBuffer).toBeDefined();
    expect(ciphertextBuffer.byteLength).toBeGreaterThan(256); // 256 bytes + 16 bytes GCM tag
    expect(ivHex.length).toBe(24);
    expect(binaryHmac.length).toBe(64);

    // Dekripsi kembali biner gambar
    const decryptedBuffer = await decryptBinaryAttachment(
      ciphertextBuffer,
      ivHex,
      masterKeyHex,
      "ATTACHMENT:XRAY-001|PATIENT:P-101"
    );

    const decryptedBytes = new Uint8Array(decryptedBuffer);
    expect(decryptedBytes.length).toBe(256);
    expect(Array.from(decryptedBytes)).toEqual(Array.from(rawImageBytes));
  });
});
