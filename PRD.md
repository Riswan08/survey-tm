# PRD — CAKRA
**C**erdas **A**nalisis **K**ebutuhan **R**encana **A**set

> **» CEPAT • TEPAT • AKURAT «**
> Membuat aset distribusi PLN semakin handal melalui usulan perbaikan yang terukur di tiap aset.

| | |
|---|---|
| **Nama produk** | CAKRA (Cerdas Analisis Kebutuhan Rencana Aset) |
| **Unit** | PLN UIW Maluku dan Maluku Utara — UP3 Masohi |
| **Platform** | Web PWA (mobile-first, offline-capable) — https://riswan08.github.io/survey-tm/ |
| **Status dokumen** | Draft v1.0 — Juli 2026 |
| **Fondasi** | Aplikasi Survey Taging TM (sudah live, menjadi Fase 1 CAKRA) |

---

## 1. Ringkasan Eksekutif

CAKRA adalah aplikasi survey dan perencanaan aset distribusi dalam satu genggaman.
Surveyor berjalan di lapangan, menandai (taging) aset pada peta lewat GPS HP, menilai
kondisinya, dan aplikasi **secara otomatis** menghasilkan usulan perbaikan, kebutuhan
material, dan RAB terinci sesuai harga satuan resmi — tanpa entri ulang di kantor,
tanpa hitung manual di Excel.

Fase 1 (sudah berjalan) menjawab kebutuhan **perencanaan jaringan baru**: taging rencana
tiang TM, pemilihan konstruksi standar, RAB otomatis sampai tiang terakhir.
Fase berikutnya mengarahkan aplikasi ke tujuan utamanya: **keandalan aset eksisting** —
setiap tiang, gardu, dan penghantar yang disurvey punya catatan kondisi dan usulan
perbaikan yang bisa diprioritaskan dan dieksekusi.

## 2. Latar Belakang & Masalah

1. **Survey manual terfragmentasi.** Tikor dicatat di GPS/HP terpisah, kondisi aset di
   kertas/WhatsApp, RAB dihitung belakangan di Excel — rawan salah salin, lambat, dan
   tidak seragam antar surveyor.
2. **Usulan perbaikan tidak terstruktur.** Temuan lapangan (tiang keropos, isolator pecah,
   ROW pohon, grounding hilang) sering berhenti sebagai foto di grup chat — tidak menjadi
   daftar usulan yang bisa dianggarkan dan dipantau.
3. **RAB tidak konsisten.** Harga satuan berbeda-beda antar dokumen; volume material
   sering meleset dari kebutuhan konstruksi standar.
4. **Data tidak terpusat.** Hasil survey tersimpan di perangkat masing-masing; manajemen
   sulit melihat gambaran kondisi aset satu penyulang/rayon secara utuh.

## 3. Visi Produk

> *Setiap aset distribusi tersurvey, ternilai kondisinya, dan punya rencana perbaikan
> yang jelas biayanya — sehingga anggaran mengalir ke aset yang paling membutuhkan,
> dan gangguan turun karena perbaikan dilakukan sebelum aset gagal.*

Slogan **Cepat • Tepat • Akurat** diterjemahkan menjadi prinsip desain:

| Prinsip | Wujud di aplikasi |
|---|---|
| **Cerdas** | Analisis otomatis: BOM konstruksi, agregasi material, prioritas usulan |
| **Cepat** | Satu ketukan menanam/menilai aset; live survey mengikuti langkah surveyor |
| **Tepat** | Konstruksi & material sesuai standar; usulan sesuai jenis kerusakan |
| **Akurat** | GPS multi-fix + batas akurasi; harga resmi lampiran; validasi data berlapis |
| **Unggul** | Offline penuh (PWA); bekerja di lokasi tanpa sinyal |
| **Hemat Anggaran** | RAB terinci material vs jasa; prioritas berbasis dampak |

## 4. Tujuan & Metrik Keberhasilan

| Tujuan | Metrik | Target |
|---|---|---|
| Mempercepat survey | Waktu survey per km jaringan | ↓ ≥ 50% vs cara manual |
| RAB tanpa hitung ulang | RAB langsung terpakai tanpa koreksi volume/harga | ≥ 95% usulan |
| Usulan perbaikan terstruktur | Temuan lapangan yang menjadi usulan ber-RAB | 100% temuan tersurvey |
| Keandalan aset | Kontribusi pada penurunan gangguan penyulang yang disurvey | tren SAIDI/SAIFI membaik |
| Adopsi | Surveyor aktif menggunakan CAKRA di UP3 | ≥ 80% petugas survey |

## 5. Pengguna & Persona

1. **Surveyor lapangan** (pengguna utama) — berjalan menyusuri jaringan dengan HP;
   butuh aplikasi ringan, offline, satu tangan, anti salah tikor.
2. **Perencana / bagian perencanaan UP3** — mengolah hasil survey menjadi usulan
   anggaran; butuh RAB terinci, ekspor Excel, rekap material lintas usulan.
3. **Manajer UP3/ULP** — memutuskan prioritas; butuh ringkasan kondisi aset,
   nilai usulan, dan peta sebaran.
4. **Admin data** — memelihara master harga & konstruksi saat SKKI/HPS berubah.

## 6. Ruang Lingkup per Fase

### Fase 1 — Fondasi Survey & RAB *(SELESAI — live)*
- Peta interaktif (OSM + satelit) dengan taging tiang via GPS atau ketuk peta.
- **Live Survey**: GPS mengikuti surveyor; panel jarak dari tiang terakhir
  (penanda gawang ideal 45–65 m); satu ketukan menanam tiang.
- 14 konstruksi TM standar (TM-1 s.d. TM-16.2, termasuk double circuit) + 11 pekerjaan
  pendukung (obstig, topang, kontra mas, grounding arrester, dudukan FCO, rambu, LBS)
  sesuai **Lampiran Harga Satuan JTM Tiang Besi UIW MMU** — harga material & jasa terpisah.
- RAB otomatis: rekap material teragregasi, penghantar berdasar jarak antar tiang
  (× fasa × faktor andongan), jasa, PPN — sampai tiang terakhir.
- Akurasi GPS: multi-fix sampling, batas akurasi dengan konfirmasi, penjaga gawang
  (deteksi ketuk ganda & lompatan), jejak berjalan.
- Offline penuh (PWA): app shell ter-cache, unduh peta area, data tersimpan di perangkat.
- Ekspor: CSV/Excel (format RAB), KML (Google Earth), JSON (proyek).

### Fase 2 — Aset Eksisting & Usulan Perbaikan *(inti CAKRA — berikutnya)*
- **Inventarisasi aset eksisting**: taging aset terpasang (bukan hanya rencana) —
  tiang TM/TR, gardu distribusi, penghantar per seksi, arrester/FCO/isolator, grounding.
- **Penilaian kondisi per aset** saat survey: Baik / Rusak Ringan / Rusak Berat +
  daftar periksa per jenis aset (mis. tiang: keropos, miring, bekas tersambar;
  ROW: pohon mendekati jaringan) + **foto bukti** (kamera HP, tersimpan lokal).
- **Usulan perbaikan per aset**: dari kondisi → aplikasi menyarankan paket perbaikan
  (mis. "ganti tiang + pindah konstruksi", "rabas ROW", "tambah grounding arrester")
  yang otomatis membawa BOM & RAB-nya. Surveyor bisa menyesuaikan.
- **Prioritisasi**: skor urgensi (tingkat kerusakan × dampak ke pelanggan/penyulang);
  daftar usulan terurut + nilai anggarannya.
- Ekspor "Daftar Usulan Perbaikan + RAB" per penyulang/rayon (format siap usulan anggaran).

### Fase 3 — Data Terpusat & Dasbor *(pengembangan lanjut)*
- **Sinkronisasi terpusat**: backend ringan; data survey multi-surveyor tergabung
  otomatis saat online (offline-first tetap dipertahankan).
- **Dasbor manajemen**: peta sebaran kondisi aset, rekap usulan per rayon/penyulang,
  status tindak lanjut (diusulkan → disetujui → dikerjakan → selesai).
- Akun & peran (surveyor, perencana, manajer, admin); riwayat perubahan.
- Master harga terpusat: admin memperbarui harga sekali, semua perangkat mengikuti.

## 7. Kebutuhan Fungsional

Prioritas: **P0** = wajib fase tersebut, **P1** = penting, **P2** = nice-to-have.

### Fase 2 (berikutnya)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Mode survey "Aset Eksisting" di samping mode "Rencana Baru" | P0 |
| FR-02 | Tipe aset: tiang, gardu, seksi penghantar, pengaman (arrester/FCO), grounding, ROW | P0 |
| FR-03 | Form kondisi per tipe aset (checklist + tingkat kerusakan + catatan) | P0 |
| FR-04 | Foto aset dari kamera HP, tersimpan offline, ikut ekspor | P0 |
| FR-05 | Katalog "paket perbaikan" per jenis kerusakan → BOM & RAB otomatis | P0 |
| FR-06 | Skor prioritas usulan (kerusakan × dampak) yang bisa diatur bobotnya | P1 |
| FR-07 | Ekspor Daftar Usulan Perbaikan + RAB per penyulang (CSV/Excel) | P0 |
| FR-08 | Multi-proyek dalam satu perangkat (per penyulang/pekerjaan) | P1 |
| FR-09 | Pencarian & filter aset di peta (jenis, kondisi, prioritas) | P1 |
| FR-10 | Impor titik aset dari KML/CSV (data eksisting yang sudah ada) | P2 |

### Fase 3
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-11 | Sinkronisasi data ke server saat online (offline-first, anti duplikat) | P0 |
| FR-12 | Autentikasi & peran pengguna | P0 |
| FR-13 | Dasbor web: peta kondisi, rekap usulan, nilai anggaran per unit | P0 |
| FR-14 | Alur status usulan (diusulkan → disetujui → dikerjakan → selesai) | P1 |
| FR-15 | Master harga terpusat + riwayat perubahan harga | P1 |
| FR-16 | Notifikasi/penugasan survey ke surveyor tertentu | P2 |

## 8. Kebutuhan Non-Fungsional

| Aspek | Kebutuhan |
|---|---|
| **Offline** | Semua fungsi survey berjalan tanpa internet; sinkron saat online (Fase 3) |
| **Akurasi lokasi** | Multi-fix GPS; tolak/konfirmasi fix di atas batas akurasi (default 15 m) |
| **Integritas data** | Validasi & normalisasi di setiap pintu masuk data; tidak ada kehilangan data saat aplikasi ditutup paksa |
| **Kinerja** | Lancar di HP Android kelas menengah; ≥ 1.000 aset per proyek tanpa lag peta |
| **Keamanan** | Data survey milik unit; backend Fase 3 dengan autentikasi; tidak ada data sensitif di repo publik |
| **Keterpakaian** | Operasi utama satu tangan di lapangan; teks Indonesia; tombol besar |
| **Keterawatan** | `data.js` sumber data tunggal (master harga, konstruksi, paket perbaikan) |

## 9. Model Data (inti)

```
Proyek     : id, nama, penyulang/rayon, tanggal, settings (harga override, penghantar, dll)
Aset       : id, jenis (tiang|gardu|seksi|pengaman|grounding|row),
             nama/kode, lat, lng, akurasiGPS, foto[], catatan,
             — rencana baru : konstruksi, jenisTiang, aksesoris[]
             — eksisting    : kondisi (baik|rusakRingan|rusakBerat), temuan[]
Usulan     : id, asetId, paketPerbaikan, bom{kode:qty}, skorPrioritas,
             status (diusulkan|disetujui|dikerjakan|selesai)
Material   : kode, nama, satuan, hargaMaterial, hargaJasa, kategori   ← lampiran UIW MMU
Konstruksi : kode, nama, bom{kode:qty}                                 ← lampiran UIW MMU
PaketPerbaikan : kode, nama, pemicu (jenis temuan), bom{kode:qty}
```

## 10. Alur Pengguna Utama

**A. Survey rencana jaringan baru** *(Fase 1 — sudah ada)*
Buka CAKRA → Live Survey → berjalan → "Tanam Tiang di Sini" → pilih konstruksi
(estimasi biaya tampil per pilihan) → ulangi tiap gawang → RAB & ekspor.

**B. Survey kondisi aset eksisting** *(Fase 2)*
Buka proyek penyulang → Live Survey mode Eksisting → berdiri di aset → taging →
pilih jenis aset → isi kondisi + foto → jika ada kerusakan, pilih/terima paket
perbaikan yang disarankan → lanjut ke aset berikutnya → di akhir: Daftar Usulan
Perbaikan terurut prioritas + total RAB → ekspor untuk usulan anggaran.

**C. Review manajemen** *(Fase 3)*
Manajer membuka dasbor → melihat peta kondisi penyulang → memfilter usulan
prioritas tinggi → menyetujui paket → status terpantau sampai selesai.

## 11. Asumsi & Ketergantungan

- Harga satuan mengikuti **Lampiran Harga Satuan Pemasangan Konstruksi JTM Tiang Besi
  UIW Maluku & Maluku Utara** (sudah tertanam); harga batang tiang & penghantar belum
  ada di lampiran → placeholder yang dapat diubah di Pengaturan.
- GPS HP cukup akurat (±5–15 m) untuk identifikasi aset; akurasi survey ditingkatkan
  dengan berdiri diam di titik aset.
- Fase 1–2 berjalan tanpa server (data di perangkat + ekspor file); Fase 3 membutuhkan
  keputusan hosting backend internal.
- Hosting saat ini GitHub Pages (HTTPS, gratis); nama domain/hosting internal PLN dapat
  menggantikannya tanpa mengubah aplikasi.

## 12. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Foto banyak memenuhi penyimpanan HP | Survey terhenti | Kompresi foto, batas ukuran, indikator kapasitas |
| Data hilang sebelum diekspor (HP rusak/hilang) | Kehilangan hasil survey | Autosave + pengingat ekspor; sinkronisasi (Fase 3) |
| Harga satuan berubah (SKKI baru) | RAB usang | Editor harga di Pengaturan; master terpusat (Fase 3) |
| Standar konstruksi berbeda antar unit | Salah BOM | `data.js` modular per unit; varian harga per seksi didukung |
| Adopsi rendah karena kebiasaan lama | Manfaat tidak tercapai | Pelatihan singkat; alur satu-ketukan; ekspor format yang sudah dikenal |

## 13. Rilis & Milestone

| Milestone | Isi | Status |
|---|---|---|
| **M1 — Survey TM & RAB** | Fase 1 lengkap, harga lampiran UIW MMU, PWA offline, live di GitHub Pages | ✅ Selesai (Juli 2026) |
| **M2 — Rebranding CAKRA** | Nama, logo, ikon aplikasi CAKRA; mode Rencana vs Eksisting | ✅ Selesai (Juli 2026) |
| **M3 — Kondisi & Usulan** | FR-01…FR-07 (aset eksisting, kondisi, foto, paket perbaikan, prioritas) | ✅ Selesai (Juli 2026) |
| **M4 — Data Terpusat** | Server sinkronisasi (`server/`), dasbor manajemen (`dasbor.html`), status tindak lanjut usulan | ✅ Selesai (Juli 2026) — akun/peran & penugasan menyusul |

## 14. Di Luar Lingkup (Non-Goals)

- Bukan pengganti sistem aset korporat PLN (mis. aplikasi enterprise eksisting) —
  CAKRA adalah alat survey & perencanaan di sisi lapangan; integrasi = ekspor/impor.
- Tidak menghitung analisis kelistrikan (load flow, drop tegangan, proteksi).
- Tidak memproses pembayaran/pengadaan — keluaran akhirnya usulan + RAB.

## 15. Lampiran

- **Sumber harga**: "Lampiran Harga Satuan Pemasangan Konstruksi JTM — Tiang Besi,
  UIW Maluku dan Maluku Utara" (14 konstruksi TM + 11 pekerjaan pendukung; total per
  konstruksi terverifikasi identik dengan dokumen).
- **Glosarium**: Tikor = titik koordinat; Gawang = jarak antar tiang; BOM = Bill of
  Material; ROW = Right of Way (ruang bebas jaringan); SKKI = Standar Kesepakatan
  Harga; RAB = Rencana Anggaran Biaya.
- **Identitas visual**: logo CAKRA (petir kuning, tiang listrik, grafik naik, kalkulator
  Rp; biru PLN #0c6bb5, kuning #ffd400, hijau) dengan slogan
  "Cepat • Tepat • Akurat" — menjadi nama, ikon, dan tema aplikasi mulai M2.
