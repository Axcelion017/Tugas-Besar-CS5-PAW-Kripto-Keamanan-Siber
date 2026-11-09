// Helper konversi Hex <-> ArrayBuffer
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Fungsi Enkripsi AES-256-GCM dengan dukungan AAD (Authenticated Associated Data)
export async function encryptAES(
  plaintext: string,
  keyHex: string,
  aadText?: string
): Promise<{ ciphertext: string; iv: string; aad?: string }> {
  const encoder = new TextEncoder();
  const rawKey = hexToBuf(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const algorithmParams: AesGcmParams = {
    name: "AES-GCM",
    iv: iv as BufferSource,
    tagLength: 128, // Standard 128-bit authentication tag
  };

  if (aadText) {
    algorithmParams.additionalData = encoder.encode(aadText) as BufferSource;
  }

  const encryptedBuf = await crypto.subtle.encrypt(
    algorithmParams,
    cryptoKey,
    encoder.encode(plaintext) as BufferSource
  );

  return {
    ciphertext: bufToHex(encryptedBuf),
    iv: bufToHex(iv.buffer),
    aad: aadText,
  };
}

// Fungsi Dekripsi AES-256-GCM dengan verifikasi AAD
export async function decryptAES(
  ciphertextHex: string,
  ivHex: string,
  keyHex: string,
  aadText?: string
): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const rawKey = hexToBuf(keyHex);
  const iv = hexToBuf(ivHex);
  const ciphertextBuf = hexToBuf(ciphertextHex);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey as BufferSource,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const algorithmParams: AesGcmParams = {
    name: "AES-GCM",
    iv: iv as BufferSource,
    tagLength: 128,
  };

  if (aadText) {
    algorithmParams.additionalData = encoder.encode(aadText) as BufferSource;
  }

  const decryptedBuf = await crypto.subtle.decrypt(
    algorithmParams,
    cryptoKey,
    ciphertextBuf as BufferSource
  );

  return decoder.decode(decryptedBuf);
}

// Fungsi Enkripsi Berkas Biner (Citra Medis Rontgen / USG / Lab)
export async function encryptBinaryAttachment(
  binaryBuffer: ArrayBuffer,
  keyHex: string,
  aadText?: string
): Promise<{ ciphertextBuffer: ArrayBuffer; ivHex: string; binaryHmac: string }> {
  const encoder = new TextEncoder();
  const rawKey = hexToBuf(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const algorithmParams: AesGcmParams = {
    name: "AES-GCM",
    iv: iv as BufferSource,
    tagLength: 128,
  };

  if (aadText) {
    algorithmParams.additionalData = encoder.encode(aadText) as BufferSource;
  }

  const encryptedBuf = await crypto.subtle.encrypt(
    algorithmParams,
    cryptoKey,
    binaryBuffer as BufferSource
  );

  // Hitung HMAC-SHA256 integritas biner
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    rawKey as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", hmacKey, encryptedBuf as BufferSource);

  return {
    ciphertextBuffer: encryptedBuf,
    ivHex: bufToHex(iv.buffer),
    binaryHmac: bufToHex(sig),
  };
}

// Fungsi Dekripsi Berkas Biner (Citra Medis)
export async function decryptBinaryAttachment(
  ciphertextBuffer: ArrayBuffer,
  ivHex: string,
  keyHex: string,
  aadText?: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const rawKey = hexToBuf(keyHex);
  const iv = hexToBuf(ivHex);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey as BufferSource,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const algorithmParams: AesGcmParams = {
    name: "AES-GCM",
    iv: iv as BufferSource,
    tagLength: 128,
  };

  if (aadText) {
    algorithmParams.additionalData = encoder.encode(aadText) as BufferSource;
  }

  return await crypto.subtle.decrypt(
    algorithmParams,
    cryptoKey,
    ciphertextBuffer as BufferSource
  );
}

// Alias fungsi (dideklarasikan SATU KALI saja di bawah agar tidak duplikat)
export const encrypt = encryptAES;
export const decrypt = decryptAES;
export const encryptAES_GCM = encryptAES;
export const decryptAES_GCM = decryptAES;
export const aesGcmEncrypt = encryptAES;
export const aesGcmDecrypt = decryptAES;