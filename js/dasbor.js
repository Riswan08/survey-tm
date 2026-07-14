/* ============================================================
   DASBOR.JS — DASBOR MANAJEMEN CAKRA (M4)
   Menggabungkan data banyak surveyor (server atau file JSON),
   memetakan kondisi aset, dan mengelola status tindak lanjut
   usulan perbaikan.
   ============================================================ */

let poles = [];
const KUNCI_CFG = 'cakra_dasbor_cfg';

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

// ---------------- normalisasi & gabung ----------------
function rapikan(p, i) {
  if (!p || typeof p !== 'object') return null;
  const lat = Number(p.lat), lng = Number(p.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    uid: (typeof p.uid === 'string' && p.uid.length >= 3) ? p.uid.slice(0, 40) : `impor-${i}-${lat.toFixed(5)}-${lng.toFixed(5)}`,
    nama: (typeof p.nama === 'string' && p.nama.trim()) ? p.nama.trim().slice(0, 40) : `#${i + 1}`,
    lat, lng,
    mode: p.mode === 'eksisting' ? 'eksisting' : 'rencana',
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
    catatan: typeof p.catatan === 'string' ? p.catatan.slice(0, 300) : '',
    diubah: isFinite(p.diubah) ? Number(p.diubah) : 0,
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

// ---------------- peta ----------------
let peta, layerTitik, sudahFit = false;

function initPeta() {
  peta = L.map('peta-dasbor').setView([-3.3, 128.95], 11);
  const jalan = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' });
  const satelit = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri' });
  jalan.addTo(peta);
  L.control.layers({ 'Peta Jalan': jalan, 'Satelit': satelit }).addTo(peta);
  layerTitik = L.layerGroup().addTo(peta);
}

function popupHTML(p) {
  const eksisting = p.mode === 'eksisting';
  const judul = eksisting ? (JENIS_ASET[p.jenisAset] || {}).nama : `${p.konstruksi} (rencana)`;
  const kd = KONDISI[p.kondisi] || KONDISI.baik;
  const totalUsulan = p.usulan.reduce((jml, u) => jml + biayaPaket(u.paket).total, 0);
  return `<div class="popup-tiang">
    <div class="pjudul">${p.nama} — ${judul}</div>
    <div class="pinfo">
      ${eksisting ? `Kondisi: <b style="color:${kd.warna}">${kd.nama}</b> · Prioritas ${skorPrioritas(p)}<br>` : ''}
      ${p.usulan.length ? `Usulan: ${p.usulan.map(u => (PAKET_PERBAIKAN[u.paket] || {}).nama).join(', ')} — <b>${rupiah(totalUsulan)}</b><br>` : ''}
      ${p.petugas ? `Petugas: ${p.petugas}<br>` : ''}
      ${p.catatan ? p.catatan + '<br>' : ''}
      ${p.foto.map(f => `<img class="foto-mini" src="${f}">`).join('')}
    </div></div>`;
}

function renderPeta() {
  layerTitik.clearLayers();
  poles.forEach(p => {
    const warna = p.mode === 'eksisting'
      ? (KONDISI[p.kondisi] || KONDISI.baik).warna
      : (KONSTRUKSI[p.konstruksi] || {}).warna || '#0c6bb5';
    L.circleMarker([p.lat, p.lng], {
      radius: 7, weight: 2, color: '#fff', fillColor: warna, fillOpacity: 1,
    }).bindPopup(popupHTML(p)).addTo(layerTitik);
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
  const eksisting = poles.filter(p => p.mode === 'eksisting');
  const rusak = eksisting.filter(p => p.kondisi !== 'baik');
  const usulan = semuaUsulan();
  const totalNilai = usulan.reduce((jml, u) => jml + u.total, 0);
  let html = `
    <div class="kartu-stat"><div class="nilai">${poles.length}</div><div class="ket">Total titik (semua surveyor)</div></div>
    <div class="kartu-stat"><div class="nilai">${eksisting.length}</div><div class="ket">Aset eksisting tersurvey</div></div>
    <div class="kartu-stat"><div class="nilai" style="color:#e53935">${rusak.length}</div><div class="ket">Aset kondisi rusak</div></div>
    <div class="kartu-stat"><div class="nilai">${usulan.length}</div><div class="ket">Usulan perbaikan</div></div>
    <div class="kartu-stat"><div class="nilai">${rupiah(totalNilai)}</div><div class="ket">Total nilai usulan</div></div>`;
  Object.entries(STATUS_USULAN).forEach(([kode, st]) => {
    const grup = usulan.filter(u => u.entri.status === kode);
    const nilai = grup.reduce((jml, u) => jml + u.total, 0);
    html += `<div class="kartu-stat"><div class="nilai" style="color:${st.warna}">${grup.length} · ${rupiah(nilai)}</div>
      <div class="ket">${st.nama}</div></div>`;
  });
  $('#d-ringkasan').innerHTML = html;
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
  let html = `<table class="rab"><tr>
    <th>Prioritas</th><th>Aset</th><th>Jenis</th><th>Kondisi</th><th>Paket Perbaikan</th>
    <th class="angka">Biaya</th><th>Petugas</th><th>Status</th></tr>`;
  daftar.forEach((u, i) => {
    const opsi = Object.entries(STATUS_USULAN)
      .map(([kode, st]) => `<option value="${kode}" ${u.entri.status === kode ? 'selected' : ''}>${st.nama}</option>`).join('');
    html += `<tr>
      <td><span class="badge-skor" style="background:${warnaSkor(u.skor)}">${u.skor}</span></td>
      <td>${u.pole.nama}</td>
      <td>${(JENIS_ASET[u.pole.jenisAset] || {}).nama || ''}</td>
      <td>${(KONDISI[u.pole.kondisi] || {}).nama || ''}</td>
      <td>${(PAKET_PERBAIKAN[u.entri.paket] || {}).nama || u.entri.paket}</td>
      <td class="angka">${angka(u.total)}</td>
      <td>${u.pole.petugas || '—'}</td>
      <td><select data-uid="${u.pole.uid}" data-paket="${u.entri.paket}"
        style="border-left:4px solid ${(STATUS_USULAN[u.entri.status] || {}).warna}">${opsi}</select></td>
    </tr>`;
  });
  html += '</table>';
  $('#d-tabel-usulan').innerHTML = html;

  document.querySelectorAll('#d-tabel-usulan select').forEach(sel => {
    sel.onchange = () => {
      const p = poles.find(x => x.uid === sel.dataset.uid);
      const entri = p && p.usulan.find(u => u.paket === sel.dataset.paket);
      if (!entri) return;
      entri.status = sel.value;
      p.diubah = Date.now(); // agar perubahan status menang saat sinkron
      renderRingkasan(); renderTabelUsulan();
      toast(`${p.nama}: ${(PAKET_PERBAIKAN[entri.paket] || {}).nama} → ${STATUS_USULAN[sel.value].nama}`);
    };
  });
}

function renderSemua() {
  renderPeta();
  renderRingkasan();
  renderTabelUsulan();
}

// ---------------- sumber data ----------------
function bacaCfg() {
  try { return JSON.parse(localStorage.getItem(KUNCI_CFG)) || {}; } catch (e) { return {}; }
}
function simpanCfg() {
  localStorage.setItem(KUNCI_CFG, JSON.stringify({ server: $('#d-server').value.trim(), unit: $('#d-unit').value.trim() }));
}

async function ambilServer() {
  simpanCfg();
  const url = $('#d-server').value.trim().replace(/\/+$/, ''), unit = $('#d-unit').value.trim();
  if (!url || !unit) { toast('Isi alamat server & kode unit'); return; }
  toast('⬇️ Mengambil data…');
  try {
    const res = await fetch(url + '/api/data', { headers: { 'X-Kode-Unit': unit } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    const hasil = gabung(d.poles);
    renderSemua();
    toast(`✅ ${hasil.baru} baru, ${hasil.diperbarui} diperbarui — total ${hasil.total} titik`);
  } catch (e) { toast('Gagal: ' + e.message); }
}

async function kirimServer() {
  simpanCfg();
  const url = $('#d-server').value.trim().replace(/\/+$/, ''), unit = $('#d-unit').value.trim();
  if (!url || !unit) { toast('Isi alamat server & kode unit'); return; }
  if (!poles.length) { toast('Belum ada data untuk dikirim'); return; }
  toast('⬆️ Menyimpan ke server…');
  try {
    const res = await fetch(url + '/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kode-Unit': unit },
      body: JSON.stringify({ poles }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    toast(`✅ Tersimpan — server kini menyimpan ${d.total} titik (status tindak lanjut ikut terbarui)`);
  } catch (e) { toast('Gagal: ' + e.message); }
}

function imporFiles(files) {
  let selesai = 0, totalBaru = 0, totalUbah = 0;
  [...files].forEach(file => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        const hasil = gabung(Array.isArray(d.poles) ? d.poles : (Array.isArray(d) ? d : []));
        totalBaru += hasil.baru; totalUbah += hasil.diperbarui;
      } catch (e) { toast(`${file.name}: file tidak valid`); }
      if (++selesai === files.length) {
        renderSemua();
        toast(`✅ ${files.length} file diimpor — ${totalBaru} titik baru, ${totalUbah} diperbarui`);
      }
    };
    r.readAsText(file);
  });
}

function unduhGabungan() {
  if (!poles.length) { toast('Belum ada data'); return; }
  const blob = new Blob([JSON.stringify({ poles }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'CAKRA-Gabungan.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('JSON gabungan diunduh — bisa dibuka kembali di aplikasi survey / dasbor');
}

// ---------------- init ----------------
document.addEventListener('DOMContentLoaded', () => {
  initPeta();

  const cfg = bacaCfg();
  $('#d-server').value = cfg.server || '';
  $('#d-unit').value = cfg.unit || '';

  $('#d-filter-status').innerHTML += Object.entries(STATUS_USULAN)
    .map(([kode, st]) => `<option value="${kode}">${st.nama}</option>`).join('');
  $('#d-filter-jenis').innerHTML += Object.entries(JENIS_ASET)
    .map(([kode, j]) => `<option value="${kode}">${j.nama}</option>`).join('');
  $('#d-filter-status').onchange = renderTabelUsulan;
  $('#d-filter-jenis').onchange = renderTabelUsulan;

  $('#d-ambil').onclick = ambilServer;
  $('#d-kirim').onclick = kirimServer;
  $('#d-file').onchange = (e) => { if (e.target.files.length) imporFiles(e.target.files); e.target.value = ''; };
  $('#d-unduh').onclick = unduhGabungan;
  $('#d-bersih').onclick = () => {
    if (!poles.length || confirm('Kosongkan data dasbor? (data di server / file tidak terhapus)')) {
      poles = []; sudahFit = false; renderSemua();
    }
  };

  renderSemua();
});
