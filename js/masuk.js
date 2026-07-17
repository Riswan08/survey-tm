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

async function cakraHash(teks) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
window.cakraHash = cakraHash; // dipakai admin untuk membuat hash kode baru

function sesiSaatIni() {
  try {
    const s = JSON.parse(localStorage.getItem(SESI_KUNCI));
    if (s && s.masuk && (Date.now() - s.masuk) < SESI_HARI * 864e5) return s;
  } catch (e) { /* rusak → anggap belum masuk */ }
  return null;
}

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
      <img src="icons/icon-192.png" alt="CAKRA">
      <h1>CAKRA</h1>
      <p class="slogan">Cepat • Tepat • Akurat — Survey Aset Distribusi</p>
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
    if (await cakraHash(kode) !== KODE_AKSES_HASH) {
      galat.textContent = 'Kode akses salah — hubungi admin unit.';
      galat.classList.remove('sembunyi');
      layar.querySelector('#m-kode').value = '';
      return;
    }
    localStorage.setItem(SESI_KUNCI, JSON.stringify({ petugas: petugas.slice(0, 40), masuk: Date.now() }));
    // nama petugas login otomatis menstempel titik survey (jika halaman aplikasi)
    if (typeof state !== 'undefined' && state.settings && !state.settings.petugas) {
      state.settings.petugas = petugas.slice(0, 40);
      if (typeof simpan === 'function') simpan();
    }
    layar.remove();
  };
  layar.querySelector('#m-masuk').onclick = proses;
  layar.querySelectorAll('input').forEach(i =>
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') proses(); }));
  layar.querySelector('#m-petugas').focus();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!sesiSaatIni()) tampilkanLayarMasuk();
});
