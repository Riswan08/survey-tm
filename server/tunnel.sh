#!/bin/bash
# ============================================================
# TUNNEL HTTPS Si CAKRA — buka server kantor ke internet
# ------------------------------------------------------------
# Memberi cakra-server alamat HTTPS publik (gratis, tanpa akun)
# lewat Cloudflare Quick Tunnel, sehingga:
#   • aplikasi survey di github.io bisa sinkron dari MANA SAJA
#     (blokir mixed-content HTTPS→HTTP hilang)
#   • GPS & semua fitur tetap jalan (github.io = HTTPS aman)
#   • semua petugas & dasbor melihat database yang sama
#
# CARA PAKAI (di komputer yang menjalankan cakra-server):
#   1) pasang cloudflared SEKALI:
#        macOS  : brew install cloudflared
#        tanpa brew: unduh dari
#          https://github.com/cloudflare/cloudflared/releases/latest
#          (file cloudflared-darwin-arm64.tgz → ekstrak → taruh di PATH)
#        Windows: winget install Cloudflare.cloudflared
#   2) jalankan server : node server/cakra-server.js
#   3) jalankan skrip  : bash server/tunnel.sh
#   4) salin alamat https://....trycloudflare.com yang muncul →
#      isi ke "Alamat Server CAKRA" di ⚙️ Pengaturan SEMUA perangkat
#
# CATATAN:
#   • Alamat berubah setiap tunnel dijalankan ulang — biarkan terus
#     berjalan di komputer kantor. Alamat permanen: buat akun
#     Cloudflare (gratis) lalu pakai "named tunnel".
#   • Server kini terjangkau dari internet — kunci datanya adalah
#     KODE UNIT: pakai kode yang panjang & tidak mudah ditebak.
# ============================================================
set -e

PORT="${PORT:-8787}"

if ! command -v cloudflared >/dev/null 2>&1; then
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

echo "🚇 Membuka tunnel HTTPS untuk http://localhost:${PORT} ..."
echo "   (alamat https://....trycloudflare.com akan muncul di bawah —"
echo "    biarkan jendela ini tetap terbuka selama jam kerja)"
echo ""
exec cloudflared tunnel --url "http://localhost:${PORT}"
