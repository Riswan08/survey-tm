/* ============================================================
   CAKRA SERVER — sinkronisasi data survey terpusat (M4)
   ------------------------------------------------------------
   Satu file, TANPA dependensi. Jalankan di komputer/server
   kantor yang terhubung jaringan lokal (LAN/WiFi kantor):

       node cakra-server.js            → port 8787
       PORT=9000 node cakra-server.js  → port lain

   Server ini juga MENYAJIKAN aplikasinya: buka
   http://<ip-komputer-ini>:8787/ dari HP surveyor
   (satu asal/origin → tidak ada masalah mixed-content).

   Data tersimpan per kode unit di folder ./data/<KODE>.json.
   Kode unit berperan sebagai kunci akses sederhana — pakai kode
   yang tidak mudah ditebak, dan jalankan hanya di jaringan
   internal. (Pengerasan lebih lanjut: reverse proxy + HTTPS.)

   API:
     GET  /api/data   (header X-Kode-Unit)
          → { poles, koreksi, tugas, harga, riwayatHarga, diperbarui }
     POST /api/sync   (header X-Kode-Unit, body {poles, koreksi, tugas, harga})
          → poles/koreksi/tugas digabung, pemenang = `diubah` terbaru
          → harga (master terpusat) diganti bila stempelnya lebih baru
          → { total, baru, diperbarui, tugas, harga }
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const DIR_DATA = path.join(__dirname, 'data');
const DIR_APP = path.join(__dirname, '..'); // folder aplikasi (index.html dst.)

if (!fs.existsSync(DIR_DATA)) fs.mkdirSync(DIR_DATA, { recursive: true });

// ---------- PENYEMBUHAN DIRI: alamat VPS (sekali jalan, hanya di VPS) ----------
// Nama gratis 103-143-12-183.domainesia.io MATI (domain domainesia.io terhapus
// dari registri .io, Sep 2026) sehingga semua klien gagal sinkron. Pengganti:
// 103-143-12-183.sslip.io — DNS publik gratis yang selalu menunjuk IP yang sama,
// tanpa akun, tanpa konfigurasi. Saat layanan ini di-restart oleh cron
// pembaruan otomatis, blok berikut menambahkan nama baru ke Caddy (nama lama
// tetap dilayani bila DNS-nya kembali) lalu memuat ulang Caddy. Aman diulang:
// hanya bekerja bila Caddyfile ada dan belum memuat sslip.io.
try {
  const CADDYFILE = '/etc/caddy/Caddyfile';
  if (process.platform === 'linux' && fs.existsSync(CADDYFILE)) {
    const isiCaddy = fs.readFileSync(CADDYFILE, 'utf8');
    if (isiCaddy.includes('103-143-12-183.domainesia.io') && !isiCaddy.includes('sslip.io')) {
      fs.writeFileSync(CADDYFILE, isiCaddy.replace('103-143-12-183.domainesia.io',
        '103-143-12-183.sslip.io, 103-143-12-183.domainesia.io'));
      console.log('[cakra] Caddyfile: 103-143-12-183.sslip.io ditambahkan (pengganti domainesia.io yang mati)');
    }
  }
} catch (e) { console.error('[cakra] migrasi alamat dilewati:', e.message); }

// ---------- DOKTER CADDY: pastikan konfigurasi valid & layanan berjalan ----------
// Dijalankan tiap kali layanan cakra (re)start di VPS. Bila Caddyfile tidak
// lolos validasi, tulis ulang konfigurasi baku yang diketahui benar (cadangan
// disimpan), lalu Caddy DI-RESTART penuh — memulihkan keadaan apa pun
// (termasuk proses caddy yang mati setelah muat-ulang gagal).
try {
  const CADDYFILE = '/etc/caddy/Caddyfile';
  if (process.platform === 'linux' && fs.existsSync(CADDYFILE) && process.getuid && process.getuid() === 0) {
    const { execFile } = require('child_process');
    const KONFIG_BAKU = '103-143-12-183.sslip.io, 103-143-12-183.domainesia.io {\n\treverse_proxy localhost:8787\n}\n';
    execFile('caddy', ['validate', '--config', CADDYFILE, '--adapter', 'caddyfile'], (errVal) => {
      if (errVal) {
        try {
          fs.copyFileSync(CADDYFILE, CADDYFILE + '.rusak-' + Date.now());
          fs.writeFileSync(CADDYFILE, KONFIG_BAKU);
          console.log('[cakra] Caddyfile tidak valid — ditulis ulang dengan konfigurasi baku (cadangan disimpan)');
        } catch (e2) { console.error('[cakra] gagal menulis Caddyfile:', e2.message); }
      }
      execFile('systemctl', ['restart', 'caddy'], (errR) => {
        console.log(errR ? '[cakra] restart caddy gagal: ' + errR.message : '[cakra] caddy di-restart');
        setTimeout(() => {
          execFile('systemctl', ['is-active', 'caddy'], (e3, out) => {
            console.log('[cakra] status caddy: ' + String(out || e3 && e3.message || '').trim());
          });
        }, 8000);
      });
    });
  }
} catch (e) { console.error('[cakra] dokter caddy dilewati:', e.message); }

// ---------- util ----------
function kodeUnitValid(kode) {
  return typeof kode === 'string' && /^[A-Za-z0-9_-]{3,60}$/.test(kode);
}

function fileUnit(kode) {
  return path.join(DIR_DATA, kode.toUpperCase() + '.json');
}

function bacaUnit(kode) {
  try { return JSON.parse(fs.readFileSync(fileUnit(kode), 'utf8')); }
  catch (e) { return { poles: [], diperbarui: 0 }; }
}

function tulisUnit(kode, data) {
  const f = fileUnit(kode);
  fs.writeFileSync(f + '.tmp', JSON.stringify(data));
  fs.renameSync(f + '.tmp', f); // tulis atomik — data tidak korup saat listrik padam
}

// gabung berdasarkan uid; pemenang = stempel `diubah` terbaru
function gabung(lama, masuk) {
  const peta = new Map();
  let baru = 0, diperbarui = 0;
  (lama || []).forEach(p => { if (p && p.uid) peta.set(p.uid, p); });
  (Array.isArray(masuk) ? masuk : []).forEach(p => {
    if (!p || typeof p.uid !== 'string' || p.uid.length < 3) return;
    if (!isFinite(p.lat) || !isFinite(p.lng)) return;
    const ada = peta.get(p.uid);
    if (!ada) { peta.set(p.uid, p); baru++; }
    else if ((Number(p.diubah) || 0) > (Number(ada.diubah) || 0)) { peta.set(p.uid, p); diperbarui++; }
  });
  return { poles: [...peta.values()], baru, diperbarui };
}

// gabung penugasan survey (FR-16): per id tugas, `diubah` terbaru menang
function gabungTugas(lama, masuk) {
  const peta = new Map();
  (lama || []).forEach(t => { if (t && typeof t.id === 'string') peta.set(t.id, t); });
  (Array.isArray(masuk) ? masuk : []).forEach(t => {
    if (!t || typeof t.id !== 'string' || t.id.length < 3 || t.id.length > 40) return;
    if (typeof t.judul !== 'string' || !t.judul.trim()) return;
    const ada = peta.get(t.id);
    if (!ada || (Number(t.diubah) || 0) > (Number(ada.diubah) || 0)) peta.set(t.id, t);
  });
  return [...peta.values()];
}

// master harga terpusat (FR-15): satu paket override per unit,
// diganti utuh bila stempel `diubah` pengirim lebih baru; riwayat dicatat.
function gabungHarga(lama, masuk, riwayat) {
  if (!masuk || typeof masuk !== 'object') return { harga: lama, riwayat, berubah: false };
  const stempelBaru = Number(masuk.diubah) || 0;
  const stempelLama = (lama && Number(lama.diubah)) || 0;
  if (!stempelBaru || stempelBaru <= stempelLama) return { harga: lama, riwayat, berubah: false };
  const bersih = {
    hargaOverride: (masuk.hargaOverride && typeof masuk.hargaOverride === 'object') ? masuk.hargaOverride : {},
    jasaOverride: (masuk.jasaOverride && typeof masuk.jasaOverride === 'object') ? masuk.jasaOverride : {},
    diubah: stempelBaru,
    oleh: typeof masuk.oleh === 'string' ? masuk.oleh.slice(0, 40) : '',
  };
  const log = (riwayat || []).concat([{
    diubah: stempelBaru, oleh: bersih.oleh,
    jumlahHarga: Object.keys(bersih.hargaOverride).length,
    jumlahJasa: Object.keys(bersih.jasaOverride).length,
  }]).slice(-50);
  return { harga: bersih, riwayat: log, berubah: true };
}

// tanda-hapus (tombstone): penghapusan titik ikut tersinkron ke semua perangkat.
// Per uid, stempel terbaru menang; titik terhapus bila stempel hapus >= stempel titik
// (titik yang DIEDIT SETELAH dihapus dianggap dihidupkan kembali).
function gabungHapus(lama, masuk) {
  const peta = new Map();
  (lama || []).forEach(t => { if (t && typeof t.uid === 'string') peta.set(t.uid, t); });
  (Array.isArray(masuk) ? masuk : []).forEach(t => {
    if (!t || typeof t.uid !== 'string' || t.uid.length < 3) return;
    const ada = peta.get(t.uid);
    if (!ada || (Number(t.diubah) || 0) > (Number(ada.diubah) || 0)) {
      peta.set(t.uid, {
        uid: t.uid.slice(0, 40),
        diubah: Number(t.diubah) || 0,
        petugas: String(t.petugas || '').slice(0, 40),
      });
    }
  });
  return [...peta.values()].slice(-5000);
}

// tahap pekerjaan perluasan: per nama pekerjaan, stempel `diubah` terbaru menang
function gabungStatusPekerjaan(lama, masuk) {
  const hasil = {};
  Object.entries(lama || {}).forEach(([k, v]) => { if (v && typeof v === 'object') hasil[k] = v; });
  Object.entries(masuk || {}).forEach(([k, v]) => {
    if (!v || typeof v !== 'object' || typeof k !== 'string' || k.length > 100) return;
    const ada = hasil[k];
    if (!ada || (Number(v.diubah) || 0) > (Number(ada.diubah) || 0)) {
      hasil[k] = {
        status: String(v.status || 'survey').slice(0, 20),
        diubah: Number(v.diubah) || 0,
        oleh: String(v.oleh || '').slice(0, 40),
      };
    }
  });
  return hasil;
}

// gabung koreksi sambungan antar tiang: per pasangan, `diubah` terbaru menang
function gabungKoreksi(lama, masuk) {
  const kunci = (k) => (k.a < k.b ? k.a + '|' + k.b : k.b + '|' + k.a);
  const peta = new Map();
  (lama || []).forEach(k => { if (k && k.a && k.b) peta.set(kunci(k), k); });
  (Array.isArray(masuk) ? masuk : []).forEach(k => {
    if (!k || typeof k.a !== 'string' || typeof k.b !== 'string') return;
    if (k.aksi !== 'tambah' && k.aksi !== 'hapus') return;
    const ada = peta.get(kunci(k));
    if (!ada || (Number(k.diubah) || 0) > (Number(ada.diubah) || 0)) peta.set(kunci(k), k);
  });
  return [...peta.values()];
}

function kirimJSON(res, kode, obj) {
  const isi = JSON.stringify(obj);
  res.writeHead(kode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Kode-Unit',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(isi);
}

// ---------- penyaji file aplikasi ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

function sajikanFile(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const f = path.normalize(path.join(DIR_APP, rel));
  if (!f.startsWith(DIR_APP) || f.includes(path.sep + 'server' + path.sep) || f.includes(path.sep + '.git')) {
    res.writeHead(403); res.end('dilarang'); return;
  }
  fs.readFile(f, (err, isi) => {
    if (err) { res.writeHead(404); res.end('tidak ditemukan'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(isi);
  });
}

// ---------- server ----------
http.createServer((req, res) => {
  const url = req.url || '/';

  if (req.method === 'OPTIONS') { kirimJSON(res, 204, {}); return; }

  if (url.startsWith('/api/')) {
    const kode = req.headers['x-kode-unit'];
    if (!kodeUnitValid(kode)) { kirimJSON(res, 401, { error: 'kode unit tidak valid' }); return; }

    if (req.method === 'GET' && url.startsWith('/api/data')) {
      const d = bacaUnit(kode);
      kirimJSON(res, 200, {
        poles: d.poles, koreksi: d.koreksi || [], tugas: d.tugas || [],
        hapus: d.hapus || [],
        harga: d.harga || null, riwayatHarga: d.riwayatHarga || [],
        pekerjaanStatus: d.pekerjaanStatus || {},
        diperbarui: d.diperbarui,
      });
      return;
    }

    if (req.method === 'POST' && url.startsWith('/api/sync')) {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 100 * 1024 * 1024) req.destroy(); // batas 100 MB
      });
      req.on('end', () => {
        try {
          const masuk = JSON.parse(body);
          const lama = bacaUnit(kode);
          const hasil = gabung(lama.poles, masuk.poles);
          const koreksi = gabungKoreksi(lama.koreksi, masuk.koreksi);
          const tugas = gabungTugas(lama.tugas, masuk.tugas);
          const h = gabungHarga(lama.harga, masuk.harga, lama.riwayatHarga);
          const pekerjaanStatus = gabungStatusPekerjaan(lama.pekerjaanStatus, masuk.pekerjaanStatus);
          // terapkan tanda-hapus: titik yang dihapus tidak pernah kembali dari
          // perangkat mana pun (kecuali diedit ulang SETELAH penghapusan)
          const hapus = gabungHapus(lama.hapus, masuk.hapus);
          const petaHapus = new Map(hapus.map(t => [t.uid, t.diubah]));
          hasil.poles = hasil.poles.filter(p =>
            !(petaHapus.has(p.uid) && petaHapus.get(p.uid) >= (Number(p.diubah) || 0)));
          tulisUnit(kode, {
            poles: hasil.poles, koreksi, tugas, hapus,
            harga: h.harga || null, riwayatHarga: h.riwayat || [],
            pekerjaanStatus,
            diperbarui: Date.now(),
          });
          console.log(`[sync] ${kode}: +${hasil.baru} baru, ${hasil.diperbarui} diperbarui, total ${hasil.poles.length}, `
            + `koreksi ${koreksi.length}, tugas ${tugas.length}${h.berubah ? ', harga terpusat diperbarui' : ''}`);
          kirimJSON(res, 200, {
            total: hasil.poles.length, baru: hasil.baru, diperbarui: hasil.diperbarui,
            koreksi: koreksi.length, tugas: tugas.length,
            harga: h.harga || null, hargaBerubah: h.berubah,
          });
        } catch (e) {
          kirimJSON(res, 400, { error: 'JSON tidak valid' });
        }
      });
      return;
    }

    kirimJSON(res, 404, { error: 'endpoint tidak dikenal' });
    return;
  }

  // selain /api/* → sajikan aplikasi CAKRA
  sajikanFile(req, res, url);
}).listen(PORT, () => {
  console.log('============================================');
  console.log('  CAKRA SERVER berjalan di port ' + PORT);
  console.log('  Aplikasi : http://<ip-komputer-ini>:' + PORT + '/');
  console.log('  Dasbor   : http://<ip-komputer-ini>:' + PORT + '/dasbor.html');
  console.log('  Data     : ' + DIR_DATA);
  console.log('============================================');
});
