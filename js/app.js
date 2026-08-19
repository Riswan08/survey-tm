/* ============================================================
   APP.JS — LOGIKA APLIKASI SURVEY TAGING TIANG TM + RAB
   ============================================================ */

// ---------------- STATE ----------------
const KUNCI_SIMPAN = 'survey_tm_v1';

// ---------------- MULTI-PROYEK (FR-08) ----------------
// Beberapa proyek (per penyulang/pekerjaan) dalam satu perangkat.
// Registry di 'cakra_proyek'; data proyek 'utama' tetap di kunci lama
// (survey_tm_v1) → data yang sudah ada otomatis menjadi Proyek Utama.
const KUNCI_PROYEK = 'cakra_proyek';
let proyek = { aktif: 'utama', daftar: [{ id: 'utama', nama: 'Proyek Utama', dibuat: 0 }] };

function kunciSimpan(id) {
  const p = id || proyek.aktif;
  return p === 'utama' ? KUNCI_SIMPAN : KUNCI_SIMPAN + '_' + p;
}

function muatRegistryProyek() {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI_PROYEK));
    if (d && Array.isArray(d.daftar) && d.daftar.length) {
      proyek.daftar = d.daftar
        .filter(p => p && typeof p.id === 'string' && /^[a-z0-9]+$/i.test(p.id))
        .map(p => ({
          id: p.id.slice(0, 20),
          nama: (typeof p.nama === 'string' && p.nama.trim()) ? p.nama.trim().slice(0, 60) : 'Proyek',
          dibuat: Number(p.dibuat) || 0,
        }));
      if (!proyek.daftar.length) proyek.daftar = [{ id: 'utama', nama: 'Proyek Utama', dibuat: 0 }];
      proyek.aktif = proyek.daftar.some(p => p.id === d.aktif) ? d.aktif : proyek.daftar[0].id;
    }
  } catch (e) { /* registry rusak → mulai dari bawaan */ }
}

function simpanRegistryProyek() {
  localStorage.setItem(KUNCI_PROYEK, JSON.stringify(proyek));
}

const proyekAktif = () => proyek.daftar.find(p => p.id === proyek.aktif) || proyek.daftar[0];

function gantiProyek(id) {
  if (id === proyek.aktif || !proyek.daftar.some(p => p.id === id)) return;
  simpan(); // amankan proyek yang sedang terbuka
  proyek.aktif = id;
  simpanRegistryProyek();
  muat();
  render();
  if (state.poles.length) map.fitBounds(state.poles.map(p => [p.lat, p.lng]), { padding: [40, 40] });
  renderDaftarProyek();
  toast(`📁 Proyek "${proyekAktif().nama}" dibuka — ${state.poles.length} titik`);
}

function buatProyek() {
  const nama = (prompt('Nama proyek baru (mis. nama penyulang / pekerjaan):') || '').trim().slice(0, 60);
  if (!nama) return;
  const id = 'p' + Date.now().toString(36);
  // proyek baru mewarisi pengaturan proyek aktif (petugas, server, harga) — titiknya kosong
  const warisan = JSON.parse(JSON.stringify(state.settings));
  warisan.namaPekerjaan = '';
  simpan();
  proyek.daftar.push({ id, nama, dibuat: Date.now() });
  proyek.aktif = id;
  simpanRegistryProyek();
  localStorage.setItem(kunciSimpan(id), JSON.stringify({ poles: [], koreksi: [], settings: warisan, idBerikut: 1 }));
  muat();
  render();
  renderDaftarProyek();
  toast(`📁 Proyek "${nama}" dibuat & dibuka`);
}

function ubahNamaProyek(id) {
  const p = proyek.daftar.find(x => x.id === id);
  if (!p) return;
  const nama = (prompt('Nama baru proyek:', p.nama) || '').trim().slice(0, 60);
  if (!nama) return;
  p.nama = nama;
  simpanRegistryProyek();
  renderDaftarProyek();
}

function hapusProyek(id) {
  const p = proyek.daftar.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Hapus proyek "${p.nama}" beserta seluruh titiknya dari perangkat ini?\n(Ekspor dulu ke JSON bila masih diperlukan.)`)) return;
  localStorage.removeItem(kunciSimpan(id));
  proyek.daftar = proyek.daftar.filter(x => x.id !== id);
  if (!proyek.daftar.length) proyek.daftar = [{ id: 'utama', nama: 'Proyek Utama', dibuat: 0 }];
  if (proyek.aktif === id) {
    proyek.aktif = proyek.daftar[0].id;
    simpanRegistryProyek();
    muat();
    render();
    if (state.poles.length) map.fitBounds(state.poles.map(p => [p.lat, p.lng]), { padding: [40, 40] });
  } else {
    simpanRegistryProyek();
  }
  renderDaftarProyek();
  toast(`Proyek "${p.nama}" dihapus`);
}

function renderDaftarProyek() {
  const wadah = $('#daftar-proyek');
  if (!wadah) return;
  wadah.innerHTML = '';
  proyek.daftar.forEach(p => {
    const aktif = p.id === proyek.aktif;
    const div = document.createElement('div');
    div.className = 'item-tiang';
    div.innerHTML = `
      <div class="bulat" style="background:${aktif ? '#0c6bb5' : '#90a4ae'}">📁</div>
      <div class="isi">
        <div class="nm">${p.nama} ${aktif ? '<span class="badge-skor" style="background:#2e7d32">AKTIF</span>' : ''}</div>
        <div class="dt">${aktif ? `${state.poles.length} titik tersimpan` : (p.dibuat ? 'dibuat ' + new Date(p.dibuat).toLocaleDateString('id-ID') : 'proyek bawaan')}</div>
      </div>
      <div class="aksi">
        ${aktif ? '' : '<button class="tombol utama kecil" data-a="buka">Buka</button>'}
        <button class="tombol polos kecil" data-a="nama">✏️</button>
        <button class="tombol bahaya kecil" data-a="hapus">🗑</button>
      </div>`;
    const btnBuka = div.querySelector('[data-a=buka]');
    if (btnBuka) btnBuka.onclick = () => gantiProyek(p.id);
    div.querySelector('[data-a=nama]').onclick = () => ubahNamaProyek(p.id);
    div.querySelector('[data-a=hapus]').onclick = () => hapusProyek(p.id);
    wadah.appendChild(div);
  });
}

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
  hapus: [],                 // tanda-hapus titik: {uid, diubah, petugas} — ikut tersinkron
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
    localStorage.setItem(kunciSimpan(), JSON.stringify({ poles: state.poles, koreksi: state.koreksi, hapus: state.hapus, settings: state.settings, idBerikut }));
  } catch (e) {
    toast('⚠️ Penyimpanan HP hampir penuh — hapus sebagian foto atau ekspor proyek ke JSON');
  }
  sinkronTertunda = true;     // ditandai sampai benar-benar diterima server
  jadwalkanSinkronOtomatis(); // setiap pekerjaan/usulan langsung mengalir ke database unit
}

// ---------------- SINKRONISASI OTOMATIS ----------------
// Offline-first tetap: data selalu tersimpan di perangkat dulu. Bila alamat
// server & kode unit terisi dan perangkat online, setiap perubahan dikirim
// otomatis (senyap, dijeda 4 dtk) — pekerjaan & usulan langsung terbaca di
// database unit untuk monitoring, tanpa tombol kirim/unduh manual.
let timerSinkron = null;
let sinkronTertunda = false; // ada perubahan yang belum diterima server (dicoba ulang berkala)
let waktuSinkronTerakhir = Number(localStorage.getItem('cakra_sinkron_terakhir')) || 0;

function catatSinkron() {
  waktuSinkronTerakhir = Date.now();
  localStorage.setItem('cakra_sinkron_terakhir', String(waktuSinkronTerakhir));
  perbaruiStatusSinkron();
}

// kode unit yang sah untuk server: huruf/angka/-/_ — spasi dll. diganti strip
function rapikanKodeUnit(v) {
  return String(v || '').trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// halaman HTTPS (github.io) DILARANG browser menghubungi server HTTP lokal
// (mixed content) — solusinya: buka aplikasi dari alamat server itu sendiri
function campuranTerblokir() {
  return location.protocol === 'https:' && urlServer().startsWith('http://');
}

function pesanCampuran() {
  return `🔴 Browser memblokir: aplikasi ini dibuka lewat HTTPS (${location.host}) sehingga TIDAK BISA `
    + `menghubungi server HTTP lokal. Buka aplikasi dari ${urlServer()}/ (server juga menyajikan `
    + `aplikasi yang sama) — sinkronisasi langsung jalan.`;
}

function perbaruiStatusSinkron() {
  const el = $('#s-status-sinkron');
  if (!el) return;
  if (!urlServer() || !state.settings.kodeUnit) {
    el.textContent = '⚪ Sinkron otomatis nonaktif — isi alamat server & kode unit lalu Simpan.';
  } else if (campuranTerblokir()) {
    el.textContent = pesanCampuran();
  } else if (navigator.onLine === false) {
    el.textContent = '🟡 Offline — perubahan aman di HP, terkirim sendiri begitu online.';
  } else if (sinkronTertunda) {
    el.textContent = '🟠 Ada perubahan yang belum diterima server — dikirim ulang otomatis tiap menit.';
  } else {
    el.textContent = '🟢 Sinkron otomatis AKTIF — setiap simpan langsung terkirim ke database unit'
      + (waktuSinkronTerakhir ? ` (terakhir ${new Date(waktuSinkronTerakhir).toLocaleTimeString('id-ID')})` : '') + '.';
  }
}

function sinkronSiap() {
  return !!(urlServer() && state.settings.kodeUnit) && navigator.onLine !== false && !campuranTerblokir();
}

// ---------------- KONFIGURASI OTOMATIS (konfig.json) ----------------
// Alamat server & kode unit dibaca dari konfig.json di repo — pengguna TIDAK
// perlu mengetik apa pun. server/tunnel.sh memperbarui file ini otomatis saat
// tunnel dinyalakan, semua perangkat mengikuti saat aplikasi dibuka.
// Isian manual di Pengaturan tetap menang (serverOtomatis jadi false).
let konfigTerbaru = null;

async function muatKonfigOtomatis() {
  try {
    const res = await fetch('konfig.json?nc=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const k = await res.json();
    if (!k || typeof k.server !== 'string' || !k.server.trim()) return;
    konfigTerbaru = {
      server: k.server.trim().replace(/\/+$/, '').slice(0, 200),
      kodeUnit: rapikanKodeUnit(k.kodeUnit || ''),
    };
    const s = state.settings;
    if (!s.server || s.serverOtomatis) {
      const berubah = s.server !== konfigTerbaru.server ||
        (konfigTerbaru.kodeUnit && s.kodeUnit !== konfigTerbaru.kodeUnit);
      s.server = konfigTerbaru.server;
      if (konfigTerbaru.kodeUnit) s.kodeUnit = konfigTerbaru.kodeUnit;
      s.serverOtomatis = true;
      if (berubah) {
        simpan();
        toast('🔗 Tersambung otomatis ke server unit — tidak perlu mengisi alamat apa pun');
      }
      perbaruiStatusSinkron();
    }
  } catch (e) { /* offline / konfig belum ada — pakai pengaturan tersimpan */ }
}

function jadwalkanSinkronOtomatis() {
  if (!sinkronSiap()) return;
  clearTimeout(timerSinkron);
  timerSinkron = setTimeout(() => kirimKeServer(true), 4000);
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
    ulp: typeof p.ulp === 'string' ? p.ulp.slice(0, 40) : '',
    pekerjaan: typeof p.pekerjaan === 'string' ? p.pekerjaan.slice(0, 100) : '',
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
// aset eksisting & calon pelanggan berada di luar rantai.
// PENTING: rantai TIDAK pernah menyeberang pekerjaan — titik rencana milik
// pekerjaan/petugas lain (hasil sinkronisasi unit) tidak digabung ke rute,
// RAB, maupun live survey pekerjaan yang sedang dikerjakan.
function grupRencanaPerPekerjaan() {
  // kunci grup = PEKERJAAN + PETUGAS — dua petugas tidak pernah tersambung
  // walau nama pekerjaannya sama / sama-sama kosong
  const grup = new Map();
  state.poles.filter(p => !p.mode || p.mode === 'rencana').forEach(p => {
    const k = (p.pekerjaan || '') + '' + (p.petugas || '');
    if (!grup.has(k)) grup.set(k, []);
    grup.get(k).push(p);
  });
  return grup;
}

// RUTE BERBENTUK POHON (mendukung percabangan): tiap titik tersambung ke titik
// TERDEKAT yang ditaging lebih dulu di pekerjaan yang sama — bukan selalu titik
// terakhir. Jalan lurus tetap berurutan; cabang menyambung ke tiang percabangan.
function sisiRantai(daftar, maks = 2000) {
  const sisi = []; // { a: induk, b: titik, d: jarak }
  for (let i = 1; i < daftar.length; i++) {
    let induk = null, jarakMin = Infinity;
    for (let j = 0; j < i; j++) {
      const d = haversine(daftar[j], daftar[i]);
      if (d < jarakMin) { jarakMin = d; induk = daftar[j]; }
    }
    if (induk && jarakMin <= maks) sisi.push({ a: induk, b: daftar[i], d: jarakMin });
  }
  return sisi;
}

// titik rantai aktif yang TERDEKAT dari suatu posisi (untuk live survey & pemeriksaan gawang)
function tiangTerdekatDari(pos, kecualiId) {
  let terdekat = null, jarakMin = Infinity;
  polesRencana().forEach(p => {
    if (kecualiId !== undefined && p.id === kecualiId) return;
    const d = haversine(p, pos);
    if (d < jarakMin) { jarakMin = d; terdekat = p; }
  });
  return terdekat ? { pole: terdekat, jarak: jarakMin } : null;
}

const polesRencana = () => {
  // rantai AKTIF = pekerjaan pada Identitas Pekerjaan saat ini, MILIK SENDIRI;
  // titik tanpa label/petugas ikut serta (akan menerima identitas saat disimpan)
  const label = labelPekerjaan();
  const saya = (state.settings.petugas || '').trim().toLowerCase();
  return state.poles.filter(p => (!p.mode || p.mode === 'rencana') &&
    (!p.pekerjaan || p.pekerjaan === label) &&
    (!p.petugas || p.petugas.trim().toLowerCase() === saya));
};

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

function normalisasiHapus(daftar) {
  return (Array.isArray(daftar) ? daftar : [])
    .filter(t => t && typeof t.uid === 'string' && t.uid.length >= 3)
    .slice(-5000)
    .map(t => ({
      uid: t.uid.slice(0, 40),
      diubah: isFinite(t.diubah) ? Number(t.diubah) : 0,
      petugas: typeof t.petugas === 'string' ? t.petugas.slice(0, 40) : '',
    }));
}

function normalisasiState(d) {
  const bawaan = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const hasil = { poles: [], koreksi: [], hapus: [], settings: bawaan };
  if (!d || typeof d !== 'object') return hasil;
  hasil.koreksi = normalisasiKoreksi(d.koreksi);
  hasil.hapus = normalisasiHapus(d.hapus);

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
  if (DAFTAR_ULP.includes(s.lokasiUlp)) hasil.settings.lokasiUlp = s.lokasiUlp;
  if (typeof s.server === 'string') hasil.settings.server = s.server.slice(0, 200);
  if (typeof s.serverOtomatis === 'boolean') hasil.settings.serverOtomatis = s.serverOtomatis;
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
  if (isFinite(s.hargaDiubah) && s.hargaDiubah >= 0) hasil.settings.hargaDiubah = Number(s.hargaDiubah);
  return hasil;
}

function muat() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(kunciSimpan())); } catch (e) { /* data rusak → mulai kosong */ }
  const bersih = normalisasiState(d);
  state.poles = bersih.poles;
  state.koreksi = bersih.koreksi;
  state.hapus = bersih.hapus;
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
  // dibandingkan dengan titik TERDEKAT (induk sambungannya) — mendukung percabangan
  const dekat = tiangTerdekatDari(p, kecualiId);
  if (!dekat) return true;
  const d = dekat.jarak, nama = dekat.pole.nama;
  if (d < 3) return confirm(`⚠️ Tiang ini hanya ${angka(d, 1)} m dari ${nama} — kemungkinan ketuk ganda atau GPS belum stabil.\n\nTetap simpan?`);
  if (d > 250) return confirm(`⚠️ Jarak ke titik terdekat (${nama}) = ${angka(d, 0)} m — jauh di atas gawang normal (±50 m). Periksa apakah tikor benar.\n\nTetap simpan?`);
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
// titik sambung suatu rantai pekerjaan ke jaringan eksisting.
// 1) MANUAL menang: sambungan yang dibuat lewat mode Koreksi (ketuk tiang
//    pekerjaan lalu tiang eksisting) = titik sambung pilihan surveyor.
// 2) Tanpa manual: otomatis ke tiang TM eksisting terdekat (maks 500 m).
function suplaiUntuk(daftar) {
  if (!daftar || !daftar.length) return null;
  const uidRantai = new Set(daftar.map(p => p.uid));
  const posisi = posisiSemua();

  // sambungan MANUAL: koreksi 'tambah' yang menghubungkan rantai ini ke luar rantai
  let manual = null;
  (state.koreksi || []).forEach(k => {
    if (k.aksi !== 'tambah') return;
    const aDi = uidRantai.has(k.a), bDi = uidRantai.has(k.b);
    if (aDi === bDi) return; // dua-duanya di dalam / di luar rantai — bukan titik sambung
    const luar = posisi.get(aDi ? k.b : k.a);
    const dalam = posisi.get(aDi ? k.a : k.b);
    if (!luar || !dalam) return;
    if (!manual || (k.diubah || 0) > manual.diubah) {
      manual = { dari: luar, ke: dalam, jarak: haversine(luar, dalam), manual: true, diubah: k.diubah || 0 };
    }
  });
  if (manual) return manual;

  // otomatis: tiang eksisting terdekat dari titik awal rantai
  const awal = daftar[0];
  let terbaik = null;
  const uji = (p) => {
    if (uidRantai.has(p.uid)) return;
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

function suplaiTerdekat() {
  return suplaiUntuk(polesRencana());
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

  // garis rute rencana per PEKERJAAN — pekerjaan/petugas berbeda tidak pernah
  // tersambung; label jarak hanya untuk pekerjaan yang sedang aktif
  const labelAktif = labelPekerjaan();
  const petugasSaya = (state.settings.petugas || '').trim().toLowerCase();
  grupRencanaPerPekerjaan().forEach((daftar) => {
    const labelG = daftar[0].pekerjaan || '';
    const petugasG0 = (daftar[0].petugas || '').trim().toLowerCase();
    const aktif = (!labelG || labelG === labelAktif) && (!petugasG0 || petugasG0 === petugasSaya);
    // sisi pohon: tiap titik ke titik terdekat sebelumnya — percabangan tergambar benar
    sisiRantai(daftar).forEach(({ a, b, d }) => {
      L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
        color: '#0c6bb5', weight: aktif ? 3 : 2, dashArray: '6 4', opacity: aktif ? 1 : .55,
      }).addTo(layerGaris);
      if (aktif) {
        L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], {
          icon: L.divIcon({ className: 'label-jarak', html: `${angka(d, 0)} m`, iconSize: null }),
          interactive: false,
        }).addTo(layerGaris);
      }
    });
    // papan nama pekerjaan di peta — petugas/role lain langsung tahu ini
    // pekerjaan apa, jenisnya apa, siapa & dari unit mana
    if (daftar.length) {
      const tengah = daftar[Math.floor(daftar.length / 2)];
      const petugasG = [...new Set(daftar.map(p => p.petugas).filter(Boolean))].join(', ');
      const ulpG = [...new Set(daftar.map(p => p.ulp).filter(Boolean))].join(', ');
      L.marker([tengah.lat, tengah.lng], {
        icon: L.divIcon({
          className: 'label-pekerjaan' + (aktif ? ' aktif' : ''),
          html: `⚡ ${labelG || labelAktif || 'Pekerjaan tanpa nama'}` +
            ((petugasG || ulpG) ? `<small>👤 ${petugasG || '—'}${ulpG ? ' · 🏢 ' + ulpG : ''}</small>` : ''),
          iconSize: null, iconAnchor: [0, 42],
        }),
        interactive: false,
      }).addTo(layerGaris);
    }
  });

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
    const m = L.marker([pole.lat, pole.lng], { icon: ikonTiang(pole, idx), draggable: !modeKoreksi && bolehUbahTitik(pole) });
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
  // identitas pekerjaan & pembuat — terbaca oleh petugas/role lain
  const infoPekerjaan =
    (pole.pekerjaan ? `⚡ <b>${pole.pekerjaan}</b><br>` : '') +
    (pole.petugas ? `👤 ${pole.petugas}${pole.ulp ? ' · 🏢 ' + pole.ulp : ''}<br>` : '');
  if (infoPekerjaan) isi += `<div class="pinfo" style="border-top:1px solid #e4e9ee;margin-top:5px;padding-top:5px">${infoPekerjaan}</div>`;
  // tombol ubah hanya untuk pembuat titik / admin — orang lain cukup melihat
  if (bolehUbahTitik(pole)) {
    div.innerHTML = isi + `
    <div class="paksi">
      <button class="tombol utama kecil" data-aksi="edit">✏️ Edit</button>
      <button class="tombol bahaya kecil" data-aksi="hapus">🗑 Hapus</button>
    </div>`;
    div.querySelector('[data-aksi=edit]').onclick = () => { map.closePopup(); bukaFormTiang(pole.id); };
    div.querySelector('[data-aksi=hapus]').onclick = () => { map.closePopup(); hapusTiang(pole.id); };
  } else {
    div.innerHTML = isi + `
    <div class="paksi"><span class="catatan-kecil">🔒 Dibuat oleh <b>${pole.petugas}</b> — hanya pembuat atau admin yang dapat mengubah.</span></div>`;
  }
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
  // total panjang sisi pohon rute (termasuk cabang) — bukan rantai lurus
  return sisiRantai(polesRencana()).reduce((jml, s) => jml + s.d, 0); // meter
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
  const poleCek = id ? state.poles.find(p => p.id === id) : null;
  if (poleCek && !bolehUbahTitik(poleCek)) {
    toast(`🔒 ${poleCek.nama} dibuat oleh ${poleCek.petugas} — hanya pembuat atau admin yang dapat mengubah`);
    return;
  }
  editId = id;
  const pole = poleCek;
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

// label pekerjaan proyek: "Jenis — Nama/Lokasi" (tampil di dasbor monitoring)
function labelPekerjaan(s) {
  s = s || state.settings;
  return (`${JENIS_PEKERJAAN[s.jenisPekerjaan] || ''}${s.namaPekerjaan ? ' — ' + s.namaPekerjaan : ''}`).trim().slice(0, 100);
}

function stempel(p, uidLama) {
  p.uid = uidLama || `${DEVICE_ID}-${p.id}`;
  p.petugas = state.settings.petugas || '';
  const sesi = (typeof sesiCakra === 'function' && sesiCakra()) || {};
  // lokasi pekerjaan (ULP) dari Identitas Pekerjaan; kalau kosong ikut ULP sesi login
  p.ulp = state.settings.lokasiUlp || sesi.ulp || p.ulp || '';
  p.pekerjaan = labelPekerjaan();
  p.diubah = Date.now();
  return p;
}

// ---------------- KEPEMILIKAN TITIK & USULAN ----------------
// Satu database bersama: semua orang MELIHAT semua titik/usulan, tetapi
// mengubah/menghapus hanya boleh PEMBUATNYA sendiri atau ADMIN (FR-12).
// Nama pembuat tidak pernah diganti saat titik diedit orang lain.
function namaPetugasSaatIni() {
  const sesi = (typeof sesiCakra === 'function' && sesiCakra()) || {};
  return (sesi.petugas || state.settings.petugas || '').trim().toLowerCase();
}

function bolehUbahTitik(p) {
  // admin & manajemen (perencana/manajer) boleh mengubah titik siapa pun;
  // surveyor hanya miliknya sendiri
  if (typeof bolehKelolaUsulan === 'function' && bolehKelolaUsulan()) return true;
  const pemilik = (p.petugas || '').trim().toLowerCase();
  return !pemilik || pemilik === namaPetugasSaatIni(); // tanpa pemilik = bebas (data lama/impor)
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
    if (!bolehUbahTitik(state.poles[i])) { toast('🔒 Hanya pembuat atau admin yang dapat mengubah titik ini'); return; }
    stempel(p, state.poles[i].uid);
    // pembuat asli dipertahankan — edit (termasuk oleh admin) tidak mengganti nama pembuat
    p.petugas = state.poles[i].petugas || p.petugas;
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

function tandaiHapus(uid) {
  // tanda-hapus ikut tersinkron ke database — titik hilang PERMANEN di semua
  // perangkat, tidak muncul kembali saat sinkronisasi berikutnya
  state.hapus = (state.hapus || []).filter(t => t.uid !== uid);
  state.hapus.push({ uid, diubah: Date.now(), petugas: state.settings.petugas || '' });
}

function hapusTiang(id) {
  const p = state.poles.find(x => x.id === id);
  if (!p) return;
  if (!bolehUbahTitik(p)) { toast(`🔒 ${p.nama} dibuat oleh ${p.petugas} — hanya pembuat atau admin yang dapat menghapus`); return; }
  if (!confirm(`Hapus tiang ${p.nama}?\n(Terhapus dari database — hilang juga di perangkat semua petugas.)`)) return;
  tandaiHapus(p.uid);
  state.poles = state.poles.filter(x => x.id !== id);
  simpan(); render(); renderDaftarTiang();
  toast(`${p.nama} dihapus dari database unit`);
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

  // garis bantu putus-putus dari tiang TERDEKAT ke posisi sekarang —
  // saat menyusuri percabangan, garis mengikuti tiang cabang, bukan ujung rute
  const dekatLive = tiangTerdekatDari({ lat, lng });
  const akhir = dekatLive ? dekatLive.pole : null;
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
  const dekat = posisiLive ? tiangTerdekatDari(posisiLive) : null;
  const jarak = dekat ? dekat.jarak : null;
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
      <tr><th>Tiang</th><th>Konstruksi</th><th class="angka">Gawang (dari tiang induk)</th><th class="angka">Kumulatif</th><th class="angka">Biaya Titik</th></tr>`;
    let kumulatif = 0;
    rincianRencana.forEach((p, i) => {
      // induk = titik terdekat yang ditaging lebih dulu (mendukung percabangan)
      let d = 0, induk = '';
      for (let j = 0; j < i; j++) {
        const dd = haversine(rincianRencana[j], p);
        if (!induk || dd < d) { d = dd; induk = rincianRencana[j].nama; }
      }
      kumulatif += d;
      html += `<tr><td>${p.nama}</td><td>${p.konstruksi} — ${(KONSTRUKSI[p.konstruksi] || {}).nama || ''}</td>
        <td class="angka">${i === 0 ? '—' : angka(d, 0) + ' m (' + induk + ')'}</td>
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
        ${bolehUbahTitik(p)
          ? `<button class="tombol utama kecil" data-a="edit">✏️</button>
             <button class="tombol bahaya kecil" data-a="hapus">🗑</button>`
          : `<span class="catatan-kecil" title="Dibuat oleh ${p.petugas} — hanya pembuat atau admin yang dapat mengubah">🔒 ${p.petugas}</span>`}
      </div>`;
    div.querySelector('[data-a=naik]').onclick = () => { geserUrutan(i, -1); };
    div.querySelector('[data-a=turun]').onclick = () => { geserUrutan(i, 1); };
    div.querySelector('[data-a=lihat]').onclick = () => { tutupModal('modal-daftar'); map.setView([p.lat, p.lng], 19); };
    const btnEdit = div.querySelector('[data-a=edit]');
    if (btnEdit) btnEdit.onclick = () => { tutupModal('modal-daftar'); bukaFormTiang(p.id); };
    const btnHapus = div.querySelector('[data-a=hapus]');
    if (btnHapus) btnHapus.onclick = () => hapusTiang(p.id);
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
  // lokasi pekerjaan (ULP) — bila belum dipilih, ikut ULP sesi login
  const sesiUlp = ((typeof sesiCakra === 'function' && sesiCakra()) || {}).ulp || '';
  const ulpTerpilih = s.lokasiUlp || (DAFTAR_ULP.includes(sesiUlp) ? sesiUlp : '');
  $('#s-lokasi-ulp').innerHTML = '<option value="">— pilih ULP —</option>' + DAFTAR_ULP
    .map(u => `<option value="${u}" ${u === ulpTerpilih ? 'selected' : ''}>${u}</option>`).join('');
  $('#s-petugas').value = s.petugas || '';
  $('#s-server').value = s.server || '';
  $('#s-unit').value = s.kodeUnit || '';
  // kolom alamat server & kode unit hanya untuk admin (pintu darurat);
  // petugas lapangan cukup melihat status — semuanya otomatis dari konfig.json
  $('#s-lanjutan').classList.toggle('sembunyi', !(typeof bolehKelolaHarga === 'function' && bolehKelolaHarga()));
  perbaruiStatusSinkron();

  // identitas sesi (nama, ULP, peran) + keterangan hak harga
  const sesi = (typeof sesiCakra === 'function') ? sesiCakra() : null;
  const peranInfo = sesi ? (PERAN[sesi.peran] || PERAN.surveyor) : null;
  $('#s-sesi-info').textContent = sesi
    ? `Masuk sebagai ${sesi.petugas} — ${sesi.ulp} (${peranInfo.ikon} ${peranInfo.nama})`
    : 'Belum masuk.';
  $('#s-ket-harga').textContent = (typeof bolehKelolaHarga === 'function' && bolehKelolaHarga())
    ? '🛠️ Anda admin: perubahan harga di sini menjadi master harga terpusat unit saat ⬆️ Kirim ke Server.'
    : 'Harga dapat diubah untuk kebutuhan lokal; saat ⬇️ Ambil dari Server, harga akan disamakan dengan master harga terpusat unit (bila ada yang lebih baru).';

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
  const labelLama = labelPekerjaan();   // untuk melabel ulang titik yang sudah ditaging
  const ulpLama = s.lokasiUlp;
  s.penghantar = $('#s-penghantar').value;
  s.sagFactor = Math.min(1.5, Math.max(1, parseFloat($('#s-sag').value) || 1.03)); // andongan tidak mungkin < 1
  s.ppnAktif = $('#s-ppn-aktif').checked;
  s.ppnPersen = Math.min(100, Math.max(0, parseFloat($('#s-ppn').value) || 11));
  s.akurasiMin = Math.min(500, Math.max(1, parseFloat($('#s-akurasi').value) || 15));
  s.jenisPekerjaan = JENIS_PEKERJAAN[$('#s-jenis-pekerjaan').value] ? $('#s-jenis-pekerjaan').value : 'PERLUASAN_JTM';
  s.namaPekerjaan = $('#s-nama-pekerjaan').value.trim().slice(0, 80);
  s.lokasiUlp = DAFTAR_ULP.includes($('#s-lokasi-ulp').value) ? $('#s-lokasi-ulp').value : '';

  // identitas pekerjaan berubah → titik yang SUDAH ditaging di proyek ini ikut
  // dilabel ulang (hanya milik sendiri / tanpa pemilik; titik surveyor lain tidak
  // disentuh) — begitu tersimpan, sinkron otomatis membawanya ke database & dasbor
  const labelBaru = labelPekerjaan();
  if (labelBaru !== labelLama || s.lokasiUlp !== ulpLama) {
    let n = 0;
    state.poles.forEach(p => {
      if (!bolehUbahTitik(p)) return;
      if (p.pekerjaan && p.pekerjaan !== labelLama) return; // milik pekerjaan lain — jangan disentuh
      p.pekerjaan = labelBaru;
      if (s.lokasiUlp) p.ulp = s.lokasiUlp;
      p.diubah = Date.now();
      n++;
    });
    if (n) toast(`🏷 ${n} titik proyek ini diberi identitas "${labelBaru}"${s.lokasiUlp ? ' (' + s.lokasiUlp + ')' : ''} — tersinkron otomatis`);
  }
  s.petugas = $('#s-petugas').value.trim().slice(0, 40);
  s.server = $('#s-server').value.trim().slice(0, 200);
  const kodeUnitMentah = $('#s-unit').value.trim();
  s.kodeUnit = rapikanKodeUnit(kodeUnitMentah);
  if (kodeUnitMentah && s.kodeUnit !== kodeUnitMentah) {
    $('#s-unit').value = s.kodeUnit;
    toast(`Kode unit dirapikan menjadi "${s.kodeUnit}" (tanpa spasi/simbol) — samakan di semua perangkat`);
  }
  // isian sama dengan konfig (atau dikosongkan) = tetap ikut pembaruan otomatis;
  // isian beda = pilihan manual pengguna, tidak ditimpa konfig
  s.serverOtomatis = !s.server || !!(konfigTerbaru && s.server === konfigTerbaru.server);
  const overrideSebelum = JSON.stringify([s.hargaOverride, s.jasaOverride]);
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
  // harga berubah → stempel baru; admin akan menyebarkannya saat sinkronisasi (FR-15)
  if (JSON.stringify([s.hargaOverride, s.jasaOverride]) !== overrideSebelum) s.hargaDiubah = Date.now();
  simpan(); render();
  tutupModal('modal-pengaturan');
  toast('Pengaturan & harga tersimpan');
}

function resetHarga() {
  if (!confirm('Kembalikan semua harga (material & jasa) ke nilai bawaan data.js?')) return;
  state.settings.hargaOverride = {};
  state.settings.jasaOverride = {};
  state.settings.hargaDiubah = Date.now(); // reset juga tersebar sebagai paket harga terbaru
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

// gabung tanda-hapus dari server + terapkan ke titik lokal
function gabungDanTerapkanHapus(masuk) {
  const peta = new Map((state.hapus || []).map(t => [t.uid, t]));
  normalisasiHapus(masuk).forEach(t => {
    const ada = peta.get(t.uid);
    if (!ada || (t.diubah || 0) > (ada.diubah || 0)) peta.set(t.uid, t);
  });
  state.hapus = [...peta.values()];
  const sebelum = state.poles.length;
  state.poles = state.poles.filter(p => {
    const t = peta.get(p.uid);
    return !(t && t.diubah >= (p.diubah || 0)); // diedit SETELAH dihapus = hidup lagi
  });
  return sebelum - state.poles.length;
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

// ---------------- PENUGASAN SURVEY (FR-16) ----------------
// Tugas berlaku untuk seluruh perangkat (bukan per proyek) — tersimpan
// di kunci sendiri dan ikut mengalir lewat sinkronisasi server.
const KUNCI_TUGAS = 'cakra_tugas';
let daftarTugas = [];

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

function muatTugas() {
  try { daftarTugas = normalisasiTugas(JSON.parse(localStorage.getItem(KUNCI_TUGAS))); }
  catch (e) { daftarTugas = []; }
}

function simpanTugas() {
  localStorage.setItem(KUNCI_TUGAS, JSON.stringify(daftarTugas));
}

function gabungTugas(masuk) {
  const peta = new Map(daftarTugas.map(t => [t.id, t]));
  let baru = 0;
  normalisasiTugas(masuk).forEach(t => {
    const ada = peta.get(t.id);
    if (!ada) { peta.set(t.id, t); baru++; }
    else if ((t.diubah || 0) > (ada.diubah || 0)) peta.set(t.id, t);
  });
  daftarTugas = [...peta.values()];
  return baru;
}

// tugas terbuka untuk petugas ini ('untuk' kosong = semua surveyor)
function tugasSaya() {
  const nama = (state.settings.petugas || '').trim().toLowerCase();
  return daftarTugas
    .filter(t => t.status === 'baru' || t.status === 'dikerjakan')
    .filter(t => !t.untuk || (nama && t.untuk.toLowerCase() === nama));
}

function perbaruiBadgeTugas() {
  const b = $('#badge-tugas');
  if (!b) return;
  const n = tugasSaya().length;
  b.textContent = n;
  b.classList.toggle('sembunyi', !n);
}

function ubahStatusTugas(id, status) {
  const t = daftarTugas.find(x => x.id === id);
  if (!t || !STATUS_TUGAS[status]) return;
  t.status = status;
  t.diubah = Date.now();
  simpanTugas(); renderTugas(); perbaruiBadgeTugas();
  jadwalkanSinkronOtomatis(); // status tugas ikut terkirim sendiri ke database unit
  toast(`🗒️ "${t.judul}" → ${STATUS_TUGAS[status].nama}`);
}

function renderTugas() {
  const wadah = $('#isi-tugas');
  if (!daftarTugas.length) {
    wadah.innerHTML = `<p class="catatan-kecil">Belum ada penugasan. Tugas dibuat perencana/manajer lewat Dasbor,
      lalu muncul di sini setelah ⬇️ Ambil dari Server (menu ⚙️ Pengaturan).</p>`;
    return;
  }
  wadah.innerHTML = '';
  const urutan = { baru: 0, dikerjakan: 1, selesai: 2, dibatalkan: 3 };
  const namaSaya = (state.settings.petugas || '').trim().toLowerCase();
  [...daftarTugas]
    .sort((a, b) => (urutan[a.status] - urutan[b.status]) || (b.dibuat - a.dibuat))
    .forEach(t => {
      const st = STATUS_TUGAS[t.status];
      const untukSaya = !t.untuk || t.untuk.toLowerCase() === namaSaya;
      const div = document.createElement('div');
      div.className = 'item-tiang';
      div.innerHTML = `
        <div class="bulat" style="background:${st.warna}">${t.status === 'selesai' ? '✔' : t.status === 'dibatalkan' ? '✕' : '🗒'}</div>
        <div class="isi">
          <div class="nm">${t.judul} <span class="badge-skor" style="background:${st.warna}">${st.nama}</span></div>
          <div class="dt">Untuk: <b>${t.untuk || 'semua surveyor'}</b>${untukSaya && t.untuk ? ' (Anda)' : ''}
            ${t.lokasi ? ' · 📍 ' + t.lokasi : ''}${t.oleh ? ' · dari ' + t.oleh : ''}
            ${t.catatan ? '<br>' + t.catatan : ''}</div>
        </div>
        <div class="aksi">
          ${t.lat !== null && t.lng !== null ? '<button class="tombol polos kecil" data-a="peta">📍</button>' : ''}
          ${t.status === 'baru' ? '<button class="tombol utama kecil" data-a="mulai">▶ Mulai</button>' : ''}
          ${t.status === 'dikerjakan' ? '<button class="tombol utama kecil" data-a="selesai">✅ Selesai</button>' : ''}
        </div>`;
      const ke = (a, fn) => { const el = div.querySelector(`[data-a=${a}]`); if (el) el.onclick = fn; };
      ke('peta', () => { tutupModal('modal-tugas'); map.setView([t.lat, t.lng], 17); toast(`📍 Lokasi tugas: ${t.judul}`); });
      ke('mulai', () => ubahStatusTugas(t.id, 'dikerjakan'));
      ke('selesai', () => ubahStatusTugas(t.id, 'selesai'));
      wadah.appendChild(div);
    });
}

// ---------------- PEKERJAAN PERLUASAN JTM/JTR (menu ⚡) ----------------
// Daftar pekerjaan perluasan di proyek ini: tiang JTM/JTR, rute, perkiraan
// biaya, dan tahap progres (dikelola di dasbor, diterima lewat sinkronisasi).
const KUNCI_STATUS_PEKERJAAN = 'cakra_pekerjaan_status';
let statusPekerjaanUnit = (() => {
  try { return JSON.parse(localStorage.getItem(KUNCI_STATUS_PEKERJAAN)) || {}; } catch (e) { return {}; }
})();

function gabungStatusPekerjaanUnit(masuk) {
  Object.entries(masuk || {}).forEach(([k, v]) => {
    if (!v || typeof v !== 'object') return;
    const ada = statusPekerjaanUnit[k];
    if (!ada || (Number(v.diubah) || 0) > (Number(ada.diubah) || 0)) statusPekerjaanUnit[k] = v;
  });
  localStorage.setItem(KUNCI_STATUS_PEKERJAAN, JSON.stringify(statusPekerjaanUnit));
}

function renderPerluasan() {
  const wadah = $('#isi-perluasan');
  // SEMUA pekerjaan di proyek (termasuk milik petugas lain) — tiap petugas baris sendiri
  const grup = {};
  grupRencanaPerPekerjaan().forEach((daftar) => {
    const judul = daftar[0].pekerjaan || '(tanpa nama pekerjaan)';
    const kunci = judul + (daftar[0].petugas ? ` — ${daftar[0].petugas}` : '');
    grup[kunci] = daftar;
  });
  const semuaNama = Object.keys(grup);
  if (!semuaNama.length) {
    wadah.innerHTML = `<p class="catatan-kecil">Belum ada titik rencana di proyek ini. Isi
      <b>Jenis & Nama Pekerjaan</b> di ⚙️ Pengaturan lalu mulai taging — pekerjaannya tampil di sini.</p>`;
    return;
  }
  wadah.innerHTML = '';
  semuaNama.forEach(nama => {
    const daftar = grup[nama];
    const jtr = daftar.filter(p => konstruksiTR(p.konstruksi)).length;
    const jtm = daftar.length - jtr;
    const petugasG = [...new Set(daftar.map(p => p.petugas).filter(Boolean))].join(', ') || '—';
    const ulpG = [...new Set(daftar.map(p => p.ulp).filter(Boolean))].join(', ') || '—';
    let rute = 0;
    for (let i = 1; i < daftar.length; i++) {
      const d = haversine(daftar[i - 1], daftar[i]);
      if (d <= 2000) rute += d;
    }
    let biaya = 0;
    daftar.forEach(p => { biaya += biayaPerTiang(p).total; });
    // tahap tersimpan per NAMA PEKERJAAN (tanpa embel-embel petugas)
    const stKey = (statusPekerjaanUnit[daftar[0].pekerjaan || '(tanpa nama pekerjaan)'] || {}).status;
    const st = STATUS_PEKERJAAN[stKey] || STATUS_PEKERJAAN.survey;
    // titik sambung ke jaringan eksisting (manual via mode Koreksi menang; else otomatis)
    const suplai = suplaiUntuk(daftar);
    const infoSambung = suplai
      ? `🔌 Sambung dari <b>${suplai.dari.nama}</b> · ${angka(suplai.jarak, 0)} m (${suplai.manual ? 'ditentukan manual' : 'otomatis terdekat'})`
      : '🔌 Belum ada titik sambung ke jaringan eksisting';
    const bolehEdit = typeof bolehKelolaUsulan === 'function' && bolehKelolaUsulan();
    const div = document.createElement('div');
    div.className = 'item-tiang';
    div.innerHTML = `
      <div class="bulat" style="background:${st.warna}">${st.persen}%</div>
      <div class="isi">
        <div class="nm">${nama} <span class="badge-skor" style="background:${st.warna}">${st.nama}</span></div>
        <div class="dt">🗼 ${daftar.length} tiang (JTM ${jtm} · JTR ${jtr}) ·
          ${rute >= 1000 ? angka(rute / 1000, 2) + ' km' : angka(rute, 0) + ' m'} ·
          ± ${rupiah(biaya)} <small>(belum termasuk penghantar)</small><br>
          👤 ${petugasG} · 🏢 ${ulpG}<br>${infoSambung}</div>
      </div>
      <div class="aksi">
        ${bolehEdit ? '<button class="tombol polos kecil" data-a="edit" title="Edit jenis/nama/ULP pekerjaan">✏️</button>' : ''}
        <button class="tombol polos kecil" data-a="sambung" title="Tentukan titik sambung ke jaringan eksisting">🔌</button>
        <button class="tombol utama kecil" data-a="peta">📍</button>
      </div>`;
    div.querySelector('[data-a=peta]').onclick = () => {
      tutupModal('modal-perluasan');
      map.fitBounds(daftar.map(p => [p.lat, p.lng]), { padding: [60, 60] });
      toast(`📍 Lokasi pekerjaan: ${nama}`);
    };
    const btnEdit = div.querySelector('[data-a=edit]');
    if (btnEdit) btnEdit.onclick = () => bukaEditPekerjaan(daftar);
    div.querySelector('[data-a=sambung]').onclick = () => {
      tutupModal('modal-perluasan');
      map.fitBounds(daftar.map(p => [p.lat, p.lng]), { padding: [80, 80] });
      if (!modeKoreksi) toggleModeKoreksi();
      toast('🔌 Ketuk salah satu tiang pekerjaan ini, lalu ketuk tiang JARINGAN EKSISTING (hijau) — itulah titik sambungnya. RAB & gambar mengikuti.');
    };
    wadah.appendChild(div);
  });
}

// ---------------- EDIT IDENTITAS PEKERJAAN (admin & manajemen) ----------------
let editPekerjaanUids = [];

function bukaEditPekerjaan(daftar) {
  editPekerjaanUids = daftar.map(p => p.uid);
  const contoh = daftar[0];
  const label = contoh.pekerjaan || '';
  // pisahkan label menjadi jenis + nama
  let jenisK = 'PERLUASAN_JTM', namaP = label;
  for (const [k, n] of Object.entries(JENIS_PEKERJAAN)) {
    if (label === n) { jenisK = k; namaP = ''; break; }
    if (label.startsWith(n + ' — ')) { jenisK = k; namaP = label.slice(n.length + 3); break; }
  }
  $('#ep-jenis').innerHTML = Object.entries(JENIS_PEKERJAAN)
    .map(([k, n]) => `<option value="${k}" ${k === jenisK ? 'selected' : ''}>${n}</option>`).join('');
  $('#ep-nama').value = namaP;
  $('#ep-ulp').innerHTML = '<option value="">— tidak diubah —</option>' + DAFTAR_ULP
    .map(u => `<option ${u === (contoh.ulp || '') ? 'selected' : ''}>${u}</option>`).join('');
  $('#ep-info').textContent = `${daftar.length} titik (petugas: ${contoh.petugas || '—'}) akan diperbarui dan tersinkron ke semua perangkat.`;
  bukaModal('modal-edit-pekerjaan');
}

function simpanEditPekerjaan() {
  const jenisK = $('#ep-jenis').value;
  const namaP = $('#ep-nama').value.trim().slice(0, 80);
  const ulp = $('#ep-ulp').value;
  const labelBaru = (`${JENIS_PEKERJAAN[jenisK] || ''}${namaP ? ' — ' + namaP : ''}`).trim().slice(0, 100);
  const set = new Set(editPekerjaanUids);
  let n = 0, labelLama = '';
  state.poles.forEach(p => {
    if (!set.has(p.uid) || !bolehUbahTitik(p)) return;
    labelLama = labelLama || p.pekerjaan || '';
    p.pekerjaan = labelBaru;
    if (ulp) p.ulp = ulp;
    p.diubah = Date.now();
    n++;
  });
  // tahap yang sudah berjalan ikut ke nama baru (tampilan lokal)
  if (labelLama && statusPekerjaanUnit[labelLama] && !statusPekerjaanUnit[labelBaru]) {
    statusPekerjaanUnit[labelBaru] = { ...statusPekerjaanUnit[labelLama] };
    localStorage.setItem(KUNCI_STATUS_PEKERJAAN, JSON.stringify(statusPekerjaanUnit));
  }
  simpan(); render(); renderPerluasan();
  tutupModal('modal-edit-pekerjaan');
  toast(n ? `✏️ ${n} titik diperbarui menjadi "${labelBaru}"${ulp ? ' (' + ulp + ')' : ''} — tersinkron otomatis`
          : 'Tidak ada titik yang boleh Anda ubah di pekerjaan ini');
}

// ---------------- MASTER HARGA TERPUSAT (FR-15) ----------------
// Server menyimpan satu paket harga override per unit. Perangkat menerapkan
// paket itu bila stempelnya lebih baru dari milik sendiri; admin yang
// mengubah harga akan mengirim paket baru saat sinkronisasi.
function terapkanHargaTerpusat(h) {
  if (!h || typeof h !== 'object') return false;
  const stempel = Number(h.diubah) || 0;
  if (!stempel || stempel <= (state.settings.hargaDiubah || 0)) return false;
  const saring = (obj) => {
    const bersih = {};
    Object.entries(obj || {}).forEach(([kode, v]) => {
      if (MATERIALS[kode] && isFinite(Number(v)) && Number(v) >= 0) bersih[kode] = Number(v);
    });
    return bersih;
  };
  state.settings.hargaOverride = saring(h.hargaOverride);
  state.settings.jasaOverride = saring(h.jasaOverride);
  state.settings.hargaDiubah = stempel;
  return true;
}

function paketHargaKirim() {
  // hanya admin yang menyebarkan harga; tanpa stempel = belum pernah diubah
  if (typeof bolehKelolaHarga !== 'function' || !bolehKelolaHarga()) return undefined;
  if (!state.settings.hargaDiubah) return undefined;
  return {
    hargaOverride: state.settings.hargaOverride,
    jasaOverride: state.settings.jasaOverride,
    diubah: state.settings.hargaDiubah,
    oleh: state.settings.petugas || '',
  };
}

function urlServer() {
  return (state.settings.server || '').trim().replace(/\/+$/, '');
}

async function kirimKeServer(senyap) {
  const url = urlServer();
  if (!url || !state.settings.kodeUnit) { if (!senyap) toast('Isi alamat server & kode unit dulu'); return; }
  if (campuranTerblokir()) { if (!senyap) toast(pesanCampuran()); return; }
  if (!senyap) toast('⬆️ Mengirim data ke server…');
  try {
    const res = await fetch(url + '/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kode-Unit': state.settings.kodeUnit },
      body: JSON.stringify({
        poles: state.poles, koreksi: state.koreksi, hapus: state.hapus,
        tugas: daftarTugas, harga: paketHargaKirim(),
      }),
    });
    if (!res.ok) throw new Error('server menolak (HTTP ' + res.status + ')');
    const d = await res.json();
    sinkronTertunda = false; // semua perubahan sudah diterima server
    catatSinkron();
    if (!senyap) toast(`✅ Terkirim — server kini menyimpan ${d.total} titik unit ini`
      + (d.hargaBerubah ? ' · harga terpusat diperbarui' : ''));
  } catch (e) {
    // sinkron otomatis diam saat offline/gagal — data aman di perangkat, dicoba lagi nanti
    if (!senyap) toast('Gagal kirim: ' + (e.message || 'server tidak terjangkau'));
  }
}

async function ambilDariServer(senyap) {
  const url = urlServer();
  if (!url || !state.settings.kodeUnit) { if (!senyap) toast('Isi alamat server & kode unit dulu'); return; }
  if (campuranTerblokir()) { if (!senyap) toast(pesanCampuran()); return; }
  if (!senyap) toast('⬇️ Mengambil data dari server…');
  try {
    const res = await fetch(url + '/api/data', {
      headers: { 'X-Kode-Unit': state.settings.kodeUnit },
    });
    if (!res.ok) throw new Error('server menolak (HTTP ' + res.status + ')');
    const d = await res.json();
    const hasil = gabungPoles(d.poles);
    gabungDanTerapkanHapus(d.hapus); // titik yang dihapus perangkat lain ikut hilang di sini
    gabungKoreksi(d.koreksi);
    const tugasBaru = gabungTugas(d.tugas);
    simpanTugas(); perbaruiBadgeTugas();
    gabungStatusPekerjaanUnit(d.pekerjaanStatus); // tahap pekerjaan dari dasbor
    const hargaBaru = terapkanHargaTerpusat(d.harga);
    simpan(); render();
    if (!senyap && state.poles.length) map.fitBounds(state.poles.map(p => [p.lat, p.lng]), { padding: [40, 40] });
    const adaPerubahan = hasil.baru || hasil.diperbarui || tugasBaru || hargaBaru;
    if (!senyap || adaPerubahan) {
      toast(`${senyap ? '🔄' : '✅'} Tergabung: ${hasil.baru} titik baru, ${hasil.diperbarui} diperbarui (total ${hasil.total})`
        + (tugasBaru ? ` · ${tugasBaru} tugas baru` : '')
        + (hargaBaru ? ' · 💰 harga terpusat unit diterapkan' : ''));
    }
  } catch (e) {
    if (!senyap) toast('Gagal ambil: ' + (e.message || 'server tidak terjangkau'));
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

  baris('Si CAKRA - RAB SURVEY JARINGAN TM');
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
  baris(MATERIALS.JASA_TIANG.nama, polesRencana().length, 'tiang', hargaEfektif('JASA_TIANG'), Math.round(rab.jasaTiang));
  baris(MATERIALS.JASA_TARIK.nama, (rab.rutePenghantar / 1000).toFixed(2), 'km', hargaEfektif('JASA_TARIK'), Math.round(rab.jasaTarik));
  baris('');
  baris('Subtotal', '', '', '', Math.round(rab.subtotal));
  baris(`PPN ${s.ppnAktif ? s.ppnPersen + '%' : '0%'}`, '', '', '', Math.round(rab.ppn));
  baris('GRAND TOTAL', '', '', '', Math.round(rab.grandTotal));
  baris('');
  baris('RINCIAN PER TIANG (RENCANA)');
  baris('Nama', 'Konstruksi', 'Jenis Tiang', 'Latitude', 'Longitude', 'Gawang dari tiang induk (m)', 'Kumulatif (m)', 'Aksesoris', 'Catatan', 'Biaya Titik');
  const rencanaCSV = polesRencana();
  let kumulatif = 0;
  rencanaCSV.forEach((p, i) => {
    // induk = titik terdekat yang ditaging lebih dulu (mendukung percabangan)
    let d = 0;
    for (let j = 0; j < i; j++) {
      const dd = haversine(rencanaCSV[j], p);
      if (j === 0 || dd < d) d = dd;
    }
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
  // rute per PEKERJAAN+PETUGAS berbentuk pohon (mendukung percabangan) —
  // tiap sisi jadi garis sendiri dalam satu MultiGeometry
  grupRencanaPerPekerjaan().forEach((daftar) => {
    const sisi = sisiRantai(daftar);
    if (!sisi.length) return;
    const namaRute = `${daftar[0].pekerjaan || 'Rencana Jaringan'}${daftar[0].petugas ? ' — ' + daftar[0].petugas : ''}`;
    plek += `
    <Placemark><name>Rute ${esc(namaRute)}</name><MultiGeometry>${sisi.map(s =>
      `<LineString><coordinates>${s.a.lng},${s.a.lat},0 ${s.b.lng},${s.b.lat},0</coordinates></LineString>`).join('')}</MultiGeometry></Placemark>`;
  });
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Si CAKRA — Survey Aset Distribusi</name>${plek}
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

// ---------------- IMPOR KML / CSV (FR-10) ----------------
// Titik aset yang sudah ada (hasil survey lama / GPS lain / Excel)
// masuk sebagai aset eksisting atau lanjutan titik rencana.
const BATAS_IMPOR = 5000;

function titikDariKML(teks) {
  const dok = new DOMParser().parseFromString(teks, 'text/xml');
  if (dok.querySelector('parsererror')) throw new Error('bukan file KML yang valid');
  const hasil = [];
  dok.querySelectorAll('Placemark').forEach(pm => {
    const koor = pm.querySelector('Point > coordinates');
    if (!koor) return; // garis / poligon dilewati — hanya titik yang diimpor
    const [lng, lat] = koor.textContent.trim().split(/[,\s]+/).map(Number);
    if (!isFinite(lat) || !isFinite(lng)) return;
    const ambil = (tag) => { const el = pm.querySelector(tag); return el ? el.textContent.trim() : ''; };
    hasil.push({ nama: ambil('name').slice(0, 40), catatan: ambil('description').replace(/<[^>]*>/g, ' ').trim().slice(0, 300), lat, lng });
  });
  return hasil;
}

function titikDariCSV(teks) {
  const barisSemua = teks.split(/\r?\n/).map(b => b.trim()).filter(Boolean);
  if (!barisSemua.length) return [];
  // pemisah = yang menghasilkan kolom terbanyak di baris pertama
  const pemisah = [';', ',', '\t'].reduce((a, b) =>
    (barisSemua[0].split(b).length > barisSemua[0].split(a).length ? b : a));
  const potong = (b) => b.split(pemisah).map(k => k.trim().replace(/^"(.*)"$/, '$1'));

  const kepala = potong(barisSemua[0]).map(k => k.toLowerCase());
  const cariKolom = (kandidat) => kepala.findIndex(k => kandidat.some(c => k === c || k.startsWith(c)));
  let iLat = cariKolom(['lat', 'latitude', 'lintang']);
  let iLng = cariKolom(['lng', 'lon', 'long', 'bujur']);
  let iNama = cariKolom(['nama', 'name', 'kode', 'label', 'titik', 'id']);
  let iKet = cariKolom(['catatan', 'ket', 'desc', 'uraian']);
  let mulai = 1;

  if (iLat < 0 || iLng < 0) {
    // tanpa baris kepala → deteksi dari isi: kolom angka |v|≤90 = lat, angka lain |v|≤180 = lng
    const contoh = potong(barisSemua[0]);
    const keAngka = (t) => parseFloat(String(t).replace(',', '.'));
    iLat = contoh.findIndex(k => { const v = keAngka(k); return isFinite(v) && Math.abs(v) <= 90 && /[.,]/.test(k); });
    iLng = contoh.findIndex((k, i) => { const v = keAngka(k); return i !== iLat && isFinite(v) && Math.abs(v) <= 180 && /[.,]/.test(k); });
    iNama = contoh.findIndex(k => !isFinite(keAngka(k)));
    iKet = -1;
    mulai = 0;
    if (iLat < 0 || iLng < 0) throw new Error('kolom koordinat tidak ditemukan — beri kepala kolom "lat" & "lng"');
  }

  const hasil = [];
  for (let i = mulai; i < barisSemua.length; i++) {
    const kolom = potong(barisSemua[i]);
    const lat = parseFloat(String(kolom[iLat] || '').replace(',', '.'));
    const lng = parseFloat(String(kolom[iLng] || '').replace(',', '.'));
    if (!isFinite(lat) || !isFinite(lng)) continue;
    hasil.push({
      nama: (iNama >= 0 ? kolom[iNama] || '' : '').slice(0, 40),
      catatan: (iKet >= 0 ? kolom[iKet] || '' : '').slice(0, 300),
      lat, lng,
    });
  }
  return hasil;
}

function imporTitikAset(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const teks = String(r.result || '');
      const kml = /\.kml$/i.test(file.name) || teks.trimStart().startsWith('<');
      let titik = kml ? titikDariKML(teks) : titikDariCSV(teks);
      if (!titik.length) throw new Error('tidak ada titik koordinat yang bisa dibaca');
      const dipangkas = titik.length > BATAS_IMPOR;
      titik = titik.slice(0, BATAS_IMPOR);

      const modeImpor = $('#e-impor-mode').value === 'rencana' ? 'rencana' : 'eksisting';
      const uidAda = new Set(state.poles.map(p => p.uid));   // titik tersimpan → impor ulang dilewati
      const uidSesi = new Set();                              // tikor kembar DI DALAM file ini → diberi nomor
      let masuk = 0, lewat = 0;
      titik.forEach(t => {
        // uid deterministik dari tikor → impor ulang file yang sama tidak menggandakan titik
        let uid = `imp-${t.lat.toFixed(5)}_${t.lng.toFixed(5)}`;
        let n = 1;
        while (uidSesi.has(uid) && n < 50) uid = `imp-${t.lat.toFixed(5)}_${t.lng.toFixed(5)}-${n++}`;
        uidSesi.add(uid);
        if (uidAda.has(uid)) { lewat++; return; }
        const p = normalisasiPole({
          id: idBerikut,
          nama: t.nama || namaBerikut(modeImpor === 'eksisting' ? 'A' : 'T'),
          lat: t.lat, lng: t.lng,
          mode: modeImpor,
          jenisAset: 'TIANG_TM',
          kondisi: 'baik',
          catatan: t.catatan,
          uid,
        }, state.poles.length);
        if (!p) { lewat++; return; }
        p.id = idBerikut++;
        p.uid = uid;
        p.petugas = state.settings.petugas || '';
        p.diubah = Date.now();
        state.poles.push(p);
        uidAda.add(uid);
        masuk++;
      });
      simpan(); render();
      if (masuk) {
        const barusan = state.poles.slice(-masuk);
        map.fitBounds(barusan.map(p => [p.lat, p.lng]), { padding: [40, 40] });
      }
      tutupModal('modal-ekspor');
      toast(`📥 ${masuk} titik diimpor sebagai ${modeImpor === 'eksisting' ? 'aset eksisting' : 'titik rencana'}`
        + (lewat ? ` — ${lewat} dilewati (duplikat/rusak)` : '')
        + (dipangkas ? ` — dibatasi ${BATAS_IMPOR} titik pertama` : ''));
    } catch (e) {
      toast('Impor gagal: ' + e.message);
    }
  };
  r.readAsText(file);
}

function hapusSemua() {
  const milik = state.poles.filter(p => bolehUbahTitik(p));
  if (!confirm(`Kosongkan proyek ini?\n${milik.length} titik yang Anda berhak hapus akan DIHAPUS PERMANEN dari database unit `
    + `(hilang di semua perangkat). Titik milik petugas lain tidak disentuh.`)) return;
  milik.forEach(p => tandaiHapus(p.uid));
  state.poles = state.poles.filter(p => !bolehUbahTitik(p));
  state.koreksi = [];
  idBerikut = Math.max(0, ...state.poles.map(p => p.id)) + 1;
  simpan(); render();
  tutupModal('modal-ekspor');
  toast(`${milik.length} titik dihapus dari database unit`);
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

// ---------------- UNDUH SEMUA PEKERJAAN (EXCEL — khusus admin) ----------------
// Mengambil SELURUH database unit dari server (semua petugas, semua pekerjaan)
// lalu mengunduhnya sebagai CSV ber-BOM yang terbuka rapi di Excel:
// A) rekap per pekerjaan, B) rincian semua titik.
async function unduhSemuaPekerjaan() {
  if (!(typeof bolehKelolaHarga === 'function' && bolehKelolaHarga())) { toast('Fitur khusus admin'); return; }
  toast('⬇️ Mengambil seluruh database unit…');
  let semuaPoles = state.poles, statusPkj = statusPekerjaanUnit;
  try {
    const res = await fetch(urlServer() + '/api/data', { headers: { 'X-Kode-Unit': state.settings.kodeUnit } });
    if (res.ok) {
      const d = await res.json();
      if (Array.isArray(d.poles) && d.poles.length) semuaPoles = d.poles;
      if (d.pekerjaanStatus) statusPkj = d.pekerjaanStatus;
    }
  } catch (e) { toast('Server tidak terjangkau — memakai data di perangkat ini'); }

  const B = [];
  const baris = (...k) => B.push(k.map(v => String(v ?? '').replace(/;/g, ',').replace(/\n/g, ' ')).join(';'));
  const tgl = (ts) => (ts ? new Date(ts).toLocaleString('id-ID') : '');
  const trKah = (p) => (KONSTRUKSI[p.konstruksi] || {}).grup === 'JTR';

  baris('Si CAKRA - SEMUA PEKERJAAN UNIT');
  baris('Diunduh', new Date().toLocaleString('id-ID'), 'oleh', state.settings.petugas || '');
  baris('');
  baris('A. REKAP PER PEKERJAAN');
  baris('Nama Pekerjaan', 'ULP', 'Petugas', 'Tahap', 'Tiang Rencana', 'JTM', 'JTR', 'Rute (m)',
    'Biaya Konstruksi (Rp)', 'Usulan Perbaikan', 'Usulan Selesai', 'Nilai Usulan (Rp)',
    'Calon Pelanggan', 'Terakhir Disimpan');
  const grup = {};
  semuaPoles.forEach(p => {
    const k = p.pekerjaan || '(tanpa nama pekerjaan)';
    (grup[k] = grup[k] || []).push(p);
  });
  Object.entries(grup).forEach(([nama, daftar]) => {
    const rencana = daftar.filter(p => !p.mode || p.mode === 'rencana');
    // rute dihitung per petugas — dua petugas tidak pernah dianggap satu rantai
    let rute = 0;
    const perPetugas = {};
    rencana.forEach(p => { const k = p.petugas || ''; (perPetugas[k] = perPetugas[k] || []).push(p); });
    Object.values(perPetugas).forEach(sub => {
      for (let i = 1; i < sub.length; i++) {
        const d = haversine(sub[i - 1], sub[i]);
        if (d <= 2000) rute += d;
      }
    });
    let biaya = 0;
    rencana.forEach(p => { try { biaya += biayaPerTiang(p).total; } catch (e) { /* konstruksi tak dikenal */ } });
    let usulan = 0, selesai = 0, nilai = 0;
    daftar.forEach(p => (p.usulan || []).forEach(u => {
      usulan++; if (u.status === 'selesai') selesai++; nilai += biayaPaket(u.paket).total;
    }));
    const st = STATUS_PEKERJAAN[(statusPkj[nama] || {}).status] || STATUS_PEKERJAAN.survey;
    baris(nama,
      [...new Set(daftar.map(p => p.ulp).filter(Boolean))].join(', '),
      [...new Set(daftar.map(p => p.petugas).filter(Boolean))].join(', '),
      `${st.nama} (${st.persen}%)`,
      rencana.length, rencana.filter(p => !trKah(p)).length, rencana.filter(trKah).length,
      Math.round(rute), Math.round(biaya), usulan, selesai, Math.round(nilai),
      daftar.filter(p => p.mode === 'pelanggan').length,
      tgl(Math.max(0, ...daftar.map(p => p.diubah || 0))));
  });
  baris('');
  baris('B. RINCIAN SEMUA TITIK');
  baris('Nama Titik', 'Pekerjaan', 'Petugas', 'ULP', 'Mode', 'Jenis / Konstruksi', 'Kondisi',
    'Latitude', 'Longitude', 'Usulan (status)', 'Catatan', 'Disimpan');
  semuaPoles.forEach(p => {
    const jenis = p.mode === 'eksisting'
      ? ((JENIS_ASET[p.jenisAset] || {}).nama || p.jenisAset || '')
      : p.mode === 'pelanggan' ? `Calon pelanggan: ${p.namaPelanggan || ''}` : (p.konstruksi || '');
    const us = (p.usulan || []).map(u =>
      `${(PAKET_PERBAIKAN[u.paket] || {}).nama || u.paket} [${(STATUS_USULAN[u.status] || {}).nama || u.status}]`).join(' + ');
    baris(p.nama || '', p.pekerjaan || '', p.petugas || '', p.ulp || '', p.mode || 'rencana', jenis,
      p.mode === 'eksisting' ? ((KONDISI[p.kondisi] || {}).nama || '') : '',
      p.lat, p.lng, us, p.catatan || '', tgl(p.diubah));
  });

  unduh('SiCAKRA-Semua-Pekerjaan.csv', '﻿' + B.join('\n'), 'text/csv;charset=utf-8');
  toast(`📊 ${semuaPoles.length} titik dari ${Object.keys(grup).length} pekerjaan diunduh — buka di Excel`);
}

// ---------------- LEMBAR GAMBAR RENCANA (CETAK / PDF) ----------------
// Gambar rencana bergaya template unit: citra satelit + jaringan berwarna
// (eksisting hitam, rencana baru biru, rehab hijau), lencana konstruksi per
// tiang (kode + fasa|tinggi), jarak gawang, dan kop keterangan di sisi kanan.
// Dicetak lewat dialog browser → "Save as PDF", A4 lanskap, margin none.
const WARNA_LEMBAR = { eksisting: '#111111', rencana: '#1e88e5', rehab: '#2e7d32' };
let petaLembar = null, layerLembar = null;

function tinggiTiang(kode) {
  const m = /(\d+)\s*m/.exec((MATERIALS[kode] || {}).nama || '');
  return m ? m[1] : '12';
}

function konstruksiTR(kode) { return (KONSTRUKSI[kode] || {}).grup === 'JTR'; }

// skala lembar cetak agar muat layar HP: lembar tetap 1122px (ukuran A4),
// di layar sempit diperkecil dengan properti zoom — hasil cetak tidak berubah
// (dipulihkan ke 1 lewat CSS @media print)
function pasSkalaLembar() {
  const skala = Math.min(1, (window.innerWidth - 16) / 1122);
  ['#lembar', '#rab-lembar'].forEach(sel => {
    const el = $(sel);
    if (el) el.style.zoom = skala < 1 ? String(skala) : '';
  });
  return skala;
}

// ---- skala CETAK: seluruh isi lembar (sampai tanda tangan) muat SATU halaman A4 ----
// A4 lanskap pada 96 dpi ≈ 1122×794 px; disisakan sedikit agar tepi tidak terpotong.
const CETAK_LEBAR = 1118, CETAK_TINGGI = 786;

function lembarAktif() {
  if (!$('#rab-wrap').classList.contains('sembunyi')) return $('#rab-lembar');
  if (!$('#lembar-wrap').classList.contains('sembunyi')) return $('#lembar');
  return null;
}

function siapkanCetak() {
  const el = lembarAktif();
  if (!el) return;
  el.style.zoom = '1'; // ukur tinggi asli tanpa skala layar HP
  const s = Math.min(1, CETAK_LEBAR / el.offsetWidth, CETAK_TINGGI / el.scrollHeight);
  el.style.zoom = String(s);
}

function pulihkanCetak() {
  pasSkalaLembar(); // kembali ke skala layar (HP mengecil, desktop 1:1)
  if (petaLembar && !$('#lembar-wrap').classList.contains('sembunyi')) petaLembar.invalidateSize();
}

// arah layar (x ke kanan, y ke bawah) dari titik a menuju b — untuk menaruh
// lencana/label tegak lurus rute agar tidak menutupi titik taging
function arahLayar(a, b) {
  const dx = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const dy = -(b.lat - a.lat);
  const n = Math.hypot(dx, dy) || 1;
  return { x: dx / n, y: dy / n };
}

// simbol trafo seperti template gambar unit: kotak trafo (pentagon) di atas tiang
function svgTrafo(jenis, warna) {
  if (jenis === 'TRAFO_PORTAL') {
    return `<svg width="26" height="26" viewBox="0 0 26 26">
      <path d="M3 13 h20 v-7 L13 1 L3 6 Z" fill="${warna}" stroke="#fff" stroke-width="1.2"/>
      <rect x="6" y="13" width="2.4" height="11" fill="${warna}" stroke="#fff" stroke-width=".8"/>
      <rect x="17.6" y="13" width="2.4" height="11" fill="${warna}" stroke="#fff" stroke-width=".8"/></svg>`;
  }
  return `<svg width="16" height="26" viewBox="0 0 16 26">
    <path d="M2 12 h12 v-6 L8 1 L2 6 Z" fill="${warna}" stroke="#fff" stroke-width="1.2"/>
    <rect x="6.8" y="12" width="2.4" height="12" fill="${warna}" stroke="#fff" stroke-width=".8"/></svg>`;
}

function gambarLembar() {
  layerLembar.clearLayers();
  const s = state.settings;

  // garis jaringan eksisting (aset bawaan + survey + koreksi) di sekitar proyek saja
  const batas = L.latLngBounds(state.poles.map(p => [p.lat, p.lng])).pad(0.6);
  const jaringan = sambunganFinal();
  const segmenEks = [];
  jaringan.edges.forEach(([a, b]) => {
    const p = jaringan.posisi.get(a), q = jaringan.posisi.get(b);
    if (batas.contains([p.lat, p.lng]) || batas.contains([q.lat, q.lng])) {
      segmenEks.push([[p.lat, p.lng], [q.lat, q.lng]]);
    }
  });
  if (segmenEks.length) {
    L.polyline(segmenEks, { color: WARNA_LEMBAR.eksisting, weight: 3.5, smoothFactor: 2 }).addTo(layerLembar);
  }

  // rute rencana per gawang: SUTR (konstruksi JTR) putus-putus, SUTM utuh + label jarak
  const rencana = polesRencana();
  let adaSUTR = false, adaSUTM = segmenEks.length > 0; // jaringan eksisting = SUTM
  // sisi pohon rute — percabangan tergambar benar (titik ke titik terdekat sebelumnya)
  sisiRantai(rencana).forEach(({ a, b, d }) => {
    const segTR = konstruksiTR(a.konstruksi) || konstruksiTR(b.konstruksi);
    if (segTR) adaSUTR = true; else adaSUTM = true;
    L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
      color: WARNA_LEMBAR.rencana, weight: 4,
      dashArray: segTR ? '8 8' : null,
    }).addTo(layerLembar);
    // label jarak digeser tegak lurus ke KIRI arah rute — menjauh dari lencana (sisi kanan)
    const dirJ = arahLayar(a, b);
    L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], {
      icon: L.divIcon({
        className: 'lg-jarak', html: `${angka(d, 0)}`, iconSize: null,
        iconAnchor: [13 - dirJ.y * 20, 8 + dirJ.x * 20],
      }),
      interactive: false,
    }).addTo(layerLembar);
  });

  // sambungan suplai dari jaringan eksisting
  const suplai = suplaiTerdekat();
  if (suplai) {
    L.polyline([[suplai.dari.lat, suplai.dari.lng], [suplai.ke.lat, suplai.ke.lng]],
      { color: WARNA_LEMBAR.rencana, weight: 3.5, dashArray: '4 8' }).addTo(layerLembar);
    L.marker([(suplai.dari.lat + suplai.ke.lat) / 2, (suplai.dari.lng + suplai.ke.lng) / 2], {
      icon: L.divIcon({ className: 'lg-jarak', html: `${angka(suplai.jarak, 0)}`, iconSize: null }),
      interactive: false,
    }).addTo(layerLembar);
  }

  // titik-titik: rencana biru + lencana konstruksi; eksisting hitam (hijau bila ada usulan/rehab)
  // nomor lencana = urutan per jenis konstruksi (TM-1 pertama = 1, kedua = 2, dst. —
  // tiap jenis dihitung terpisah), sesuai input saat taging
  const urutanKonstruksi = new Map();
  const indeksRencana = new Map(); // uid -> posisi di rute (untuk arah & sisi lencana)
  const hitungJenis = {};
  rencana.forEach((p, i) => {
    hitungJenis[p.konstruksi] = (hitungJenis[p.konstruksi] || 0) + 1;
    urutanKonstruksi.set(p.uid, hitungJenis[p.konstruksi]);
    indeksRencana.set(p.uid, i);
  });
  state.poles.forEach(p => {
    if (p.mode === 'pelanggan') return; // calon pelanggan tidak masuk gambar rencana
    const eksisting = p.mode === 'eksisting';
    const rehab = eksisting && (p.usulan || []).length > 0;
    const warna = eksisting ? (rehab ? WARNA_LEMBAR.rehab : WARNA_LEMBAR.eksisting) : WARNA_LEMBAR.rencana;
    const trafo = p.jenisAset === 'TRAFO_CANTOL' || p.jenisAset === 'TRAFO_PORTAL';
    if (eksisting && trafo) {
      // simbol trafo cantol/portal seperti legenda template
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: '', html: svgTrafo(p.jenisAset, warna), iconSize: [26, 26], iconAnchor: [13, 24] }),
        interactive: false,
      }).addTo(layerLembar);
    } else {
      L.circleMarker([p.lat, p.lng], { radius: 6.5, weight: 1.5, color: '#fff', fillColor: warna, fillOpacity: 1 })
        .addTo(layerLembar);
    }
    if (eksisting) {
      // nomor/nama tiang eksisting di atas titiknya
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: 'lg-nama', html: p.nama.replace(/^A-/, ''), iconAnchor: [-8, 22] }),
        interactive: false,
      }).addTo(layerLembar);
    } else {
      // hanya titik rencana PEKERJAAN AKTIF yang masuk gambar — pekerjaan lain
      // (hasil sinkronisasi unit) tidak diikutkan agar gambar tidak tercampur
      if (!indeksRencana.has(p.uid)) return;
      // lencana konstruksi: kode di atas, "urutan jenis | tinggi tiang" di bawah.
      // Dipasang MENYAMPING tegak lurus arah rute, berselang-seling kiri/kanan —
      // titik taging, garis, dan label jarak tetap terlihat walau tiang berdekatan.
      const i = indeksRencana.get(p.uid) || 0;
      const sebelum = rencana[i - 1], sesudah = rencana[i + 1];
      const dir = sesudah ? arahLayar(p, sesudah) : (sebelum ? arahLayar(sebelum, p) : { x: 0, y: -1 });
      const sisi = i % 2 ? -1 : 1; // ganjil kiri, genap kanan
      const J = 56;                 // jarak lencana dari titik (px)
      const ox = -dir.y * J * sisi, oy = dir.x * J * sisi;
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="lg-badge"><div class="k">${p.konstruksi.replace('-', '')}</div>
                 <div class="b">${urutanKonstruksi.get(p.uid) || 1} | ${tinggiTiang(p.tiang)}</div></div>`,
          iconSize: [44, 44], iconAnchor: [22 - ox, 22 - oy],
        }),
        interactive: false,
      }).addTo(layerLembar);
    }
  });

  // legenda dinamis: baris keterangan tampil hanya bila datanya ada di gambar
  const eks = state.poles.filter(p => p.mode === 'eksisting');
  const tampilLegenda = {
    rehab: eks.some(p => (p.usulan || []).length),
    rencana: rencana.length > 0,
    eksisting: segmenEks.length > 0 || eks.some(p => !(p.usulan || []).length),
    sutr: adaSUTR,
    sutm: adaSUTM,
    cantol: eks.some(p => p.jenisAset === 'TRAFO_CANTOL'),
    portal: eks.some(p => p.jenisAset === 'TRAFO_PORTAL'),
  };
  document.querySelectorAll('#lembar [data-lg]').forEach(el => {
    el.style.display = tampilLegenda[el.dataset.lg] ? '' : 'none';
  });
}

function bukaLembarGambar() {
  const titikGambar = state.poles.filter(p => p.mode !== 'pelanggan');
  if (!titikGambar.length) { toast('Belum ada titik survey untuk digambar'); return; }
  const s = state.settings;
  const sesi = (typeof sesiCakra === 'function' && sesiCakra()) || {};

  // pra-isi hanya bila kosong — isian pengguna dipertahankan selama halaman terbuka
  const isi = (sel, nilai) => { const el = $(sel); if (!el.value) el.value = nilai || ''; };
  isi('#lg-judul', (JENIS_PEKERJAAN[s.jenisPekerjaan] || 'Gambar Rencana').toUpperCase());
  isi('#lg-lokasi', s.namaPekerjaan);
  isi('#lg-digambar', s.petugas || sesi.petugas);
  isi('#lg-nomor', '1');
  // baris ULP dari sesi — disembunyikan bila sama dengan baris UP3 di atasnya (hindari dobel)
  const ulpSesi = (sesi.ulp || '').toUpperCase();
  $('#lg-ulp').textContent = ulpSesi;
  $('#lg-ulp').style.display = (!ulpSesi || ulpSesi === 'UP3 MASOHI') ? 'none' : '';
  $('#lg-t-tanggal').textContent = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  perbaruiKopLembar();

  $('#lembar-wrap').classList.remove('sembunyi');
  if (!petaLembar) {
    petaLembar = L.map('peta-lembar', { preferCanvas: true, zoomControl: true });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Esri World Imagery' }).addTo(petaLembar);
    layerLembar = L.layerGroup().addTo(petaLembar);
  }
  gambarLembar();
  pasSkalaLembar();
  setTimeout(() => {
    petaLembar.invalidateSize();
    petaLembar.fitBounds(titikGambar.map(p => [p.lat, p.lng]), { padding: [70, 70] });
  }, 80);
}

function perbaruiKopLembar() {
  const salin = (dari, ke) => { $(ke).textContent = $(dari).value.trim() || '—'; };
  salin('#lg-judul', '#lg-t-judul');
  salin('#lg-lokasi', '#lg-t-lokasi');
  salin('#lg-digambar', '#lg-t-digambar');
  salin('#lg-diperiksa', '#lg-t-diperiksa');
  salin('#lg-disetujui', '#lg-t-disetujui');
  salin('#lg-nomor', '#lg-t-nomor');
  const judul = $('#lg-judul').value.trim();
  const lokasi = $('#lg-lokasi').value.trim();
  $('#lg-judul-peta').textContent = (judul + (lokasi ? ' ' + lokasi : '')).toUpperCase() || 'GAMBAR RENCANA';
}

// ---------------- LEMBAR RAB RESMI (CETAK / PDF, format UP3) ----------------
// Tabel persis format resmi unit: kolom Harga Satuan & Jumlah Harga terpisah
// Material/Jasa, baris Jumlah → DPP (11/12) → PPn 12% → Jumlah Total, terbilang,
// dan blok tanda tangan (nama/jabatan dapat diubah lewat isian di atas lembar).
function terbilang(n) {
  n = Math.round(Math.abs(Number(n) || 0));
  const angkaDasar = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const ke = (x) => {
    if (x < 12) return angkaDasar[x];
    if (x < 20) return ke(x - 10) + ' Belas';
    if (x < 100) return ke(Math.floor(x / 10)) + ' Puluh' + (x % 10 ? ' ' + ke(x % 10) : '');
    if (x < 200) return 'Seratus' + (x % 100 ? ' ' + ke(x % 100) : '');
    if (x < 1000) return ke(Math.floor(x / 100)) + ' Ratus' + (x % 100 ? ' ' + ke(x % 100) : '');
    if (x < 2000) return 'Seribu' + (x % 1000 ? ' ' + ke(x % 1000) : '');
    if (x < 1e6) return ke(Math.floor(x / 1000)) + ' Ribu' + (x % 1000 ? ' ' + ke(x % 1000) : '');
    if (x < 1e9) return ke(Math.floor(x / 1e6)) + ' Juta' + (x % 1e6 ? ' ' + ke(x % 1e6) : '');
    if (x < 1e12) return ke(Math.floor(x / 1e9)) + ' Miliar' + (x % 1e9 ? ' ' + ke(x % 1e9) : '');
    return ke(Math.floor(x / 1e12)) + ' Triliun' + (x % 1e12 ? ' ' + ke(x % 1e12) : '');
  };
  return n ? ke(n) : 'Nol';
}

function renderRABResmi() {
  const rab = hitungRAB();
  const nilai = (sel) => $(sel).value.trim();
  const sel = (v) => (v ? angka(v) : ''); // sel kosong bila nol — seperti format asli

  let no = 0;
  let totM = 0, totJ = 0;
  let barisHTML = '';
  const seksi = (judul) => { no++; barisHTML += `<tr class="seksi"><td class="tengah">${no}</td><td colspan="8">${judul}</td></tr>`; };
  const baris = (uraian, sat, vol, volTeks, hm, hj) => {
    no++;
    const jm = Math.round(vol * hm), jj = Math.round(vol * hj);
    totM += jm; totJ += jj;
    barisHTML += `<tr>
      <td class="tengah">${no}</td><td class="uraian">${uraian}</td>
      <td class="tengah">${sat}</td><td class="tengah" style="font-weight:700">${volTeks}</td>
      <td class="angka">${sel(hm)}</td><td class="angka">${sel(hj)}</td>
      <td class="angka">${sel(jm)}</td><td class="angka">${sel(jj)}</td>
      <td class="angka">${sel(jm + jj)}</td></tr>`;
  };

  if (rab.barisRekap.length || rab.panjangKawat) {
    seksi('MATERIAL');
    rab.barisRekap.forEach(b => baris(b.nama, b.satuan, b.qty, angka(b.qty), b.harga, b.jasa));
    if (rab.panjangKawat > 0) {
      baris(`${rab.ph.nama} (${rab.ph.fasa} fasa × faktor andongan ${state.settings.sagFactor})`,
        'Mtr', Math.round(rab.panjangKawat), angka(rab.panjangKawat, 0), hargaEfektif(state.settings.penghantar), 0);
    }
  }
  if (polesRencana().length) {
    seksi('JASA');
    baris(MATERIALS.JASA_TIANG.nama, 'Btg', polesRencana().length, angka(polesRencana().length), 0, hargaEfektif('JASA_TIANG'));
    if (rab.rutePenghantar > 0) {
      baris(MATERIALS.JASA_TARIK.nama, 'Km', rab.rutePenghantar / 1000, angka(rab.rutePenghantar / 1000, 2), 0, hargaEfektif('JASA_TARIK'));
    }
  }
  if (rab.daftarUsulan.length) {
    seksi('USULAN PERBAIKAN ASET EKSISTING');
    rab.daftarUsulan.forEach(u => baris(`${u.paket} — ${u.aset}`, 'Pkt', 1, '1', u.material, u.jasa));
  }

  // Jumlah → DPP (11/12 dari jumlah) → PPn 12% → Jumlah Total, per kolom seperti format asli
  const jumlah = totM + totJ;
  const dppM = Math.round(totM * 11 / 12), dppJ = Math.round(totJ * 11 / 12), dppT = Math.round(jumlah * 11 / 12);
  const ppnM = Math.round(dppM * 0.12), ppnJ = Math.round(dppJ * 0.12), ppnT = Math.round(dppT * 0.12);
  const rekapBaris = (label, m, j, t) => `<tr class="rekap">
    <td colspan="6" style="text-align:right">${label}</td>
    <td class="angka">${angka(m)}</td><td class="angka">${angka(j)}</td><td class="angka">${angka(t)}</td></tr>`;

  const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#rab-lembar').innerHTML = `
    <div class="rjudul">RENCANA ANGGARAN BIAYA</div>
    <div class="rinfo"><span>Pekerjaan</span>: ${nilai('#rb-pekerjaan') || '—'}</div>
    <div class="rinfo" style="margin-bottom:14px"><span>Lokasi</span>: ${nilai('#rb-lokasi') || '—'}</div>
    <table class="rtab">
      <tr>
        <th rowspan="2" style="width:46px">No.</th><th rowspan="2">Uraian Barang/Jasa</th>
        <th rowspan="2" style="width:56px">Sat</th><th rowspan="2" style="width:66px">Vol</th>
        <th colspan="2">Harga Satuan</th><th colspan="2">Jumlah Harga</th>
        <th rowspan="1" style="width:110px">Jumlah Total</th>
      </tr>
      <tr>
        <th style="width:100px">Material (Rp)</th><th style="width:88px">Jasa (Rp)</th>
        <th style="width:110px">Material (Rp)</th><th style="width:88px">Jasa (Rp)</th>
        <th>(Rp)</th>
      </tr>
      <tr>
        <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7 = 4 x 5</th><th>8 = 4 x 6</th><th>10 = 7 + 8</th>
      </tr>
      <tr><td colspan="9" style="height:14px;border-left:1.2px solid #000;border-right:1.2px solid #000"></td></tr>
      ${barisHTML || '<tr><td colspan="9" style="text-align:center">Belum ada data survey — lakukan taging terlebih dahulu.</td></tr>'}
      ${rekapBaris('Jumlah', totM, totJ, jumlah)}
      ${rekapBaris('DPP', dppM, dppJ, dppT)}
      ${rekapBaris('PPn 12%', ppnM, ppnJ, ppnT)}
      ${rekapBaris('Jumlah Total', totM + ppnM, totJ + ppnJ, jumlah + ppnT)}
      <tr><td colspan="9" style="font-weight:800">Terbilang : ${terbilang(jumlah + ppnT)} Rupiah</td></tr>
    </table>
    <div class="ttd">
      <div class="blok">&nbsp;<br>Mengetahui<br>${nilai('#rb-jab1') || '—'}<div class="nama">${nilai('#rb-nama1') || '(..........................)'}</div></div>
      <div class="blok">${nilai('#rb-kota') || 'Masohi'}, ${tanggal}<br>Membuat<br>${nilai('#rb-jab2') || '—'}<div class="nama">${nilai('#rb-nama2') || '(..........................)'}</div></div>
    </div>
    <div class="ttd-tengah">Menyetujui<br>${nilai('#rb-jab3') || '—'}<div class="nama">${nilai('#rb-nama3') || '(..........................)'}</div></div>`;
}

function bukaRABResmi() {
  const s = state.settings;
  const isi = (sel2, v) => { const el = $(sel2); if (!el.value) el.value = v || ''; };
  isi('#rb-pekerjaan', (s.namaPekerjaan ? `${JENIS_PEKERJAAN[s.jenisPekerjaan] || ''} ${s.namaPekerjaan}` : JENIS_PEKERJAAN[s.jenisPekerjaan] || '').trim());
  isi('#rb-lokasi', 'PT PLN (Persero) UP3 Masohi');
  isi('#rb-kota', 'Masohi');
  isi('#rb-jab1', 'Assistant Manager Perencanaan');
  isi('#rb-jab2', 'Team Leader Perencanaan Sistem');
  isi('#rb-nama2', s.petugas || '');
  isi('#rb-jab3', 'Manager UP3 Masohi');
  renderRABResmi();
  pasSkalaLembar();
  $('#rab-wrap').classList.remove('sembunyi');
}

// ---------------- MODAL ----------------
function bukaModal(id) { $('#' + id).classList.add('tampil'); }
function tutupModal(id) { $('#' + id).classList.remove('tampil'); }

// ---------------- INIT ----------------
document.addEventListener('DOMContentLoaded', () => {
  muatRegistryProyek();
  muat();
  muatTugas();
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

  // konfigurasi otomatis dari konfig.json, lalu tarik data unit —
  // pengguna tidak perlu mengetik alamat server / kode unit
  muatKonfigOtomatis().then(() => { if (sinkronSiap()) ambilDariServer(true); });
  // sinkron berkelanjutan selama aplikasi terbuka:
  // - perubahan yang gagal terkirim dicoba ulang tiap menit
  // - data petugas lain ditarik tiap 90 dtk (tanpa perlu menutup/membuka aplikasi)
  // - konfig (alamat server terbaru) dimuat ulang tiap 5 menit
  setInterval(() => { if (sinkronTertunda && sinkronSiap()) kirimKeServer(true); }, 60000);
  setInterval(() => { if (sinkronSiap()) ambilDariServer(true); }, 90000);
  setInterval(muatKonfigOtomatis, 300000);
  window.addEventListener('online', () => {
    if (sinkronSiap()) { ambilDariServer(true); jadwalkanSinkronOtomatis(); }
  });
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
  $('#btn-tugas').onclick = () => { renderTugas(); bukaModal('modal-tugas'); };
  $('#btn-perluasan').onclick = () => { renderPerluasan(); bukaModal('modal-perluasan'); };
  $('#ep-simpan').onclick = simpanEditPekerjaan;
  perbaruiBadgeTugas();
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
  $('#btn-ekspor').onclick = () => { renderDaftarProyek(); bukaModal('modal-ekspor'); };
  $('#p-baru').onclick = buatProyek;
  $('#e-impor-kml').onchange = (e) => { if (e.target.files[0]) imporTitikAset(e.target.files[0]); e.target.value = ''; };

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
    state.settings.kodeUnit = rapikanKodeUnit($('#s-unit').value);
    $('#s-unit').value = state.settings.kodeUnit;
    state.settings.serverOtomatis = !state.settings.server ||
      !!(konfigTerbaru && state.settings.server === konfigTerbaru.server);
    simpan();
    perbaruiStatusSinkron();
  };
  $('#s-unduh-excel').onclick = unduhSemuaPekerjaan; // khusus admin (tombolnya pun hanya tampil untuk admin)
  // sinkron manual hanya sebagai cadangan — normalnya cukup SIMPAN, semuanya otomatis
  $('#s-sinkron').onclick = async () => {
    terapkanIsianSync();
    await kirimKeServer();
    await ambilDariServer();
  };
  window.addEventListener('online', perbaruiStatusSinkron);
  window.addEventListener('offline', perbaruiStatusSinkron);

  // ekspor (simpan/buka file JSON dihapus — data real-time di database unit)
  $('#e-csv').onclick = eksporCSV;
  $('#e-kml').onclick = eksporKML;
  $('#e-pdf').onclick = () => { tutupModal('modal-ekspor'); bukaLembarGambar(); };
  $('#lg-cetak').onclick = () => { siapkanCetak(); window.print(); };
  $('#lg-tutup').onclick = () => { $('#lembar-wrap').classList.add('sembunyi'); pulihkanCetak(); };
  $('#e-rabresmi').onclick = () => { tutupModal('modal-ekspor'); bukaRABResmi(); };
  $('#rb-cetak').onclick = () => { siapkanCetak(); window.print(); };
  $('#rb-tutup').onclick = () => { $('#rab-wrap').classList.add('sembunyi'); pulihkanCetak(); };
  // skala pas satu halaman juga saat cetak dari menu browser (Ctrl+P / Bagikan → Cetak)
  window.addEventListener('beforeprint', siapkanCetak);
  window.addEventListener('afterprint', pulihkanCetak);
  ['#rb-pekerjaan', '#rb-lokasi', '#rb-kota', '#rb-jab1', '#rb-nama1', '#rb-jab2', '#rb-nama2', '#rb-jab3', '#rb-nama3']
    .forEach(sel => { $(sel).oninput = renderRABResmi; });
  // lembar cetak ikut menyesuaikan saat layar berubah (putar HP / ubah ukuran jendela)
  window.addEventListener('resize', () => {
    pasSkalaLembar();
    if (petaLembar && !$('#lembar-wrap').classList.contains('sembunyi')) petaLembar.invalidateSize();
  });
  ['#lg-judul', '#lg-lokasi', '#lg-digambar', '#lg-diperiksa', '#lg-disetujui', '#lg-nomor']
    .forEach(sel => { $(sel).oninput = perbaruiKopLembar; });
  $('#e-tile').onclick = unduhTileArea;
  $('#e-hapus').onclick = hapusSemua;

  // tautan cepat lembar cetak: index.html?cetak=rab / ?cetak=gambar
  const cetakOtomatis = new URLSearchParams(location.search).get('cetak');
  if (cetakOtomatis === 'rab') setTimeout(() => { bukaRABResmi(); siapkanCetak(); }, 400);
  if (cetakOtomatis === 'gambar') setTimeout(() => { bukaLembarGambar(); setTimeout(siapkanCetak, 400); }, 400);

  // tutup modal (tombol × dan klik latar)
  document.querySelectorAll('[data-tutup]').forEach(b => b.onclick = () => tutupModal(b.dataset.tutup));
  document.querySelectorAll('.modal-latar').forEach(l => {
    l.addEventListener('click', (e) => { if (e.target === l) l.classList.remove('tampil'); });
  });
});
