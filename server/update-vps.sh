#!/bin/bash
# ============================================================
# UPDATE OTOMATIS Si CAKRA DI VPS — jalankan SEKALI, berlaku selamanya
# ------------------------------------------------------------
# 1) Memperbarui aplikasi di VPS ke versi terbaru SEKARANG
# 2) Memasang pembaruan otomatis tiap 10 menit (cron):
#    tarik versi terbaru dari GitHub; bila kode server ikut berubah,
#    layanan cakra di-restart otomatis
#
# Cara pakai (di console VPS sebagai root):
#   curl -so u.sh https://riswan08.github.io/survey-tm/server/update-vps.sh
#   bash u.sh
# ============================================================
set -e

echo "== [1/3] Perbarui aplikasi sekarang =="
git -C /opt/sicakra pull --ff-only
grep "const VERSI" /opt/sicakra/sw.js | head -1

echo "== [2/3] Pasang skrip pembaruan berkala =="
cat > /usr/local/bin/sicakra-update <<'SKRIP'
#!/bin/bash
# tarik versi terbaru; restart layanan hanya bila kode server berubah
cd /opt/sicakra || exit 0
LAMA=$(git rev-parse HEAD 2>/dev/null)
git pull --ff-only >/dev/null 2>&1 || exit 0
BARU=$(git rev-parse HEAD 2>/dev/null)
if [ "$LAMA" != "$BARU" ] && ! git diff --quiet "$LAMA" "$BARU" -- server/cakra-server.js; then
  systemctl restart cakra
fi
SKRIP
chmod +x /usr/local/bin/sicakra-update

echo "== [3/3] Jadwalkan tiap 10 menit =="
echo '*/10 * * * * root /usr/local/bin/sicakra-update' > /etc/cron.d/sicakra-update
chmod 644 /etc/cron.d/sicakra-update

echo ""
echo "✅ BERES — VPS kini memperbarui dirinya sendiri tiap 10 menit."
