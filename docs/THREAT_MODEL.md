# Threat Modeling & Analisis Risiko: Resilio-Health (v0.1)
- Kasus Acuan: Change Healthcare (190jt rekam medis bocor) & 96% Kerentanan BOLA di Indonesia.
- 5 Risiko Prioritas:
  1. BOLA / IDOR API Access (Mitigasi: Zero-Trust Gateway).
  2. Ransomware Downtime (Mitigasi: Offline PWA & IndexedDB).
  3. Manipulasi Data Lokal (Mitigasi: HMAC-SHA256).
  4. Pencurian Fisik Perangkat (Mitigasi: Client-Side AES-256-GCM).
  5. Penyangkalan Transaksi Medis (Mitigasi: Tamper-Evident Audit Trail).
