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

function isValidHex(value: string, expectedLength?: number): boolean {
  if (!value || value.length % 2 !== 0) return false;
  if (expectedLength !== undefined && value.length !== expectedLength) return false;
  return /^[0-9a-fA-F]+$/.test(value);
}

export async function generateHMAC(message: string, keyHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const rawKey = hexToBuf(keyHex);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(message) as BufferSource
  );

  return bufToHex(signature);
}

/**
 * Verifikasi integritas HMAC-SHA256 secara constant-time menggunakan W3C Web Crypto API
 * `crypto.subtle.verify("HMAC", ...)` untuk mencegah Timing Attack (CWE-208 / NIST SP 800-107).
 */
export async function verifyHMAC(
  message: string,
  expectedHmacHex: string,
  keyHex: string
): Promise<boolean> {
  const cleanExpected = (expectedHmacHex || "").trim();
  const cleanKey = (keyHex || "").trim();

  // HMAC-SHA256 wajib tepat 32 byte (64 karakter hex)
  if (!isValidHex(cleanExpected, 64) || !isValidHex(cleanKey)) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const rawKey = hexToBuf(cleanKey);
    const expectedSig = hexToBuf(cleanExpected);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      rawKey as BufferSource,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      expectedSig as BufferSource,
      encoder.encode(message) as BufferSource
    );
  } catch {
    return false;
  }
}

export const createHMAC = generateHMAC;
export const hmacSha256Sign = generateHMAC;
export const hmacSha256Verify = verifyHMAC;
