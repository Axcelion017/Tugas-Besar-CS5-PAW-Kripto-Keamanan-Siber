#!/usr/bin/env bash
# ==============================================================================
# Skrip Pengerasan Sistem Operasi (OS Hardening) - Resilio-Health
# Standar: Sub-CPMK 3 KKS (Tugas 2 Penanda sec-0.2)
# Target: Ubuntu 22.04 LTS (Multipass VM / Server Linux)
# ==============================================================================

set -euo pipefail

echo "========================================================"
echo " [1/5] MEMULAI PROSES HARDENING SISTEM OPERASI UBUNTU"
echo "========================================================"

# Pastikan dijalankan sebagai root / sudo
if [ "$EUID" -ne 0 ]; then
  echo "[-] Skrip ini harus dijalankan dengan hak akses root (sudo)."
  exit 1
fi

echo "[+] 1. Mengonfigurasi SSH Server (Key-Only & Root Disabled)..."
# Pasang konfigurasi khusus pada sshd_config.d agar idempoten dan aman
cat << 'EOF' > /etc/ssh/sshd_config.d/99-resilio-hardening.conf
# Resilio-Health Security Hardening (KKS sec-0.2)
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

chmod 600 /etc/ssh/sshd_config.d/99-resilio-hardening.conf

# Restart layanan SSH daemon
if systemctl is-active --quiet ssh; then
  systemctl restart ssh
elif systemctl is-active --quiet sshd; then
  systemctl restart sshd
fi

echo "[+] 2. Memverifikasi Konfigurasi SSH Daemon Aktif:"
sshd -T | grep -E 'passwordauthentication|permitrootlogin'

echo ""
echo "[+] 3. Mengonfigurasi Parameter Kernel (/etc/sysctl.d/99-security-hardening.conf)..."
cat << 'EOF' > /etc/sysctl.d/99-security-hardening.conf
# Resilio-Health Sysctl Security Hardening
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
fs.suid_dumpable = 0
EOF

sysctl --system > /dev/null 2>&1 || true

echo "[+] 4. Mengonfigurasi Firewall UFW..."
apt-get update -qq
apt-get install -y -qq ufw > /dev/null 2>&1

ufw --force reset > /dev/null 2>&1 || true
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH Key-Only'
ufw allow 80/tcp comment 'HTTP Web'
ufw allow 443/tcp comment 'HTTPS Web'
ufw allow 3000/tcp comment 'Resilio-Health HIS Web'
# Port 5432 sengaja TIDAK dibuka untuk publik (hanya internal container)
ufw --force enable

echo "[+] Status Firewall UFW:"
ufw status verbose

echo ""
echo "[+] 5. Memasang Alat Audit Lynis & Menjalankan Pemindaian..."
apt-get install -y -qq lynis > /dev/null 2>&1 || true

echo "[+] Menjalankan Lynis System Audit..."
lynis audit system --quick --auditor "Resilio-Security-Team" | tee /tmp/lynis-execution.log

echo ""
echo "========================================================"
echo " [OK] HARDENING SELESAI & TERVERIFIKASI!"
echo "========================================================"
echo "Hasil pemeriksaan SSH:"
sshd -T | grep -E 'passwordauthentication|permitrootlogin'
echo ""
grep -E "Hardening index" /tmp/lynis-execution.log || true
echo "========================================================"
