/* ============================================================
   DATA.JS — SUMBER DATA TUNGGAL APLIKASI SURVEY TAGING TM
   ------------------------------------------------------------
   Harga konstruksi & material pendukung diambil dari:
   "LAMPIRAN HARGA SATUAN PEMASANGAN KONSTRUKSI JARINGAN
    TEGANGAN MENENGAH (JTM) - TIANG BESI"
   UIW MALUKU DAN MALUKU UTARA.

   Setiap material punya DUA harga: `harga` (material) dan
   `jasa` (ongkos pasang per satuan) — sesuai format lampiran.
   Harga tiang (batang) & penghantar TIDAK ada di lampiran,
   jadi masih contoh — sesuaikan lewat menu Pengaturan.
   ============================================================ */

// ------------------------------------------------------------
// MASTER MATERIAL & JASA
// kategori: tiang | material | penghantar | jasa
// ------------------------------------------------------------
const MATERIALS = {
  // --- Batang tiang (HARGA CONTOH — tidak ada di lampiran, silakan sesuaikan) ---
  TIANG_12_200:  { nama: 'Tiang Beton 12 m / 200 daN',  satuan: 'btg', harga: 4200000, jasa: 0, kategori: 'tiang' },
  TIANG_12_350:  { nama: 'Tiang Beton 12 m / 350 daN',  satuan: 'btg', harga: 5500000, jasa: 0, kategori: 'tiang' },
  TIANG_13_350:  { nama: 'Tiang Beton 13 m / 350 daN',  satuan: 'btg', harga: 6500000, jasa: 0, kategori: 'tiang' },
  TIANG_BESI:    { nama: 'Tiang Besi (harga sesuai kontrak)', satuan: 'btg', harga: 0, jasa: 0, kategori: 'tiang' },

  // --- Besi UNP & siku (lampiran) ---
  UNP10_1000:    { nama: 'Besi UNP 10 (5x50x100x1000 mm) Galv.',  satuan: 'btg', harga: 574133,  jasa: 31590,  kategori: 'material' },
  UNP10_2000:    { nama: 'Besi UNP 10 (5x50x100x2000 mm) Galv.',  satuan: 'btg', harga: 751692,  jasa: 70770,  kategori: 'material' },
  UNP10_2400:    { nama: 'Besi UNP 10 (5x50x100x2400 mm) Galv.',  satuan: 'btg', harga: 887610,  jasa: 82500,  kategori: 'material' },
  UNP10_3000:    { nama: 'Besi UNP 10 (5x50x100x3000 mm) Galv.',  satuan: 'btg', harga: 1238195, jasa: 169050, kategori: 'material' },
  UNP8_2100:     { nama: 'Besi UNP 8 (6x45x80x2100 mm) Galv.',    satuan: 'btg', harga: 502199,  jasa: 70770,  kategori: 'material' },
  SIKU_672:      { nama: 'Siku Penyangga (50x50x5x672 mm) Galv.', satuan: 'btg', harga: 141480,  jasa: 37350,  kategori: 'material' },
  SIKU_1050:     { nama: 'Siku Penyangga (50x50x5x1050 mm) Galv. — pasang tunggal', satuan: 'btg', harga: 155966, jasa: 66510, kategori: 'material' },
  SIKU_1050B:    { nama: 'Siku Penyangga (50x50x5x1050 mm) Galv. — pasang ganda',   satuan: 'btg', harga: 155966, jasa: 37350, kategori: 'material' },
  SIKU_1800:     { nama: 'Siku Penyangga (50x50x5x1800 mm) Galv.', satuan: 'btg', harga: 208082, jasa: 107570, kategori: 'material' },
  STRUT:         { nama: 'Besi UNP 10 Strut Support (250 mm) Galv.', satuan: 'btg', harga: 143724, jasa: 16970, kategori: 'material' },

  // --- Pelat, adaptor, beugel & klem ---
  ADAPTOR:       { nama: 'Adaptor Pelat Besi 120x104 mm tbl 5 mm Galv.', satuan: 'bh', harga: 118272, jasa: 37350, kategori: 'material' },
  STEELPLATE:    { nama: 'Steel Plate (5x100x420 mm) Galv.',       satuan: 'bh',  harga: 118721, jasa: 19130, kategori: 'material' },
  STEELPLATE_B:  { nama: 'Steel Plate (5x100x420 mm) Galv. — harga seksi TM-5A', satuan: 'bh', harga: 118721, jasa: 19580, kategori: 'material' },
  BEUGEL_5:      { nama: 'Beugel Besi UNP 10/UNP 8 (1/2) Ø5 inch Galv.', satuan: 'bh', harga: 77112, jasa: 18260, kategori: 'material' },
  BEUGEL_7:      { nama: 'Beugel Besi UNP (1/2) Ø7 inch Galv.',    satuan: 'bh',  harga: 79658,  jasa: 21320, kategori: 'material' },
  BEUGEL_2:      { nama: 'Beugel Besi UNP 10 (1/2) Ø2 inch Galv.', satuan: 'bh',  harga: 59559,  jasa: 10710, kategori: 'material' },
  KLEM_SIKU_5:   { nama: 'Klem Beugel Besi Siku (2/2) Ø5 inch Galv.', satuan: 'set', harga: 94614, jasa: 18260, kategori: 'material' },
  KLEM_SIKU_5G:  { nama: 'Klem Beugel Besi Siku (2/2) Ø5 inch Galv. — harga seksi TM-10', satuan: 'set', harga: 91511, jasa: 18260, kategori: 'material' },
  KLEM_SIKU_7:   { nama: 'Klem Beugel Besi Siku (2/2) Ø7 inch Galv.', satuan: 'set', harga: 105145, jasa: 18260, kategori: 'material' },
  KLEM_UNP10_5:  { nama: 'Klem Beugel Besi UNP 10 (2/2) Ø5 inch Galv.', satuan: 'set', harga: 94614, jasa: 18260, kategori: 'material' },
  KLEM_TREK_5:   { nama: 'Klem Beugel Trek (3/2) Ø5 inch Galv.',   satuan: 'set', harga: 99547,  jasa: 18260, kategori: 'material' },
  KLEM_TREK_5B:  { nama: 'Klem Beugel Trek (3/2) Ø5 inch Galv. — harga seksi Topang Tekan', satuan: 'set', harga: 99959, jasa: 18260, kategori: 'material' },
  KLEM_TREK_7:   { nama: 'Klem Beugel Trek (3/2) Ø7 inch Galv.',   satuan: 'set', harga: 101012, jasa: 18260, kategori: 'material' },

  // --- Mur & baut ---
  MUR50:         { nama: 'Mur + Baut M16 x 50 + Ring Galv.',       satuan: 'bh',  harga: 15181,  jasa: 4710,  kategori: 'material' },
  MUR75:         { nama: 'Mur + Baut M16 x 75 + Ring Galv.',       satuan: 'bh',  harga: 16985,  jasa: 4710,  kategori: 'material' },
  MUR75B:        { nama: 'Mur + Baut M16 x 75 + Ring Galv. (tipe B)', satuan: 'bh', harga: 15664, jasa: 4710, kategori: 'material' },
  MUR180:        { nama: 'Mur + Baut M16 x 180 + Ring Galv.',      satuan: 'bh',  harga: 31730,  jasa: 9170,  kategori: 'material' },
  MUR300:        { nama: 'Mur + Baut M16 x 300 + Ring Galv. (full drad, double mur)', satuan: 'bh', harga: 59241, jasa: 9960, kategori: 'material' },
  MUR_M15_50:    { nama: 'Mur + Baut M15 x 50 + Ring Galv.',       satuan: 'bh',  harga: 13729,  jasa: 4710,  kategori: 'material' },

  // --- Aksesoris jaringan ---
  BENDING:       { nama: 'Bending Wire Berisolasi',                satuan: 'pcs', harga: 21778,  jasa: 13800, kategori: 'material' },
  BALOK_BETON:   { nama: 'Balok Beton 30x30x20 cm (tiang sudut)',  satuan: 'bh',  harga: 184518, jasa: 51800, kategori: 'material' },
  JOINT70:       { nama: 'Joint Sleeve AL 70 mm²',                 satuan: 'bh',  harga: 82429,  jasa: 43810, kategori: 'material' },
  CCO70150:      { nama: 'CCO AL 70–150 mm²',                      satuan: 'bh',  harga: 60240,  jasa: 43810, kategori: 'material' },

  // --- Pipa ---
  PIPA2_6M:      { nama: 'Pipa Galvanis Ø2" x 6 m (Medium A)',     satuan: 'btg', harga: 674756, jasa: 70770, kategori: 'material' },
  PIPA2_15M:     { nama: 'Pipa Galvanis Ø2" x 1,5 m (Medium A)',   satuan: 'btg', harga: 274558, jasa: 22430, kategori: 'material' },
  PIPA34:        { nama: 'Pipa Galvanis Ø3/4" (Medium A)',         satuan: 'btg', harga: 372204, jasa: 31590, kategori: 'material' },

  // --- Topang / schoor ---
  TOPANG_TARIK_SET: { nama: 'Topang Tarik JTM (jasa pemasangan lengkap)', satuan: 'set', harga: 0, jasa: 255970, kategori: 'material' },
  SLING35:       { nama: 'Sling Baja 35 mm² (galvanized steel wire)', satuan: 'mtr', harga: 33882, jasa: 3000, kategori: 'material' },
  BETON_SCHOOR:  { nama: 'Beton Block Schoor Tarik MB-K175',       satuan: 'bh',  harga: 217407, jasa: 70770, kategori: 'material' },
  ISOL_TELUR:    { nama: 'Isolator Telur TM',                      satuan: 'bh',  harga: 95496,  jasa: 5710,  kategori: 'material' },
  TURNBUCKLE:    { nama: 'Spanschroef / Turn Buckle 5/8 inch',     satuan: 'bh',  harga: 124477, jasa: 11730, kategori: 'material' },
  WIRECLIP35:    { nama: 'Wire Clip 35 mm²',                       satuan: 'bh',  harga: 14023,  jasa: 5670,  kategori: 'material' },
  ANGKER:        { nama: 'Besi Angker 16 x 1800 mm Galv.',         satuan: 'btg', harga: 202229, jasa: 41300, kategori: 'material' },
  KAUSEN35:      { nama: 'Kausen 35 mm² Galv.',                    satuan: 'bh',  harga: 14045,  jasa: 5710,  kategori: 'material' },
  COR_BETON:     { nama: 'Cor Beton 1pc:2krl:3psr (topang tekan)', satuan: 'bh',  harga: 244907, jasa: 16970, kategori: 'material' },

  // --- Grounding & pengaman ---
  EARTH_ROD:     { nama: 'Earthing Rod 16 x 175 mm² + Clamp',      satuan: 'btg', harga: 342682, jasa: 175790, kategori: 'material' },
  CU50:          { nama: 'Kawat Cu 50 mm²',                        satuan: 'mtr', harga: 147748, jasa: 5710,  kategori: 'material' },
  SCHOEN_CU50:   { nama: 'Kabel Schoen Cu 50 mm²',                 satuan: 'bh',  harga: 55070,  jasa: 20220, kategori: 'material' },
  STAINLESS:     { nama: 'Stainless Steel @ 0,75 m',               satuan: 'bh',  harga: 15290,  jasa: 5480,  kategori: 'material' },
  STOPBUCKLE:    { nama: 'Stoping Buckle',                         satuan: 'bh',  harga: 7783,   jasa: 5480,  kategori: 'material' },
  PENGHALANG:    { nama: 'Penghalang Panjat',                      satuan: 'bh',  harga: 152052, jasa: 20220, kategori: 'material' },
  RAMBU:         { nama: 'Rambu Tanda Bahaya',                     satuan: 'bh',  harga: 67553,  jasa: 20220, kategori: 'material' },
  LBS630:        { nama: 'LBS Manual 630 A + Pelengkap',           satuan: 'set', harga: 29420528, jasa: 1578020, kategori: 'material' },
  SKOEN70:       { nama: 'Skoen Cable AL/CU 70',                   satuan: 'set', harga: 80735,  jasa: 20220, kategori: 'material' },

  // --- Tiang & material konstruksi JTR / Tegangan Rendah ---
  // (HARGA CONTOH — lampiran harga JTR belum tersedia; sesuaikan di Pengaturan)
  TIANG_9_200:   { nama: 'Tiang Beton 9 m / 200 daN (TR)',        satuan: 'btg', harga: 2800000, jasa: 0, kategori: 'tiang' },
  TIANG_9_350:   { nama: 'Tiang Beton 9 m / 350 daN (TR)',        satuan: 'btg', harga: 3400000, jasa: 0, kategori: 'tiang' },
  SUSP_SET:      { nama: 'Suspension Clamp + Bracket JTR (set)',  satuan: 'set', harga: 165000, jasa: 35000, kategori: 'material' },
  STRAIN_SET:    { nama: 'Strain Clamp / Fixed Dead End + Bracket JTR (set)', satuan: 'set', harga: 195000, jasa: 40000, kategori: 'material' },
  SS_STRIP:      { nama: 'Stainless Steel Strip + Stopping Buckle (set)', satuan: 'set', harga: 45000, jasa: 15000, kategori: 'material' },
  CCO_TR:        { nama: 'Konektor Tap (CCO) JTR',                satuan: 'bh',  harga: 45000,  jasa: 20000, kategori: 'material' },
  PS_STRAP:      { nama: 'Plastic Strap JTR',                     satuan: 'bh',  harga: 8000,   jasa: 3000,  kategori: 'material' },

  // --- Penghantar utama (HARGA CONTOH — tidak ada di lampiran) ---
  PH_AAAC70:     { nama: 'Penghantar AAAC 70 mm²',                 satuan: 'm', harga: 28000,  jasa: 0, kategori: 'penghantar', fasa: 3 },
  PH_AAAC150:    { nama: 'Penghantar AAAC 150 mm²',                satuan: 'm', harga: 52000,  jasa: 0, kategori: 'penghantar', fasa: 3 },
  PH_AAAC240:    { nama: 'Penghantar AAAC 240 mm²',                satuan: 'm', harga: 78000,  jasa: 0, kategori: 'penghantar', fasa: 3 },
  PH_MVTIC150:   { nama: 'Kabel MVTIC 3×150 mm² (twisted)',        satuan: 'm', harga: 185000, jasa: 0, kategori: 'penghantar', fasa: 1 },
  PH_LVTC70:     { nama: 'Kabel Pilin JTR LVTC/NFA2X 3×70+50 mm²', satuan: 'm', harga: 65000,  jasa: 0, kategori: 'penghantar', fasa: 1 },
  PH_LVTC50:     { nama: 'Kabel Pilin JTR LVTC/NFA2X 3×50+35 mm²', satuan: 'm', harga: 52000,  jasa: 0, kategori: 'penghantar', fasa: 1 },

  // --- Jasa gelondongan (CONTOH — sesuaikan) ---
  JASA_TIANG:    { nama: 'Jasa Tanam / Pancang Tiang',             satuan: 'tiang', harga: 1500000,  jasa: 0, kategori: 'jasa' },
  JASA_TARIK:    { nama: 'Jasa Penarikan Penghantar (per km rute)', satuan: 'km',   harga: 12000000, jasa: 0, kategori: 'jasa' },
  JASA_RABAS:    { nama: 'Jasa Rabas / Pangkas Pohon per titik (CONTOH)', satuan: 'titik', harga: 0, jasa: 350000, kategori: 'jasa' },
  JASA_TARIK_ULANG: { nama: 'Jasa Tarik Ulang Andongan per seksi (CONTOH)', satuan: 'seksi', harga: 0, jasa: 750000, kategori: 'jasa' },
};

// ------------------------------------------------------------
// KONSTRUKSI TIANG TM — sesuai Lampiran UIW Maluku & Malut
// bom = { kodeMaterial: qty }
// ------------------------------------------------------------
const KONSTRUKSI = {
  'TM-1': {
    nama: 'Tiang Penumpu', sudut: 'jalur lurus', warna: '#1976d2',
    desc: 'Konstruksi tiang penumpu tunggal.',
    bom: { UNP10_2000: 1, ADAPTOR: 1, SIKU_672: 2, BEUGEL_5: 1, KLEM_SIKU_5: 1, MUR50: 2, MUR75: 4, MUR180: 2, BENDING: 3 },
  },
  'TM-2': {
    nama: 'Tiang Penumpu Ganda', sudut: 'penumpu ganda / sudut', warna: '#00897b',
    desc: 'Penumpu ganda, termasuk balok beton tiang sudut.',
    bom: { UNP10_2000: 2, ADAPTOR: 2, STEELPLATE: 4, SIKU_672: 4, KLEM_SIKU_5: 1, KLEM_UNP10_5: 1, MUR50: 4, MUR75: 2, MUR180: 12, MUR300: 2, BALOK_BETON: 2, BENDING: 3 },
  },
  'TM-3': {
    nama: 'Tiang Awal', sudut: 'awal jaringan', warna: '#43a047',
    desc: 'Konstruksi tiang awal jaringan.',
    bom: { UNP10_2000: 2, ADAPTOR: 2, STEELPLATE: 4, SIKU_672: 4, KLEM_SIKU_5: 1, KLEM_UNP10_5: 1, MUR50: 4, MUR75: 2, MUR180: 12, MUR300: 2, BENDING: 1 },
  },
  'TM-4': {
    nama: 'Tiang Akhir', sudut: 'akhir jaringan', warna: '#e53935',
    desc: 'Konstruksi tiang akhir jaringan.',
    bom: { UNP10_2000: 2, ADAPTOR: 2, STEELPLATE: 4, SIKU_672: 4, KLEM_SIKU_5: 1, KLEM_UNP10_5: 1, MUR50: 4, MUR75: 2, MUR180: 12, MUR300: 2 },
  },
  'TM-5': {
    nama: 'Tiang Tarik Ganda', sudut: 'penegang', warna: '#f57c00',
    desc: 'Tarik ganda, termasuk balok beton & joint sleeve.',
    bom: { UNP10_2000: 2, ADAPTOR: 2, STEELPLATE: 4, SIKU_672: 4, KLEM_SIKU_5: 1, KLEM_UNP10_5: 1, MUR50: 4, MUR75: 2, MUR180: 12, MUR300: 2, BALOK_BETON: 2, BENDING: 1, JOINT70: 3 },
  },
  'TM-6': {
    nama: 'Tiang Percabangan', sudut: 'percabangan', warna: '#8e24aa',
    desc: 'Konstruksi tiang percabangan jaringan, termasuk CCO.',
    bom: { UNP10_2000: 3, ADAPTOR: 3, STEELPLATE: 4, SIKU_672: 6, BEUGEL_5: 1, KLEM_SIKU_5: 2, KLEM_UNP10_5: 1, MUR50: 6, MUR75: 6, MUR180: 14, MUR300: 2, BENDING: 4, CCO70150: 3 },
  },
  'TM-10': {
    nama: 'Tiang Belokan / Sudut', sudut: 'belokan', warna: '#d81b60',
    desc: 'Konstruksi tiang belokan / sudut.',
    bom: { UNP10_2000: 4, ADAPTOR: 4, STEELPLATE: 8, SIKU_672: 8, KLEM_SIKU_5G: 2, KLEM_UNP10_5: 2, MUR50: 8, MUR75: 4, MUR180: 24, MUR300: 4, BENDING: 1, JOINT70: 3 },
  },
  'TM-16': {
    nama: 'Portal / Single-Arm 2 Tiang Besi', sudut: 'portal', warna: '#5d4037',
    desc: 'Konstruksi portal single-arm dua tiang besi.',
    bom: { UNP10_2400: 2, STEELPLATE: 6, UNP8_2100: 2, SIKU_1800: 2, KLEM_UNP10_5: 2, BEUGEL_5: 2, BEUGEL_7: 2, MUR50: 4, MUR75: 8, MUR180: 12, MUR300: 4, JOINT70: 3 },
  },
  'TM-1A': {
    nama: 'Penumpu Double Circuit', sudut: 'jalur lurus 2 sirkit', warna: '#0288d1',
    desc: 'Penumpu tunggal untuk jaringan double circuit.',
    bom: { UNP10_2000: 1, SIKU_1050: 1, BEUGEL_5: 1, KLEM_SIKU_5: 1, MUR50: 2, MUR75: 6, BENDING: 3 },
  },
  'TM-2A': {
    nama: 'Penumpu Ganda Double Circuit', sudut: 'penumpu ganda 2 sirkit', warna: '#00acc1',
    desc: 'Penumpu ganda untuk jaringan double circuit.',
    bom: { UNP10_2000: 2, STEELPLATE: 6, SIKU_1050B: 2, KLEM_SIKU_5: 2, MUR50: 2, MUR75: 2, MUR180: 12, MUR300: 2, BENDING: 3 },
  },
  'TM-5A': {
    nama: 'Tiang Tarik Ganda (Tipe A)', sudut: 'penegang', warna: '#ef6c00',
    desc: 'Tarik ganda tanpa balok beton, dengan joint sleeve.',
    bom: { UNP10_2000: 2, ADAPTOR: 2, STEELPLATE_B: 4, SIKU_672: 4, KLEM_SIKU_5: 1, KLEM_UNP10_5: 1, MUR50: 4, MUR75: 2, MUR180: 12, MUR300: 2, BENDING: 1, JOINT70: 3 },
  },
  'TM-10A': {
    nama: 'Belokan / Sudut 2 Tiang', sudut: 'belokan 2 tiang', warna: '#ad1457',
    desc: 'Konstruksi belokan/sudut dengan dua tiang.',
    bom: { UNP10_2000: 8, UNP8_2100: 2, STEELPLATE: 16, SIKU_672: 16, SIKU_1800: 2, ADAPTOR: 8, KLEM_SIKU_5: 8, BEUGEL_7: 4, MUR50: 19, MUR75: 16, MUR180: 48, MUR300: 8, BENDING: 8, JOINT70: 3 },
  },
  'TM-16.1': {
    nama: 'End Pole (1 Arm)', sudut: 'end pole', warna: '#6d4c41',
    desc: 'Konstruksi tiang end pole satu arm.',
    bom: { UNP10_3000: 2, STEELPLATE: 6, MUR180: 12, MUR300: 4 },
  },
  'TM-16.2': {
    nama: 'End Pole (2 Arm)', sudut: 'end pole', warna: '#4e342e',
    desc: 'Konstruksi tiang end pole dua arm.',
    bom: { UNP10_3000: 4, STEELPLATE: 12, MUR180: 24, MUR300: 8 },
  },

  // ---- KONSTRUKSI JTR / TEGANGAN RENDAH (kabel pilin LVTC/NFA2X) ----
  // Standar konstruksi JTR PLN; HARGA CONTOH — sesuaikan bila lampiran JTR tersedia.
  'TR-1': {
    nama: 'Tiang Penumpu JTR', sudut: 'jalur lurus', warna: '#7cb342', grup: 'JTR',
    desc: 'Penumpu kabel pilin: suspension clamp + bracket.',
    bom: { SUSP_SET: 1, SS_STRIP: 2, PS_STRAP: 3 },
  },
  'TR-2': {
    nama: 'Tiang Sudut JTR', sudut: 'sudut kecil', warna: '#26a69a', grup: 'JTR',
    desc: 'Sudut kecil: suspension clamp ganda.',
    bom: { SUSP_SET: 2, SS_STRIP: 3, PS_STRAP: 3 },
  },
  'TR-3': {
    nama: 'Tiang Awal / Akhir JTR', sudut: 'awal / akhir', warna: '#ef5350', grup: 'JTR',
    desc: 'Awal/akhir jaringan: strain clamp (fixed dead end).',
    bom: { STRAIN_SET: 1, SS_STRIP: 2, PS_STRAP: 2 },
  },
  'TR-4': {
    nama: 'Tiang Penegang / Sudut Besar JTR', sudut: 'penegang / seksi', warna: '#ab47b2', grup: 'JTR',
    desc: 'Penegang atau sudut besar: strain clamp ganda + konektor jumper.',
    bom: { STRAIN_SET: 2, SS_STRIP: 4, CCO_TR: 4, PS_STRAP: 3 },
  },
};

// ------------------------------------------------------------
// PEKERJAAN PENDUKUNG (opsional per tiang) — dari lampiran
// ------------------------------------------------------------
const AKSESORIS = {
  OBSTIG_D1: {
    nama: 'Dudukan Obstig Type 1 (end pole)',
    bom: { UNP10_3000: 1, UNP10_1000: 2, SIKU_672: 2, KLEM_SIKU_5: 2, BEUGEL_5: 2, BEUGEL_2: 3, MUR50: 12, MUR75: 4 },
  },
  OBSTIG_D2: {
    nama: 'Dudukan Obstig Type 2 (end pole)',
    bom: { UNP10_3000: 2, UNP10_1000: 4, SIKU_672: 4, KLEM_SIKU_7: 4, BEUGEL_7: 4, BEUGEL_2: 6, MUR50: 24, MUR75: 8 },
  },
  OBSTIG_P1: {
    nama: 'Penahan Pipa Obstig Type 1',
    bom: { UNP10_3000: 2, BEUGEL_7: 4, BEUGEL_2: 6, PIPA2_6M: 3, MUR50: 12, MUR75: 8 },
  },
  OBSTIG_P2: {
    nama: 'Penahan Pipa Obstig Type 2',
    bom: { UNP10_3000: 2, BEUGEL_7: 4, BEUGEL_2: 12, PIPA2_6M: 6, MUR50: 24, MUR75: 8 },
  },
  TOPANG_TARIK: {
    nama: 'Topang Tarik JTM (jasa pemasangan)',
    bom: { TOPANG_TARIK_SET: 1 },
  },
  KONTRA_MAS: {
    nama: 'Topang Antar Tarik (Kontra Mas) JTM',
    bom: { KLEM_TREK_5: 3, SLING35: 30, BETON_SCHOOR: 1, ISOL_TELUR: 1, TURNBUCKLE: 2, WIRECLIP35: 12, ANGKER: 1, KAUSEN35: 2, MUR_M15_50: 6 },
  },
  TOPANG_TEKAN: {
    nama: 'Topang Tekan JTM',
    bom: { STRUT: 1, BEUGEL_5: 1, PIPA2_15M: 1, COR_BETON: 1, KLEM_TREK_5B: 2, KLEM_TREK_7: 2, MUR75B: 12 },
  },
  GROUNDING_ARR: {
    nama: 'Pemasangan Grounding Arrester',
    bom: { EARTH_ROD: 1, CU50: 14, SCHOEN_CU50: 1, PIPA34: 1, STAINLESS: 3, STOPBUCKLE: 3 },
  },
  DUDUKAN_FCO: {
    nama: 'Dudukan FCO & Arrester',
    bom: { UNP10_2400: 1, BEUGEL_5: 1, MUR75B: 2 },
  },
  RAMBU_PENGAMAN: {
    nama: 'Rambu Pengaman (penghalang panjat + rambu bahaya)',
    bom: { PENGHALANG: 1, RAMBU: 1 },
  },
  LBS_MANUAL: {
    nama: 'LBS Manual 630 A Pole Mounted',
    bom: { LBS630: 1, SKOEN70: 6 },
  },
};

// ------------------------------------------------------------
// PAKET PERBAIKAN (M3) — usulan per temuan, BOM memakai harga
// lampiran UIW MMU. Paket berbasis jasa contoh ditandai (CONTOH).
// tanamTiang: true → biaya jasa tanam tiang ikut dihitung.
// ------------------------------------------------------------
const PAKET_PERBAIKAN = {
  GANTI_TIANG: {
    nama: 'Ganti tiang + konstruksi penumpu (TM-1)', tanamTiang: true,
    bom: { TIANG_BESI: 1, UNP10_2000: 1, ADAPTOR: 1, SIKU_672: 2, BEUGEL_5: 1, KLEM_SIKU_5: 1, MUR50: 2, MUR75: 4, MUR180: 2, BENDING: 3 },
  },
  PASANG_TOPANG_TARIK: { nama: 'Pasang topang tarik JTM',            bom: { TOPANG_TARIK_SET: 1 } },
  PASANG_KONTRA_MAS:   { nama: 'Pasang topang antar tarik (kontra mas)', bom: { KLEM_TREK_5: 3, SLING35: 30, BETON_SCHOOR: 1, ISOL_TELUR: 1, TURNBUCKLE: 2, WIRECLIP35: 12, ANGKER: 1, KAUSEN35: 2, MUR_M15_50: 6 } },
  PASANG_TOPANG_TEKAN: { nama: 'Pasang topang tekan JTM',            bom: { STRUT: 1, BEUGEL_5: 1, PIPA2_15M: 1, COR_BETON: 1, KLEM_TREK_5B: 2, KLEM_TREK_7: 2, MUR75B: 12 } },
  PASANG_GROUNDING_ARR:{ nama: 'Pasang/ganti grounding arrester',    bom: { EARTH_ROD: 1, CU50: 14, SCHOEN_CU50: 1, PIPA34: 1, STAINLESS: 3, STOPBUCKLE: 3 } },
  GANTI_DUDUKAN_FCO:   { nama: 'Ganti dudukan FCO & arrester',       bom: { UNP10_2400: 1, BEUGEL_5: 1, MUR75B: 2 } },
  PASANG_RAMBU:        { nama: 'Pasang rambu pengaman + penghalang panjat', bom: { PENGHALANG: 1, RAMBU: 1 } },
  PASANG_LBS:          { nama: 'Pasang LBS Manual 630 A',            bom: { LBS630: 1, SKOEN70: 6 } },
  PERBAIKI_JUMPER:     { nama: 'Perbaikan kawat rantas / jumper (joint sleeve)', bom: { JOINT70: 3, BENDING: 3 } },
  TARIK_ULANG:         { nama: 'Tarik ulang / perbaiki andongan (CONTOH)', bom: { JASA_TARIK_ULANG: 1 } },
  GANTI_TIANG_TR:      { nama: 'Ganti tiang TR + konstruksi penumpu TR-1 (CONTOH)', tanamTiang: true,
                         bom: { TIANG_9_200: 1, SUSP_SET: 1, SS_STRIP: 2, PS_STRAP: 3 } },
  GANTI_KLEM_TR:       { nama: 'Ganti suspension/strain clamp JTR (CONTOH)', bom: { SUSP_SET: 1, STRAIN_SET: 1, SS_STRIP: 2 } },
  RABAS:               { nama: 'Rabas / pangkas pohon (CONTOH)',     bom: { JASA_RABAS: 1 } },
};

// ------------------------------------------------------------
// TEMUAN LAPANGAN per jenis aset → paket perbaikan yang disarankan
// ------------------------------------------------------------
const TEMUAN = {
  TIANG_TM: {
    T_KEROPOS:  { nama: 'Tiang keropos / korosi berat',        paket: 'GANTI_TIANG' },
    T_RETAK:    { nama: 'Tiang retak / pecah',                 paket: 'GANTI_TIANG' },
    T_MIRING:   { nama: 'Tiang miring',                        paket: 'PASANG_TOPANG_TARIK' },
    T_TARIKAN:  { nama: 'Tarikan berat tanpa topang',          paket: 'PASANG_KONTRA_MAS' },
    T_RAMBU:    { nama: 'Tanpa rambu / penghalang panjat',     paket: 'PASANG_RAMBU' },
  },
  TIANG_TR: {
    TR_KEROPOS: { nama: 'Tiang keropos / korosi berat',        paket: 'GANTI_TIANG_TR' },
    TR_RETAK:   { nama: 'Tiang retak / pecah',                 paket: 'GANTI_TIANG_TR' },
    TR_MIRING:  { nama: 'Tiang miring',                        paket: 'PASANG_TOPANG_TARIK' },
    TR_KLEM:    { nama: 'Suspension/strain clamp rusak',       paket: 'GANTI_KLEM_TR' },
    TR_KENDOR:  { nama: 'Kabel pilin kendor / terlalu rendah', paket: 'TARIK_ULANG' },
  },
  GARDU: {
    G_GROUNDING:{ nama: 'Grounding arrester rusak / hilang',   paket: 'PASANG_GROUNDING_ARR' },
    G_FCO:      { nama: 'Dudukan FCO keropos / rusak',         paket: 'GANTI_DUDUKAN_FCO' },
    G_RAMBU:    { nama: 'Rambu pengaman tidak ada',            paket: 'PASANG_RAMBU' },
    G_LBS:      { nama: 'Perlu LBS untuk manuver',             paket: 'PASANG_LBS' },
  },
  PENGHANTAR: {
    P_RANTAS:   { nama: 'Kawat rantas / burik',                paket: 'PERBAIKI_JUMPER' },
    P_JUMPER:   { nama: 'Jumper kendor / titik panas',         paket: 'PERBAIKI_JUMPER' },
    P_KENDOR:   { nama: 'Andongan kendor / terlalu rendah',    paket: 'TARIK_ULANG' },
  },
  PENGAMAN: {
    PA_ARRESTER:{ nama: 'Arrester rusak / hilang',             paket: 'PASANG_GROUNDING_ARR' },
    PA_FCO:     { nama: 'FCO rusak / dudukan keropos',         paket: 'GANTI_DUDUKAN_FCO' },
  },
  GROUNDING: {
    GR_PUTUS:   { nama: 'Kawat grounding putus / hilang',      paket: 'PASANG_GROUNDING_ARR' },
  },
  ROW: {
    R_SENTUH:   { nama: 'Pohon menyentuh jaringan',            paket: 'RABAS' },
    R_DEKAT:    { nama: 'Pohon mendekati ruang bebas',         paket: 'RABAS' },
  },
};

// ------------------------------------------------------------
// DAMPAK GANGGUAN — bobot prioritas (skor = kondisi × dampak)
// ------------------------------------------------------------
const DAMPAK = {
  rendah: { nama: 'Rendah (ujung cabang)',    bobot: 1 },
  sedang: { nama: 'Sedang (cabang / desa)',   bobot: 2 },
  tinggi: { nama: 'Tinggi (penyulang utama)', bobot: 3 },
};

const BOBOT_KONDISI = { baik: 1, rusakRingan: 2, rusakBerat: 3 };

// jenis pekerjaan — identitas proyek survey, tampil di RAB & ekspor
const JENIS_PEKERJAAN = {
  PERLUASAN_JTM:  'Perluasan Jaringan JTM',
  PERLUASAN_JTR:  'Perluasan Jaringan JTR',
  SAMBUNGAN_BARU: 'Penyambungan Baru / Temuan Baru',
  REHAB:          'Rehab Jaringan',
  UPRATING_JTM:   'Uprating Jaringan JTM',
  UPRATING_JTR:   'Uprating Jaringan JTR',
  PEMELIHARAAN:   'Pemeliharaan Jaringan',
  LAINNYA:        'Lainnya',
};

// eviden calon pelanggan — slot foto berlabel
const EVIDEN_PELANGGAN = {
  ktp:      'Foto KTP',
  kk:       'Foto Kartu Keluarga',
  depan:    'Bangunan Tampak Depan',
  belakang: 'Bangunan Tampak Belakang',
};

// status tindak lanjut usulan perbaikan (M4)
const STATUS_USULAN = {
  diusulkan:  { nama: 'Diusulkan',  warna: '#607d8b' },
  disetujui:  { nama: 'Disetujui',  warna: '#0288d1' },
  dikerjakan: { nama: 'Dikerjakan', warna: '#f57c00' },
  selesai:    { nama: 'Selesai',    warna: '#2e7d32' },
};

// ------------------------------------------------------------
// ASET EKSISTING (mode survey kondisi — fondasi usulan perbaikan)
// ------------------------------------------------------------
const JENIS_ASET = {
  TIANG_TM:   { nama: 'Tiang TM',                 ikon: '🗼' },
  TIANG_TR:   { nama: 'Tiang TR (Tegangan Rendah)', ikon: '🕯️' },
  GARDU:      { nama: 'Gardu Distribusi',         ikon: '🏠' },
  PENGHANTAR: { nama: 'Penghantar / Seksi Jaringan', ikon: '➿' },
  PENGAMAN:   { nama: 'Pengaman (Arrester / FCO)', ikon: '🛡️' },
  GROUNDING:  { nama: 'Grounding / Pentanahan',   ikon: '⏚' },
  ROW:        { nama: 'ROW / Pohon Dekat Jaringan', ikon: '🌳' },
};

const KONDISI = {
  baik:        { nama: 'Baik',         warna: '#2e7d32' },
  rusakRingan: { nama: 'Rusak Ringan', warna: '#f57c00' },
  rusakBerat:  { nama: 'Rusak Berat',  warna: '#e53935' },
};

// ------------------------------------------------------------
// KODE AKSES APLIKASI per ULP (layar masuk)
// Yang disimpan hanya HASH SHA-256-nya — kode aslinya tidak terbaca di sini.
// Kode yang dipakai menentukan ULP pengguna (tercatat di sesi).
// Ganti/tambah kode: konsol browser → await cakraHash('KODEBARU') → tempel ke sini.
// ------------------------------------------------------------
const KODE_AKSES = {
  '02bafe81c5cbd71611dd1b2178a2410e2d003f727015035c3e9003468863944a': 'ULP Piru',
  '7ae0865f53528ddf750b5728e3570e0713cb235a782ec1387e422cbf9d7e38a7': 'ULP Masohi',
  '5b7a436e2ca4a8c8135f4f6513b23f5dce679b23277ec5dd58083b4323167d12': 'ULP Kairatu',
  '7fbe9da3f554d892d8d487d0c0b0e38362bdf9d8b2a4a6619c0be8b2540cf776': 'ULP Kobisonta',
  '769e88a66014f9d0f61f37d013a2a177bcdd77f5e95a05ea394efe27624e9abc': 'ULP Bula',
};

// ------------------------------------------------------------
// PENGATURAN BAWAAN
// ------------------------------------------------------------
const DEFAULT_SETTINGS = {
  penghantar: 'PH_AAAC70',  // jenis penghantar utama
  sagFactor: 1.03,          // faktor andongan (sag) 3%
  ppnAktif: true,
  ppnPersen: 11,
  hargaOverride: {},        // { kode: hargaMaterial custom } — dari menu Pengaturan
  jasaOverride: {},         // { kode: hargaJasa custom }
  akurasiMin: 15,           // meter — di atas ini muncul konfirmasi sebelum tikor dipakai
  jenisPekerjaan: 'PERLUASAN_JTM',  // identitas pekerjaan survey ini
  namaPekerjaan: '',                // mis. "Perluasan Dusun Waraka"
  // sinkronisasi terpusat (M4) — kosongkan jika bekerja mandiri/offline saja
  server: '',               // mis. http://192.168.1.10:8787 (server CAKRA internal unit)
  kodeUnit: '',             // kode unit = kunci akses data bersama
  petugas: '',              // nama surveyor — tercatat di tiap titik
};

const DEFAULT_TIANG = 'TIANG_BESI';
