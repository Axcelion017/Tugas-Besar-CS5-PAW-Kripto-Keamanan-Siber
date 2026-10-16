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

export async function verifyHMAC(
  message: string,
  expectedHmacHex: string,
  keyHex: string
): Promise<boolean> {
  const calculated = await generateHMAC(message, keyHex);
  return calculated.toLowerCase() === expectedHmacHex.toLowerCase();
}

export const createHMAC = generateHMAC;