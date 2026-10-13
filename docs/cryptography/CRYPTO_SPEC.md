# Spesifikasi Komponen Kriptografi — Resilio-Health

## 1. Algoritma Terpilih
1. **AES-256-GCM (Authenticated Encryption)**:
   - Standar: NIST SP 800-38D
   - Panjang Kunci: 256-bit (32 bytes / 64 karakter heksadesimal)
   - Initialization Vector (IV): 96-bit (12 bytes) acak unik per enkripsi
   - Tag Autentikasi: 128-bit bawaan GCM
2. **HMAC-SHA256 (Hash-based Message Authentication Code)**:
   - Standar: RFC 2104
   - Fungsi Hash: SHA-256
   - Penggunaan: Verifikasi integritas ciphertext sebelum didekripsi oleh klien

## 2. Diagram Alir Komponen
- **Masukan**: JSON String Plaintext + Kunci Simetris Hex Pasien
- **Proses**:
  1. `crypto.getRandomValues(new Uint8Array(12))` $\to$ IV acak.
  2. `SubtleCrypto.encrypt("AES-GCM", key, data)` $\to$ Ciphertext + Tag.
  3. `SubtleCrypto.sign("HMAC", key, ciphertext)` $\to$ HMAC Digest.
- **Keluaran**: `{ ciphertext: hex, iv: hex, hmacDigest: hex }`