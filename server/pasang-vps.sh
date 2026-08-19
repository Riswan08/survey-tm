#!/bin/bash
# ============================================================
# PEMASANGAN Si CAKRA DI VPS (Ubuntu 22.04/24.04) — SEKALI JALAN
# ------------------------------------------------------------
# Memasang: Node.js, Caddy (HTTPS otomatis), cakra-server sebagai
# layanan systemd (auto-start saat VPS reboot), dan firewall dasar.
#
# CARA PAKAI (sebagai root di VPS, setelah DNS domain → IP VPS):
#   export DOMAIN=sicakra.my.id        # ganti dengan domain Anda
#   bash pasang-vps.sh
#
# Setelah selesai: isi https://DOMAIN ke konfig.json repo (sekali,
# permanen) — semua aplikasi & dasbor tersambung otomatis.
# ============================================================
set -euo pipefail

[ -z "${DOMAIN:-}" ] && { echo "❌ Set dulu: export DOMAIN=namadomainanda"; exit 1; }
[ "$(id -u)" != "0" ] && { echo "❌ Jalankan sebagai root (sudo -i)"; exit 1; }

echo "== [1/5] Paket dasar & Node.js =="
apt-get update -y
apt-get install -y nodejs git curl ufw debian-keyring debian-archive-keyring apt-transport-https
node --version

echo "== [2/5] Ambil aplikasi Si CAKRA =="
if [ -d /opt/sicakra/.git ]; then
  git -C /opt/sicakra pull --ff-only
else
  git clone https://github.com/Riswan08/survey-tm.git /opt/sicakra
fi
mkdir -p /opt/sicakra/server/data

echo "== [3/5] Layanan systemd (auto-start & auto-restart) =="
cat > /etc/systemd/system/cakra.service <<'UNIT'
[Unit]
Description=Si CAKRA server sinkronisasi
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/sicakra/server/cakra-server.js
Environment=PORT=8787
Restart=always
RestartSec=3
User=root
WorkingDirectory=/opt/sicakra

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now cakra
sleep 1
curl -s -o /dev/null -w "cakra-server lokal: HTTP %{http_code}\n" http://localhost:8787/

echo "== [4/5] Caddy — HTTPS otomatis untuk $DOMAIN =="
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y && apt-get install -y caddy
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
    reverse_proxy localhost:8787
}
CADDY
systemctl restart caddy

echo "== [5/5] Firewall =="
ufw allow OpenSSH >/dev/null
ufw allow 80,443/tcp >/dev/null
yes | ufw enable >/dev/null || true

echo ""
echo "============================================================"
echo "✅ SELESAI. Uji: https://$DOMAIN  (sertifikat butuh ±1 menit)"
echo ""
echo "Langkah terakhir (sekali, permanen): di repo survey-tm ubah"
echo "konfig.json → \"server\": \"https://$DOMAIN\" lalu commit & push."
echo "Semua aplikasi & dasbor akan tersambung otomatis."
echo ""
echo "Migrasi data lama (dari komputer kantor, bila ada):"
echo "  scp server/data/*.json root@$DOMAIN:/opt/sicakra/server/data/"
echo "Perbarui aplikasi di VPS kapan saja: git -C /opt/sicakra pull"
echo "============================================================"
