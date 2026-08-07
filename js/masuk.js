/* ============================================================
   MASUK.JS — LAYAR MASUK CAKRA (aplikasi & dasbor)
   ------------------------------------------------------------
   Pagar pencegah penyalahgunaan kasual: nama petugas + kode akses
   (dicocokkan ke hash SHA-256 di data.js — kode asli tidak pernah
   tertulis di kode sumber). Sesi tersimpan 30 hari di perangkat.
   Bekerja offline. Keluar: tombol di Pengaturan / dasbor.
   ============================================================ */

const SESI_KUNCI = 'cakra_sesi';
const SESI_HARI = 30;

// SHA-256 murni — cadangan saat crypto.subtle tidak tersedia: browser hanya
// menyediakannya di HTTPS/localhost, sedangkan aplikasi juga dibuka dari
// server LAN (http://192.168.x.x) dan login harus tetap bisa.
function sha256Manual(teks) {
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const data = new TextEncoder().encode(teks);
  const total = (((data.length + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[data.length] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 4, (data.length * 8) >>> 0);
  dv.setUint32(total - 8, Math.floor(data.length / 0x20000000));
  const w = new Uint32Array(64);
  for (let blok = 0; blok < total; blok += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(blok + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map(x => x.toString(16).padStart(8, '0')).join('');
}

async function cakraHash(teks) {
  if (crypto.subtle) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  return sha256Manual(teks); // http://IP-LAN — crypto.subtle dimatikan browser
}
window.cakraHash = cakraHash; // dipakai admin untuk membuat hash kode baru

function sesiSaatIni() {
  try {
    const s = JSON.parse(localStorage.getItem(SESI_KUNCI));
    if (s && s.masuk && (Date.now() - s.masuk) < SESI_HARI * 864e5) return s;
  } catch (e) { /* rusak → anggap belum masuk */ }
  return null;
}
window.sesiCakra = sesiSaatIni;

// ---- peran & hak akses (FR-12) — sesi lama tanpa peran = surveyor ----
function peranSesi() {
  const s = sesiSaatIni();
  return (s && PERAN[s.peran]) ? s.peran : 'surveyor';
}
const bolehKelolaUsulan = () => ['perencana', 'manajer', 'admin'].includes(peranSesi());
const bolehKelolaTugas  = () => ['perencana', 'manajer', 'admin'].includes(peranSesi());
const bolehKelolaHarga  = () => peranSesi() === 'admin';
window.peranSesi = peranSesi;

function keluarSesi() {
  localStorage.removeItem(SESI_KUNCI);
  location.reload();
}
window.keluarSesi = keluarSesi;

function tampilkanLayarMasuk() {
  const layar = document.createElement('div');
  layar.id = 'layar-masuk';
  layar.innerHTML = `
    <div class="kotak-masuk">
      <img src="icons/logo.png" alt="Si CAKRA">
      <h1>Si CAKRA</h1>
      <p class="slogan">Sistem Cerdas Analisis Kebutuhan Rencana Aset<br>Cepat • Tepat • Akurat</p>
      <input type="text" id="m-petugas" maxlength="40" placeholder="Nama petugas / surveyor" autocomplete="name">
      <input type="password" id="m-kode" maxlength="60" placeholder="Kode akses unit" autocomplete="off">
      <button id="m-masuk" class="tombol utama">Masuk</button>
      <p class="galat sembunyi" id="m-galat"></p>
      <p class="ket">Kode akses diberikan oleh admin unit. Sesi tersimpan 30 hari di perangkat ini.</p>
    </div>`;
  document.body.appendChild(layar);

  const proses = async () => {
    const petugas = layar.querySelector('#m-petugas').value.trim();
    const kode = layar.querySelector('#m-kode').value;
    const galat = layar.querySelector('#m-galat');
    if (!petugas) { galat.textContent = 'Isi nama petugas dulu.'; galat.classList.remove('sembunyi'); return; }
    if (!kode) { galat.textContent = 'Isi kode akses.'; galat.classList.remove('sembunyi'); return; }
    const cocok = KODE_AKSES[await cakraHash(kode)];
    if (!cocok) {
      galat.textContent = 'Kode akses salah — hubungi admin unit.';
      galat.classList.remove('sembunyi');
      layar.querySelector('#m-kode').value = '';
      return;
    }
    // nilai lama berupa string ULP saja → peran surveyor
    const akun = typeof cocok === 'string' ? { ulp: cocok, peran: 'surveyor' } : cocok;
    localStorage.setItem(SESI_KUNCI, JSON.stringify({
      petugas: petugas.slice(0, 40), ulp: akun.ulp,
      peran: PERAN[akun.peran] ? akun.peran : 'surveyor',
      masuk: Date.now(),
    }));
    // nama petugas login otomatis menstempel titik survey (jika halaman aplikasi)
    if (typeof state !== 'undefined' && state.settings && !state.settings.petugas) {
      state.settings.petugas = petugas.slice(0, 40);
      if (typeof simpan === 'function') simpan();
    }
    layar.remove();
    if (typeof toast === 'function') {
      const p = PERAN[akun.peran] || PERAN.surveyor;
      toast(`Selamat datang, ${petugas.slice(0, 40)} — ${akun.ulp} (${p.ikon} ${p.nama})`);
    }
    // hak peran memengaruhi tampilan dasbor/pengaturan → segarkan bila fungsinya ada
    if (typeof renderSemua === 'function') renderSemua();
  };
  layar.querySelector('#m-masuk').onclick = proses;
  layar.querySelectorAll('input').forEach(i =>
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') proses(); }));
  layar.querySelector('#m-petugas').focus();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!sesiSaatIni()) tampilkanLayarMasuk();
});
