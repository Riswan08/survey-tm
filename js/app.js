/* ============================================================
   APP.JS — LOGIKA APLIKASI SURVEY TAGING TIANG TM + RAB
   ============================================================ */

// ---------------- STATE ----------------
const KUNCI_SIMPAN = 'survey_tm_v1';

// identitas perangkat — untuk uid titik yang unik lintas surveyor (sinkronisasi M4)
const DEVICE_ID = (() => {
  let d = localStorage.getItem('cakra_device_id');
  if (!d) {
    const b = new Uint8Array(4);
    crypto.getRandomValues(b);
    d = [...b].map(x => x.toString(36)).join('').slice(0, 8);
    localStorage.setItem('cakra_device_id', d);
  }
  return d;
})();

let state = {
  poles: [],                 // {id, nama, lat, lng, tiang, konstruksi, aksesoris:[], catatan}
  koreksi: [],               // koreksi sambungan: {a, b, aksi: 'tambah'|'hapus', diubah, petugas}
  settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
};
let idBerikut = 1;
let modeTaging = false;
let editId = null;           // id tiang yang sedang diedit (null = tambah baru)
let draftLatLng = null;      // koordinat calon tiang
let draftKonstruksi = 'TM-1';

// ---------------- UTIL ----------------
const $ = (sel) => document.querySelector(sel);
const rupiah = (n) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));
const angka = (n, d = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

function hargaEfektif(kode) {
  const ov = state.settings.hargaOverride[kode];
  return (ov !== undefined && ov !== null && ov !== '') ? Number(ov) : MATERIALS[kode].harga;
}

function jasaEfektif(kode) {
  const ov = state.settings.jasaOverride[kode];
  return (ov !== undefined && ov !== null && ov !== '') ? Number(ov) : (MATERIALS[kode].jasa || 0);
}

function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function toast(pesan) {
  const t = $('#toast');
  t.textContent = pesan;
  t.classList.add('tampil');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('tampil'), 2600);
}

function simpan() {
  try {
    localStorage.setItem(KUNCI_SIMPAN, JSON.stringify({ poles: state.poles, koreksi: state.koreksi, settings: state.settings, idBerikut }));
  } catch (e) {
    toast('⚠️ Penyimpanan HP hampir penuh — hapus sebagian foto atau ekspor proyek ke JSON');
  }
}

// --- validasi data: apa pun isi localStorage / file impor, state selalu sehat ---
function normalisasiPole(p, indeks) {
  if (!p || typeof p !== 'object') return null;
  const lat = Number(p.lat), lng = Number(p.lng);
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    id: Number.isInteger(p.id) && p.id > 0 ? p.id : indeks + 1,
    nama: (typeof p.nama === 'string' && p.nama.trim()) ? p.nama.trim().slice(0, 40) : `T-${String(indeks + 1).padStart(2, '0')}`,
    lat, lng,
    mode: (p.mode === 'eksisting' || p.mode === 'pelanggan') ? p.mode : 'rencana',
    namaPelanggan: typeof p.namaPelanggan === 'string' ? p.namaPelanggan.slice(0, 60) : '',
    fotoPelanggan: (() => {
      const f = (p.fotoPelanggan && typeof p.fotoPelanggan === 'object') ? p.fotoPelanggan : {};
      const bersih = {};
      Object.keys(EVIDEN_PELANGGAN).forEach(k => {
        bersih[k] = (typeof f[k] === 'string' && f[k].startsWith('data:image')) ? f[k] : '';
      });
      return bersih;
    })(),
    tiang: MATERIALS[p.tiang] && MATERIALS[p.tiang].kategori === 'tiang' ? p.tiang : DEFAULT_TIANG,
    konstruksi: KONSTRUKSI[p.konstruksi] ? p.konstruksi : 'TM-1',
    aksesoris: Array.isArray(p.aksesoris) ? p.aksesoris.filter(a => AKSESORIS[a]) : [],
    jenisAset: JENIS_ASET[p.jenisAset] ? p.jenisAset : 'TIANG_TM',
    kondisi: KONDISI[p.kondisi] ? p.kondisi : 'baik',
    dampak: DAMPAK[p.dampak] ? p.dampak : 'sedang',
    temuan: Array.isArray(p.temuan) ? p.temuan.filter(t => Object.values(TEMUAN).some(g => g[t])) : [],
    // usulan lama (string kode paket) dimigrasi ke objek {paket, status}
    usulan: Array.isArray(p.usulan) ? p.usulan.map(u => {
      if (typeof u === 'string') return PAKET_PERBAIKAN[u] ? { paket: u, status: 'diusulkan' } : null;
      if (u && PAKET_PERBAIKAN[u.paket]) return { paket: u.paket, status: STATUS_USULAN[u.status] ? u.status : 'diusulkan' };
      return null;
    }).filter(Boolean) : [],
    foto: Array.isArray(p.foto) ? p.foto.filter(f => typeof f === 'string' && f.startsWith('data:image')).slice(0, 3) : [],
    catatan: typeof p.catatan === 'string' ? p.catatan.slice(0, 300) : '',
    // identitas sinkronisasi
    uid: (typeof p.uid === 'string' && p.uid.length >= 3) ? p.uid.slice(0, 40) : `${DEVICE_ID}-${p.id || indeks + 1}-${indeks}`,
    petugas: typeof p.petugas === 'string' ? p.petugas.slice(0, 40) : '',
    diubah: isFinite(p.diubah) ? Number(p.diubah) : 0,
    // sambungan jaringan eksisting: uid tiang tetangga (garis kabel di peta)
    sambung: Array.isArray(p.sambung) ? p.sambung.filter(s => typeof s === 'string' && s.length >= 3).slice(0, 8) : [],
  };
}

// ---------------- USULAN PERBAIKAN (M3) ----------------
function biayaPaket(kode) {
  const pk = PAKET_PERBAIKAN[kode];
  if (!pk) return { material: 0, jasa: 0, total: 0 };
  let material = 0, jasa = 0;
  Object.entries(pk.bom).forEach(([k, q]) => {
    material += hargaEfektif(k) * q;
    jasa += jasaEfektif(k) * q;
  });
  if (pk.tanamTiang) jasa += hargaEfektif('JASA_TIANG');
  return { material, jasa, total: material + jasa };
}

// skor prioritas 1–9: tingkat kerusakan × dampak gangguan
function skorPrioritas(pole) {
  return (BOBOT_KONDISI[pole.kondisi] || 1) * ((DAMPAK[pole.dampak] || DAMPAK.sedang).bobot);
}

function warnaSkor(skor) {
  return skor >= 6 ? '#e53935' : skor >= 3 ? '#f57c00' : '#2e7d32';
}

// titik rencana = rantai jaringan yang dihitung RAB & jaraknya;
// aset eksisting & calon pelanggan berada di luar rantai
const polesRencana = () => state.poles.filter(p => !p.mode || p.mode === 'rencana');

function normalisasiKoreksi(daftar) {
  return (Array.isArray(daftar) ? daftar : [])
    .filter(k => k && typeof k.a === 'string' && typeof k.b === 'string' &&
      k.a.length >= 3 && k.b.length >= 3 && k.a !== k.b &&
      (k.aksi === 'tambah' || k.aksi === 'hapus'))
    .slice(0, 5000)
    .map(k => ({
      a: k.a.slice(0, 40), b: k.b.slice(0, 40), aksi: k.aksi,
      diubah: isFinite(k.diubah) ? Number(k.diubah) : 0,
      petugas: typeof k.petugas === 'string' ? k.petugas.slice(0, 40) : '',
    }));
}

function normalisasiState(d) {
  const bawaan = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const hasil = { poles: [], koreksi: [], settings: bawaan };
  if (!d || typeof d !== 'object') return hasil;
  hasil.koreksi = normalisasiKoreksi(d.koreksi);

  const idTerpakai = new Set();
  (Array.isArray(d.poles) ? d.poles : []).forEach((p, i) => {
    const n = normalisasiPole(p, i);
    if (!n) return;
    while (idTerpakai.has(n.id)) n.id++; // id wajib unik
    idTerpakai.add(n.id);
    hasil.poles.push(n);
  });

  const s = (d.settings && typeof d.settings === 'object') ? d.settings : {};
  if (MATERIALS[s.penghantar] && MATERIALS[s.penghantar].kategori === 'penghantar') hasil.settings.penghantar = s.penghantar;
  if (isFinite(s.sagFactor) && s.sagFactor >= 1 && s.sagFactor <= 1.5) hasil.settings.sagFactor = Number(s.sagFactor);
  if (typeof s.ppnAktif === 'boolean') hasil.settings.ppnAktif = s.ppnAktif;
  if (isFinite(s.ppnPersen) && s.ppnPersen >= 0 && s.ppnPersen <= 100) hasil.settings.ppnPersen = Number(s.ppnPersen);
  if (isFinite(s.akurasiMin) && s.akurasiMin >= 1 && s.akurasiMin <= 500) hasil.settings.akurasiMin = Number(s.akurasiMin);
  if (JENIS_PEKERJAAN[s.jenisPekerjaan]) hasil.settings.jenisPekerjaan = s.jenisPekerjaan;
  if (typeof s.namaPekerjaan === 'string') hasil.settings.namaPekerjaan = s.namaPekerjaan.slice(0, 80);
  if (typeof s.server === 'string') hasil.settings.server = s.server.slice(0, 200);
  if (typeof s.kodeUnit === 'string') hasil.settings.kodeUnit = s.kodeUnit.slice(0, 60);
  if (typeof s.petugas === 'string') hasil.settings.petugas = s.petugas.slice(0, 40);
  if (MATERIALS[s.tiangTerakhir] && MATERIALS[s.tiangTerakhir].kategori === 'tiang') hasil.settings.tiangTerakhir = s.tiangTerakhir;
  if (s.hargaOverride && typeof s.hargaOverride === 'object') {
    Object.entries(s.hargaOverride).forEach(([kode, h]) => {
      if (MATERIALS[kode] && isFinite(Number(h)) && Number(h) >= 0) hasil.settings.hargaOverride[kode] = Number(h);
    });
  }
  if (s.jasaOverride && typeof s.jasaOverride === 'object') {
    Object.entries(s.jasaOverride).forEach(([kode, h]) => {
      if (MATERIALS[kode] && isFinite(Number(h)) && Number(h) >= 0) hasil.settings.jasaOverride[kode] = Number(h);
    });
  }
  return hasil;
}

function muat() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KUNCI_SIMPAN)); } catch (e) { /* data rusak → mulai kosong */ }
  const bersih = normalisasiState(d);
  state.poles = bersih.poles;
  state.koreksi = bersih.koreksi;
  state.settings = bersih.settings;
  idBerikut = Math.max(0, ...state.poles.map(p => p.id)) + 1;
}

// nomor otomatis berikutnya per awalan (T- rencana, A- aset eksisting, CP- calon pelanggan)
function namaBerikut(awalan = 'T') {
  const re = new RegExp(`^${awalan}-?(\\d+)$`, 'i');
  const modeAwalan = { T: 'rencana', A: 'eksisting', CP: 'pelanggan' }[awalan] || 'rencana';
  let maks = 0, jumlah = 0;
  state.poles.forEach(p => {
    if ((p.mode || 'rencana') === modeAwalan) jumlah++;
    const m = re.exec(p.nama);
    if (m) maks = Math.max(maks, parseInt(m[1], 10));
  });
  return `${awalan}-${String(Math.max(maks, jumlah) + 1).padStart(2, '0')}`;
}

// pemeriksaan kewajaran gawang — cegah tikor salah (GPS loncat / salah ketuk).
// hanya untuk titik rencana (rantai jaringan); aset eksisting bebas posisinya.
function periksaGawang(p, kecualiId) {
  if (p.mode === 'eksisting' || p.mode === 'pelanggan') return true;
  const lainnya = polesRencana().filter(x => x.id !== kecualiId);
  const akhir = lainnya[lainnya.length - 1];
  if (!akhir) return true;
  const d = haversine(akhir, p);
  if (d < 3) return confirm(`⚠️ Tiang ini hanya ${angka(d, 1)} m dari ${akhir.nama} — kemungkinan ketuk ganda atau GPS belum stabil.\n\nTetap simpan?`);
  if (d > 250) return confirm(`⚠️ Jarak ke ${akhir.nama} = ${angka(d, 0)} m — jauh di atas gawang normal (±50 m). Periksa apakah tikor benar.\n\nTetap simpan?`);
  return true;
}

// ---------------- PETA ----------------
let map, layerTiang, layerGaris, layerGps, layerAset;

function initPeta() {
  map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([-3.3, 128.95], 13); // sekitar Masohi
  L.control.zoom({ position: 'topleft' }).addTo(map);

  // CARTO Voyager: gaya bersih ala Google Maps, gratis tanpa API key
  const voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
    maxZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO',
  });
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap',
  });
  const satelit = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Esri World Imagery' }
  );
  voyager.addTo(map);
  layerAset = L.layerGroup().addTo(map); // aset TM bawaan — selalu tampil, bisa disembunyikan dari kontrol layer
  L.control.layers(
    { 'Peta Jalan': voyager, 'OpenStreetMap': osm, 'Satelit': satelit },
    { 'Jaringan Aset TM (bawaan)': layerAset },
    { position: 'topleft' }
  ).addTo(map);

  layerGaris = L.layerGroup().addTo(map);
  layerTiang = L.layerGroup().addTo(map);
  layerGps = L.layerGroup().addTo(map);

  map.on('baselayerchange', (e) => {
    tileAktif = e.name === 'Satelit' ? 'esri' : (e.name === 'OpenStreetMap' ? 'osm' : 'carto');
  });
  // level-of-detail: di zoom jauh, marker aset (28 rb titik) disembunyikan
  // agar zoom/geser tetap mulus — garis jaringan tetap tampil sebagai gambaran umum
  map.on('zoomend', aturLodAset);
  map.on('click', (e) => {
    if (modeTaging) bukaFormTiang(null, e.latlng);
  });
}

// ---------------- LAPISAN ASET TM BAWAAN ----------------
// data/aset-tm.json = inventaris tiang TM eksisting unit (impor Excel).
// Selalu tampil di peta (ter-cache offline oleh service worker), read-only,
// TIDAK membebani localStorage. Ketuk markernya → "Survey Aset Ini" untuk
// menilai kondisi/temuan (tiang jadi titik survey dengan uid yang sama,
// sehingga tidak dobel saat sinkronisasi).
let asetStatis = [];

async function muatAsetStatis() {
  try {
    const res = await fetch('data/aset-tm.json');
    if (!res.ok) return;
    const d = await res.json();
    asetStatis = (Array.isArray(d.poles) ? d.poles : [])
      .filter(p => p && typeof p.uid === 'string' && isFinite(p.lat) && isFinite(p.lng));
    render(); // gambar ulang termasuk garis jaringan aset + koreksi
    // pemakaian pertama (belum ada titik survey): fokuskan peta ke wilayah aset
    if (asetStatis.length && !state.poles.length) {
      map.fitBounds(asetStatis.filter((_, i) => i % 25 === 0).map(p => [p.lat, p.lng]), { padding: [30, 30] });
    }
  } catch (e) { /* offline sebelum sempat ter-cache — biarkan, coba lagi saat online */ }
}

// marker aset dibangun SEKALI (28 rb titik ≈ 1 dtk), lalu tiap render
// hanya disinkronkan: sembunyikan yang tersurvey & sesuaikan mode koreksi.
let cacheMarkerAset = new Map(); // uid -> { cm, p }

const ZOOM_MIN_MARKER_ASET = 13;
let lodMarkerTampil = true;

function aturLodAset() {
  const tampil = map.getZoom() >= ZOOM_MIN_MARKER_ASET;
  if (tampil === lodMarkerTampil) return;
  lodMarkerTampil = tampil;
  if (tampil) { if (!map.hasLayer(layerAset)) map.addLayer(layerAset); }
  else { if (map.hasLayer(layerAset)) map.removeLayer(layerAset); }
}

function renderAsetStatis() {
  if (!layerAset) return;
  if (!asetStatis.length) { layerAset.clearLayers(); cacheMarkerAset.clear(); return; }

  if (!cacheMarkerAset.size) {
    layerAset.clearLayers();
    asetStatis.forEach(p => {
      const cm = L.circleMarker([p.lat, p.lng], { radius: 4, weight: 1, color: '#fff', fillColor: '#43a047', fillOpacity: .95 });
      cm.on('click', () => { if (modeKoreksi) { cm.closePopup(); pilihKoreksi(p.uid); } });
      cm.addTo(layerAset);
      cacheMarkerAset.set(p.uid, { cm, p });
    });
  }

  const uidTersurvey = new Set(state.poles.map(p => p.uid));
  cacheMarkerAset.forEach(({ cm, p }, uid) => {
    const sembunyikan = uidTersurvey.has(uid);
    const tampil = layerAset.hasLayer(cm);
    if (sembunyikan && tampil) layerAset.removeLayer(cm);
    else if (!sembunyikan && !tampil) layerAset.addLayer(cm);
    // popup nonaktif saat mode koreksi agar ketukan langsung memilih tiang
    if (modeKoreksi && cm.getPopup()) cm.unbindPopup();
    else if (!modeKoreksi && !cm.getPopup()) cm.bindPopup(() => popupAsetStatis(p));
  });
}

function popupAsetStatis(p) {
  const div = document.createElement('div');
  div.className = 'popup-tiang';
  div.innerHTML = `
    <div class="pjudul">${p.nama} — Tiang TM (aset unit)</div>
    <div class="pinfo">${p.catatan || ''}<br>${Number(p.lat).toFixed(6)}, ${Number(p.lng).toFixed(6)}</div>
    <div class="paksi"><button class="tombol utama kecil">📝 Survey Aset Ini</button></div>`;
  div.querySelector('button').onclick = () => {
    map.closePopup();
    const n = normalisasiPole(p, state.poles.length);
    if (!n) return;
    n.id = idBerikut++;
    n.uid = p.uid; // uid asli dipertahankan → anti-duplikat lintas surveyor
    n.petugas = state.settings.petugas || '';
    n.diubah = Date.now();
    state.poles.push(n);
    simpan(); render();
    bukaFormTiang(n.id);
    toast(`${n.nama} siap disurvey — isi kondisi & temuannya`);
  };
  return div;
}

// ---------------- SAMBUNGAN JARINGAN (gabungan + koreksi) ----------------
// Sumber garis kabel: sambung milik aset bawaan + sambung milik titik survey,
// lalu ditimpa daftar koreksi (tambah/putus). Titik survey ber-uid sama
// menggantikan aset bawaan (termasuk daftar sambungnya).
const kunciPasangan = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

function posisiSemua() {
  const m = new Map();
  asetStatis.forEach(p => m.set(p.uid, p));
  state.poles.forEach(p => m.set(p.uid, p));
  return m;
}

function sambunganFinal() {
  const posisi = posisiSemua();
  const tersurvey = new Set(state.poles.map(p => p.uid));
  const edges = new Map();
  const tambah = (uidA, uidB) => {
    if (uidA !== uidB && posisi.has(uidA) && posisi.has(uidB)) edges.set(kunciPasangan(uidA, uidB), [uidA, uidB]);
  };
  asetStatis.forEach(p => { if (!tersurvey.has(p.uid)) (p.sambung || []).forEach(u => tambah(p.uid, u)); });
  state.poles.forEach(p => (p.sambung || []).forEach(u => tambah(p.uid, u)));
  (state.koreksi || []).forEach(k => {
    if (k.aksi === 'hapus') edges.delete(kunciPasangan(k.a, k.b));
    else tambah(k.a, k.b);
  });
  return { edges, posisi };
}

// ---------------- SAMBUNGAN SUPLAI (temuan baru → jaringan eksisting) ----------------
// Rencana jaringan baru mengambil suplai dari tiang TM eksisting terdekat:
// titik rencana PERTAMA otomatis ditarik garis suplai ke tiang eksisting
// terdekat (maks 500 m). Jaraknya ikut dihitung di penghantar & jasa tarik.
// Bisa diputus lewat mode Koreksi Sambungan (lalu sambung manual ke tiang lain).
function suplaiTerdekat() {
  const rencana = polesRencana();
  if (!rencana.length) return null;
  const awal = rencana[0];
  const uidRencana = new Set(rencana.map(p => p.uid));
  let terbaik = null;
  const uji = (p) => {
    if (uidRencana.has(p.uid)) return;
    const d = haversine(awal, p);
    if (!terbaik || d < terbaik.jarak) terbaik = { dari: p, jarak: d };
  };
  const uidState = new Set(state.poles.map(p => p.uid));
  asetStatis.forEach(p => { if (!uidState.has(p.uid)) uji(p); });
  state.poles.forEach(p => { if (p.mode === 'eksisting' && p.jenisAset === 'TIANG_TM') uji(p); });
  if (!terbaik || terbaik.jarak > 500) return null;
  // dihormati bila surveyor memutus lewat koreksi sambungan
  const diputus = (state.koreksi || []).some(k =>
    k.aksi === 'hapus' && kunciPasangan(k.a, k.b) === kunciPasangan(terbaik.dari.uid, awal.uid));
  if (diputus) return null;
  return { dari: terbaik.dari, ke: awal, jarak: terbaik.jarak };
}

// ---------------- MODE KOREKSI SAMBUNGAN ----------------
// Ketuk dua tiang: belum tersambung → disambung; sudah tersambung → diputus.
let modeKoreksi = false, koreksiPilihan = null, tandaPilihan = null;

function batalPilihKoreksi() {
  koreksiPilihan = null;
  if (tandaPilihan) { map.removeLayer(tandaPilihan); tandaPilihan = null; }
}

function toggleModeKoreksi() {
  modeKoreksi = !modeKoreksi;
  if (modeKoreksi && modeTaging) { modeTaging = false; $('#btn-tag').classList.remove('aktif'); $('#btn-tag').innerHTML = '🎯 Mode Taging'; }
  batalPilihKoreksi();
  $('#btn-koreksi').classList.toggle('aktif', modeKoreksi);
  $('#btn-koreksi').innerHTML = modeKoreksi ? '🔗 Koreksi: AKTIF' : '🔗 Koreksi Sambungan';
  render();
  toast(modeKoreksi
    ? 'Mode koreksi — ketuk tiang pertama, lalu tiang kedua (sambung / putus)'
    : 'Mode koreksi dimatikan');
}

function pilihKoreksi(uid) {
  const posisi = posisiSemua();
  const p = posisi.get(uid);
  if (!p) return;

  if (!koreksiPilihan) {
    koreksiPilihan = uid;
    tandaPilihan = L.circleMarker([p.lat, p.lng], { radius: 12, color: '#ffd400', weight: 4, fill: false }).addTo(map);
    toast(`${p.nama} dipilih — ketuk tiang kedua`);
    return;
  }
  if (koreksiPilihan === uid) { batalPilihKoreksi(); toast('Pilihan dibatalkan'); return; }

  const q = posisi.get(koreksiPilihan);
  const { edges } = sambunganFinal();
  const sudahTersambung = edges.has(kunciPasangan(uid, koreksiPilihan));
  const d = haversine(p, q);
  const ok = sudahTersambung
    ? confirm(`✂️ Putuskan sambungan ${q.nama} — ${p.nama} (${angka(d, 0)} m)?`)
    : confirm(`🔗 Sambungkan ${q.nama} — ${p.nama}?\nJarak ${angka(d, 0)} m${d > 300 ? ' — cukup jauh, pastikan memang satu bentangan.' : ''}`);
  if (ok) {
    const kk = kunciPasangan(uid, koreksiPilihan);
    state.koreksi = (state.koreksi || []).filter(k => kunciPasangan(k.a, k.b) !== kk);
    state.koreksi.push({
      a: koreksiPilihan, b: uid,
      aksi: sudahTersambung ? 'hapus' : 'tambah',
      diubah: Date.now(),
      petugas: state.settings.petugas || '',
    });
    simpan(); render();
    toast(sudahTersambung ? '✂️ Sambungan diputus' : '🔗 Tiang tersambung');
  }
  batalPilihKoreksi();
}

// ---------------- PETA OFFLINE ----------------
// Unduh tile area yang sedang tampil ke Cache Storage — dipakai
// service worker saat offline. GPS & taging tetap jalan tanpa tile.
let tileAktif = 'carto';

function latLng2Tile(lat, lng, z) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  const jepit = (v) => Math.min(Math.max(v, 0), n - 1);
  return { x: jepit(x), y: jepit(y) };
}

function urlTile(x, y, z) {
  if (tileAktif === 'esri') {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  // subdomain dihitung sama persis dengan cara Leaflet → cache offline pasti kena
  if (tileAktif === 'osm') {
    const s = ['a', 'b', 'c'][Math.abs(x + y) % 3];
    return `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }
  const s = ['a', 'b', 'c', 'd'][Math.abs(x + y) % 4];
  return `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
}

async function unduhTileArea() {
  if (!('caches' in window)) { toast('Browser tidak mendukung penyimpanan offline'); return; }
  if (navigator.onLine === false) { toast('Butuh internet untuk mengunduh peta'); return; }

  const b = map.getBounds();
  const zAwal = Math.max(Math.min(map.getZoom(), 17), 11);
  const zAkhir = Math.min(17, zAwal + 3);
  const urls = [];
  for (let z = zAwal; z <= zAkhir; z++) {
    const a1 = latLng2Tile(b.getNorth(), b.getWest(), z);
    const a2 = latLng2Tile(b.getSouth(), b.getEast(), z);
    for (let x = a1.x; x <= a2.x; x++) for (let y = a1.y; y <= a2.y; y++) urls.push(urlTile(x, y, z));
  }
  if (urls.length > 600 &&
      !confirm(`Area cukup luas (${urls.length} tile). Hanya 600 tile pertama yang diunduh — perbesar peta dulu untuk hasil lebih fokus.\n\nLanjutkan?`)) return;
  urls.length = Math.min(urls.length, 600);

  const c = await caches.open('stm-tiles-v1');
  let sukses = 0, gagal = 0;
  for (let i = 0; i < urls.length; i += 8) { // unduh 8 tile sekaligus
    await Promise.all(urls.slice(i, i + 8).map(async (u) => {
      try {
        if (await c.match(u)) { sukses++; return; }
        const res = await fetch(u, { mode: 'no-cors' });
        await c.put(u, res);
        sukses++;
      } catch (e) { gagal++; }
    }));
    toast(`🗺 Mengunduh peta… ${Math.min(i + 8, urls.length)}/${urls.length} tile`);
  }
  toast(gagal ? `Peta tersimpan sebagian: ${sukses} tile OK, ${gagal} gagal` : `✅ Peta offline siap — ${sukses} tile tersimpan`);
}

// lencana status pekerjaan di marker: ❗ ada usulan belum rampung, ✔ semua selesai
function badgeUsulan(pole) {
  const u = pole.usulan || [];
  if (!u.length) return '';
  const selesai = u.every(x => x.status === 'selesai');
  return `<div class="badge-u ${selesai ? 'ok' : 'perlu'}" title="${selesai ? 'Pekerjaan selesai' : 'Ada usulan pekerjaan'}">${selesai ? '✔' : '!'}</div>`;
}

function ikonTiang(pole, idx) {
  if (pole.mode === 'pelanggan') {
    return L.divIcon({
      className: 'label-tiang',
      html: `<div class="pin"><div class="titik" style="background:#7b1fa2;border-radius:3px"></div><div class="nama">👤 ${pole.namaPelanggan || pole.nama}</div></div>`,
      iconSize: [0, 0],
    });
  }
  if (pole.mode === 'eksisting') {
    const k = KONDISI[pole.kondisi] || KONDISI.baik;
    const j = JENIS_ASET[pole.jenisAset] || { nama: '?' };
    return L.divIcon({
      className: 'label-tiang',
      html: `<div class="pin">${badgeUsulan(pole)}<div class="titik" style="background:${k.warna};border-radius:3px"></div><div class="nama">${pole.nama} · ${j.nama}</div></div>`,
      iconSize: [0, 0],
    });
  }
  const warna = (KONSTRUKSI[pole.konstruksi] || {}).warna || '#555';
  return L.divIcon({
    className: 'label-tiang',
    html: `<div class="pin"><div class="titik" style="background:${warna}"></div><div class="nama">${pole.nama} · ${pole.konstruksi}</div></div>`,
    iconSize: [0, 0],
  });
}

function render() {
  layerTiang.clearLayers();
  layerGaris.clearLayers();

  // garis jaringan + label jarak per gawang — hanya titik rencana
  const rencana = polesRencana();
  if (rencana.length > 1) {
    L.polyline(rencana.map(p => [p.lat, p.lng]), { color: '#0c6bb5', weight: 3, dashArray: '6 4' }).addTo(layerGaris);
    for (let i = 1; i < rencana.length; i++) {
      const a = rencana[i - 1], b = rencana[i];
      const d = haversine(a, b);
      L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], {
        icon: L.divIcon({ className: 'label-jarak', html: `${angka(d, 0)} m`, iconSize: null }),
        interactive: false,
      }).addTo(layerGaris);
    }
  }

  // garis jaringan eksisting: aset bawaan + titik survey + koreksi sambungan
  const jaringan = sambunganFinal();
  const segmen = [];
  jaringan.edges.forEach(([a, b]) => {
    const p = jaringan.posisi.get(a), q = jaringan.posisi.get(b);
    segmen.push([[p.lat, p.lng], [q.lat, q.lng]]);
  });
  if (segmen.length) {
    // smoothFactor tinggi = garis disederhanakan saat digambar → zoom jauh tetap mulus
    L.polyline(segmen, { color: '#2e7d32', weight: 2.5, opacity: .85, smoothFactor: 2.5 }).addTo(layerGaris);
  }

  // garis suplai: rencana baru mengambil listrik dari tiang eksisting terdekat
  const suplai = suplaiTerdekat();
  if (suplai) {
    L.polyline([[suplai.dari.lat, suplai.dari.lng], [suplai.ke.lat, suplai.ke.lng]],
      { color: '#e65100', weight: 3, dashArray: '4 7', opacity: .9 }).addTo(layerGaris);
    L.marker([(suplai.dari.lat + suplai.ke.lat) / 2, (suplai.dari.lng + suplai.ke.lng) / 2], {
      icon: L.divIcon({ className: 'label-jarak', html: `⚡ suplai dari ${suplai.dari.nama} · ${angka(suplai.jarak, 0)} m`, iconSize: null }),
      interactive: false,
    }).addTo(layerGaris);
  }

  // marker tiang — jika aset eksisting sangat banyak (impor massal), pakai titik
  // kanvas yang ringan agar peta tetap lancar di HP
  const jumlahEksisting = state.poles.filter(p => p.mode === 'eksisting').length;
  const modeRingan = jumlahEksisting > 300;
  state.poles.forEach((pole, idx) => {
    // titik dengan usulan pekerjaan selalu pakai marker berlencana (❗/✔)
    if (modeRingan && pole.mode === 'eksisting' && !(pole.usulan || []).length) {
      const warna = (KONDISI[pole.kondisi] || KONDISI.baik).warna;
      const cm = L.circleMarker([pole.lat, pole.lng], { radius: 4.5, weight: 1.5, color: '#fff', fillColor: warna, fillOpacity: 1 })
        .addTo(layerTiang);
      if (modeKoreksi) cm.on('click', () => pilihKoreksi(pole.uid));
      else cm.bindPopup(() => popupTiang(pole));
      return;
    }
    const m = L.marker([pole.lat, pole.lng], { icon: ikonTiang(pole, idx), draggable: !modeKoreksi });
    m.on('dragend', (e) => {
      const ll = e.target.getLatLng();
      // konfirmasi dulu — mencegah tikor bergeser karena tersenggol saat menggeser peta
      if (confirm(`Pindahkan ${pole.nama} ke tikor baru?\n${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`)) {
        pole.lat = ll.lat; pole.lng = ll.lng;
        pole.diubah = Date.now();
        simpan();
        toast(`${pole.nama} dipindah ke tikor baru`);
      }
      render(); // kembalikan / perbarui posisi marker & garis
    });
    if (modeKoreksi) m.on('click', () => pilihKoreksi(pole.uid));
    else m.bindPopup(() => popupTiang(pole));
    m.addTo(layerTiang);
  });

  perbaruiRingkasan();
  renderAsetStatis(); // segarkan lapisan aset (sembunyikan yang sudah jadi titik survey)
}

function popupTiang(pole) {
  const div = document.createElement('div');
  div.className = 'popup-tiang';
  let isi;
  if (pole.mode === 'pelanggan') {
    const lengkap = Object.keys(EVIDEN_PELANGGAN).filter(k => (pole.fotoPelanggan || {})[k]).length;
    isi = `
    <div class="pjudul">👤 ${pole.namaPelanggan || pole.nama}</div>
    <div class="pinfo">
      Calon pelanggan (${pole.nama})<br>
      Eviden: <b>${lengkap}/${Object.keys(EVIDEN_PELANGGAN).length}</b> ${lengkap === Object.keys(EVIDEN_PELANGGAN).length ? '✅' : '⚠️ belum lengkap'}<br>
      ${pole.lat.toFixed(6)}, ${pole.lng.toFixed(6)}
      ${pole.catatan ? '<br>' + pole.catatan : ''}
    </div>`;
  } else if (pole.mode === 'eksisting') {
    const j = JENIS_ASET[pole.jenisAset] || { nama: '?' };
    const kd = KONDISI[pole.kondisi] || KONDISI.baik;
    const skor = skorPrioritas(pole);
    const totalUsulan = (pole.usulan || []).reduce((jml, u) => jml + biayaPaket(u.paket).total, 0);
    const daftarPekerjaan = (pole.usulan || []).map(u => {
      const st = STATUS_USULAN[u.status] || STATUS_USULAN.diusulkan;
      return `• ${(PAKET_PERBAIKAN[u.paket] || {}).nama || u.paket}
        <span class="badge-skor" style="background:${st.warna};font-size:10px">${st.nama}</span>`;
    }).join('<br>');
    isi = `
    <div class="pjudul">${pole.nama} — ${j.nama}</div>
    <div class="pinfo">
      Kondisi: <b style="color:${kd.warna}">${kd.nama}</b> ·
      Prioritas: <span class="badge-skor" style="background:${warnaSkor(skor)}">${skor}</span><br>
      ${daftarPekerjaan ? `<b>Pekerjaan (${pole.usulan.length}) — ${rupiah(totalUsulan)}:</b><br>${daftarPekerjaan}<br>` : ''}
      ${(pole.foto || []).length ? `📷 ${pole.foto.length} foto<br>` : ''}
      ${pole.lat.toFixed(6)}, ${pole.lng.toFixed(6)}
      ${pole.catatan ? '<br>' + pole.catatan : ''}
    </div>`;
  } else {
    const k = KONSTRUKSI[pole.konstruksi] || { nama: '?' };
    isi = `
    <div class="pjudul">${pole.nama} — ${pole.konstruksi}</div>
    <div class="pinfo">
      ${k.nama}<br>
      ${MATERIALS[pole.tiang].nama}<br>
      ${pole.lat.toFixed(6)}, ${pole.lng.toFixed(6)}<br>
      <b>Biaya titik ini: ${rupiah(biayaPerTiang(pole).total)}</b>
    </div>`;
  }
  div.innerHTML = isi + `
    <div class="paksi">
      <button class="tombol utama kecil" data-aksi="edit">✏️ Edit</button>
      <button class="tombol bahaya kecil" data-aksi="hapus">🗑 Hapus</button>
    </div>`;
  div.querySelector('[data-aksi=edit]').onclick = () => { map.closePopup(); bukaFormTiang(pole.id); };
  div.querySelector('[data-aksi=hapus]').onclick = () => { map.closePopup(); hapusTiang(pole.id); };
  return div;
}

// ---------------- PERHITUNGAN RAB ----------------
function bomTiang(pole) {
  // gabungan BOM: batang tiang + konstruksi + aksesoris opsional
  const bom = {};
  const tambah = (kode, qty) => { bom[kode] = (bom[kode] || 0) + qty; };
  tambah(pole.tiang, 1);
  const k = KONSTRUKSI[pole.konstruksi];
  if (k) Object.entries(k.bom).forEach(([kode, q]) => tambah(kode, q));
  (pole.aksesoris || []).forEach(aks => {
    const a = AKSESORIS[aks];
    if (a) Object.entries(a.bom).forEach(([kode, q]) => tambah(kode, q));
  });
  return bom;
}

function biayaPerTiang(pole) {
  const bom = bomTiang(pole);
  let material = 0, jasaKonstruksi = 0;
  Object.entries(bom).forEach(([kode, q]) => {
    material += hargaEfektif(kode) * q;
    jasaKonstruksi += jasaEfektif(kode) * q;
  });
  const jasaTanam = hargaEfektif('JASA_TIANG');
  const jasa = jasaKonstruksi + jasaTanam;
  return { bom, material, jasaKonstruksi, jasaTanam, jasa, total: material + jasa };
}

function panjangRute() {
  const rencana = polesRencana();
  let total = 0;
  for (let i = 1; i < rencana.length; i++) total += haversine(rencana[i - 1], rencana[i]);
  return total; // meter
}

function hitungRAB() {
  const s = state.settings;
  const rencana = polesRencana(); // aset eksisting belum masuk RAB (usulan perbaikan = M3)

  // 1) rekap material seluruh titik rencana
  const rekap = {}; // kode -> qty
  rencana.forEach(p => {
    Object.entries(bomTiang(p)).forEach(([kode, q]) => { rekap[kode] = (rekap[kode] || 0) + q; });
  });
  let totalMaterialTiang = 0, totalJasaKonstruksi = 0;
  const barisRekap = Object.entries(rekap).map(([kode, qty]) => {
    const h = hargaEfektif(kode), j = jasaEfektif(kode);
    const jmlMaterial = h * qty, jmlJasa = j * qty;
    totalMaterialTiang += jmlMaterial;
    totalJasaKonstruksi += jmlJasa;
    return { kode, nama: MATERIALS[kode].nama, satuan: MATERIALS[kode].satuan, qty,
             harga: h, jasa: j, jmlMaterial, jmlJasa, jumlah: jmlMaterial + jmlJasa };
  });

  // 2) penghantar: rute antar tiang rencana + sambungan suplai dari jaringan eksisting
  const rute = panjangRute();
  const suplai = suplaiTerdekat();
  const jarakSuplai = suplai ? suplai.jarak : 0;
  const rutePenghantar = rute + jarakSuplai;
  const ph = MATERIALS[s.penghantar];
  const panjangKawat = rutePenghantar * (ph.fasa || 3) * s.sagFactor;
  const biayaPenghantar = panjangKawat * hargaEfektif(s.penghantar);

  // 3) jasa
  const jasaTiang = rencana.length * hargaEfektif('JASA_TIANG');
  const jasaTarik = (rutePenghantar / 1000) * hargaEfektif('JASA_TARIK');

  // 4) usulan perbaikan aset eksisting — terurut skor prioritas
  const daftarUsulan = [];
  state.poles.filter(p => p.mode === 'eksisting').forEach(p => {
    (p.usulan || []).forEach(u => {
      const pk = PAKET_PERBAIKAN[u.paket];
      if (!pk) return;
      const b = biayaPaket(u.paket);
      daftarUsulan.push({
        aset: p.nama, jenis: (JENIS_ASET[p.jenisAset] || {}).nama || '',
        kondisi: (KONDISI[p.kondisi] || {}).nama || '', paket: pk.nama,
        status: u.status || 'diusulkan', petugas: p.petugas || '',
        material: b.material, jasa: b.jasa, total: b.total, skor: skorPrioritas(p),
      });
    });
  });
  daftarUsulan.sort((a, b) => b.skor - a.skor || b.total - a.total);
  const totalUsulan = daftarUsulan.reduce((jml, u) => jml + u.total, 0);

  const subtotal = totalMaterialTiang + totalJasaKonstruksi + biayaPenghantar + jasaTiang + jasaTarik + totalUsulan;
  const ppn = s.ppnAktif ? subtotal * (s.ppnPersen / 100) : 0;

  return {
    barisRekap, totalMaterialTiang, totalJasaKonstruksi,
    rute, suplai, jarakSuplai, rutePenghantar, ph, panjangKawat, biayaPenghantar,
    jasaTiang, jasaTarik,
    daftarUsulan, totalUsulan,
    subtotal, ppn, grandTotal: subtotal + ppn,
  };
}

function perbaruiRingkasan() {
  const rab = hitungRAB();
  $('#r-tiang').textContent = polesRencana().length;
  $('#r-jarak').textContent = rab.rute >= 1000 ? angka(rab.rute / 1000, 2) + ' km' : angka(rab.rute, 0) + ' m';
  $('#r-total').textContent = rupiah(rab.grandTotal);
  if (liveAktif) perbaruiPanelLive(); // panel live ikut segar setelah tambah/hapus/geser tiang
}

// ---------------- FORM TITIK (TAMBAH / EDIT) ----------------
let draftModeTitik = 'rencana';
let draftKondisi = 'baik';
let draftDampak = 'sedang';
let draftFoto = [];

// temuan yang dicentang menyarankan paket perbaikannya (baris hijau);
// user tetap bebas menambah/menghapus usulan
function renderTemuanUsulan(pole) {
  const jenis = $('#f-jenis-aset').value || 'TIANG_TM';
  const grupTemuan = TEMUAN[jenis] || {};
  // form baru dibuka → mulai dari data tersimpan (kosong jika titik baru),
  // JANGAN baca sisa centang form sebelumnya di DOM.
  // render ulang dalam sesi form yang sama (ganti jenis aset) → pertahankan centang user.
  const pertamaKali = !renderTemuanUsulan._siap;
  const temuanAktif = new Set(pertamaKali
    ? (pole ? pole.temuan || [] : [])
    : [...document.querySelectorAll('#f-temuan input:checked')].map(i => i.value));
  const usulanManual = new Set(pertamaKali
    ? (pole ? (pole.usulan || []).map(u => u.paket) : [])
    : [...document.querySelectorAll('#f-usulan input:checked')].map(i => i.value));
  renderTemuanUsulan._siap = true;

  const wt = $('#f-temuan');
  wt.innerHTML = '';
  Object.entries(grupTemuan).forEach(([kode, t]) => {
    const lbl = document.createElement('label');
    lbl.className = 'cek-baris';
    lbl.innerHTML = `<input type="checkbox" value="${kode}" ${temuanAktif.has(kode) ? 'checked' : ''}> ${t.nama}`;
    lbl.querySelector('input').onchange = (e) => {
      // temuan dicentang → paketnya ikut tercentang otomatis
      if (e.target.checked && t.paket) {
        const cb = document.querySelector(`#f-usulan input[value="${t.paket}"]`);
        if (cb) { cb.checked = true; cb.closest('.baris-usulan').classList.add('saran'); }
      }
      perbaruiPratinjauBiaya();
    };
    wt.appendChild(lbl);
  });
  if (!Object.keys(grupTemuan).length) wt.innerHTML = '<p class="catatan-kecil">Tidak ada daftar temuan untuk jenis aset ini.</p>';

  const paketSaran = new Set(Object.entries(grupTemuan).filter(([k]) => temuanAktif.has(k)).map(([, t]) => t.paket));
  const wu = $('#f-usulan');
  wu.innerHTML = '';
  Object.entries(PAKET_PERBAIKAN).forEach(([kode, pk]) => {
    const dicentang = usulanManual.has(kode) || paketSaran.has(kode);
    const b = biayaPaket(kode);
    const lbl = document.createElement('label');
    lbl.className = 'baris-usulan' + (paketSaran.has(kode) ? ' saran' : '');
    lbl.innerHTML = `<input type="checkbox" value="${kode}" ${dicentang ? 'checked' : ''}> ${pk.nama}
      <span class="hrg">± ${rupiah(b.total)}</span>`;
    lbl.querySelector('input').onchange = perbaruiPratinjauBiaya;
    wu.appendChild(lbl);
  });
}

// --- foto: kompres ke maks 900 px JPEG agar hemat penyimpanan HP ---
function kompresGambar(file, selesai) {
  const img = new Image();
  img.onload = () => {
    const skala = Math.min(1, 900 / Math.max(img.width, img.height));
    const kanvas = document.createElement('canvas');
    kanvas.width = Math.round(img.width * skala);
    kanvas.height = Math.round(img.height * skala);
    kanvas.getContext('2d').drawImage(img, 0, 0, kanvas.width, kanvas.height);
    URL.revokeObjectURL(img.src);
    selesai(kanvas.toDataURL('image/jpeg', 0.6));
  };
  img.onerror = () => toast('File bukan gambar yang valid');
  img.src = URL.createObjectURL(file);
}

function tambahFoto(file) {
  if (draftFoto.length >= 3) { toast('Maksimal 3 foto per aset'); return; }
  kompresGambar(file, (dataUrl) => { draftFoto.push(dataUrl); renderGaleri(); });
}

// --- eviden calon pelanggan: slot foto berlabel (KTP, KK, bangunan depan/belakang) ---
let draftFotoP = {};

function renderEvidenPelanggan() {
  const wadah = $('#eviden-pelanggan');
  wadah.innerHTML = '';
  Object.entries(EVIDEN_PELANGGAN).forEach(([kode, label]) => {
    const ada = !!draftFotoP[kode];
    const baris = document.createElement('div');
    baris.className = 'slot-eviden' + (ada ? ' terisi' : '');
    baris.innerHTML = `
      ${ada ? `<img src="${draftFotoP[kode]}" alt="${label}">` : '<div class="kosong">📷</div>'}
      <div class="lbl">${label}${ada ? ' ✓' : ''}</div>
      <label class="tombol ${ada ? 'polos' : 'utama'} kecil" style="cursor:pointer">${ada ? 'Ganti' : 'Ambil'}
        <input type="file" accept="image/*" capture="environment" hidden></label>
      ${ada ? '<button type="button" class="tombol bahaya kecil">✕</button>' : ''}`;
    baris.querySelector('input').onchange = (e) => {
      if (e.target.files[0]) kompresGambar(e.target.files[0], (dataUrl) => {
        draftFotoP[kode] = dataUrl;
        renderEvidenPelanggan(); perbaruiPratinjauBiaya();
      });
      e.target.value = '';
    };
    const hapus = baris.querySelector('button.bahaya');
    if (hapus) hapus.onclick = () => { draftFotoP[kode] = ''; renderEvidenPelanggan(); perbaruiPratinjauBiaya(); };
    wadah.appendChild(baris);
  });
}

function renderGaleri() {
  const g = $('#galeri-foto');
  g.innerHTML = '';
  draftFoto.forEach((f, i) => {
    const div = document.createElement('div');
    div.className = 'foto';
    div.innerHTML = `<img src="${f}" alt="foto ${i + 1}"><button type="button" title="Hapus foto">✕</button>`;
    div.querySelector('button').onclick = () => { draftFoto.splice(i, 1); renderGaleri(); };
    g.appendChild(div);
  });
}

function terapkanModeForm() {
  const eksisting = draftModeTitik === 'eksisting';
  const pelanggan = draftModeTitik === 'pelanggan';
  $('#grup-rencana').classList.toggle('sembunyi', eksisting || pelanggan);
  $('#grup-eksisting').classList.toggle('sembunyi', !eksisting);
  $('#grup-pelanggan').classList.toggle('sembunyi', !pelanggan);
  $('#grup-jenis-tiang').classList.toggle('sembunyi', eksisting || pelanggan);
  document.querySelectorAll('#f-mode button').forEach(b =>
    b.classList.toggle('aktif', b.dataset.mode === draftModeTitik));
  // nama otomatis ikut mode (hanya saat tambah baru & belum diedit manual)
  if (!editId) {
    const nilai = $('#f-nama').value;
    if (/^(T|A|CP)-\d+$/i.test(nilai)) $('#f-nama').value = namaBerikut(pelanggan ? 'CP' : (eksisting ? 'A' : 'T'));
  }
  perbaruiPratinjauBiaya();
}

function bukaFormTiang(id, latlng) {
  editId = id;
  const pole = id ? state.poles.find(p => p.id === id) : null;
  draftLatLng = pole ? { lat: pole.lat, lng: pole.lng } : latlng;
  draftKonstruksi = pole ? pole.konstruksi : draftKonstruksi;
  draftModeTitik = pole ? (pole.mode || 'rencana') : draftModeTitik;
  draftKondisi = pole ? (pole.kondisi || 'baik') : 'baik';
  draftDampak = pole ? (pole.dampak || 'sedang') : 'sedang';
  draftFoto = pole ? [...(pole.foto || [])] : [];
  draftFotoP = pole ? { ...(pole.fotoPelanggan || {}) } : {};
  renderTemuanUsulan._siap = false;

  $('#f-judul').textContent = pole ? `Edit ${pole.nama}` : 'Taging Titik Baru';
  $('#f-nama').value = pole ? pole.nama : namaBerikut(draftModeTitik === 'eksisting' ? 'A' : 'T');
  $('#f-lat').value = draftLatLng.lat.toFixed(6);
  $('#f-lng').value = draftLatLng.lng.toFixed(6);
  $('#f-tiang').value = pole ? pole.tiang : DEFAULT_TIANG;
  $('#f-catatan').value = pole ? (pole.catatan || '') : '';

  // kartu konstruksi — dikelompokkan JTM / JTR
  const wadah = $('#pilih-konstruksi');
  wadah.innerHTML = '';
  let grupTerakhir = null;
  Object.entries(KONSTRUKSI).forEach(([kode, k]) => {
    const grup = k.grup || 'JTM';
    if (grup !== grupTerakhir) {
      const h = document.createElement('div');
      h.className = 'grup-kartu';
      h.textContent = grup === 'JTR' ? '💡 JTR — Tegangan Rendah (harga contoh)' : '⚡ JTM — Tegangan Menengah (harga lampiran)';
      wadah.appendChild(h);
      grupTerakhir = grup;
    }
    const kartu = document.createElement('div');
    kartu.className = 'kartu-k' + (kode === draftKonstruksi ? ' pilih' : '');
    kartu.dataset.kode = kode;
    kartu.innerHTML = `<div class="kode" style="color:${k.warna}">${kode}</div>
      <div class="fungsi">${k.nama}</div><div class="sudut">${k.sudut}</div>`;
    kartu.onclick = () => {
      draftKonstruksi = kode;
      wadah.querySelectorAll('.kartu-k').forEach(el => el.classList.remove('pilih'));
      kartu.classList.add('pilih');
      perbaruiPratinjauBiaya();
    };
    wadah.appendChild(kartu);
  });

  // aksesoris
  const wa = $('#pilih-aksesoris');
  wa.innerHTML = '';
  Object.entries(AKSESORIS).forEach(([kode, a]) => {
    const dicentang = pole && (pole.aksesoris || []).includes(kode);
    const lbl = document.createElement('label');
    lbl.className = 'cek-baris';
    lbl.innerHTML = `<input type="checkbox" value="${kode}" ${dicentang ? 'checked' : ''}> ${a.nama}`;
    lbl.querySelector('input').onchange = perbaruiPratinjauBiaya;
    wa.appendChild(lbl);
  });

  // isian aset eksisting: jenis aset + kondisi
  $('#f-jenis-aset').innerHTML = Object.entries(JENIS_ASET)
    .map(([kode, j]) => `<option value="${kode}" ${pole && pole.jenisAset === kode ? 'selected' : ''}>${j.ikon} ${j.nama}</option>`).join('');
  const wk = $('#f-kondisi');
  wk.innerHTML = '';
  Object.entries(KONDISI).forEach(([kode, k]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.kondisi = kode;
    b.textContent = k.nama;
    b.className = kode === draftKondisi ? 'aktif' : '';
    b.onclick = () => {
      draftKondisi = kode;
      wk.querySelectorAll('button').forEach(el => el.classList.toggle('aktif', el.dataset.kondisi === kode));
      perbaruiPratinjauBiaya();
    };
    wk.appendChild(b);
  });

  // dampak gangguan (prioritas)
  const wd = $('#f-dampak');
  wd.innerHTML = '';
  Object.entries(DAMPAK).forEach(([kode, d]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = d.nama;
    b.className = kode === draftDampak ? 'aktif' : '';
    b.onclick = () => {
      draftDampak = kode;
      [...wd.children].forEach(el => el.classList.toggle('aktif', el === b));
      perbaruiPratinjauBiaya();
    };
    wd.appendChild(b);
  });

  // calon pelanggan
  $('#f-nama-pelanggan').value = pole ? (pole.namaPelanggan || '') : '';
  renderEvidenPelanggan();

  renderTemuanUsulan(pole);
  renderGaleri();
  terapkanModeForm();
  bukaModal('modal-tiang');
}

function poleDariForm() {
  // konstruksi dibaca dari kartu yang tersorot — apa yang tampil = apa yang tersimpan
  const kartuPilih = document.querySelector('#pilih-konstruksi .kartu-k.pilih');
  return {
    id: editId || idBerikut,
    nama: $('#f-nama').value.trim() || `${draftModeTitik === 'eksisting' ? 'A' : 'T'}-${idBerikut}`,
    lat: parseFloat($('#f-lat').value),
    lng: parseFloat($('#f-lng').value),
    mode: draftModeTitik,
    tiang: $('#f-tiang').value,
    konstruksi: (kartuPilih && kartuPilih.dataset.kode) || draftKonstruksi,
    aksesoris: [...document.querySelectorAll('#pilih-aksesoris input:checked')].map(i => i.value),
    jenisAset: $('#f-jenis-aset').value || 'TIANG_TM',
    kondisi: draftKondisi,
    dampak: draftDampak,
    namaPelanggan: $('#f-nama-pelanggan').value.trim().slice(0, 60),
    fotoPelanggan: { ...draftFotoP },
    temuan: [...document.querySelectorAll('#f-temuan input:checked')].map(i => i.value),
    // status usulan yang sudah berjalan dipertahankan; usulan baru = "diusulkan"
    usulan: [...document.querySelectorAll('#f-usulan input:checked')].map(i => {
      const lama = editId && (state.poles.find(x => x.id === editId) || {}).usulan;
      const ada = (lama || []).find(u => u.paket === i.value);
      return { paket: i.value, status: ada ? ada.status : 'diusulkan' };
    }),
    foto: [...draftFoto],
    catatan: $('#f-catatan').value.trim(),
  };
}

function perbaruiPratinjauBiaya() {
  const p = poleDariForm();
  if (isNaN(p.lat) || isNaN(p.lng)) return;
  if (p.mode === 'pelanggan') {
    const lengkap = Object.keys(EVIDEN_PELANGGAN).filter(k => p.fotoPelanggan[k]);
    const kurang = Object.entries(EVIDEN_PELANGGAN).filter(([k]) => !p.fotoPelanggan[k]).map(([, l]) => l);
    $('#f-pratinjau').innerHTML =
      `<b>👤 Calon Pelanggan${p.namaPelanggan ? ' — ' + p.namaPelanggan : ''}</b><br>
       Eviden: <b>${lengkap.length}/${Object.keys(EVIDEN_PELANGGAN).length} lengkap</b>
       ${kurang.length ? `<br><span style="font-size:11px">Kurang: ${kurang.join(', ')}</span>` : ' ✅'}`;
    return;
  }
  if (p.mode === 'eksisting') {
    const j = JENIS_ASET[p.jenisAset] || { nama: '?' };
    const kd = KONDISI[p.kondisi] || KONDISI.baik;
    const skor = skorPrioritas(p);
    let totalUsulan = 0, rincianUsulan = [];
    p.usulan.forEach(u => {
      const b = biayaPaket(u.paket);
      totalUsulan += b.total;
      rincianUsulan.push(`${(PAKET_PERBAIKAN[u.paket] || {}).nama} (${rupiah(b.total)})`);
    });
    $('#f-pratinjau').innerHTML =
      `<b>Aset Eksisting — ${j.nama}</b><br>
       Kondisi: <b style="color:${kd.warna}">${kd.nama}</b> ·
       Skor prioritas: <span class="badge-skor" style="background:${warnaSkor(skor)}">${skor}</span><br>` +
      (p.usulan.length
        ? `<span style="font-size:11px">${rincianUsulan.join(', ')}</span><br>
           Total usulan perbaikan aset ini: <b>${rupiah(totalUsulan)}</b>`
        : `<span style="font-size:11px">Belum ada usulan perbaikan — centang temuan di lapangan untuk saran otomatis.</span>`);
    return;
  }
  const b = biayaPerTiang(p);
  const k = KONSTRUKSI[p.konstruksi];
  const rincian = Object.entries(b.bom)
    .map(([kode, q]) => `${MATERIALS[kode].nama} (${q} ${MATERIALS[kode].satuan})`).join(', ');
  $('#f-pratinjau').innerHTML =
    `<b>${p.konstruksi} — ${k.nama}</b><br>
     <span style="font-size:11px">${rincian}</span><br>
     Material: <b>${rupiah(b.material)}</b> + Jasa pasang: <b>${rupiah(b.jasaKonstruksi)}</b> + Jasa tanam tiang: <b>${rupiah(b.jasaTanam)}</b><br>
     Total titik ini: <b>${rupiah(b.total)}</b>`;
}

function stempel(p, uidLama) {
  p.uid = uidLama || `${DEVICE_ID}-${p.id}`;
  p.petugas = state.settings.petugas || '';
  p.diubah = Date.now();
  return p;
}

function simpanTiangDariForm() {
  const p = poleDariForm();
  if (!isFinite(p.lat) || !isFinite(p.lng) || p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
    toast('Koordinat tidak valid'); return;
  }
  if (!editId && !periksaGawang(p, null)) return;
  if (editId) {
    const i = state.poles.findIndex(x => x.id === editId);
    if (i < 0) { toast('Tiang sudah tidak ada — tidak jadi disimpan'); tutupModal('modal-tiang'); return; }
    stempel(p, state.poles[i].uid);
    state.poles[i] = p;
    toast(`${p.nama} diperbarui`);
  } else {
    stempel(p);
    state.poles.push(p);
    idBerikut++;
    toast(p.mode === 'pelanggan'
      ? `${p.nama} — calon pelanggan ${p.namaPelanggan || '(tanpa nama)'} tersimpan`
      : p.mode === 'eksisting'
        ? `${p.nama} (${(JENIS_ASET[p.jenisAset] || {}).nama} — ${(KONDISI[p.kondisi] || {}).nama}) tersimpan`
        : `${p.nama} (${p.konstruksi}) tersimpan`);
  }
  simpan(); render();
  tutupModal('modal-tiang');
}

function hapusTiang(id) {
  const p = state.poles.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Hapus tiang ${p.nama}?`)) return;
  state.poles = state.poles.filter(x => x.id !== id);
  simpan(); render(); renderDaftarTiang();
  toast(`${p.nama} dihapus`);
}

// ---------------- GPS ----------------
// Tikor tidak diambil dari satu pembacaan: GPS disimak beberapa detik,
// fix paling akurat yang dipakai. Berhenti lebih awal jika sudah ≤ 8 m.
const AKURASI_BAGUS = 8;    // m — cukup, berhenti menyimak
const LAMA_SIMAK = 8000;    // ms — maksimal menyimak GPS

function ambilTikorGPS() {
  if (!navigator.geolocation) { toast('Perangkat tidak mendukung GPS'); return; }
  if (ambilTikorGPS._aktif) return; // cegah dua proses bersamaan
  ambilTikorGPS._aktif = true;
  toast('📡 Menyimak GPS — cari posisi paling akurat…');

  let terbaik = null, selesaiSudah = false;
  const wId = navigator.geolocation.watchPosition(
    (pos) => {
      const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: pos.coords.accuracy || 9999 };
      if (!terbaik || fix.akurasi < terbaik.akurasi) terbaik = fix;
      toast(`📡 Menyimak GPS… akurasi terbaik ±${Math.round(terbaik.akurasi)} m`);
      if (terbaik.akurasi <= AKURASI_BAGUS) selesai();
    },
    (err) => { selesai(err); },
    { enableHighAccuracy: true, timeout: LAMA_SIMAK, maximumAge: 0 }
  );
  const timer = setTimeout(() => selesai(), LAMA_SIMAK);

  function selesai(err) {
    if (selesaiSudah) return;
    selesaiSudah = true;
    clearTimeout(timer);
    navigator.geolocation.clearWatch(wId);
    ambilTikorGPS._aktif = false;

    if (!terbaik) { toast('Gagal ambil GPS: ' + (err ? err.message : 'tidak ada sinyal')); return; }
    if (terbaik.akurasi > state.settings.akurasiMin &&
        !confirm(`Akurasi GPS hanya ±${Math.round(terbaik.akurasi)} m (batas: ${state.settings.akurasiMin} m).\nCoba di tempat lebih terbuka, atau tetap pakai tikor ini?`)) {
      return;
    }
    const ll = { lat: terbaik.lat, lng: terbaik.lng };
    layerGps.clearLayers();
    L.circle(ll, { radius: terbaik.akurasi, color: '#0c6bb5', fillOpacity: .1, weight: 1 }).addTo(layerGps);
    L.circleMarker(ll, { radius: 6, color: '#fff', fillColor: '#0c6bb5', fillOpacity: 1, weight: 2 }).addTo(layerGps);
    map.setView(ll, Math.max(map.getZoom(), 18));
    bukaFormTiang(null, ll);
    toast(`Tikor terkunci — akurasi ±${Math.round(terbaik.akurasi)} m`);
  }
}

// ---------------- LIVE SURVEY ----------------
// Berjalan sambil GPS mengikuti; panel menunjukkan jarak dari tiang
// terakhir, satu ketukan menanam tiang di posisi berdiri sekarang.
let liveAktif = false, watchId = null, posisiLive = null, ikutiPeta = true;
let jejakTitik = [], markerLive = null, lingkarLive = null, garisJejak = null, garisKeTiang = null;
let bufferFix = []; // fix GPS 15 detik terakhir — saat menanam, dipakai yang paling akurat

function fixTerbaik() {
  const batas = Date.now() - 15000;
  const baru = bufferFix.filter(f => f.waktu >= batas);
  if (!baru.length) return posisiLive;
  return baru.reduce((a, b) => (b.akurasi < a.akurasi ? b : a));
}

function mulaiLive() {
  if (!navigator.geolocation) { toast('Perangkat tidak mendukung GPS'); return; }
  liveAktif = true; ikutiPeta = true;
  jejakTitik = []; posisiLive = null;
  markerLive = lingkarLive = garisJejak = garisKeTiang = null;
  layerGps.clearLayers();
  $('#fab-wrap').classList.add('sembunyi');
  $('#panel-live').classList.remove('sembunyi');
  $('#lv-ikuti').classList.add('aktif');
  perbaruiPanelLive();
  bufferFix = [];
  watchId = navigator.geolocation.watchPosition(
    (pos) => terimaPosisiLive(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
    (err) => {
      if (err.code === 1) { // izin ditolak — live tidak mungkin jalan
        stopLive();
        toast('Izin lokasi ditolak — aktifkan izin lokasi untuk aplikasi ini di pengaturan HP');
      } else {
        toast('GPS: ' + err.message);
      }
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
  );
  toast('Live survey aktif — berjalanlah, aplikasi mengikuti posisi Anda');
}

function stopLive() {
  liveAktif = false;
  if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  bufferFix = []; fixTanam = null; posisiLive = null;
  $('#fab-wrap').classList.remove('sembunyi');
  $('#panel-live').classList.add('sembunyi');
  layerGps.clearLayers();
  markerLive = lingkarLive = garisJejak = garisKeTiang = null;
  toast('Live survey dihentikan');
}

function terimaPosisiLive(lat, lng, akurasi) {
  if (!liveAktif) return;
  if (!isFinite(lat) || !isFinite(lng)) return;
  posisiLive = { lat, lng, akurasi: akurasi || 0, waktu: Date.now() };
  bufferFix.push(posisiLive);
  if (bufferFix.length > 40) bufferFix.shift();
  // jejak hanya menerima fix yang layak — mencegah garis loncat-loncat saat sinyal jelek
  if (posisiLive.akurasi <= state.settings.akurasiMin * 2) jejakTitik.push([lat, lng]);

  if (!markerLive) {
    lingkarLive = L.circle([lat, lng], { radius: posisiLive.akurasi, color: '#2e7d32', fillOpacity: .08, weight: 1 }).addTo(layerGps);
    markerLive = L.circleMarker([lat, lng], { radius: 7, color: '#fff', fillColor: '#2e7d32', fillOpacity: 1, weight: 2 }).addTo(layerGps);
    garisJejak = L.polyline(jejakTitik, { color: '#e53935', weight: 2, opacity: .7 }).addTo(layerGps);
    map.setView([lat, lng], Math.max(map.getZoom(), 18));
  } else {
    markerLive.setLatLng([lat, lng]);
    lingkarLive.setLatLng([lat, lng]).setRadius(posisiLive.akurasi);
    garisJejak.setLatLngs(jejakTitik);
    if (ikutiPeta) map.panTo([lat, lng]);
  }

  // garis bantu putus-putus dari tiang rencana terakhir ke posisi sekarang
  const rencanaLive = polesRencana();
  const akhir = rencanaLive[rencanaLive.length - 1];
  if (akhir) {
    const seg = [[akhir.lat, akhir.lng], [lat, lng]];
    if (!garisKeTiang) garisKeTiang = L.polyline(seg, { color: '#2e7d32', weight: 2, dashArray: '4 7' }).addTo(layerGps);
    else garisKeTiang.setLatLngs(seg);
  } else if (garisKeTiang) {
    layerGps.removeLayer(garisKeTiang);
    garisKeTiang = null;
  }

  perbaruiPanelLive();
}

function perbaruiPanelLive() {
  const rencana = polesRencana();
  const akhir = rencana[rencana.length - 1];
  const jarak = (akhir && posisiLive) ? haversine(akhir, posisiLive) : null;
  const elJarak = $('#lv-jarak');
  elJarak.textContent = jarak === null ? '—' : angka(jarak, 0) + ' m';
  elJarak.classList.toggle('ideal', jarak !== null && jarak >= 45 && jarak <= 65); // gawang ideal 45–65 m
  $('#lv-akurasi').textContent = posisiLive ? '±' + Math.round(posisiLive.akurasi) + ' m' : '—';
  $('#lv-jumlah').textContent = rencana.length;
}

// --- tanam cepat: pilih konstruksi = langsung tersimpan ---
let fixTanam = null; // fix yang dikunci saat modal dibuka — tiang ditanam persis di titik ini

function bukaTanamCepat() {
  if (!posisiLive) { toast('Menunggu sinyal GPS… coba lagi sebentar'); return; }
  fixTanam = fixTerbaik(); // pakai fix paling akurat 15 detik terakhir
  if (fixTanam.akurasi > state.settings.akurasiMin &&
      !confirm(`Akurasi GPS saat ini ±${Math.round(fixTanam.akurasi)} m (batas: ${state.settings.akurasiMin} m).\nBerdiri diam sebentar di titik tiang biasanya memperbaiki akurasi.\n\nTetap tanam dengan tikor ini?`)) {
    return;
  }
  $('#q-tiang').value = state.settings.tiangTerakhir || DEFAULT_TIANG;

  const wa = $('#q-aksesoris');
  wa.innerHTML = '';
  Object.entries(AKSESORIS).forEach(([kode, a]) => {
    const lbl = document.createElement('label');
    lbl.className = 'cek-baris';
    lbl.innerHTML = `<input type="checkbox" value="${kode}"> ${a.nama}`;
    lbl.querySelector('input').onchange = renderKartuCepat;
    wa.appendChild(lbl);
  });

  $('#q-posisi').textContent =
    `Posisi: ${fixTanam.lat.toFixed(6)}, ${fixTanam.lng.toFixed(6)} (akurasi ±${Math.round(fixTanam.akurasi)} m)`;
  renderKartuCepat();
  bukaModal('modal-cepat');
}

function renderKartuCepat() {
  const tiang = $('#q-tiang').value;
  const aksesoris = [...document.querySelectorAll('#q-aksesoris input:checked')].map(i => i.value);
  const wadah = $('#q-konstruksi');
  wadah.innerHTML = '';
  let grupCepat = null;
  Object.entries(KONSTRUKSI).forEach(([kode, k]) => {
    const grup = k.grup || 'JTM';
    if (grup !== grupCepat) {
      const h = document.createElement('div');
      h.className = 'grup-kartu';
      h.textContent = grup === 'JTR' ? '💡 JTR — Tegangan Rendah' : '⚡ JTM — Tegangan Menengah';
      wadah.appendChild(h);
      grupCepat = grup;
    }
    const b = biayaPerTiang({ tiang, konstruksi: kode, aksesoris });
    const kartu = document.createElement('div');
    kartu.className = 'kartu-q';
    kartu.innerHTML = `<div class="kode" style="color:${k.warna}">${kode}</div>
      <div class="fungsi">${k.nama} · ${k.sudut}</div>
      <div class="biaya">± ${rupiah(b.total)}</div>`;
    kartu.onclick = () => tanamCepat(kode);
    wadah.appendChild(kartu);
  });
}

function tanamCepat(kode) {
  const fix = fixTanam || fixTerbaik();
  if (!fix) return;
  const p = {
    id: idBerikut,
    mode: 'rencana',
    jenisAset: 'TIANG_TM',
    kondisi: 'baik',
    nama: namaBerikut('T'),
    lat: fix.lat,
    lng: fix.lng,
    tiang: $('#q-tiang').value,
    konstruksi: kode,
    aksesoris: [...document.querySelectorAll('#q-aksesoris input:checked')].map(i => i.value),
    catatan: `akurasi GPS ±${Math.round(fix.akurasi)} m`,
  };
  if (!periksaGawang(p, null)) return;
  stempel(p);
  state.poles.push(p);
  idBerikut++;
  state.settings.tiangTerakhir = p.tiang; // jadi default tanam berikutnya
  simpan(); render(); perbaruiPanelLive();
  tutupModal('modal-cepat');
  toast(`${p.nama} (${kode}) ditanam — total RAB ${rupiah(hitungRAB().grandTotal)}`);
}

// ---------------- PANEL RAB ----------------
function renderRAB() {
  const rab = hitungRAB();
  const s = state.settings;
  let html = '';

  // identitas pekerjaan
  html += `<p style="margin-bottom:10px;font-size:13px">
    <b>Jenis Pekerjaan:</b> ${JENIS_PEKERJAAN[s.jenisPekerjaan] || '—'}
    ${s.namaPekerjaan ? `<br><b>Nama Pekerjaan:</b> ${s.namaPekerjaan}` : ''}
    ${s.petugas ? `<br><b>Surveyor:</b> ${s.petugas}` : ''}</p>`;

  html += `<div class="judul-seksi">A. Rekap Material & Jasa Konstruksi (format lampiran UIW MMU)</div>`;
  if (rab.barisRekap.length === 0) {
    html += `<p class="catatan-kecil">Belum ada tiang. Lakukan taging di peta terlebih dahulu.</p>`;
  } else {
    html += `<div class="bungkus-tabel"><table class="rab">
      <tr><th>Uraian</th><th class="angka">Vol</th><th>Sat</th>
        <th class="angka">Material (Rp)</th><th class="angka">Jasa (Rp)</th>
        <th class="angka">Jml Material</th><th class="angka">Jml Jasa</th><th class="angka">Jumlah</th></tr>`;
    rab.barisRekap.forEach(b => {
      html += `<tr><td>${b.nama}</td><td class="angka">${angka(b.qty)}</td><td>${b.satuan}</td>
        <td class="angka">${angka(b.harga)}</td><td class="angka">${angka(b.jasa)}</td>
        <td class="angka">${angka(b.jmlMaterial)}</td><td class="angka">${angka(b.jmlJasa)}</td>
        <td class="angka">${angka(b.jumlah)}</td></tr>`;
    });
    html += `<tr class="sub"><td colspan="5">Subtotal A</td>
      <td class="angka">${angka(rab.totalMaterialTiang)}</td>
      <td class="angka">${angka(rab.totalJasaKonstruksi)}</td>
      <td class="angka">${angka(rab.totalMaterialTiang + rab.totalJasaKonstruksi)}</td></tr>
      </table></div>`;
  }

  html += `<div class="judul-seksi">B. Penghantar (Jarak Tiang Pertama s.d. Terakhir + Sambungan Suplai)</div>
    <div class="bungkus-tabel"><table class="rab">
      <tr><th>Uraian</th><th class="angka">Vol</th><th>Sat</th><th class="angka">Harga Satuan</th><th class="angka">Jumlah</th></tr>
      <tr><td>Panjang rute jaringan rencana</td><td class="angka">${angka(rab.rute, 0)}</td><td>m</td><td class="angka">—</td><td class="angka">—</td></tr>
      ${rab.suplai ? `<tr><td>⚡ Sambungan suplai dari tiang eksisting <b>${rab.suplai.dari.nama}</b> ke titik awal rencana</td>
        <td class="angka">${angka(rab.jarakSuplai, 0)}</td><td>m</td><td class="angka">—</td><td class="angka">—</td></tr>` : ''}
      <tr><td>${rab.ph.nama} (${rab.ph.fasa} fasa × faktor andongan ${s.sagFactor})</td>
        <td class="angka">${angka(rab.panjangKawat, 0)}</td><td>m</td>
        <td class="angka">${rupiah(hargaEfektif(s.penghantar))}</td>
        <td class="angka">${rupiah(rab.biayaPenghantar)}</td></tr>
    </table></div>`;

  html += `<div class="judul-seksi">C. Jasa Pemasangan</div>
    <div class="bungkus-tabel"><table class="rab">
      <tr><th>Uraian</th><th class="angka">Vol</th><th>Sat</th><th class="angka">Harga Satuan</th><th class="angka">Jumlah</th></tr>
      <tr><td>${MATERIALS.JASA_TIANG.nama}</td><td class="angka">${polesRencana().length}</td><td>tiang</td>
        <td class="angka">${rupiah(hargaEfektif('JASA_TIANG'))}</td><td class="angka">${rupiah(rab.jasaTiang)}</td></tr>
      <tr><td>${MATERIALS.JASA_TARIK.nama}</td><td class="angka">${angka(rab.rutePenghantar / 1000, 2)}</td><td>km</td>
        <td class="angka">${rupiah(hargaEfektif('JASA_TARIK'))}</td><td class="angka">${rupiah(rab.jasaTarik)}</td></tr>
    </table></div>`;

  html += `<div class="judul-seksi">D. Usulan Perbaikan Aset Eksisting (terurut prioritas)</div>`;
  if (rab.daftarUsulan.length === 0) {
    html += `<p class="catatan-kecil">Belum ada usulan — taging aset eksisting dan centang temuan di lapangan.</p>`;
  } else {
    html += `<div class="bungkus-tabel"><table class="rab">
      <tr><th>Prioritas</th><th>Aset</th><th>Kondisi</th><th>Paket Perbaikan</th><th>Status</th>
        <th class="angka">Material</th><th class="angka">Jasa</th><th class="angka">Jumlah</th></tr>`;
    rab.daftarUsulan.forEach(u => {
      const st = STATUS_USULAN[u.status] || STATUS_USULAN.diusulkan;
      html += `<tr><td><span class="badge-skor" style="background:${warnaSkor(u.skor)}">${u.skor}</span></td>
        <td>${u.aset} — ${u.jenis}</td><td>${u.kondisi}</td><td>${u.paket}</td>
        <td><span class="badge-skor" style="background:${st.warna}">${st.nama}</span></td>
        <td class="angka">${angka(u.material)}</td><td class="angka">${angka(u.jasa)}</td>
        <td class="angka">${angka(u.total)}</td></tr>`;
    });
    html += `<tr class="sub"><td colspan="7">Subtotal D — Usulan Perbaikan</td>
      <td class="angka">${angka(rab.totalUsulan)}</td></tr></table></div>`;
  }

  html += `<div class="judul-seksi">E. Total</div>
    <div class="bungkus-tabel"><table class="rab">
      <tr class="sub"><td>Subtotal (A + B + C + D)</td><td class="angka">${rupiah(rab.subtotal)}</td></tr>
      <tr><td>PPN ${s.ppnAktif ? s.ppnPersen + '%' : '(nonaktif)'}</td><td class="angka">${rupiah(rab.ppn)}</td></tr>
      <tr class="total"><td>GRAND TOTAL RAB</td><td class="angka">${rupiah(rab.grandTotal)}</td></tr>
    </table></div>
    <p class="catatan-kecil">Harga konstruksi & pendukung sesuai Lampiran Harga Satuan JTM Tiang Besi UIW Maluku &amp; Maluku Utara.
    ⚠️ Harga <b>batang tiang</b> dan <b>penghantar</b> tidak ada di lampiran — masih contoh, sesuaikan di menu Pengaturan.</p>`;

  // rincian per titik rencana
  const rincianRencana = polesRencana();
  html += `<div class="judul-seksi">Rincian Per Tiang (Rencana)</div>`;
  if (rincianRencana.length) {
    html += `<div class="bungkus-tabel"><table class="rab">
      <tr><th>Tiang</th><th>Konstruksi</th><th class="angka">Jarak dari Sebelumnya</th><th class="angka">Kumulatif</th><th class="angka">Biaya Titik</th></tr>`;
    let kumulatif = 0;
    rincianRencana.forEach((p, i) => {
      const d = i === 0 ? 0 : haversine(rincianRencana[i - 1], p);
      kumulatif += d;
      html += `<tr><td>${p.nama}</td><td>${p.konstruksi} — ${(KONSTRUKSI[p.konstruksi] || {}).nama || ''}</td>
        <td class="angka">${i === 0 ? '—' : angka(d, 0) + ' m'}</td>
        <td class="angka">${angka(kumulatif, 0)} m</td>
        <td class="angka">${rupiah(biayaPerTiang(p).total)}</td></tr>`;
    });
    html += `</table></div>`;
  }

  // ringkasan aset eksisting & calon pelanggan
  const eksisting = state.poles.filter(p => p.mode === 'eksisting');
  if (eksisting.length) {
    const rusak = eksisting.filter(p => p.kondisi !== 'baik').length;
    html += `<div class="judul-seksi">Aset Eksisting Tersurvey</div>
      <p class="catatan-kecil">${eksisting.length} aset tersurvey, <b>${rusak} dalam kondisi rusak</b>,
      ${rab.daftarUsulan.length} usulan perbaikan senilai <b>${rupiah(rab.totalUsulan)}</b> (lihat bagian D).</p>`;
  }
  const pelangganList = state.poles.filter(p => p.mode === 'pelanggan');
  if (pelangganList.length) {
    const lengkap = pelangganList.filter(p => Object.keys(EVIDEN_PELANGGAN).every(k => (p.fotoPelanggan || {})[k])).length;
    html += `<div class="judul-seksi">Calon Pelanggan</div>
      <p class="catatan-kecil">👤 ${pelangganList.length} calon pelanggan tercatat,
      <b>${lengkap} dengan eviden lengkap</b> (KTP, KK, foto bangunan depan & belakang) — rincian di ekspor CSV.</p>`;
  }

  $('#isi-rab').innerHTML = html;
  bukaModal('modal-rab');
}

// ---------------- DAFTAR TIANG ----------------
function renderDaftarTiang() {
  const wadah = $('#isi-daftar');
  if (!state.poles.length) {
    wadah.innerHTML = '<p class="catatan-kecil">Belum ada tiang tersimpan.</p>';
    return;
  }
  wadah.innerHTML = '';
  const BATAS_TAMPIL = 400;
  if (state.poles.length > BATAS_TAMPIL) {
    wadah.innerHTML = `<p class="catatan-kecil">Menampilkan ${BATAS_TAMPIL} dari ${state.poles.length} titik —
      titik lainnya tetap tampil di peta (ketuk markernya untuk edit/hapus).</p>`;
  }
  state.poles.slice(0, BATAS_TAMPIL).forEach((p, i) => {
    const eksisting = p.mode === 'eksisting';
    const pelangganKah = p.mode === 'pelanggan';
    const k = pelangganKah
      ? { warna: '#7b1fa2', nama: `Calon Pelanggan · ${p.namaPelanggan || '(tanpa nama)'}` }
      : eksisting
        ? { warna: (KONDISI[p.kondisi] || KONDISI.baik).warna, nama: `${(JENIS_ASET[p.jenisAset] || {}).nama || '?'} · ${(KONDISI[p.kondisi] || {}).nama || ''}` }
        : (KONSTRUKSI[p.konstruksi] || { warna: '#555', nama: '?' });
    const sebelum = polesRencana();
    const idxR = sebelum.indexOf(p);
    const d = (eksisting || pelangganKah || idxR <= 0) ? null : haversine(sebelum[idxR - 1], p);
    const div = document.createElement('div');
    div.className = 'item-tiang';
    div.innerHTML = `
      <div class="bulat" style="background:${k.warna}">${pelangganKah ? 'CP' : (eksisting ? 'ASET' : p.konstruksi.replace('TM-', 'TM'))}</div>
      <div class="isi">
        <div class="nm">${p.nama} — ${k.nama}</div>
        <div class="dt">${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}
          ${(eksisting || pelangganKah) ? '' : (d !== null ? ` · gawang ${angka(d, 0)} m` : ' · titik awal')}
          ${p.catatan ? ' · ' + p.catatan : ''}</div>
      </div>
      <div class="aksi">
        <button class="tombol polos kecil" data-a="naik" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="tombol polos kecil" data-a="turun" ${i === state.poles.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="tombol polos kecil" data-a="lihat">📍</button>
        <button class="tombol utama kecil" data-a="edit">✏️</button>
        <button class="tombol bahaya kecil" data-a="hapus">🗑</button>
      </div>`;
    div.querySelector('[data-a=naik]').onclick = () => { geserUrutan(i, -1); };
    div.querySelector('[data-a=turun]').onclick = () => { geserUrutan(i, 1); };
    div.querySelector('[data-a=lihat]').onclick = () => { tutupModal('modal-daftar'); map.setView([p.lat, p.lng], 19); };
    div.querySelector('[data-a=edit]').onclick = () => { tutupModal('modal-daftar'); bukaFormTiang(p.id); };
    div.querySelector('[data-a=hapus]').onclick = () => hapusTiang(p.id);
    wadah.appendChild(div);
  });
}

function geserUrutan(i, arah) {
  const j = i + arah;
  if (j < 0 || j >= state.poles.length) return;
  [state.poles[i], state.poles[j]] = [state.poles[j], state.poles[i]];
  simpan(); render(); renderDaftarTiang();
}

// ---------------- PENGATURAN ----------------
function renderPengaturan() {
  const s = state.settings;
  $('#s-penghantar').innerHTML = Object.entries(MATERIALS)
    .filter(([, m]) => m.kategori === 'penghantar')
    .map(([kode, m]) => `<option value="${kode}" ${kode === s.penghantar ? 'selected' : ''}>${m.nama}</option>`)
    .join('');
  $('#s-sag').value = s.sagFactor;
  $('#s-ppn-aktif').checked = s.ppnAktif;
  $('#s-ppn').value = s.ppnPersen;
  $('#s-akurasi').value = s.akurasiMin;
  $('#s-jenis-pekerjaan').innerHTML = Object.entries(JENIS_PEKERJAAN)
    .map(([kode, nama]) => `<option value="${kode}" ${kode === s.jenisPekerjaan ? 'selected' : ''}>${nama}</option>`).join('');
  $('#s-nama-pekerjaan').value = s.namaPekerjaan || '';
  $('#s-petugas').value = s.petugas || '';
  $('#s-server').value = s.server || '';
  $('#s-unit').value = s.kodeUnit || '';

  // editor harga per kategori — material konstruksi punya dua kolom: material & jasa pasang
  const label = { tiang: 'Batang Tiang (harga contoh)', material: 'Material Konstruksi & Pendukung (lampiran UIW MMU)', penghantar: 'Penghantar (harga contoh)', jasa: 'Jasa Gelondongan (harga contoh)' };
  const wadah = $('#editor-harga');
  wadah.innerHTML = '';
  Object.entries(label).forEach(([kat, judul]) => {
    const grup = document.createElement('div');
    grup.className = 'grup-harga';
    grup.innerHTML = `<h4>${judul}</h4>` +
      (kat === 'material' ? `<div class="baris-harga"><div class="nm"></div><small style="width:130px;text-align:center">Material</small><small style="width:130px;text-align:center">Jasa</small></div>` : '');
    Object.entries(MATERIALS).filter(([, m]) => m.kategori === kat).forEach(([kode, m]) => {
      const baris = document.createElement('div');
      baris.className = 'baris-harga';
      baris.innerHTML = `<div class="nm">${m.nama} <small>/ ${m.satuan}</small></div>
        <input type="number" min="0" step="100" data-kode="${kode}" data-jenis="harga" value="${hargaEfektif(kode)}" title="Harga material">` +
        (kat === 'material' ? `<input type="number" min="0" step="100" data-kode="${kode}" data-jenis="jasa" value="${jasaEfektif(kode)}" title="Harga jasa pasang">` : '');
      grup.appendChild(baris);
    });
    wadah.appendChild(grup);
  });
  bukaModal('modal-pengaturan');
}

function simpanPengaturan() {
  const s = state.settings;
  s.penghantar = $('#s-penghantar').value;
  s.sagFactor = Math.min(1.5, Math.max(1, parseFloat($('#s-sag').value) || 1.03)); // andongan tidak mungkin < 1
  s.ppnAktif = $('#s-ppn-aktif').checked;
  s.ppnPersen = Math.min(100, Math.max(0, parseFloat($('#s-ppn').value) || 11));
  s.akurasiMin = Math.min(500, Math.max(1, parseFloat($('#s-akurasi').value) || 15));
  s.jenisPekerjaan = JENIS_PEKERJAAN[$('#s-jenis-pekerjaan').value] ? $('#s-jenis-pekerjaan').value : 'PERLUASAN_JTM';
  s.namaPekerjaan = $('#s-nama-pekerjaan').value.trim().slice(0, 80);
  s.petugas = $('#s-petugas').value.trim().slice(0, 40);
  s.server = $('#s-server').value.trim().slice(0, 200);
  s.kodeUnit = $('#s-unit').value.trim().slice(0, 60);
  document.querySelectorAll('#editor-harga input[data-kode]').forEach(inp => {
    const kode = inp.dataset.kode, nilai = Number(inp.value);
    if (inp.value === '' || !isFinite(nilai) || nilai < 0) return; // kosong / tidak valid → harga lama dipertahankan
    if (inp.dataset.jenis === 'jasa') {
      if (nilai !== (MATERIALS[kode].jasa || 0)) s.jasaOverride[kode] = nilai;
      else delete s.jasaOverride[kode];
    } else {
      if (nilai !== MATERIALS[kode].harga) s.hargaOverride[kode] = nilai;
      else delete s.hargaOverride[kode];
    }
  });
  simpan(); render();
  tutupModal('modal-pengaturan');
  toast('Pengaturan & harga tersimpan');
}

function resetHarga() {
  if (!confirm('Kembalikan semua harga (material & jasa) ke nilai bawaan data.js?')) return;
  state.settings.hargaOverride = {};
  state.settings.jasaOverride = {};
  simpan(); renderPengaturan(); render();
}

// ---------------- SINKRONISASI TERPUSAT (M4) ----------------
// Gabung titik berdasarkan uid (unik lintas perangkat).
// Jika uid sama: pemenang = yang stempel waktu `diubah` paling baru.
function gabungPoles(masuk) {
  const peta = new Map(state.poles.map(p => [p.uid, p]));
  let baru = 0, diperbarui = 0;
  (Array.isArray(masuk) ? masuk : []).forEach((m, i) => {
    const n = normalisasiPole(m, state.poles.length + i);
    if (!n) return;
    const ada = peta.get(n.uid);
    if (!ada) { peta.set(n.uid, n); baru++; }
    else if ((n.diubah || 0) > (ada.diubah || 0)) { peta.set(n.uid, n); diperbarui++; }
  });
  state.poles = [...peta.values()];
  state.poles.forEach((p, i) => { p.id = i + 1; }); // id lokal dirapikan, uid tetap
  idBerikut = state.poles.length + 1;
  return { baru, diperbarui, total: state.poles.length };
}

// gabung koreksi sambungan: per pasangan tiang, pemenang = `diubah` terbaru
function gabungKoreksi(masuk) {
  const peta = new Map((state.koreksi || []).map(k => [kunciPasangan(k.a, k.b), k]));
  normalisasiKoreksi(masuk).forEach(k => {
    const kk = kunciPasangan(k.a, k.b);
    const ada = peta.get(kk);
    if (!ada || (k.diubah || 0) > (ada.diubah || 0)) peta.set(kk, k);
  });
  state.koreksi = [...peta.values()];
}

function urlServer() {
  return (state.settings.server || '').trim().replace(/\/+$/, '');
}

async function kirimKeServer() {
  const url = urlServer();
  if (!url || !state.settings.kodeUnit) { toast('Isi alamat server & kode unit dulu'); return; }
  toast('⬆️ Mengirim data ke server…');
  try {
    const res = await fetch(url + '/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kode-Unit': state.settings.kodeUnit },
      body: JSON.stringify({ poles: state.poles, koreksi: state.koreksi }),
    });
    if (!res.ok) throw new Error('server menolak (HTTP ' + res.status + ')');
    const d = await res.json();
    toast(`✅ Terkirim — server kini menyimpan ${d.total} titik unit ini`);
  } catch (e) {
    toast('Gagal kirim: ' + (e.message || 'server tidak terjangkau'));
  }
}

async function ambilDariServer() {
  const url = urlServer();
  if (!url || !state.settings.kodeUnit) { toast('Isi alamat server & kode unit dulu'); return; }
  toast('⬇️ Mengambil data dari server…');
  try {
    const res = await fetch(url + '/api/data', {
      headers: { 'X-Kode-Unit': state.settings.kodeUnit },
    });
    if (!res.ok) throw new Error('server menolak (HTTP ' + res.status + ')');
    const d = await res.json();
    const hasil = gabungPoles(d.poles);
    gabungKoreksi(d.koreksi);
    simpan(); render();
    if (state.poles.length) map.fitBounds(state.poles.map(p => [p.lat, p.lng]), { padding: [40, 40] });
    toast(`✅ Tergabung: ${hasil.baru} titik baru, ${hasil.diperbarui} diperbarui (total ${hasil.total})`);
  } catch (e) {
    toast('Gagal ambil: ' + (e.message || 'server tidak terjangkau'));
  }
}

// ---------------- EKSPOR / IMPOR ----------------
function unduh(namaFile, isi, tipe) {
  const blob = new Blob([isi], { type: tipe });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = namaFile;
  a.click();
  URL.revokeObjectURL(a.href);
}

function eksporCSV() {
  const rab = hitungRAB();
  const s = state.settings;
  const B = [];
  const baris = (...kolom) => B.push(kolom.join(';'));

  baris('CAKRA - RAB SURVEY JARINGAN TM');
  baris('Cepat - Tepat - Akurat');
  baris('Jenis Pekerjaan', JENIS_PEKERJAAN[s.jenisPekerjaan] || '');
  baris('Nama Pekerjaan', (s.namaPekerjaan || '-').replace(/;/g, ','));
  baris('Surveyor', (s.petugas || '-').replace(/;/g, ','));
  baris('Tanggal ekspor', new Date().toLocaleString('id-ID'));
  baris('');
  baris('A. REKAP MATERIAL & JASA KONSTRUKSI (Lampiran UIW Maluku & Maluku Utara - Tiang Besi)');
  baris('Uraian', 'Vol', 'Sat', 'Harga Material', 'Harga Jasa', 'Jml Material', 'Jml Jasa', 'Jumlah');
  rab.barisRekap.forEach(b => baris(b.nama, b.qty, b.satuan, b.harga, b.jasa, b.jmlMaterial, b.jmlJasa, b.jumlah));
  baris('Subtotal A', '', '', '', '', Math.round(rab.totalMaterialTiang), Math.round(rab.totalJasaKonstruksi), Math.round(rab.totalMaterialTiang + rab.totalJasaKonstruksi));
  baris('');
  baris('B. PENGHANTAR');
  baris('Panjang rute rencana (m)', Math.round(rab.rute));
  if (rab.suplai) baris(`Sambungan suplai dari tiang eksisting ${rab.suplai.dari.nama} (m)`, Math.round(rab.jarakSuplai));
  baris(`${rab.ph.nama} (${rab.ph.fasa} fasa x sag ${s.sagFactor})`, Math.round(rab.panjangKawat), 'm', hargaEfektif(s.penghantar), Math.round(rab.biayaPenghantar));
  baris('');
  baris('C. JASA');
  baris(MATERIALS.JASA_TIANG.nama, state.poles.length, 'tiang', hargaEfektif('JASA_TIANG'), Math.round(rab.jasaTiang));
  baris(MATERIALS.JASA_TARIK.nama, (rab.rute / 1000).toFixed(2), 'km', hargaEfektif('JASA_TARIK'), Math.round(rab.jasaTarik));
  baris('');
  baris('Subtotal', '', '', '', Math.round(rab.subtotal));
  baris(`PPN ${s.ppnAktif ? s.ppnPersen + '%' : '0%'}`, '', '', '', Math.round(rab.ppn));
  baris('GRAND TOTAL', '', '', '', Math.round(rab.grandTotal));
  baris('');
  baris('RINCIAN PER TIANG (RENCANA)');
  baris('Nama', 'Konstruksi', 'Jenis Tiang', 'Latitude', 'Longitude', 'Jarak dari sebelumnya (m)', 'Kumulatif (m)', 'Aksesoris', 'Catatan', 'Biaya Titik');
  const rencanaCSV = polesRencana();
  let kumulatif = 0;
  rencanaCSV.forEach((p, i) => {
    const d = i === 0 ? 0 : haversine(rencanaCSV[i - 1], p);
    kumulatif += d;
    baris(p.nama.replace(/;/g, ','), p.konstruksi, MATERIALS[p.tiang].nama, p.lat, p.lng,
      Math.round(d), Math.round(kumulatif),
      (p.aksesoris || []).map(a => AKSESORIS[a].nama).join(' + '),
      (p.catatan || '').replace(/;/g, ','),
      Math.round(biayaPerTiang(p).total));
  });

  const eksistingCSV = state.poles.filter(p => p.mode === 'eksisting');
  if (eksistingCSV.length) {
    baris('');
    baris('DAFTAR ASET EKSISTING TERSURVEY');
    baris('Nama', 'Jenis Aset', 'Kondisi', 'Dampak', 'Skor Prioritas', 'Latitude', 'Longitude', 'Temuan', 'Jml Foto', 'Catatan');
    eksistingCSV.forEach(p => baris(
      p.nama.replace(/;/g, ','),
      (JENIS_ASET[p.jenisAset] || {}).nama || p.jenisAset,
      (KONDISI[p.kondisi] || {}).nama || p.kondisi,
      (DAMPAK[p.dampak] || {}).nama || '',
      skorPrioritas(p),
      p.lat, p.lng,
      (p.temuan || []).map(t => { const g = TEMUAN[p.jenisAset] || {}; return (g[t] || {}).nama || t; }).join(' + ').replace(/;/g, ','),
      (p.foto || []).length,
      (p.catatan || '').replace(/;/g, ',')));
  }

  const pelangganCSV = state.poles.filter(p => p.mode === 'pelanggan');
  if (pelangganCSV.length) {
    baris('');
    baris('DAFTAR CALON PELANGGAN');
    baris('Kode', 'Nama (sesuai KTP)', 'Latitude', 'Longitude', 'Eviden Lengkap', 'KTP', 'KK', 'Bangunan Depan', 'Bangunan Belakang', 'Catatan');
    pelangganCSV.forEach(p => {
      const f = p.fotoPelanggan || {};
      const ada = (k) => (f[k] ? 'ADA' : 'BELUM');
      const lengkap = Object.keys(EVIDEN_PELANGGAN).filter(k => f[k]).length;
      baris(p.nama, (p.namaPelanggan || '').replace(/;/g, ','), p.lat, p.lng,
        `${lengkap}/${Object.keys(EVIDEN_PELANGGAN).length}`,
        ada('ktp'), ada('kk'), ada('depan'), ada('belakang'),
        (p.catatan || '').replace(/;/g, ','));
    });
  }

  if (rab.daftarUsulan.length) {
    baris('');
    baris('D. USULAN PERBAIKAN ASET EKSISTING (TERURUT PRIORITAS)');
    baris('Skor', 'Aset', 'Jenis', 'Kondisi', 'Paket Perbaikan', 'Status', 'Petugas', 'Material', 'Jasa', 'Jumlah');
    rab.daftarUsulan.forEach(u => baris(u.skor, u.aset.replace(/;/g, ','), u.jenis, u.kondisi,
      u.paket.replace(/;/g, ','), (STATUS_USULAN[u.status] || {}).nama || '', (u.petugas || '').replace(/;/g, ','),
      Math.round(u.material), Math.round(u.jasa), Math.round(u.total)));
    baris('TOTAL USULAN PERBAIKAN', '', '', '', '', '', '', '', '', Math.round(rab.totalUsulan));
  }

  unduh('CAKRA-RAB-Survey.csv', '﻿' + B.join('\n'), 'text/csv;charset=utf-8');
  toast('RAB diekspor ke CSV (buka di Excel)');
}

function eksporKML() {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let plek = state.poles.map(p => {
    const eksisting = p.mode === 'eksisting';
    const pelangganKah = p.mode === 'pelanggan';
    const label = pelangganKah ? 'Calon Pelanggan' : (eksisting ? (JENIS_ASET[p.jenisAset] || {}).nama || 'Aset' : p.konstruksi);
    const desk = pelangganKah
      ? `Calon pelanggan: ${p.namaPelanggan || '-'}${p.catatan ? ' — ' + p.catatan : ''}`
      : eksisting
        ? `Aset eksisting — Kondisi: ${(KONDISI[p.kondisi] || {}).nama || ''}${p.catatan ? ' — ' + p.catatan : ''}`
        : `${(KONSTRUKSI[p.konstruksi] || {}).nama || ''} — ${MATERIALS[p.tiang].nama}${p.catatan ? ' — ' + p.catatan : ''}`;
    return `
    <Placemark><name>${esc(p.nama)} (${esc(label)})</name>
      <description>${esc(desk)}</description>
      <Point><coordinates>${p.lng},${p.lat},0</coordinates></Point>
    </Placemark>`;
  }).join('');
  const rencanaKML = polesRencana();
  if (rencanaKML.length > 1) {
    plek += `
    <Placemark><name>Rute Rencana Jaringan TM</name>
      <LineString><coordinates>${rencanaKML.map(p => `${p.lng},${p.lat},0`).join(' ')}</coordinates></LineString>
    </Placemark>`;
  }
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>CAKRA — Survey Aset Distribusi</name>${plek}
</Document></kml>`;
  unduh('CAKRA-Survey.kml', kml, 'application/vnd.google-earth.kml+xml');
  toast('Diekspor ke KML (buka di Google Earth)');
}

function eksporJSON() {
  unduh('CAKRA-Proyek.json', JSON.stringify({ poles: state.poles, koreksi: state.koreksi, settings: state.settings }, null, 2), 'application/json');
  toast('Proyek disimpan sebagai file JSON');
}

function imporJSON(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.poles)) throw new Error('format tidak dikenal');
      const jumlahMentah = d.poles.length;
      const bersih = normalisasiState(d); // saring entri rusak, perbaiki kode tak dikenal
      state.poles = bersih.poles;
      state.koreksi = bersih.koreksi;
      state.settings = bersih.settings;
      idBerikut = Math.max(0, ...state.poles.map(p => p.id)) + 1;
      simpan(); render();
      if (state.poles.length) map.fitBounds(state.poles.map(p => [p.lat, p.lng]), { padding: [40, 40] });
      tutupModal('modal-ekspor');
      const dibuang = jumlahMentah - state.poles.length;
      toast(`Proyek dimuat: ${state.poles.length} tiang` + (dibuang > 0 ? ` (${dibuang} entri rusak dilewati)` : ''));
    } catch (e) { toast('File tidak valid: ' + e.message); }
  };
  r.readAsText(file);
}

function hapusSemua() {
  if (!confirm('Hapus SEMUA tiang & koreksi sambungan, lalu mulai proyek baru?')) return;
  state.poles = [];
  state.koreksi = [];
  idBerikut = 1;
  simpan(); render();
  tutupModal('modal-ekspor');
  toast('Proyek baru dimulai');
}

// ---------------- PENCARIAN LOKASI ----------------
// Tiga sumber sekaligus: (1) tikor langsung "-3.33, 128.95",
// (2) titik di data sendiri (nama titik / nama pelanggan / aset / catatan),
// (3) nama desa/tempat via geocoding OpenStreetMap (butuh internet).
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
  if (markerCari) map.removeLayer(markerCari);
  markerCari = L.circleMarker([lat, lng], { radius: 11, color: '#d81b60', weight: 4, fill: false })
    .bindPopup(`<b>${label}</b><br>${lat.toFixed(6)}, ${lng.toFixed(6)}`)
    .addTo(map);
  map.setView([lat, lng], Math.max(map.getZoom(), 16));
  markerCari.openPopup();
  $('#cari-hasil').innerHTML = '';
}

function itemHasil(ikon, judul, ket, lat, lng) {
  const div = document.createElement('div');
  div.className = 'hasil-cari';
  div.innerHTML = `<span class="ik">${ikon}</span><div><div>${judul}</div><div class="ket-hasil">${ket}</div></div>`;
  div.onclick = () => menujuHasil(lat, lng, judul);
  return div;
}

async function jalankanPencarian() {
  const q = $('#cari-input').value.trim();
  const wadah = $('#cari-hasil');
  wadah.innerHTML = '';
  if (q.length < 2) return;

  // 1) tikor langsung
  const tikor = parseTikor(q);
  if (tikor) {
    menujuHasil(tikor.lat, tikor.lng, `Tikor ${tikor.lat.toFixed(6)}, ${tikor.lng.toFixed(6)}`);
    return;
  }

  // 2) titik milik sendiri (survey + aset bawaan)
  const kunci = q.toLowerCase();
  const cocokkan = (teks) => (teks || '').toLowerCase().includes(kunci);
  state.poles.filter(p => cocokkan(p.nama) || cocokkan(p.namaPelanggan) || cocokkan(p.catatan))
    .slice(0, 5)
    .forEach(p => wadah.appendChild(itemHasil(
      p.mode === 'pelanggan' ? '👤' : p.mode === 'eksisting' ? '📋' : '🆕',
      p.mode === 'pelanggan' ? (p.namaPelanggan || p.nama) : p.nama,
      p.mode === 'pelanggan' ? `Calon pelanggan · ${p.nama}` : (p.mode === 'eksisting' ? 'Aset tersurvey' : 'Titik rencana'),
      p.lat, p.lng)));
  asetStatis.filter(p => cocokkan(p.nama)).slice(0, 5)
    .forEach(p => wadah.appendChild(itemHasil('🗼', p.nama, 'Tiang TM (aset bawaan)', p.lat, p.lng)));

  // 3) nama desa / tempat via Nominatim (OpenStreetMap)
  const memuat = document.createElement('div');
  memuat.className = 'hasil-cari';
  memuat.innerHTML = '<span class="ik">🌐</span><div>Mencari nama lokasi…</div>';
  wadah.appendChild(memuat);
  try {
    const res = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=id&q='
      + encodeURIComponent(q), { headers: { 'Accept-Language': 'id' } });
    const daftar = await res.json();
    memuat.remove();
    if (!daftar.length && !wadah.children.length) {
      wadah.innerHTML = '<div class="hasil-cari"><span class="ik">😕</span><div>Tidak ditemukan — coba kata lain atau masukkan tikor.</div></div>';
    }
    daftar.forEach(t => wadah.appendChild(itemHasil('📍',
      (t.display_name || '').split(',').slice(0, 2).join(','),
      (t.display_name || '').split(',').slice(2, 5).join(',').trim(),
      parseFloat(t.lat), parseFloat(t.lon))));
  } catch (e) {
    memuat.innerHTML = '<span class="ik">📵</span><div>Pencarian nama lokasi butuh internet — pencarian tikor & nama titik tetap bisa.</div>';
  }
}

function togglePanelCari() {
  const panel = $('#panel-cari');
  const tampil = panel.classList.toggle('sembunyi');
  if (!tampil) { $('#cari-input').focus(); }
  else if (markerCari) { map.removeLayer(markerCari); markerCari = null; }
}

// ---------------- MODAL ----------------
function bukaModal(id) { $('#' + id).classList.add('tampil'); }
function tutupModal(id) { $('#' + id).classList.remove('tampil'); }

// ---------------- INIT ----------------
document.addEventListener('DOMContentLoaded', () => {
  muat();
  initPeta();

  // pilihan jenis tiang diisi dari data.js — satu sumber data, tidak bisa desync
  const opsiTiang = Object.entries(MATERIALS)
    .filter(([, m]) => m.kategori === 'tiang')
    .map(([kode, m]) => `<option value="${kode}">${m.nama.replace('Tiang ', '')}</option>`).join('');
  $('#f-tiang').innerHTML = opsiTiang;
  $('#q-tiang').innerHTML = opsiTiang;

  // indikator offline — taging tetap jalan, hanya tile peta baru yang butuh internet
  const badgeOffline = () => $('#badge-offline').classList.toggle('sembunyi', navigator.onLine !== false);
  window.addEventListener('online', badgeOffline);
  window.addEventListener('offline', badgeOffline);
  badgeOffline();
  render();
  if (state.poles.length) map.fitBounds(state.poles.map(p => [p.lat, p.lng]), { padding: [40, 40] });
  muatAsetStatis(); // lapisan aset TM bawaan

  // tombol
  $('#btn-gps').onclick = ambilTikorGPS;
  $('#btn-tag').onclick = () => {
    modeTaging = !modeTaging;
    $('#btn-tag').classList.toggle('aktif', modeTaging);
    $('#btn-tag').innerHTML = modeTaging ? '🎯 Mode Taging: AKTIF' : '🎯 Mode Taging';
    toast(modeTaging ? 'Ketuk peta untuk menaruh tiang' : 'Mode taging dimatikan');
  };
  $('#btn-rab').onclick = renderRAB;
  $('#btn-cari').onclick = togglePanelCari;
  $('#cari-tombol').onclick = jalankanPencarian;
  $('#cari-tutup').onclick = togglePanelCari;
  $('#cari-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') jalankanPencarian(); });
  $('#btn-koreksi').onclick = toggleModeKoreksi;
  $('#btn-live').onclick = mulaiLive;
  $('#lv-stop').onclick = stopLive;
  $('#lv-tanam').onclick = bukaTanamCepat;
  $('#lv-ikuti').onclick = () => {
    ikutiPeta = !ikutiPeta;
    $('#lv-ikuti').classList.toggle('aktif', ikutiPeta);
    if (ikutiPeta && posisiLive) map.panTo([posisiLive.lat, posisiLive.lng]);
    toast(ikutiPeta ? 'Peta mengikuti posisi Anda' : 'Peta bebas digeser');
  };
  $('#q-tiang').onchange = () => renderKartuCepat();
  map.on('dragstart', () => {
    if (liveAktif && ikutiPeta) { ikutiPeta = false; $('#lv-ikuti').classList.remove('aktif'); }
  });
  $('#ringkas').onclick = renderRAB;
  $('#btn-daftar').onclick = () => { renderDaftarTiang(); bukaModal('modal-daftar'); };
  $('#btn-pengaturan').onclick = renderPengaturan;
  $('#btn-ekspor').onclick = () => bukaModal('modal-ekspor');

  // form titik
  $('#f-simpan').onclick = simpanTiangDariForm;
  $('#f-tiang').onchange = perbaruiPratinjauBiaya;
  $('#f-jenis-aset').onchange = () => { renderTemuanUsulan(null); perbaruiPratinjauBiaya(); };
  $('#f-nama-pelanggan').oninput = perbaruiPratinjauBiaya;
  $('#f-foto').onchange = (e) => {
    [...e.target.files].forEach(tambahFoto);
    e.target.value = '';
  };
  document.querySelectorAll('#f-mode button').forEach(b => {
    b.onclick = () => { draftModeTitik = b.dataset.mode; terapkanModeForm(); };
  });

  // pengaturan
  $('#s-simpan').onclick = simpanPengaturan;
  $('#s-reset').onclick = resetHarga;
  $('#s-keluar').onclick = () => { if (confirm('Keluar dari sesi ini? Data survey di perangkat tetap aman.')) keluarSesi(); };
  const terapkanIsianSync = () => {
    state.settings.petugas = $('#s-petugas').value.trim().slice(0, 40);
    state.settings.server = $('#s-server').value.trim().slice(0, 200);
    state.settings.kodeUnit = $('#s-unit').value.trim().slice(0, 60);
    simpan();
  };
  $('#s-kirim').onclick = () => { terapkanIsianSync(); kirimKeServer(); };
  $('#s-ambil').onclick = () => { terapkanIsianSync(); ambilDariServer(); };

  // ekspor
  $('#e-csv').onclick = eksporCSV;
  $('#e-kml').onclick = eksporKML;
  $('#e-tile').onclick = unduhTileArea;
  $('#e-json').onclick = eksporJSON;
  $('#e-impor').onchange = (e) => { if (e.target.files[0]) imporJSON(e.target.files[0]); e.target.value = ''; };
  $('#e-hapus').onclick = hapusSemua;

  // tutup modal (tombol × dan klik latar)
  document.querySelectorAll('[data-tutup]').forEach(b => b.onclick = () => tutupModal(b.dataset.tutup));
  document.querySelectorAll('.modal-latar').forEach(l => {
    l.addEventListener('click', (e) => { if (e.target === l) l.classList.remove('tampil'); });
  });
});
