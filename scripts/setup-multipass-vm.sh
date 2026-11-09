#!/usr/bin/env bash
# ==============================================================================
# Skrip Otomatisasi Setup VM Multipass (macOS) - Resilio-Health
# Membangun Ubuntu 22.04 LTS VM 'resilio-node' dan menerapkan OS Hardening
# ==============================================================================

set -euo pipefail

VM_NAME="resilio-node"
UBUNTU_RELEASE="22.04"
CPUS="2"
MEMORY="2G"
DISK="8G"

echo "=========================================================="
echo " SETUP VM MULTIPASS RESILIO-HEALTH (UBUNTU 22.04 LTS)"
echo " Standar KKS: Sub-CPMK 3 (Tugas 2 Penanda sec-0.2)"
echo "=========================================================="

# 1. Cek ketersediaan command multipass
if ! command -v multipass &> /dev/null; then
  echo "[-] Alat 'multipass' belum terpasang di macOS Anda."
  echo "[*] Silakan pasang terlebih dahulu via Homebrew dengan perintah:"
  echo "    brew install --cask multipass"
  exit 1
fi

# 2. Cek apakah VM sudah ada
if multipass list | grep -q "$VM_NAME"; then
  echo "[*] VM '$VM_NAME' sudah ditemukan di sistem."
  STATUS=$(multipass info "$VM_NAME" | grep "State:" | awk '{print $2}')
  if [ "$STATUS" != "Running" ]; then
    echo "[+] Menjalankan VM '$VM_NAME'..."
    multipass start "$VM_NAME"
  fi
else
  echo "[+] Membuat VM baru '$VM_NAME' (Ubuntu $UBUNTU_RELEASE, CPU: $CPUS, RAM: $MEMORY, Disk: $DISK)..."
  multipass launch "$UBUNTU_RELEASE" \
    --name "$VM_NAME" \
    --cpus "$CPUS" \
    --memory "$MEMORY" \
    --disk "$DISK" \
    --timeout 900 || {
      echo ""
      echo "[-] Terjadi kendala saat download image Multipass."
      echo "[*] Jika muncul error 'Hash of ... does not match', bersihkan cache yang korup dengan:"
      echo "    sudo rm -rf /var/root/Library/Caches/multipassd/qemu/vault/images/*"
      echo "    Lalu jalankan ulang skrip ini."
      exit 1
    }
fi

echo "[+] Status VM saat ini:"
multipass info "$VM_NAME"

echo ""
echo "[+] Mentransfer skrip hardening 'scripts/harden-os.sh' ke dalam VM..."
multipass transfer scripts/harden-os.sh "$VM_NAME":/home/ubuntu/harden-os.sh

echo "[+] Memberikan izin eksekusi skrip di dalam VM..."
multipass exec "$VM_NAME" -- chmod +x /home/ubuntu/harden-os.sh

echo "[+] Mengeksekusi hardening di dalam VM (Root/Sudo)..."
multipass exec "$VM_NAME" -- sudo /home/ubuntu/harden-os.sh

echo ""
echo "=========================================================="
echo " [BERHASIL] VM RESILIO-NODE SIAP DIDEMONSTRASIKAN!"
echo "=========================================================="
echo "Untuk masuk ke dalam terminal VM dan demonstrasi:"
echo "  multipass shell $VM_NAME"
echo ""
echo "Perintah pengujian wajib untuk rubrik evaluasi:"
echo "  sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'"
echo "=========================================================="
