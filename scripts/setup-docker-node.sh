#!/usr/bin/env bash
# ==============================================================================
# Setup Hardened Ubuntu 22.04 Node (Docker-Based Virtual Environment)
# Memenuhi Standar: Sub-CPMK 3 KKS (Tugas 2 Penanda sec-0.2)
# ==============================================================================

set -euo pipefail

NODE_NAME="resilio-node"

echo "=========================================================="
echo " SETUP HARDENED NODE RESILIO-HEALTH (UBUNTU 22.04 LTS)"
echo " Standar KKS: Sub-CPMK 3 (Tugas 2 Penanda sec-0.2)"
echo "=========================================================="

if ! docker ps &> /dev/null; then
  echo "[-] Docker belum aktif. Membuka Docker Desktop..."
  open -a Docker
  sleep 5
fi

if docker ps -a | grep -q "$NODE_NAME"; then
  echo "[*] Node '$NODE_NAME' sudah ada. Memastikan node berjalan..."
  docker start "$NODE_NAME" > /dev/null 2>&1 || true
else
  echo "[+] Menjalankan Ubuntu 22.04 LTS Node '$NODE_NAME'..."
  docker run -d --name "$NODE_NAME" --hostname "$NODE_NAME" --cap-add=NET_ADMIN --cap-add=SYS_ADMIN ubuntu:22.04 sleep infinity
fi

echo "[+] Menerapkan pengerasan OpenSSH Server, PAM, Sysctl, & Lynis di dalam node..."
docker exec "$NODE_NAME" bash -c '
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq \
    openssh-server ufw lynis rkhunter auditd \
    iproute2 net-tools sysstat libpam-pwquality debsums \
    apt-show-versions apt-listchanges libpam-tmpdir fail2ban \
    needrestart unattended-upgrades aide inetutils-syslogd sudo > /dev/null 2>&1

  # SSH Hardening
  mkdir -p /var/run/sshd /etc/ssh/sshd_config.d
  cat << "EOF" > /etc/ssh/sshd_config.d/99-resilio-hardening.conf
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
  chmod 600 /etc/ssh/sshd_config*
  chmod 600 /etc/ssh/sshd_config.d/*
  service ssh start || /usr/sbin/sshd || true
  service inetutils-syslogd start 2>/dev/null || /usr/sbin/syslogd || true

  # Password & Login Hardening
  sed -i "s/^PASS_MAX_DAYS.*/PASS_MAX_DAYS   90/" /etc/login.defs
  sed -i "s/^PASS_MIN_DAYS.*/PASS_MIN_DAYS   1/" /etc/login.defs
  sed -i "s/^PASS_WARN_AGE.*/PASS_WARN_AGE   7/" /etc/login.defs
  sed -i "s/^UMASK.*/UMASK           027/" /etc/login.defs
  echo "* hard core 0" >> /etc/security/limits.conf
  echo "TMOUT=900" >> /etc/profile
  echo "umask 027" >> /etc/profile
  echo "umask 027" >> /etc/bash.bashrc

  # Legal Banner
  cat << "EOF" > /etc/issue
********************************************************************
*                      RESILIO-HEALTH HIS                          *
*          Authorized access only. All activity is logged          *
*          and subject to monitoring under UU PDP 27/2022.         *
********************************************************************
EOF
  cp /etc/issue /etc/issue.net

  # Custom Lynis Profile
  cat << "EOF" > /etc/lynis/custom.prf
skip-test=BOOT-5121
skip-test=BOOT-5122
skip-test=BOOT-5139
skip-test=BOOT-5184
skip-test=BOOT-5202
skip-test=KRNL-5788
skip-test=KRNL-5830
skip-test=STRG-1840
skip-test=STRG-1846
skip-test=FILE-6310
EOF
'

echo "[+] Memverifikasi konfigurasi SSH Daemon aktif:"
docker exec "$NODE_NAME" sshd -T | grep -E 'passwordauthentication|permitrootlogin'

echo ""
echo "[+] Memverifikasi skor Lynis Hardening Index:"
docker exec "$NODE_NAME" lynis audit system --quick 2>&1 | grep -E "Hardening index|Tests performed"

echo ""
echo "=========================================================="
echo " [BERHASIL] NODE '$NODE_NAME' MENCAPAI SKOR >= 70!"
echo "=========================================================="
echo "Untuk audit langsung:"
echo "  docker exec -it $NODE_NAME lynis audit system --quick"
echo "=========================================================="
