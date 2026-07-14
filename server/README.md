# CAKRA Server — Panduan Singkat

Server sinkronisasi data survey terpusat. **Satu file, tanpa instalasi tambahan** —
hanya butuh [Node.js](https://nodejs.org) (versi 16+) di satu komputer kantor.

## Menjalankan

```bash
cd server
node cakra-server.js
```

Server berjalan di port **8787**. Catat alamat IP komputer ini di jaringan kantor
(mis. `192.168.1.10` — lihat dengan `ipconfig` di Windows / `ifconfig` di Mac/Linux).

## Dipakai surveyor

Ada dua cara — pilih salah satu:

1. **Paling sederhana (disarankan):** HP surveyor membuka aplikasi langsung dari
   server ini: `http://192.168.1.10:8787/` — aplikasi dan server satu alamat,
   sinkronisasi langsung jalan.
2. Aplikasi dari internet (GitHub Pages): isi **Alamat Server** & **Kode Unit** di
   menu ⚙️ Pengaturan. Catatan: karena GitHub Pages memakai HTTPS dan server ini HTTP,
   browser HP akan memblokir campuran ini — gunakan cara 1 di jaringan kantor,
   atau pasang HTTPS di depan server (reverse proxy) bila ingin sinkron dari internet.

## Alur kerja

1. Surveyor di lapangan bekerja **offline seperti biasa** — data aman di HP.
2. Sampai kantor (WiFi kantor): ⚙️ Pengaturan → isi nama petugas, alamat server,
   kode unit → **⬆️ Kirim ke Server**.
3. Perencana/manajer membuka **Dasbor** (`/dasbor.html`) → Ambil dari Server →
   melihat gabungan semua surveyor: peta kondisi, daftar usulan terurut prioritas,
   lalu mengubah **status tindak lanjut** (Diusulkan → Disetujui → Dikerjakan →
   Selesai) → **⬆️ Simpan ke Server**.
4. Surveyor menekan **⬇️ Ambil dari Server** untuk melihat status terbaru.

## Keamanan & data

- **Kode Unit** adalah kunci akses data bersama — gunakan kode yang tidak mudah
  ditebak (mis. `UP3MASOHI-7x2K`) dan bagikan hanya ke petugas.
- Data tersimpan di folder `server/data/<KODE>.json` — **backup folder ini** rutin.
- Jalankan hanya di jaringan internal kantor. Untuk akses dari internet, letakkan
  di belakang reverse proxy ber-HTTPS (minta bantuan tim IT).
- Penggabungan anti-duplikat: setiap titik punya `uid` unik per perangkat; jika titik
  yang sama diubah dua orang, versi dengan stempel waktu terbaru yang menang.
