/* ============================================================
   APP.JS — LOGIKA APLIKASI SURVEY TAGING TIANG TM + RAB
   ============================================================ */

// ---------------- STATE ----------------
const KUNCI_SIMPAN = 'survey_tm_v1';

let state = {
  poles: [],                 // {id, nama, lat, lng, tiang, konstruksi, aksesoris:[], catatan}
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
  localStorage.setItem(KUNCI_SIMPAN, JSON.stringify({ poles: state.poles, settings: state.settings, idBerikut }));
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
    tiang: MATERIALS[p.tiang] && MATERIALS[p.tiang].kategori === 'tiang' ? p.tiang : DEFAULT_TIANG,
    konstruksi: KONSTRUKSI[p.konstruksi] ? p.konstruksi : 'TM-1',
    aksesoris: Array.isArray(p.aksesoris) ? p.aksesoris.filter(a => AKSESORIS[a]) : [],
    catatan: typeof p.catatan === 'string' ? p.catatan.slice(0, 300) : '',
  };
}

function normalisasiState(d) {
  const bawaan = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const hasil = { poles: [], settings: bawaan };
  if (!d || typeof d !== 'object') return hasil;

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
  if (MATERIALS[s.tiangTerakhir] && MATERIALS[s.tiangTerakhir].kategori === 'tiang') hasil.settings.tiangTerakhir = s.tiangTerakhir;
  if (s.hargaOverride && typeof s.hargaOverride === 'object') {
    Object.entries(s.hargaOverride).forEach(([kode, h]) => {
      if (MATERIALS[kode] && isFinite(Number(h)) && Number(h) >= 0) hasil.settings.hargaOverride[kode] = Number(h);
    });
  }
  return hasil;
}

function muat() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KUNCI_SIMPAN)); } catch (e) { /* data rusak → mulai kosong */ }
  const bersih = normalisasiState(d);
  state.poles = bersih.poles;
  state.settings = bersih.settings;
  idBerikut = Math.max(0, ...state.poles.map(p => p.id)) + 1;
}

// nomor tiang otomatis berikutnya: lanjut dari nomor terbesar yang ada (aman setelah hapus)
function namaBerikut() {
  let maks = 0;
  state.poles.forEach(p => {
    const m = /^T-?(\d+)$/i.exec(p.nama);
    if (m) maks = Math.max(maks, parseInt(m[1], 10));
  });
  return `T-${String(Math.max(maks, state.poles.length) + 1).padStart(2, '0')}`;
}

// pemeriksaan kewajaran gawang — cegah tikor salah (GPS loncat / salah ketuk)
function periksaGawang(p, kecualiId) {
  const lainnya = state.poles.filter(x => x.id !== kecualiId);
  const akhir = lainnya[lainnya.length - 1];
  if (!akhir) return true;
  const d = haversine(akhir, p);
  if (d < 3) return confirm(`⚠️ Tiang ini hanya ${angka(d, 1)} m dari ${akhir.nama} — kemungkinan ketuk ganda atau GPS belum stabil.\n\nTetap simpan?`);
  if (d > 250) return confirm(`⚠️ Jarak ke ${akhir.nama} = ${angka(d, 0)} m — jauh di atas gawang normal (±50 m). Periksa apakah tikor benar.\n\nTetap simpan?`);
  return true;
}

// ---------------- PETA ----------------
let map, layerTiang, layerGaris, layerGps;

function initPeta() {
  map = L.map('map', { zoomControl: false }).setView([-3.3, 128.95], 13); // sekitar Masohi
  L.control.zoom({ position: 'topleft' }).addTo(map);

  const jalan = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap',
  });
  const satelit = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Esri World Imagery' }
  );
  jalan.addTo(map);
  L.control.layers({ 'Peta Jalan': jalan, 'Satelit': satelit }, null, { position: 'topleft' }).addTo(map);

  layerGaris = L.layerGroup().addTo(map);
  layerTiang = L.layerGroup().addTo(map);
  layerGps = L.layerGroup().addTo(map);

  map.on('baselayerchange', (e) => { tileAktif = e.name === 'Satelit' ? 'esri' : 'osm'; });
  map.on('click', (e) => {
    if (modeTaging) bukaFormTiang(null, e.latlng);
  });
}

// ---------------- PETA OFFLINE ----------------
// Unduh tile area yang sedang tampil ke Cache Storage — dipakai
// service worker saat offline. GPS & taging tetap jalan tanpa tile.
let tileAktif = 'osm';

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
  const s = ['a', 'b', 'c'][Math.abs(x + y) % 3]; // subdomain sama dengan pilihan Leaflet → cache pasti kena
  return `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
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

function ikonTiang(pole, idx) {
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

  // garis jaringan + label jarak per gawang (span)
  const titik = state.poles.map(p => [p.lat, p.lng]);
  if (titik.length > 1) {
    L.polyline(titik, { color: '#0c6bb5', weight: 3, dashArray: '6 4' }).addTo(layerGaris);
    for (let i = 1; i < state.poles.length; i++) {
      const a = state.poles[i - 1], b = state.poles[i];
      const d = haversine(a, b);
      L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], {
        icon: L.divIcon({ className: 'label-jarak', html: `${angka(d, 0)} m`, iconSize: null }),
        interactive: false,
      }).addTo(layerGaris);
    }
  }

  // marker tiang (bisa digeser)
  state.poles.forEach((pole, idx) => {
    const m = L.marker([pole.lat, pole.lng], { icon: ikonTiang(pole, idx), draggable: true });
    m.on('dragend', (e) => {
      const ll = e.target.getLatLng();
      // konfirmasi dulu — mencegah tikor bergeser karena tersenggol saat menggeser peta
      if (confirm(`Pindahkan ${pole.nama} ke tikor baru?\n${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`)) {
        pole.lat = ll.lat; pole.lng = ll.lng;
        simpan();
        toast(`${pole.nama} dipindah ke tikor baru`);
      }
      render(); // kembalikan / perbarui posisi marker & garis
    });
    m.bindPopup(() => popupTiang(pole));
    m.addTo(layerTiang);
  });

  perbaruiRingkasan();
}

function popupTiang(pole) {
  const k = KONSTRUKSI[pole.konstruksi] || { nama: '?' };
  const biaya = biayaPerTiang(pole).total;
  const div = document.createElement('div');
  div.className = 'popup-tiang';
  div.innerHTML = `
    <div class="pjudul">${pole.nama} — ${pole.konstruksi}</div>
    <div class="pinfo">
      ${k.nama}<br>
      ${MATERIALS[pole.tiang].nama}<br>
      ${pole.lat.toFixed(6)}, ${pole.lng.toFixed(6)}<br>
      <b>Biaya titik ini: ${rupiah(biaya)}</b>
    </div>
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
  let material = 0;
  Object.entries(bom).forEach(([kode, q]) => { material += hargaEfektif(kode) * q; });
  const jasa = hargaEfektif('JASA_TIANG');
  return { bom, material, jasa, total: material + jasa };
}

function panjangRute() {
  let total = 0;
  for (let i = 1; i < state.poles.length; i++) total += haversine(state.poles[i - 1], state.poles[i]);
  return total; // meter
}

function hitungRAB() {
  const s = state.settings;

  // 1) rekap material seluruh tiang
  const rekap = {}; // kode -> qty
  state.poles.forEach(p => {
    Object.entries(bomTiang(p)).forEach(([kode, q]) => { rekap[kode] = (rekap[kode] || 0) + q; });
  });
  let totalMaterialTiang = 0;
  const barisRekap = Object.entries(rekap).map(([kode, qty]) => {
    const h = hargaEfektif(kode), jml = h * qty;
    totalMaterialTiang += jml;
    return { kode, nama: MATERIALS[kode].nama, satuan: MATERIALS[kode].satuan, qty, harga: h, jumlah: jml };
  });

  // 2) penghantar berdasarkan panjang rute (sampai tiang terakhir)
  const rute = panjangRute();
  const ph = MATERIALS[s.penghantar];
  const panjangKawat = rute * (ph.fasa || 3) * s.sagFactor;
  const biayaPenghantar = panjangKawat * hargaEfektif(s.penghantar);

  // 3) jasa
  const jasaTiang = state.poles.length * hargaEfektif('JASA_TIANG');
  const jasaTarik = (rute / 1000) * hargaEfektif('JASA_TARIK');

  const subtotal = totalMaterialTiang + biayaPenghantar + jasaTiang + jasaTarik;
  const ppn = s.ppnAktif ? subtotal * (s.ppnPersen / 100) : 0;

  return {
    barisRekap, totalMaterialTiang,
    rute, ph, panjangKawat, biayaPenghantar,
    jasaTiang, jasaTarik,
    subtotal, ppn, grandTotal: subtotal + ppn,
  };
}

function perbaruiRingkasan() {
  const rab = hitungRAB();
  $('#r-tiang').textContent = state.poles.length;
  $('#r-jarak').textContent = rab.rute >= 1000 ? angka(rab.rute / 1000, 2) + ' km' : angka(rab.rute, 0) + ' m';
  $('#r-total').textContent = rupiah(rab.grandTotal);
  if (liveAktif) perbaruiPanelLive(); // panel live ikut segar setelah tambah/hapus/geser tiang
}

// ---------------- FORM TIANG (TAMBAH / EDIT) ----------------
function bukaFormTiang(id, latlng) {
  editId = id;
  const pole = id ? state.poles.find(p => p.id === id) : null;
  draftLatLng = pole ? { lat: pole.lat, lng: pole.lng } : latlng;
  draftKonstruksi = pole ? pole.konstruksi : draftKonstruksi;

  $('#f-judul').textContent = pole ? `Edit ${pole.nama}` : 'Taging Tiang Baru';
  $('#f-nama').value = pole ? pole.nama : namaBerikut();
  $('#f-lat').value = draftLatLng.lat.toFixed(6);
  $('#f-lng').value = draftLatLng.lng.toFixed(6);
  $('#f-tiang').value = pole ? pole.tiang : DEFAULT_TIANG;
  $('#f-catatan').value = pole ? (pole.catatan || '') : '';

  // kartu konstruksi
  const wadah = $('#pilih-konstruksi');
  wadah.innerHTML = '';
  Object.entries(KONSTRUKSI).forEach(([kode, k]) => {
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

  perbaruiPratinjauBiaya();
  bukaModal('modal-tiang');
}

function poleDariForm() {
  // konstruksi dibaca dari kartu yang tersorot — apa yang tampil = apa yang tersimpan
  const kartuPilih = document.querySelector('#pilih-konstruksi .kartu-k.pilih');
  return {
    id: editId || idBerikut,
    nama: $('#f-nama').value.trim() || `T-${idBerikut}`,
    lat: parseFloat($('#f-lat').value),
    lng: parseFloat($('#f-lng').value),
    tiang: $('#f-tiang').value,
    konstruksi: (kartuPilih && kartuPilih.dataset.kode) || draftKonstruksi,
    aksesoris: [...document.querySelectorAll('#pilih-aksesoris input:checked')].map(i => i.value),
    catatan: $('#f-catatan').value.trim(),
  };
}

function perbaruiPratinjauBiaya() {
  const p = poleDariForm();
  if (isNaN(p.lat) || isNaN(p.lng)) return;
  const b = biayaPerTiang(p);
  const k = KONSTRUKSI[p.konstruksi];
  const rincian = Object.entries(b.bom)
    .map(([kode, q]) => `${MATERIALS[kode].nama} (${q} ${MATERIALS[kode].satuan})`).join(', ');
  $('#f-pratinjau').innerHTML =
    `<b>${p.konstruksi} — ${k.nama}</b><br>
     <span style="font-size:11px">${rincian}</span><br>
     Material: <b>${rupiah(b.material)}</b> &nbsp;+&nbsp; Jasa: <b>${rupiah(b.jasa)}</b><br>
     Total titik ini: <b>${rupiah(b.total)}</b>`;
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
    state.poles[i] = p;
    toast(`${p.nama} diperbarui`);
  } else {
    state.poles.push(p);
    idBerikut++;
    toast(`${p.nama} (${p.konstruksi}) tersimpan`);
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

  // garis bantu putus-putus dari tiang terakhir ke posisi sekarang
  const akhir = state.poles[state.poles.length - 1];
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
  const akhir = state.poles[state.poles.length - 1];
  const jarak = (akhir && posisiLive) ? haversine(akhir, posisiLive) : null;
  const elJarak = $('#lv-jarak');
  elJarak.textContent = jarak === null ? '—' : angka(jarak, 0) + ' m';
  elJarak.classList.toggle('ideal', jarak !== null && jarak >= 45 && jarak <= 65); // gawang ideal 45–65 m
  $('#lv-akurasi').textContent = posisiLive ? '±' + Math.round(posisiLive.akurasi) + ' m' : '—';
  $('#lv-jumlah').textContent = state.poles.length;
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
  Object.entries(KONSTRUKSI).forEach(([kode, k]) => {
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
    nama: namaBerikut(),
    lat: fix.lat,
    lng: fix.lng,
    tiang: $('#q-tiang').value,
    konstruksi: kode,
    aksesoris: [...document.querySelectorAll('#q-aksesoris input:checked')].map(i => i.value),
    catatan: `akurasi GPS ±${Math.round(fix.akurasi)} m`,
  };
  if (!periksaGawang(p, null)) return;
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

  html += `<div class="judul-seksi">A. Rekap Material Tiang & Konstruksi</div>`;
  if (rab.barisRekap.length === 0) {
    html += `<p class="catatan-kecil">Belum ada tiang. Lakukan taging di peta terlebih dahulu.</p>`;
  } else {
    html += `<div class="bungkus-tabel"><table class="rab">
      <tr><th>Uraian Material</th><th class="angka">Vol</th><th>Sat</th><th class="angka">Harga Satuan</th><th class="angka">Jumlah</th></tr>`;
    rab.barisRekap.forEach(b => {
      html += `<tr><td>${b.nama}</td><td class="angka">${angka(b.qty)}</td><td>${b.satuan}</td>
        <td class="angka">${rupiah(b.harga)}</td><td class="angka">${rupiah(b.jumlah)}</td></tr>`;
    });
    html += `<tr class="sub"><td colspan="4">Subtotal Material</td><td class="angka">${rupiah(rab.totalMaterialTiang)}</td></tr>
      </table></div>`;
  }

  html += `<div class="judul-seksi">B. Penghantar (Jarak Tiang Pertama s.d. Terakhir)</div>
    <div class="bungkus-tabel"><table class="rab">
      <tr><th>Uraian</th><th class="angka">Vol</th><th>Sat</th><th class="angka">Harga Satuan</th><th class="angka">Jumlah</th></tr>
      <tr><td>Panjang rute jaringan</td><td class="angka">${angka(rab.rute, 0)}</td><td>m</td><td class="angka">—</td><td class="angka">—</td></tr>
      <tr><td>${rab.ph.nama} (${rab.ph.fasa} fasa × faktor andongan ${s.sagFactor})</td>
        <td class="angka">${angka(rab.panjangKawat, 0)}</td><td>m</td>
        <td class="angka">${rupiah(hargaEfektif(s.penghantar))}</td>
        <td class="angka">${rupiah(rab.biayaPenghantar)}</td></tr>
    </table></div>`;

  html += `<div class="judul-seksi">C. Jasa Pemasangan</div>
    <div class="bungkus-tabel"><table class="rab">
      <tr><th>Uraian</th><th class="angka">Vol</th><th>Sat</th><th class="angka">Harga Satuan</th><th class="angka">Jumlah</th></tr>
      <tr><td>${MATERIALS.JASA_TIANG.nama}</td><td class="angka">${state.poles.length}</td><td>tiang</td>
        <td class="angka">${rupiah(hargaEfektif('JASA_TIANG'))}</td><td class="angka">${rupiah(rab.jasaTiang)}</td></tr>
      <tr><td>${MATERIALS.JASA_TARIK.nama}</td><td class="angka">${angka(rab.rute / 1000, 2)}</td><td>km</td>
        <td class="angka">${rupiah(hargaEfektif('JASA_TARIK'))}</td><td class="angka">${rupiah(rab.jasaTarik)}</td></tr>
    </table></div>`;

  html += `<div class="judul-seksi">D. Total</div>
    <div class="bungkus-tabel"><table class="rab">
      <tr class="sub"><td>Subtotal (A + B + C)</td><td class="angka">${rupiah(rab.subtotal)}</td></tr>
      <tr><td>PPN ${s.ppnAktif ? s.ppnPersen + '%' : '(nonaktif)'}</td><td class="angka">${rupiah(rab.ppn)}</td></tr>
      <tr class="total"><td>GRAND TOTAL RAB</td><td class="angka">${rupiah(rab.grandTotal)}</td></tr>
    </table></div>
    <p class="catatan-kecil">⚠️ Harga satuan adalah contoh — sesuaikan di menu Pengaturan dengan harga SKKI/HPS unit Anda.</p>`;

  // rincian per tiang
  html += `<div class="judul-seksi">Rincian Per Tiang</div>`;
  if (state.poles.length) {
    html += `<div class="bungkus-tabel"><table class="rab">
      <tr><th>Tiang</th><th>Konstruksi</th><th class="angka">Jarak dari Sebelumnya</th><th class="angka">Kumulatif</th><th class="angka">Biaya Titik</th></tr>`;
    let kumulatif = 0;
    state.poles.forEach((p, i) => {
      const d = i === 0 ? 0 : haversine(state.poles[i - 1], p);
      kumulatif += d;
      html += `<tr><td>${p.nama}</td><td>${p.konstruksi} — ${(KONSTRUKSI[p.konstruksi] || {}).nama || ''}</td>
        <td class="angka">${i === 0 ? '—' : angka(d, 0) + ' m'}</td>
        <td class="angka">${angka(kumulatif, 0)} m</td>
        <td class="angka">${rupiah(biayaPerTiang(p).total)}</td></tr>`;
    });
    html += `</table></div>`;
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
  state.poles.forEach((p, i) => {
    const k = KONSTRUKSI[p.konstruksi] || { warna: '#555', nama: '?' };
    const d = i === 0 ? null : haversine(state.poles[i - 1], p);
    const div = document.createElement('div');
    div.className = 'item-tiang';
    div.innerHTML = `
      <div class="bulat" style="background:${k.warna}">${p.konstruksi.replace('TM-', 'TM')}</div>
      <div class="isi">
        <div class="nm">${p.nama} — ${k.nama}</div>
        <div class="dt">${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}
          ${d !== null ? ` · gawang ${angka(d, 0)} m` : ' · titik awal'}
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

  // editor harga per kategori
  const label = { tiang: 'Tiang', material: 'Material Konstruksi', pengaman: 'Pengaman / Aksesoris', penghantar: 'Penghantar', jasa: 'Jasa' };
  const wadah = $('#editor-harga');
  wadah.innerHTML = '';
  Object.entries(label).forEach(([kat, judul]) => {
    const grup = document.createElement('div');
    grup.className = 'grup-harga';
    grup.innerHTML = `<h4>${judul}</h4>`;
    Object.entries(MATERIALS).filter(([, m]) => m.kategori === kat).forEach(([kode, m]) => {
      const baris = document.createElement('div');
      baris.className = 'baris-harga';
      baris.innerHTML = `<div class="nm">${m.nama} <small>/ ${m.satuan}</small></div>
        <input type="number" min="0" step="1000" data-kode="${kode}" value="${hargaEfektif(kode)}">`;
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
  document.querySelectorAll('#editor-harga input[data-kode]').forEach(inp => {
    const kode = inp.dataset.kode, nilai = Number(inp.value);
    if (inp.value === '' || !isFinite(nilai) || nilai < 0) return; // kosong / tidak valid → harga lama dipertahankan
    if (nilai !== MATERIALS[kode].harga) s.hargaOverride[kode] = nilai;
    else delete s.hargaOverride[kode];
  });
  simpan(); render();
  tutupModal('modal-pengaturan');
  toast('Pengaturan & harga tersimpan');
}

function resetHarga() {
  if (!confirm('Kembalikan semua harga ke nilai bawaan data.js?')) return;
  state.settings.hargaOverride = {};
  simpan(); renderPengaturan(); render();
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

  baris('RAB SURVEY JARINGAN TM');
  baris('Tanggal ekspor', new Date().toLocaleString('id-ID'));
  baris('');
  baris('A. REKAP MATERIAL TIANG & KONSTRUKSI');
  baris('Uraian', 'Vol', 'Sat', 'Harga Satuan', 'Jumlah');
  rab.barisRekap.forEach(b => baris(b.nama, b.qty, b.satuan, b.harga, b.jumlah));
  baris('Subtotal Material', '', '', '', Math.round(rab.totalMaterialTiang));
  baris('');
  baris('B. PENGHANTAR');
  baris('Panjang rute (m)', Math.round(rab.rute));
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
  baris('RINCIAN PER TIANG');
  baris('Nama', 'Konstruksi', 'Jenis Tiang', 'Latitude', 'Longitude', 'Jarak dari sebelumnya (m)', 'Kumulatif (m)', 'Aksesoris', 'Catatan', 'Biaya Titik');
  let kumulatif = 0;
  state.poles.forEach((p, i) => {
    const d = i === 0 ? 0 : haversine(state.poles[i - 1], p);
    kumulatif += d;
    baris(p.nama.replace(/;/g, ','), p.konstruksi, MATERIALS[p.tiang].nama, p.lat, p.lng,
      Math.round(d), Math.round(kumulatif),
      (p.aksesoris || []).map(a => AKSESORIS[a].nama).join(' + '),
      (p.catatan || '').replace(/;/g, ','),
      Math.round(biayaPerTiang(p).total));
  });

  unduh('RAB-Survey-TM.csv', '﻿' + B.join('\n'), 'text/csv;charset=utf-8');
  toast('RAB diekspor ke CSV (buka di Excel)');
}

function eksporKML() {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let plek = state.poles.map(p => `
    <Placemark><name>${esc(p.nama)} (${p.konstruksi})</name>
      <description>${esc((KONSTRUKSI[p.konstruksi] || {}).nama || '')} — ${esc(MATERIALS[p.tiang].nama)}${p.catatan ? ' — ' + esc(p.catatan) : ''}</description>
      <Point><coordinates>${p.lng},${p.lat},0</coordinates></Point>
    </Placemark>`).join('');
  if (state.poles.length > 1) {
    plek += `
    <Placemark><name>Rute Jaringan TM</name>
      <LineString><coordinates>${state.poles.map(p => `${p.lng},${p.lat},0`).join(' ')}</coordinates></LineString>
    </Placemark>`;
  }
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Survey Jaringan TM</name>${plek}
</Document></kml>`;
  unduh('Survey-TM.kml', kml, 'application/vnd.google-earth.kml+xml');
  toast('Diekspor ke KML (buka di Google Earth)');
}

function eksporJSON() {
  unduh('Proyek-Survey-TM.json', JSON.stringify({ poles: state.poles, settings: state.settings }, null, 2), 'application/json');
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
  if (!confirm('Hapus SEMUA tiang dan mulai proyek baru?')) return;
  state.poles = [];
  idBerikut = 1;
  simpan(); render();
  tutupModal('modal-ekspor');
  toast('Proyek baru dimulai');
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

  // tombol
  $('#btn-gps').onclick = ambilTikorGPS;
  $('#btn-tag').onclick = () => {
    modeTaging = !modeTaging;
    $('#btn-tag').classList.toggle('aktif', modeTaging);
    $('#btn-tag').innerHTML = modeTaging ? '🎯 Mode Taging: AKTIF' : '🎯 Mode Taging';
    toast(modeTaging ? 'Ketuk peta untuk menaruh tiang' : 'Mode taging dimatikan');
  };
  $('#btn-rab').onclick = renderRAB;
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

  // form tiang
  $('#f-simpan').onclick = simpanTiangDariForm;
  $('#f-tiang').onchange = perbaruiPratinjauBiaya;

  // pengaturan
  $('#s-simpan').onclick = simpanPengaturan;
  $('#s-reset').onclick = resetHarga;

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
