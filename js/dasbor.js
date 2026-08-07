/* ============================================================
   DASBOR.JS — DASBOR MANAJEMEN CAKRA (M4)
   Menggabungkan data banyak surveyor (server atau file JSON),
   memetakan kondisi aset, dan mengelola status tindak lanjut
   usulan perbaikan.
   ============================================================ */

let poles = [];
let koreksi = [];     // koreksi sambungan antar tiang (ikut tersinkron)
let asetStatis = [];  // aset TM bawaan (data/aset-tm.json)
let tugas = [];       // penugasan survey (FR-16) — ikut tersinkron
let hargaTerpusat = null;  // master harga unit (FR-15) — info dari server
let riwayatHarga = [];
let pekerjaanStatus = {};  // tahap pekerjaan perluasan: nama -> {status, diubah, oleh}
const KUNCI_CFG = 'cakra_dasbor_cfg';
const kunciPasangan = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

// ---------------- util ----------------
const $ = (sel) => document.querySelector(sel);
const rupiah = (n) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));
const angka = (n) => new Intl.NumberFormat('id-ID').format(Math.round(n));

function toast(pesan) {
  const t = $('#toast');
  t.textContent = pesan;
  t.classList.add('tampil');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('tampil'), 2800);
}

function hargaMat(kode) { return (MATERIALS[kode] || {}).harga || 0; }
function jasaMat(kode) { return (MATERIALS[kode] || {}).jasa || 0; }

function biayaPaket(kode) {
  const pk = PAKET_PERBAIKAN[kode];
  if (!pk) return { material: 0, jasa: 0, total: 0 };
  let material = 0, jasa = 0;
  Object.entries(pk.bom).forEach(([k, q]) => { material += hargaMat(k) * q; jasa += jasaMat(k) * q; });
  if (pk.tanamTiang) jasa += (MATERIALS.JASA_TIANG || {}).harga || 0;
  return { material, jasa, total: material + jasa };
}

function skorPrioritas(p) {
  return (BOBOT_KONDISI[p.kondisi] || 1) * ((DAMPAK[p.dampak] || DAMPAK.sedang).bobot);
}
const warnaSkor = (s) => (s >= 6 ? '#e53935' : s >= 3 ? '#f57c00' : '#2e7d32');

// ---------------- hitungan PERLUASAN JTM (fokus utama dasbor) ----------------
function jarakM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// biaya satu tiang rencana: batang tiang + BOM konstruksi + aksesoris + jasa tanam
function biayaTitikRencana(p) {
  let total = 0;
  const tambah = (kode, q) => { total += (hargaMat(kode) + jasaMat(kode)) * q; };
  if (MATERIALS[p.tiang]) tambah(p.tiang, 1);
  const k = KONSTRUKSI[p.konstruksi];
  if (k) Object.entries(k.bom).forEach(([kode, q]) => tambah(kode, q));
  (Array.isArray(p.aksesoris) ? p.aksesoris : []).forEach(a => {
    const ak = AKSESORIS[a];
    if (ak) Object.entries(ak.bom).forEach(([kode, q]) => tambah(kode, q));
  });
  total += hargaMat('JASA_TIANG');
  return total;
}

// rekap perluasan per pekerjaan: jumlah tiang rencana, panjang rute, ± nilai RAB
// (penghantar diperkirakan AAAC 70 · 3 fasa · andongan 3% + jasa tarik)
function perluasanPerPekerjaan() {
  const grup = {};
  poles.filter(p => p.mode === 'rencana').forEach(p => {
    const kunci = p.pekerjaan || '(tanpa nama pekerjaan)';
    (grup[kunci] = grup[kunci] || []).push(p);
  });
  const hasil = {};
  Object.entries(grup).forEach(([nama, daftar]) => {
    let rute = 0;
    for (let i = 1; i < daftar.length; i++) {
      const d = jarakM(daftar[i - 1], daftar[i]);
      if (d <= 2000) rute += d; // bentang > 2 km = bukan satu rantai (lokasi berbeda) — dilewati
    }
    let biaya = 0, mulai = 0, akhir = 0;
    daftar.forEach(p => {
      biaya += biayaTitikRencana(p);
      const t = p.diubah || 0;
      if (t) { if (!mulai || t < mulai) mulai = t; if (t > akhir) akhir = t; }
    });
    biaya += rute * 3 * 1.03 * hargaMat('PH_AAAC70') + (rute / 1000) * hargaMat('JASA_TARIK');
    hasil[nama] = { tiang: daftar.length, rute, biaya, mulai, akhir };
  });
  return hasil;
}

// tahap pekerjaan (survey→diusulkan→disetujui→konstruksi→selesai)
function tahapPekerjaan(nama) {
  const s = (pekerjaanStatus[nama] || {}).status;
  return STATUS_PEKERJAAN[s] ? s : 'survey';
}

function gabungPekerjaanStatus(masuk) {
  Object.entries(masuk || {}).forEach(([k, v]) => {
    if (!v || typeof v !== 'object') return;
    const ada = pekerjaanStatus[k];
    if (!ada || (Number(v.diubah) || 0) > (Number(ada.diubah) || 0)) pekerjaanStatus[k] = v;
  });
}

// ---------------- normalisasi & gabung ----------------
function rapikan(p, i) {
  if (!p || typeof p !== 'object') return null;
  const lat = Number(p.lat), lng = Number(p.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    uid: (typeof p.uid === 'string' && p.uid.length >= 3) ? p.uid.slice(0, 40) : `impor-${i}-${lat.toFixed(5)}-${lng.toFixed(5)}`,
    nama: (typeof p.nama === 'string' && p.nama.trim()) ? p.nama.trim().slice(0, 40) : `#${i + 1}`,
    lat, lng,
    mode: (p.mode === 'eksisting' || p.mode === 'pelanggan') ? p.mode : 'rencana',
    namaPelanggan: typeof p.namaPelanggan === 'string' ? p.namaPelanggan.slice(0, 60) : '',
    fotoPelanggan: (p.fotoPelanggan && typeof p.fotoPelanggan === 'object') ? p.fotoPelanggan : {},
    konstruksi: KONSTRUKSI[p.konstruksi] ? p.konstruksi : 'TM-1',
    jenisAset: JENIS_ASET[p.jenisAset] ? p.jenisAset : 'TIANG_TM',
    kondisi: KONDISI[p.kondisi] ? p.kondisi : 'baik',
    dampak: DAMPAK[p.dampak] ? p.dampak : 'sedang',
    usulan: (Array.isArray(p.usulan) ? p.usulan : []).map(u => {
      if (typeof u === 'string') return PAKET_PERBAIKAN[u] ? { paket: u, status: 'diusulkan' } : null;
      if (u && PAKET_PERBAIKAN[u.paket]) return { paket: u.paket, status: STATUS_USULAN[u.status] ? u.status : 'diusulkan' };
      return null;
    }).filter(Boolean),
    foto: (Array.isArray(p.foto) ? p.foto : []).filter(f => typeof f === 'string' && f.startsWith('data:image')).slice(0, 3),
    petugas: typeof p.petugas === 'string' ? p.petugas.slice(0, 40) : '',
    ulp: typeof p.ulp === 'string' ? p.ulp.slice(0, 40) : '',
    pekerjaan: typeof p.pekerjaan === 'string' ? p.pekerjaan.slice(0, 100) : '',
    catatan: typeof p.catatan === 'string' ? p.catatan.slice(0, 300) : '',
    diubah: isFinite(p.diubah) ? Number(p.diubah) : 0,
    sambung: Array.isArray(p.sambung) ? p.sambung.filter(s => typeof s === 'string' && s.length >= 3).slice(0, 8) : [],
    // dibawa apa adanya agar unduhan JSON gabungan tetap lengkap utk aplikasi survey
    id: p.id, tiang: p.tiang, aksesoris: p.aksesoris, temuan: p.temuan,
  };
}

function gabung(masuk) {
  const peta = new Map(poles.map(p => [p.uid, p]));
  let baru = 0, diperbarui = 0;
  (Array.isArray(masuk) ? masuk : []).forEach((m, i) => {
    const n = rapikan(m, peta.size + i);
    if (!n) return;
    const ada = peta.get(n.uid);
    if (!ada) { peta.set(n.uid, n); baru++; }
    else if ((n.diubah || 0) > (ada.diubah || 0)) { peta.set(n.uid, n); diperbarui++; }
  });
  poles = [...peta.values()];
  return { baru, diperbarui, total: poles.length };
}

function gabungKoreksi(masuk) {
  const peta = new Map(koreksi.map(k => [kunciPasangan(k.a, k.b), k]));
  (Array.isArray(masuk) ? masuk : []).forEach(k => {
    if (!k || typeof k.a !== 'string' || typeof k.b !== 'string') return;
    if (k.aksi !== 'tambah' && k.aksi !== 'hapus') return;
    const ada = peta.get(kunciPasangan(k.a, k.b));
    if (!ada || (k.diubah || 0) > (ada.diubah || 0)) peta.set(kunciPasangan(k.a, k.b), k);
  });
  koreksi = [...peta.values()];
}

// ---------------- penugasan survey (FR-16) ----------------
function normalisasiTugas(daftar) {
  return (Array.isArray(daftar) ? daftar : [])
    .filter(t => t && typeof t.id === 'string' && t.id.length >= 3 &&
      typeof t.judul === 'string' && t.judul.trim())
    .slice(0, 500)
    .map(t => ({
      id: t.id.slice(0, 40),
      judul: t.judul.trim().slice(0, 80),
      untuk: typeof t.untuk === 'string' ? t.untuk.trim().slice(0, 40) : '',
      lokasi: typeof t.lokasi === 'string' ? t.lokasi.trim().slice(0, 80) : '',
      lat: isFinite(t.lat) ? Number(t.lat) : null,
      lng: isFinite(t.lng) ? Number(t.lng) : null,
      catatan: typeof t.catatan === 'string' ? t.catatan.slice(0, 300) : '',
      status: STATUS_TUGAS[t.status] ? t.status : 'baru',
      oleh: typeof t.oleh === 'string' ? t.oleh.slice(0, 40) : '',
      dibuat: Number(t.dibuat) || 0,
      diubah: Number(t.diubah) || 0,
    }));
}

function gabungTugas(masuk) {
  const peta = new Map(tugas.map(t => [t.id, t]));
  let baru = 0;
  normalisasiTugas(masuk).forEach(t => {
    const ada = peta.get(t.id);
    if (!ada) { peta.set(t.id, t); baru++; }
    else if ((t.diubah || 0) > (ada.diubah || 0)) peta.set(t.id, t);
  });
  tugas = [...peta.values()];
  return baru;
}

function tambahTugas() {
  const judul = $('#t-judul').value.trim().slice(0, 80);
  if (!judul) { toast('Isi judul tugas dulu (mis. "Survey kondisi penyulang Amahai")'); return; }
  const tikor = parseTikor($('#t-tikor').value || '');
  const sesi = (typeof sesiCakra === 'function' && sesiCakra()) || {};
  tugas.push({
    id: 'tg' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36),
    judul,
    untuk: $('#t-untuk').value.trim().slice(0, 40),
    lokasi: $('#t-lokasi').value.trim().slice(0, 80),
    lat: tikor ? tikor.lat : null,
    lng: tikor ? tikor.lng : null,
    catatan: $('#t-catatan').value.trim().slice(0, 300),
    status: 'baru',
    oleh: sesi.petugas || '',
    dibuat: Date.now(),
    diubah: Date.now(),
  });
  ['#t-judul', '#t-untuk', '#t-lokasi', '#t-tikor', '#t-catatan'].forEach(s => { $(s).value = ''; });
  renderTugasDasbor();
  toast('🗒️ Tugas dibuat — tersinkron otomatis, surveyor menerimanya saat ⬇️ Ambil dari Server');
  kirimServer(true);
}

function renderTugasDasbor() {
  const bolehKelola = typeof bolehKelolaTugas === 'function' && bolehKelolaTugas();
  $('#t-form').classList.toggle('sembunyi', !bolehKelola);
  $('#t-ket-peran').classList.toggle('sembunyi', bolehKelola);

  const wadah = $('#d-tabel-tugas');
  if (!tugas.length) {
    wadah.innerHTML = '<p class="catatan-kecil">Belum ada penugasan. Ambil dari server dulu, atau buat tugas baru di atas.</p>';
    return;
  }
  const urutan = { baru: 0, dikerjakan: 1, selesai: 2, dibatalkan: 3 };
  let html = `<table class="rab"><tr>
    <th>Tugas</th><th>Untuk</th><th>Lokasi</th><th>Dibuat</th><th>Status</th></tr>`;
  [...tugas].sort((a, b) => (urutan[a.status] - urutan[b.status]) || (b.dibuat - a.dibuat)).forEach(t => {
    const st = STATUS_TUGAS[t.status];
    const selStatus = bolehKelola
      ? `<select data-tugas="${t.id}" style="border-left:4px solid ${st.warna}">${Object.entries(STATUS_TUGAS)
          .map(([kode, s]) => `<option value="${kode}" ${t.status === kode ? 'selected' : ''}>${s.nama}</option>`).join('')}</select>`
      : `<span class="badge-skor" style="background:${st.warna}">${st.nama}</span>`;
    html += `<tr>
      <td><b>${t.judul}</b>${t.catatan ? `<br><small>${t.catatan}</small>` : ''}</td>
      <td>${t.untuk || 'semua surveyor'}</td>
      <td>${t.lokasi || '—'}${t.lat !== null ? ` <button class="tombol polos kecil" data-peta="${t.id}">📍</button>` : ''}</td>
      <td>${t.dibuat ? new Date(t.dibuat).toLocaleDateString('id-ID') : '—'}${t.oleh ? '<br><small>oleh ' + t.oleh + '</small>' : ''}</td>
      <td>${selStatus}</td>
    </tr>`;
  });
  html += '</table>';
  wadah.innerHTML = html;

  wadah.querySelectorAll('select[data-tugas]').forEach(sel => {
    sel.onchange = () => {
      const t = tugas.find(x => x.id === sel.dataset.tugas);
      if (!t) return;
      t.status = sel.value;
      t.diubah = Date.now();
      renderTugasDasbor();
      toast(`🗒️ "${t.judul}" → ${STATUS_TUGAS[sel.value].nama}`);
      kirimServer(true);
    };
  });
  wadah.querySelectorAll('[data-peta]').forEach(b => {
    b.onclick = () => {
      const t = tugas.find(x => x.id === b.dataset.peta);
      if (!t || t.lat === null) return;
      peta.setView([t.lat, t.lng], 16);
      document.querySelector('#peta-dasbor').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  });
}

// ---------------- master harga terpusat (FR-15) — info & riwayat ----------------
function renderHargaTerpusat() {
  const wadah = $('#d-harga-info');
  if (!hargaTerpusat) {
    wadah.innerHTML = `<p class="catatan-kecil">Belum ada master harga terpusat unit ini. Admin: ubah harga di
      aplikasi survey (⚙️ Pengaturan) lalu ⬆️ Kirim ke Server — semua perangkat mengikuti saat sinkronisasi.</p>`;
    return;
  }
  const jmlH = Object.keys(hargaTerpusat.hargaOverride || {}).length;
  const jmlJ = Object.keys(hargaTerpusat.jasaOverride || {}).length;
  let html = `<p class="catatan-kecil">💰 Master harga aktif: <b>${jmlH} harga material</b> &amp; <b>${jmlJ} harga jasa</b> diubah dari bawaan
    — terakhir diperbarui ${new Date(hargaTerpusat.diubah).toLocaleString('id-ID')}${hargaTerpusat.oleh ? ' oleh <b>' + hargaTerpusat.oleh + '</b>' : ''}.</p>`;
  if (riwayatHarga.length) {
    html += `<table class="rab"><tr><th>Waktu</th><th>Oleh</th><th class="angka">Harga Material Diubah</th><th class="angka">Harga Jasa Diubah</th></tr>`;
    [...riwayatHarga].reverse().slice(0, 10).forEach(r => {
      html += `<tr><td>${new Date(r.diubah).toLocaleString('id-ID')}</td><td>${r.oleh || '—'}</td>
        <td class="angka">${r.jumlahHarga}</td><td class="angka">${r.jumlahJasa}</td></tr>`;
    });
    html += '</table>';
  }
  wadah.innerHTML = html;
}

async function muatAsetStatis() {
  try {
    const res = await fetch('data/aset-tm.json');
    if (!res.ok) return;
    const d = await res.json();
    asetStatis = (Array.isArray(d.poles) ? d.poles : [])
      .filter(p => p && typeof p.uid === 'string' && isFinite(p.lat) && isFinite(p.lng));
    renderPeta();
    if (asetStatis.length && !poles.length) {
      peta.fitBounds(asetStatis.filter((_, i) => i % 25 === 0).map(p => [p.lat, p.lng]), { padding: [30, 30] });
    }
  } catch (e) { /* offline tanpa cache — lewati */ }
}

// ---------------- peta ----------------
let peta, layerTitik, layerAsetD, sudahFit = false;
let cacheMarkerAsetD = new Map(); // marker aset bawaan — dibangun sekali
const ZOOM_MIN_MARKER_ASET = 13;  // di bawah ini marker aset disembunyikan (LOD)
let lodTampilD = true;

function renderAsetDasbor(tersurvey) {
  if (!layerAsetD) return;
  if (!cacheMarkerAsetD.size && asetStatis.length) {
    asetStatis.forEach(p => {
      const cm = L.circleMarker([p.lat, p.lng], { radius: 3.5, weight: 1, color: '#fff', fillColor: '#43a047', fillOpacity: .9 })
        .bindPopup(`<b>${p.nama}</b> — Tiang TM (aset)<br>${p.catatan || ''}`);
      cm.addTo(layerAsetD);
      cacheMarkerAsetD.set(p.uid, cm);
    });
  }
  cacheMarkerAsetD.forEach((cm, uid) => {
    const sembunyikan = tersurvey.has(uid);
    const tampil = layerAsetD.hasLayer(cm);
    if (sembunyikan && tampil) layerAsetD.removeLayer(cm);
    else if (!sembunyikan && !tampil) layerAsetD.addLayer(cm);
  });
}

function aturLodAsetD() {
  const tampil = peta.getZoom() >= ZOOM_MIN_MARKER_ASET;
  if (tampil === lodTampilD) return;
  lodTampilD = tampil;
  if (tampil) { if (!peta.hasLayer(layerAsetD)) peta.addLayer(layerAsetD); }
  else { if (peta.hasLayer(layerAsetD)) peta.removeLayer(layerAsetD); }
}

function initPeta() {
  peta = L.map('peta-dasbor', { preferCanvas: true }).setView([-3.3, 128.95], 11);
  const voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    { maxZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO' });
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' });
  const satelit = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri' });
  voyager.addTo(peta);
  L.control.layers({ 'Peta Jalan': voyager, 'OpenStreetMap': osm, 'Satelit': satelit }).addTo(peta);
  layerAsetD = L.layerGroup().addTo(peta);
  layerTitik = L.layerGroup().addTo(peta);
  peta.on('zoomend', aturLodAsetD);
  aturLodAsetD(); // zoom awal 11 < 13 → marker aset mulai tersembunyi
}

function popupHTML(p) {
  const eksisting = p.mode === 'eksisting';
  const judul = p.mode === 'pelanggan'
    ? `Calon Pelanggan: ${p.namaPelanggan || '-'}`
    : eksisting ? (JENIS_ASET[p.jenisAset] || {}).nama : `${p.konstruksi} (rencana)`;
  const kd = KONDISI[p.kondisi] || KONDISI.baik;
  const totalUsulan = p.usulan.reduce((jml, u) => jml + biayaPaket(u.paket).total, 0);
  const daftarPekerjaan = p.usulan.map(u => {
    const st = STATUS_USULAN[u.status] || STATUS_USULAN.diusulkan;
    return `• ${(PAKET_PERBAIKAN[u.paket] || {}).nama || u.paket}
      <span class="badge-skor" style="background:${st.warna};font-size:10px">${st.nama}</span>`;
  }).join('<br>');
  return `<div class="popup-tiang">
    <div class="pjudul">${p.nama} — ${judul}</div>
    <div class="pinfo">
      ${eksisting ? `Kondisi: <b style="color:${kd.warna}">${kd.nama}</b> · Prioritas ${skorPrioritas(p)}<br>` : ''}
      ${daftarPekerjaan ? `<b>Pekerjaan (${p.usulan.length}) — ${rupiah(totalUsulan)}:</b><br>${daftarPekerjaan}<br>` : ''}
      ${p.petugas ? `Petugas: ${p.petugas}<br>` : ''}
      ${p.catatan ? p.catatan + '<br>' : ''}
      ${p.foto.map(f => `<img class="foto-mini" src="${f}">`).join('')}
    </div></div>`;
}

// fokus peta ke sebuah titik + buka popupnya (dipanggil dari daftar usulan)
function fokusTitik(uid) {
  const p = poles.find(x => x.uid === uid);
  if (!p) return;
  peta.setView([p.lat, p.lng], 18);
  const m = markerPerUid.get(uid);
  if (m) m.openPopup();
  document.querySelector('#peta-dasbor').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

let markerPerUid = new Map(); // untuk fokus + buka popup dari daftar usulan

function renderPeta() {
  layerTitik.clearLayers();
  markerPerUid = new Map();
  // garis jaringan: aset bawaan + data survey, ditimpa koreksi sambungan
  const posisi = new Map();
  asetStatis.forEach(p => posisi.set(p.uid, p));
  poles.forEach(p => posisi.set(p.uid, p));
  const tersurvey = new Set(poles.map(p => p.uid));
  const edges = new Map();
  const tambahEdge = (a, b) => {
    if (a !== b && posisi.has(a) && posisi.has(b)) edges.set(kunciPasangan(a, b), [a, b]);
  };
  asetStatis.forEach(p => { if (!tersurvey.has(p.uid)) (p.sambung || []).forEach(u => tambahEdge(p.uid, u)); });
  poles.forEach(p => (p.sambung || []).forEach(u => tambahEdge(p.uid, u)));
  koreksi.forEach(k => {
    if (k.aksi === 'hapus') edges.delete(kunciPasangan(k.a, k.b));
    else tambahEdge(k.a, k.b);
  });
  const segmen = [];
  edges.forEach(([a, b]) => segmen.push([[posisi.get(a).lat, posisi.get(a).lng], [posisi.get(b).lat, posisi.get(b).lng]]));
  if (segmen.length) L.polyline(segmen, { color: '#2e7d32', weight: 2.5, opacity: .85, smoothFactor: 2.5 }).addTo(layerTitik);

  // marker aset bawaan: di layer terpisah, dibangun sekali, disembunyikan saat
  // yang tersurvey berubah / zoom jauh (level-of-detail)
  renderAsetDasbor(tersurvey);
  poles.forEach(p => {
    const warna = p.mode === 'pelanggan'
      ? '#7b1fa2'
      : p.mode === 'eksisting'
        ? (KONDISI[p.kondisi] || KONDISI.baik).warna
        : (KONSTRUKSI[p.konstruksi] || {}).warna || '#0c6bb5';
    let m;
    if (p.mode === 'eksisting' && (p.usulan || []).length) {
      // titik ber-usulan: marker berlencana ❗ (belum rampung) / ✔ (semua selesai)
      const selesai = p.usulan.every(u => u.status === 'selesai');
      m = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: 'label-tiang',
          html: `<div class="pin"><div class="badge-u ${selesai ? 'ok' : 'perlu'}">${selesai ? '✔' : '!'}</div>
            <div class="titik" style="background:${warna};border-radius:3px"></div>
            <div class="nama">${p.nama}</div></div>`,
          iconSize: [0, 0],
        }),
      });
    } else {
      m = L.circleMarker([p.lat, p.lng], { radius: 7, weight: 2, color: '#fff', fillColor: warna, fillOpacity: 1 });
    }
    m.bindPopup(popupHTML(p)).addTo(layerTitik);
    markerPerUid.set(p.uid, m);
  });
  if (poles.length && !sudahFit) {
    peta.fitBounds(poles.map(p => [p.lat, p.lng]), { padding: [30, 30] });
    sudahFit = true;
  }
}

// ---------------- ringkasan & tabel ----------------
function semuaUsulan() {
  const daftar = [];
  poles.filter(p => p.mode === 'eksisting').forEach(p => {
    p.usulan.forEach(u => {
      const b = biayaPaket(u.paket);
      daftar.push({ pole: p, entri: u, skor: skorPrioritas(p), ...b });
    });
  });
  daftar.sort((a, b) => b.skor - a.skor || b.total - a.total);
  return daftar;
}

function renderRingkasan() {
  // baris pertama: PERLUASAN JTM — fokus utama pemantauan
  const perluasan = perluasanPerPekerjaan();
  const namaPerluasan = Object.keys(perluasan);
  const totTiang = namaPerluasan.reduce((a, n) => a + perluasan[n].tiang, 0);
  const totRute = namaPerluasan.reduce((a, n) => a + perluasan[n].rute, 0);
  const totBiaya = namaPerluasan.reduce((a, n) => a + perluasan[n].biaya, 0);
  const gayaUtama = 'background:#e8f2fb;border-color:#9ec4e4';
  let html = `
    <div class="kartu-stat" style="${gayaUtama}"><div class="nilai">${namaPerluasan.length}</div><div class="ket"><b>PEKERJAAN PERLUASAN JTM</b></div></div>
    <div class="kartu-stat" style="${gayaUtama}"><div class="nilai">${totTiang}</div><div class="ket"><b>TIANG RENCANA</b> (semua pekerjaan)</div></div>
    <div class="kartu-stat" style="${gayaUtama}"><div class="nilai">${totRute >= 1000
      ? (totRute / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' km'
      : angka(totRute) + ' m'}</div><div class="ket"><b>PANJANG RUTE JARINGAN</b></div></div>
    <div class="kartu-stat" style="${gayaUtama}"><div class="nilai">${rupiah(totBiaya)}</div><div class="ket"><b>± NILAI RAB PERLUASAN</b></div></div>`;

  // baris berikutnya: survey aset & tindak lanjut (pelengkap)
  const eksisting = poles.filter(p => p.mode === 'eksisting');
  const rusak = eksisting.filter(p => p.kondisi !== 'baik');
  const usulan = semuaUsulan();
  const totalNilai = usulan.reduce((jml, u) => jml + u.total, 0);
  const selesai = usulan.filter(u => u.entri.status === 'selesai');
  const pelanggan = poles.filter(p => p.mode === 'pelanggan');
  html += `
    <div class="kartu-stat"><div class="nilai">${eksisting.length}</div><div class="ket">Aset tersurvey (${rusak.length} rusak)</div></div>
    <div class="kartu-stat"><div class="nilai">${usulan.length} · ${rupiah(totalNilai)}</div><div class="ket">Usulan perbaikan (${selesai.length} selesai)</div></div>
    <div class="kartu-stat"><div class="nilai" style="color:#7b1fa2">${pelanggan.length}</div><div class="ket">Calon pelanggan</div></div>`;
  $('#d-ringkasan').innerHTML = html;
}

// ---------------- daftar pekerjaan yang masuk ----------------
// Setiap titik mencatat nama pekerjaannya + waktu disimpan — di sini
// direkap per pekerjaan supaya pemantau langsung tahu apa saja yang masuk.
function tglSingkat(ts) {
  return ts ? new Date(ts).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '—';
}

function renderDaftarPekerjaan() {
  const wadah = $('#d-pekerjaan');
  if (!poles.length) {
    wadah.innerHTML = '<p class="catatan-kecil">Belum ada pekerjaan yang masuk.</p>';
    return;
  }
  const grup = {};
  poles.forEach(p => {
    const kunci = p.pekerjaan || '(tanpa nama pekerjaan)';
    const g = grup[kunci] = grup[kunci] ||
      { titik: 0, usulan: 0, selesai: 0, nilai: 0, pelanggan: 0, evidenLengkap: 0,
        petugas: new Set(), ulp: new Set(), terakhir: 0 };
    g.titik++;
    (p.usulan || []).forEach(u => {
      g.usulan++;
      if (u.status === 'selesai') g.selesai++;
      g.nilai += biayaPaket(u.paket).total;
    });
    if (p.mode === 'pelanggan') {
      g.pelanggan++;
      const f = p.fotoPelanggan || {};
      if (Object.keys(EVIDEN_PELANGGAN).every(k => f[k])) g.evidenLengkap++;
    }
    if (p.petugas) g.petugas.add(p.petugas);
    if (p.ulp) g.ulp.add(p.ulp);
    if ((p.diubah || 0) > g.terakhir) g.terakhir = p.diubah;
  });

  const perluasan = perluasanPerPekerjaan();
  const bolehUbah = typeof bolehKelolaUsulan === 'function' && bolehKelolaUsulan();
  let html = `<table class="rab"><tr>
    <th>Nama Pekerjaan</th><th>Unit</th><th>Petugas</th>
    <th class="angka">Tiang Rencana</th><th class="angka">Rute</th><th class="angka">± RAB Perluasan (Rp)</th>
    <th style="min-width:150px">Tahap &amp; Progres</th>
    <th class="angka">Calon Pelanggan</th>
    <th class="angka">Usulan Perbaikan</th><th>Terakhir Disimpan</th></tr>`;
  Object.entries(grup)
    .sort((a, b) => {
      // pekerjaan perluasan (punya tiang rencana) selalu di atas, lalu urut terbaru
      const pa = perluasan[a[0]] ? 1 : 0, pb = perluasan[b[0]] ? 1 : 0;
      return (pb - pa) || (b[1].terakhir - a[1].terakhir);
    })
    .forEach(([nama, g]) => {
      const pl = perluasan[nama];
      // tahap & progres hanya untuk pekerjaan perluasan (punya tiang rencana)
      let selTahap = '—';
      if (pl) {
        const kunciTahap = tahapPekerjaan(nama);
        const st = STATUS_PEKERJAAN[kunciTahap];
        const kontrol = bolehUbah
          ? `<select data-pkj="${encodeURIComponent(nama)}" style="border-left:4px solid ${st.warna}">${
              Object.entries(STATUS_PEKERJAAN).map(([k, s]) =>
                `<option value="${k}" ${k === kunciTahap ? 'selected' : ''}>${s.nama} (${s.persen}%)</option>`).join('')}</select>`
          : `<span class="badge-skor" style="background:${st.warna}">${st.nama} ${st.persen}%</span>`;
        selTahap = `${kontrol}<div class="batang-progres" style="margin-top:4px"><div style="width:${st.persen}%;background:${st.warna}"></div></div>`;
      }
      html += `<tr>
        <td><b>${nama}</b></td>
        <td>${[...g.ulp].join(', ') || '—'}</td>
        <td>${[...g.petugas].join(', ') || '—'}</td>
        <td class="angka">${pl ? pl.tiang : '—'}</td>
        <td class="angka">${pl && pl.rute ? (pl.rute >= 1000
          ? (pl.rute / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' km'
          : angka(pl.rute) + ' m') : '—'}</td>
        <td class="angka"><b>${pl ? angka(pl.biaya) : '—'}</b></td>
        <td>${selTahap}</td>
        <td class="angka">${g.pelanggan
          ? `<b style="color:#7b1fa2">${g.pelanggan}</b><br><small>${g.evidenLengkap} eviden lengkap</small>`
          : '—'}</td>
        <td class="angka">${g.usulan ? `${g.usulan}${g.selesai ? ` (${g.selesai} selesai)` : ''} · ${angka(g.nilai)}` : '—'}</td>
        <td>${tglSingkat(g.terakhir)}</td></tr>`;
    });
  wadah.innerHTML = html + `</table>
    <p class="catatan-kecil">± RAB Perluasan = tiang + konstruksi + aksesoris + jasa tanam + perkiraan penghantar
    (AAAC 70 · 3 fasa · andongan 3%) + jasa tarik — RAB rinci resmi tetap dari aplikasi surveyor (🧾 RAB Resmi).</p>`;

  // ubah tahap → tersimpan & tersinkron otomatis, timeline ikut segar
  wadah.querySelectorAll('select[data-pkj]').forEach(sel => {
    sel.onchange = () => {
      const nama = decodeURIComponent(sel.dataset.pkj);
      const sesi = (typeof sesiCakra === 'function' && sesiCakra()) || {};
      pekerjaanStatus[nama] = { status: sel.value, diubah: Date.now(), oleh: sesi.petugas || '' };
      renderDaftarPekerjaan(); renderTimeline();
      toast(`⚡ "${nama}" → ${STATUS_PEKERJAAN[sel.value].nama}`);
      kirimServer(true);
    };
  });
}

// ---------------- timeline pekerjaan perluasan ----------------
// Batang waktu per pekerjaan: dari titik pertama disimpan s.d. aktivitas
// terakhir, diwarnai sesuai tahapnya; garis merah = hari ini.
function tglPendek(ts) {
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' });
}

function renderTimeline() {
  const wadah = $('#d-timeline');
  const perluasan = perluasanPerPekerjaan();
  const entri = Object.entries(perluasan).filter(([, g]) => g.mulai);
  if (!entri.length) {
    wadah.innerHTML = '<p class="catatan-kecil">Belum ada pekerjaan perluasan untuk ditampilkan di timeline.</p>';
    return;
  }
  const min = Math.min(...entri.map(([, g]) => g.mulai));
  const maks = Math.max(...entri.map(([, g]) => g.akhir), Date.now());
  const bentang = Math.max(maks - min, 864e5); // minimal 1 hari agar batang tidak degenerate
  const posKini = Math.min(((Date.now() - min) / bentang) * 100, 100);

  let html = `<div class="tl-sumbu"><span>${tglPendek(min)}</span>
    <span style="color:#e53935">▼ hari ini</span><span>${tglPendek(maks)}</span></div>`;
  entri.sort((a, b) => a[1].mulai - b[1].mulai).forEach(([nama, g]) => {
    const st = STATUS_PEKERJAAN[tahapPekerjaan(nama)];
    const kiri = ((g.mulai - min) / bentang) * 100;
    const lebar = Math.max(((g.akhir - g.mulai) / bentang) * 100, 3);
    html += `<div class="tl-baris">
      <div class="tl-nama" title="${nama}">${nama}</div>
      <div class="tl-rel">
        <div class="tl-kini" style="left:${posKini}%"></div>
        <div class="tl-bar" style="left:${Math.min(kiri, 97)}%;width:${lebar}%;background:${st.warna}"
          title="${tglSingkat(g.mulai)} — ${tglSingkat(g.akhir)}">${st.nama} · ${st.persen}%</div>
      </div>
      <div class="tl-tgl">${tglPendek(g.mulai)} – ${tglPendek(g.akhir)}</div>
    </div>`;
  });
  wadah.innerHTML = html;
}

// ---------------- monitoring per petugas & unit (ULP) ----------------
// Rekap semua usulan pekerjaan dari seluruh petugas, dikelompokkan per unit:
// jumlah titik, usulan per status, nilai, dan batang progres penyelesaian.
function renderMonitoringPetugas() {
  const wadah = $('#d-monitoring');
  const eksisting = poles.filter(p => p.mode === 'eksisting');
  if (!poles.length) {
    wadah.innerHTML = '<p class="catatan-kecil">Belum ada data survey.</p>';
    return;
  }

  // grup[ulp][petugas] = { titik, usulan: {status: n}, nilai }
  const grup = {};
  poles.forEach(p => {
    const ulp = p.ulp || '(tanpa unit)';
    const ptg = p.petugas || '(tanpa nama)';
    grup[ulp] = grup[ulp] || {};
    const g = grup[ulp][ptg] = grup[ulp][ptg] ||
      { titik: 0, usulan: { diusulkan: 0, disetujui: 0, dikerjakan: 0, selesai: 0 }, nilai: 0 };
    g.titik++;
    (p.usulan || []).forEach(u => {
      if (g.usulan[u.status] === undefined) return;
      g.usulan[u.status]++;
      g.nilai += biayaPaket(u.paket).total;
    });
  });

  let html = '';
  Object.keys(grup).sort().forEach(ulp => {
    const petugasUnit = grup[ulp];
    const totalUnit = Object.values(petugasUnit).reduce((a, g) => {
      a.titik += g.titik; a.nilai += g.nilai;
      Object.keys(a.usulan).forEach(s => { a.usulan[s] += g.usulan[s]; });
      return a;
    }, { titik: 0, nilai: 0, usulan: { diusulkan: 0, disetujui: 0, dikerjakan: 0, selesai: 0 } });
    const totU = Object.values(totalUnit.usulan).reduce((a, b) => a + b, 0);

    html += `<div class="judul-seksi" style="margin-top:10px">🏢 ${ulp} — ${totalUnit.titik} titik · ${totU} usulan · ${rupiah(totalUnit.nilai)}</div>
      <table class="rab"><tr><th>Petugas</th><th class="angka">Titik</th>
        ${Object.values(STATUS_USULAN).map(s => `<th class="angka">${s.nama}</th>`).join('')}
        <th class="angka">Nilai Usulan</th><th style="min-width:120px">Progres Selesai</th></tr>`;
    Object.keys(petugasUnit).sort().forEach(ptg => {
      const g = petugasUnit[ptg];
      const jml = Object.values(g.usulan).reduce((a, b) => a + b, 0);
      const persen = jml ? Math.round(g.usulan.selesai / jml * 100) : 0;
      html += `<tr><td><b>${ptg}</b></td><td class="angka">${g.titik}</td>
        ${Object.keys(STATUS_USULAN).map(s => `<td class="angka">${g.usulan[s] || ''}</td>`).join('')}
        <td class="angka">${g.nilai ? angka(g.nilai) : ''}</td>
        <td><div class="batang-progres"><div style="width:${persen}%"></div></div>
          <small>${jml ? `${g.usulan.selesai}/${jml} (${persen}%)` : 'belum ada usulan'}</small></td></tr>`;
    });
    html += '</table>';
  });
  wadah.innerHTML = html || '<p class="catatan-kecil">Belum ada data survey.</p>';
}

function renderTabelUsulan() {
  const fStatus = $('#d-filter-status').value;
  const fJenis = $('#d-filter-jenis').value;
  const daftar = semuaUsulan().filter(u =>
    (!fStatus || u.entri.status === fStatus) &&
    (!fJenis || u.pole.jenisAset === fJenis));

  $('#d-info-filter').textContent = `${daftar.length} usulan · ${rupiah(daftar.reduce((jml, u) => jml + u.total, 0))}`;

  if (!daftar.length) {
    $('#d-tabel-usulan').innerHTML = '<p class="catatan-kecil">Tidak ada usulan pada filter ini.</p>';
    return;
  }
  // surveyor hanya melihat status; ubah status = perencana/manajer/admin (FR-12)
  const bolehUbah = typeof bolehKelolaUsulan === 'function' && bolehKelolaUsulan();
  let html = `<table class="rab"><tr>
    <th>Prioritas</th><th>Aset</th><th>Jenis</th><th>Kondisi</th><th>Paket Perbaikan</th>
    <th>Pekerjaan</th><th class="angka">Biaya</th><th>Petugas</th><th>Disimpan</th><th>Status</th></tr>`;
  daftar.forEach((u, i) => {
    const st = STATUS_USULAN[u.entri.status] || STATUS_USULAN.diusulkan;
    const selStatus = bolehUbah
      ? `<select data-uid="${u.pole.uid}" data-paket="${u.entri.paket}"
          style="border-left:4px solid ${st.warna}">${Object.entries(STATUS_USULAN)
            .map(([kode, s]) => `<option value="${kode}" ${u.entri.status === kode ? 'selected' : ''}>${s.nama}</option>`).join('')}</select>`
      : `<span class="badge-skor" style="background:${st.warna}">${st.nama}</span>`;
    html += `<tr>
      <td><span class="badge-skor" style="background:${warnaSkor(u.skor)}">${u.skor}</span></td>
      <td>${u.pole.nama}</td>
      <td>${(JENIS_ASET[u.pole.jenisAset] || {}).nama || ''}</td>
      <td>${(KONDISI[u.pole.kondisi] || {}).nama || ''}</td>
      <td>${(PAKET_PERBAIKAN[u.entri.paket] || {}).nama || u.entri.paket}</td>
      <td>${u.pole.pekerjaan || '—'}</td>
      <td class="angka">${angka(u.total)}</td>
      <td>${u.pole.petugas || '—'}</td>
      <td style="white-space:nowrap">${tglSingkat(u.pole.diubah)}</td>
      <td>${selStatus}</td>
    </tr>`;
  });
  html += '</table>';
  if (!bolehUbah) html += '<p class="catatan-kecil">Masuk dengan kode perencana/manajer untuk mengubah status tindak lanjut.</p>';
  $('#d-tabel-usulan').innerHTML = html;

  document.querySelectorAll('#d-tabel-usulan select').forEach(sel => {
    sel.onchange = () => {
      const p = poles.find(x => x.uid === sel.dataset.uid);
      const entri = p && p.usulan.find(u => u.paket === sel.dataset.paket);
      if (!entri) return;
      entri.status = sel.value;
      p.diubah = Date.now(); // agar perubahan status menang saat sinkron
      renderPeta(); renderRingkasan(); renderTitikUsulan(); renderTabelUsulan(); // lencana ❗/✔ ikut segar
      toast(`${p.nama}: ${(PAKET_PERBAIKAN[entri.paket] || {}).nama} → ${STATUS_USULAN[sel.value].nama}`);
      kirimServer(true); // langsung tersinkron ke server unit
    };
  });
}

// ---------------- daftar titik dengan usulan pekerjaan ----------------
// Ketuk titik → rincian jenis pekerjaannya terbuka; ketuk pekerjaan → peta
// langsung mengarah ke lokasinya.
function renderTitikUsulan() {
  const wadah = $('#d-titik-usulan');
  const daftar = poles
    .filter(p => p.mode === 'eksisting' && (p.usulan || []).length)
    .sort((a, b) => skorPrioritas(b) - skorPrioritas(a));
  if (!daftar.length) {
    wadah.innerHTML = '<p class="catatan-kecil">Belum ada titik dengan usulan pekerjaan.</p>';
    return;
  }
  wadah.innerHTML = '';
  daftar.forEach(p => {
    const selesai = p.usulan.every(u => u.status === 'selesai');
    const total = p.usulan.reduce((jml, u) => jml + biayaPaket(u.paket).total, 0);
    const baris = document.createElement('div');
    baris.className = 'item-tiang';
    baris.style.cursor = 'pointer';
    baris.innerHTML = `
      <div class="bulat" style="background:${selesai ? '#2e7d32' : '#e53935'}">${selesai ? '✔' : '!'}</div>
      <div class="isi">
        <div class="nm">${p.nama} — ${(JENIS_ASET[p.jenisAset] || {}).nama || ''}</div>
        <div class="dt">${p.usulan.length} pekerjaan · ${rupiah(total)} · prioritas ${skorPrioritas(p)}
          ${p.petugas ? ' · ' + p.petugas : ''}</div>
      </div>
      <div class="aksi">▾</div>`;
    const rincian = document.createElement('div');
    rincian.className = 'sembunyi';
    rincian.style.cssText = 'margin:-4px 0 10px 40px';
    p.usulan.forEach(u => {
      const st = STATUS_USULAN[u.status] || STATUS_USULAN.diusulkan;
      const b = biayaPaket(u.paket);
      const item = document.createElement('div');
      item.className = 'hasil-cari';
      item.innerHTML = `<span class="ik">🔧</span>
        <div><div>${(PAKET_PERBAIKAN[u.paket] || {}).nama || u.paket}
          <span class="badge-skor" style="background:${st.warna};font-size:10px">${st.nama}</span></div>
        <div class="ket-hasil">${rupiah(b.total)} — ketuk untuk menuju lokasi</div></div>`;
      item.onclick = (e) => { e.stopPropagation(); fokusTitik(p.uid); };
      rincian.appendChild(item);
    });
    baris.onclick = () => rincian.classList.toggle('sembunyi');
    wadah.appendChild(baris);
    wadah.appendChild(rincian);
  });
}

// ---------------- tabel calon pelanggan + eviden ----------------
function bukaLightbox(src, ket) {
  const lb = document.querySelector('#lightbox');
  lb.querySelector('img').src = src;
  lb.querySelector('.ket').textContent = ket;
  lb.classList.add('tampil');
}

function renderTabelPelanggan() {
  const wadah = $('#d-tabel-pelanggan');
  const daftar = poles.filter(p => p.mode === 'pelanggan');
  if (!daftar.length) {
    wadah.innerHTML = '<p class="catatan-kecil">Belum ada calon pelanggan — taging lewat aplikasi survey (mode 👤 Calon Pelanggan).</p>';
    return;
  }
  let html = `<table class="rab"><tr>
    <th>Kode</th><th>Nama (sesuai KTP)</th><th>Kelengkapan</th>`;
  Object.values(EVIDEN_PELANGGAN).forEach(l => { html += `<th>${l}</th>`; });
  html += `<th>Petugas</th><th>Catatan</th><th>Peta</th></tr>`;
  daftar.forEach((p, i) => {
    const f = p.fotoPelanggan || {};
    const lengkap = Object.keys(EVIDEN_PELANGGAN).filter(k => f[k]).length;
    const total = Object.keys(EVIDEN_PELANGGAN).length;
    html += `<tr>
      <td>${p.nama}</td>
      <td><b>${p.namaPelanggan || '—'}</b></td>
      <td><span class="badge-skor" style="background:${lengkap === total ? '#2e7d32' : '#f57c00'}">${lengkap}/${total}</span></td>`;
    Object.entries(EVIDEN_PELANGGAN).forEach(([kode, label]) => {
      html += `<td>${f[kode]
        ? `<img class="eviden-mini" data-cp="${i}" data-ev="${kode}" src="${f[kode]}" alt="${label}">`
        : '<span class="eviden-kosong">belum</span>'}</td>`;
    });
    html += `<td>${p.petugas || '—'}</td><td>${p.catatan || ''}</td>
      <td><button class="tombol polos kecil" data-fokus="${i}">📍</button></td></tr>`;
  });
  html += '</table>';
  wadah.innerHTML = html;

  wadah.querySelectorAll('.eviden-mini').forEach(img => {
    img.onclick = () => {
      const p = daftar[Number(img.dataset.cp)];
      bukaLightbox(img.src, `${p.namaPelanggan || p.nama} — ${EVIDEN_PELANGGAN[img.dataset.ev]}`);
    };
  });
  wadah.querySelectorAll('[data-fokus]').forEach(b => {
    b.onclick = () => {
      const p = daftar[Number(b.dataset.fokus)];
      peta.setView([p.lat, p.lng], 17);
      document.querySelector('#peta-dasbor').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  });
}

// ---------------- pencarian lokasi ----------------
let markerCari = null;

function parseTikor(q) {
  const m = q.trim().match(/^(-?\d{1,3}(?:[.,]\d+)?)[\s,;]+(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(',', '.'));
  const lng = parseFloat(m[2].replace(',', '.'));
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function menujuHasil(lat, lng, label) {
  if (markerCari) peta.removeLayer(markerCari);
  markerCari = L.circleMarker([lat, lng], { radius: 11, color: '#d81b60', weight: 4, fill: false })
    .bindPopup(`<b>${label}</b>`).addTo(peta);
  peta.setView([lat, lng], 16);
  markerCari.openPopup();
  $('#d-cari-hasil').innerHTML = '';
  document.querySelector('#peta-dasbor').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function jalankanPencarian() {
  const q = $('#d-cari').value.trim();
  const wadah = $('#d-cari-hasil');
  wadah.innerHTML = '';
  if (q.length < 2) return;
  const tikor = parseTikor(q);
  if (tikor) { menujuHasil(tikor.lat, tikor.lng, `Tikor ${tikor.lat.toFixed(6)}, ${tikor.lng.toFixed(6)}`); return; }

  const kunci = q.toLowerCase();
  const cocokkan = (t) => (t || '').toLowerCase().includes(kunci);
  const item = (ikon, judul, ket, lat, lng) => {
    const div = document.createElement('div');
    div.className = 'hasil-cari';
    div.innerHTML = `<span class="ik">${ikon}</span><div><div>${judul}</div><div class="ket-hasil">${ket}</div></div>`;
    div.onclick = () => menujuHasil(lat, lng, judul);
    return div;
  };
  poles.filter(p => cocokkan(p.nama) || cocokkan(p.namaPelanggan) || cocokkan(p.catatan)).slice(0, 5)
    .forEach(p => wadah.appendChild(item(p.mode === 'pelanggan' ? '👤' : '📌',
      p.mode === 'pelanggan' ? (p.namaPelanggan || p.nama) : p.nama,
      p.mode, p.lat, p.lng)));
  asetStatis.filter(p => cocokkan(p.nama)).slice(0, 5)
    .forEach(p => wadah.appendChild(item('🗼', p.nama, 'Tiang TM (aset bawaan)', p.lat, p.lng)));
  try {
    const res = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=id&q='
      + encodeURIComponent(q), { headers: { 'Accept-Language': 'id' } });
    (await res.json()).forEach(t => wadah.appendChild(item('📍',
      (t.display_name || '').split(',').slice(0, 2).join(','),
      (t.display_name || '').split(',').slice(2, 5).join(',').trim(),
      parseFloat(t.lat), parseFloat(t.lon))));
  } catch (e) {
    toast('Pencarian nama lokasi butuh internet — tikor & nama titik tetap bisa');
  }
  if (!wadah.children.length) {
    wadah.innerHTML = '<div class="hasil-cari"><span class="ik">😕</span><div>Tidak ditemukan.</div></div>';
  }
}

function renderSemua() {
  const jam = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const el = $('#d-terakhir');
  if (el) el.textContent = `Data per pukul ${jam} — menyegarkan sendiri tiap menit`;
  renderPeta();
  renderRingkasan();
  renderDaftarPekerjaan();
  renderTimeline();
  renderMonitoringPetugas();
  renderTitikUsulan();
  renderTabelUsulan();
  renderTabelPelanggan();
  renderTugasDasbor();
  renderHargaTerpusat();
}

// ---------------- sinkronisasi otomatis (tanpa panel) ----------------
// Alamat server & kode unit diambil dari pengaturan aplikasi survey
// (⚙️ Pengaturan) — dasbor menarik & mengirim sendiri di latar belakang.
function bacaCfg() {
  try { return JSON.parse(localStorage.getItem(KUNCI_CFG)) || {}; } catch (e) { return {}; }
}

function cfgServer() {
  const app = ambilCfgAplikasi();
  const lama = bacaCfg(); // simpanan dasbor versi lama sebagai cadangan
  return {
    server: (app.server || lama.server || '').trim().replace(/\/+$/, ''),
    unit: (app.unit || lama.unit || '').trim(),
  };
}

async function ambilServer() {
  const { server, unit } = cfgServer();
  if (!server || !unit) return; // belum dikonfigurasi → dasbor bekerja dari data perangkat saja
  try {
    const res = await fetch(server + '/api/data', { headers: { 'X-Kode-Unit': unit } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    const hasil = gabung(d.poles);
    gabungKoreksi(d.koreksi);
    const tugasBaru = gabungTugas(d.tugas);
    hargaTerpusat = d.harga || hargaTerpusat;
    riwayatHarga = Array.isArray(d.riwayatHarga) ? d.riwayatHarga : riwayatHarga;
    gabungPekerjaanStatus(d.pekerjaanStatus);
    renderSemua();
    if (hasil.baru || hasil.diperbarui || tugasBaru) {
      toast(`🔄 Data unit tergabung: ${hasil.baru} baru, ${hasil.diperbarui} diperbarui`
        + (tugasBaru ? ` · ${tugasBaru} tugas` : ''));
    }
  } catch (e) { toast('Server unit tidak terjangkau — dasbor memakai data perangkat ini'); }
}

async function kirimServer(senyap) {
  const { server, unit } = cfgServer();
  if (!server || !unit) {
    if (!senyap) toast('Server unit belum diatur (aplikasi → ⚙️ Pengaturan) — perubahan tersimpan di perangkat ini');
    return;
  }
  if (!poles.length && !tugas.length) return;
  try {
    const res = await fetch(server + '/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kode-Unit': unit },
      body: JSON.stringify({ poles, koreksi, tugas, pekerjaanStatus }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (!senyap) toast('✅ Perubahan tersinkron ke server unit');
  } catch (e) { toast('⚠️ Gagal sinkron ke server — perubahan tersimpan di dasbor ini: ' + e.message); }
}

// ---------------- data lokal otomatis ----------------
// Dasbor membaca langsung data survey di perangkat ini (semua proyek) —
// pekerjaan/usulan yang baru disimpan di aplikasi langsung tampil di sini
// tanpa impor manual. Data server tetap digabung saat tersambung.
function muatDataLokal() {
  const kunci = ['survey_tm_v1'];
  try {
    const reg = JSON.parse(localStorage.getItem('cakra_proyek'));
    (reg && Array.isArray(reg.daftar) ? reg.daftar : []).forEach(p => {
      if (p && typeof p.id === 'string' && p.id !== 'utama') kunci.push('survey_tm_v1_' + p.id);
    });
  } catch (e) { /* registry proyek tidak ada — cukup kunci utama */ }
  let baru = 0, ubah = 0;
  kunci.forEach(k => {
    try {
      const d = JSON.parse(localStorage.getItem(k));
      if (d && Array.isArray(d.poles)) {
        const hasil = gabung(d.poles);
        baru += hasil.baru; ubah += hasil.diperbarui;
        gabungKoreksi(d.koreksi);
      }
    } catch (e) { /* proyek rusak dilewati */ }
  });
  return baru + ubah;
}

// pengaturan server dari aplikasi survey ikut dipakai dasbor (satu kali isi saja) —
// dibaca dari PROYEK AKTIF; kalau kosong, dicari di proyek lain
function ambilCfgAplikasi() {
  const kunciSemua = ['survey_tm_v1'];
  let kunciAktif = 'survey_tm_v1';
  try {
    const reg = JSON.parse(localStorage.getItem('cakra_proyek'));
    (reg && Array.isArray(reg.daftar) ? reg.daftar : []).forEach(p => {
      if (p && typeof p.id === 'string' && p.id !== 'utama') kunciSemua.push('survey_tm_v1_' + p.id);
    });
    if (reg && reg.aktif && reg.aktif !== 'utama') kunciAktif = 'survey_tm_v1_' + reg.aktif;
  } catch (e) { /* tanpa registry — cukup kunci utama */ }
  const baca = (k) => {
    try {
      const s = (JSON.parse(localStorage.getItem(k)) || {}).settings || {};
      return { server: s.server || '', unit: s.kodeUnit || '' };
    } catch (e) { return { server: '', unit: '' }; }
  };
  const aktif = baca(kunciAktif);
  if (aktif.server && aktif.unit) return aktif;
  for (const k of kunciSemua) {
    const c = baca(k);
    if (c.server && c.unit) return c;
  }
  return aktif;
}

// ---------------- init ----------------
document.addEventListener('DOMContentLoaded', () => {
  initPeta();

  // data survey perangkat ini tampil otomatis; server unit digabung otomatis di latar belakang
  muatDataLokal();
  ambilServer();
  // monitoring langsung: dasbor menyegarkan diri dari server tiap 60 detik
  setInterval(() => { muatDataLokal(); ambilServer(); }, 60000);

  // segarkan otomatis saat kembali ke tab dasbor / aplikasi menyimpan data baru
  window.addEventListener('focus', () => { if (muatDataLokal()) renderSemua(); });
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('survey_tm_v1')) { muatDataLokal(); renderSemua(); }
  });

  $('#d-filter-status').innerHTML += Object.entries(STATUS_USULAN)
    .map(([kode, st]) => `<option value="${kode}">${st.nama}</option>`).join('');
  $('#d-filter-jenis').innerHTML += Object.entries(JENIS_ASET)
    .map(([kode, j]) => `<option value="${kode}">${j.nama}</option>`).join('');
  $('#d-filter-status').onchange = renderTabelUsulan;
  $('#d-filter-jenis').onchange = renderTabelUsulan;

  $('#t-tambah').onclick = tambahTugas;

  $('#d-cari-tombol').onclick = jalankanPencarian;
  $('#d-cari').addEventListener('keydown', (e) => { if (e.key === 'Enter') jalankanPencarian(); });
  document.querySelector('#lightbox').onclick = () => document.querySelector('#lightbox').classList.remove('tampil');

  renderSemua();
  muatAsetStatis();
});
