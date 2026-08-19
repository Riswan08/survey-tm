#!/bin/bash
# ============================================================
# TUNNEL HTTPS Si CAKRA — buka server kantor ke internet
# ------------------------------------------------------------
# 1) Menyalakan Cloudflare Quick Tunnel (gratis, tanpa akun)
#    untuk cakra-server → dapat alamat https://xx.trycloudflare.com
# 2) OTOMATIS menulis alamat itu ke konfig.json dan push ke
#    GitHub → semua aplikasi & dasbor tersambung sendiri,
#    TIDAK ADA yang perlu mengetik alamat server / kode unit.
#
# CARA PAKAI (di komputer yang menjalankan cakra-server):
#   node server/cakra-server.js      (biarkan berjalan)
#   bash server/tunnel.sh            (biarkan berjalan)
#
# Prasyarat sekali saja: cloudflared terpasang
#   (brew install cloudflared / unduh rilis resmi Cloudflare)
# ============================================================
set -e

PORT="${PORT:-8787}"
DIR_REPO="$(cd "$(dirname "$0")/.." && pwd)"
CF="$(command -v cloudflared || true)"
[ -z "$CF" ] && [ -x "$HOME/bin/cloudflared" ] && CF="$HOME/bin/cloudflared"

if [ -z "$CF" ]; then
  echo "❌ cloudflared belum terpasang."
  echo "   macOS : brew install cloudflared"
  echo "   Unduh : https://github.com/cloudflare/cloudflared/releases/latest"
  exit 1
fi

if ! curl -s -m 3 -o /dev/null "http://localhost:${PORT}/"; then
  echo "❌ cakra-server belum berjalan di port ${PORT}."
  echo "   Jalankan dulu: node server/cakra-server.js"
  exit 1
fi

LOG="$(mktemp -t cakra-tunnel)"
echo "🚇 Menyalakan tunnel HTTPS untuk http://localhost:${PORT} ..."
"$CF" tunnel --url "http://localhost:${PORT}" > "$LOG" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null' EXIT

URL=""
for i in $(seq 1 40); do
  URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1)"
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "❌ Alamat tunnel tidak muncul — log: $LOG"
  exit 1
fi

echo ""
echo "✅ Tunnel aktif: $URL"

# --- perbarui konfig.json + push ke GitHub (perangkat lain ikut otomatis) ---
KODE_UNIT="$(node -e "try{process.stdout.write(JSON.parse(require('fs').readFileSync('$DIR_REPO/konfig.json','utf8')).kodeUnit||'')}catch(e){}" 2>/dev/null)"
KODE_UNIT="${KODE_UNIT:-UP3-MASOHI}"
cat > "$DIR_REPO/konfig.json" <<KONF
{
  "server": "$URL",
  "kodeUnit": "$KODE_UNIT",
  "keterangan": "Konfigurasi otomatis Si CAKRA — aplikasi & dasbor membaca file ini saat dibuka; server/tunnel.sh memperbaruinya otomatis saat tunnel dinyalakan."
}
KONF

if git -C "$DIR_REPO" diff --quiet -- konfig.json; then
  echo "ℹ️  konfig.json sudah sesuai — tidak perlu push."
else
  if git -C "$DIR_REPO" add konfig.json && \
     git -C "$DIR_REPO" commit -q -m "Perbarui alamat server otomatis (tunnel): $URL" && \
     git -C "$DIR_REPO" push -q origin main; then
    echo "📤 konfig.json diperbarui & di-push — semua perangkat akan tersambung"
    echo "   otomatis begitu GitHub Pages selesai build (±1-2 menit)."
  else
    echo "⚠️  Gagal push konfig.json — perbarui manual: isi \"server\": \"$URL\""
    echo "   di konfig.json lalu commit & push."
  fi
fi

echo ""
echo "Biarkan jendela ini tetap terbuka selama jam kerja."
echo "(Ctrl+C untuk berhenti — alamat akan hangus dan berganti saat dinyalakan lagi.)"
wait $PID
