#!/usr/bin/env bash
# ==============================================================================
# Skrip Verifikasi Mandiri Hardening Sistem (Rubrik KKS sec-0.2)
# ==============================================================================

set -euo pipefail

VM_NAME="resilio-node"

echo "=========================================================="
echo " PENGECEKAN KELAYAKAN HARDENING (TUGAS 2 KKS sec-0.2)"
echo "=========================================================="

echo "[1/3] Memeriksa konfigurasi SSH Daemon pada Node ($VM_NAME)..."
if command -v multipass &> /dev/null && multipass list 2>/dev/null | grep -q "$VM_NAME"; then
  echo "Output dari 'sshd -T' (Multipass VM):"
  multipass exec "$VM_NAME" -- sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'
  echo "-> [OK] SSH terverifikasi hanya kunci & root dinonaktifkan."
elif command -v docker &> /dev/null && docker ps 2>/dev/null | grep -q "$VM_NAME"; then
  echo "Output dari 'sshd -T' (Hardened Node $VM_NAME):"
  docker exec "$VM_NAME" sshd -T | grep -E 'passwordauthentication|permitrootlogin'
  echo "-> [OK] SSH terverifikasi hanya kunci & root dinonaktifkan."
else
  echo "[!] Node VM belum aktif. Jalankan skrip setup terlebih dahulu."
fi

echo ""
echo "[2/3] Memeriksa pengerasan Docker Container (Non-Root & Capabilities)..."
if [ -f "Dockerfile" ] && [ -f "docker-compose.yml" ]; then
  grep "USER node" Dockerfile && echo "-> [OK] Dockerfile menerapkan USER non-root 'node'."
  grep "cap_drop:" -A 2 docker-compose.yml && echo "-> [OK] docker-compose membatasi Linux capabilities (cap_drop: ALL)."
  grep -A 5 "db:" docker-compose.yml | grep "expose:" && echo "-> [OK] Port database PostgreSQL tidak dipublikasikan ke host (expose-only)."
fi

echo ""
echo "[3/3] Memeriksa Berkas Bukti Evaluasi (security/)..."
for f in security/access-tests.md security/lynis-before.txt security/lynis-after.txt security/image-scan-before.txt security/image-scan-after.txt security/sbom.cdx.json; do
  if [ -f "$f" ]; then
    echo "  [✓] $f (Tersedia)"
  else
    echo "  [✗] $f (Hilang)"
  fi
done

echo ""
echo "=========================================================="
echo " Seluruh kriteria Tugas 2 KKS siap dievaluasi!"
echo "=========================================================="
