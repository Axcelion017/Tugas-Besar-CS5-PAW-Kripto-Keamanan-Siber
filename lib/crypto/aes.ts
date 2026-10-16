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

// Fungsi Enkripsi AES-256-GCM
export async function encryptAES(
  plaintext: string,
  keyHex: string
): Promise<{ ciphertext: string; iv: string }> {
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

  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    cryptoKey,
    encoder.encode(plaintext) as BufferSource
  );

  return {
    ciphertext: bufToHex(encryptedBuf),
    iv: bufToHex(iv.buffer),
  };
}

// Fungsi Dekripsi AES-256-GCM
export async function decryptAES(
  ciphertextHex: string,
  ivHex: string,
  keyHex: string
): Promise<string> {
  const decoder = new TextDecoder();
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

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    cryptoKey,
    ciphertextBuf as BufferSource
  );

  return decoder.decode(decryptedBuf);
}

// Alias fungsi (dideklarasikan SATU KALI saja di bawah agar tidak duplikat)
export const encrypt = encryptAES;
export const decrypt = decryptAES;
export const encryptAES_GCM = encryptAES;
export const decryptAES_GCM = decryptAES;