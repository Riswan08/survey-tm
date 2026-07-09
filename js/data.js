/* ============================================================
   DATA.JS — SUMBER DATA TUNGGAL APLIKASI SURVEY TAGING TM
   ------------------------------------------------------------
   Semua harga di bawah adalah CONTOH (placeholder).
   Sesuaikan dengan harga SKKI / HPS / kontrak yang berlaku
   di unit Anda. Harga juga bisa diubah dari menu Pengaturan
   di aplikasi (tersimpan di perangkat, tanpa mengubah file ini).
   ============================================================ */

// ------------------------------------------------------------
// MASTER MATERIAL & JASA
// kategori: tiang | material | penghantar | pengaman | jasa
// ------------------------------------------------------------
const MATERIALS = {
  // --- Tiang beton ---
  TIANG_12_200:  { nama: 'Tiang Beton 12 m / 200 daN',            satuan: 'btg', harga: 4200000, kategori: 'tiang' },
  TIANG_12_350:  { nama: 'Tiang Beton 12 m / 350 daN',            satuan: 'btg', harga: 5500000, kategori: 'tiang' },
  TIANG_13_350:  { nama: 'Tiang Beton 13 m / 350 daN',            satuan: 'btg', harga: 6500000, kategori: 'tiang' },
  TIANG_14_500:  { nama: 'Tiang Beton 14 m / 500 daN',            satuan: 'btg', harga: 8200000, kategori: 'tiang' },

  // --- Material konstruksi ---
  XARM:          { nama: 'Cross Arm UNP 10 × 2000 mm',            satuan: 'bh',  harga: 850000,  kategori: 'material' },
  BRACE:         { nama: 'Arm Tie / Brace 50×50×5×650 mm',        satuan: 'bh',  harga: 165000,  kategori: 'material' },
  ISOL_TUMPU:    { nama: 'Isolator Tumpu 20 kV (Line Post)',      satuan: 'bh',  harga: 425000,  kategori: 'material' },
  ISOL_TARIK:    { nama: 'Isolator Tarik 20 kV (set)',            satuan: 'set', harga: 515000,  kategori: 'material' },
  STRAIN_CLAMP:  { nama: 'Strain Clamp AAAC 70–150 mm²',          satuan: 'bh',  harga: 185000,  kategori: 'material' },
  BINDING:       { nama: 'Top Ties / Binding Wire (3 fasa)',      satuan: 'set', harga: 90000,   kategori: 'material' },
  BOLT_SET:      { nama: 'Mur, Baut & Ring (set konstruksi)',     satuan: 'set', harga: 125000,  kategori: 'material' },
  JUMPER:        { nama: 'Penghantar Jumper AAAC',                satuan: 'm',   harga: 35000,   kategori: 'material' },
  PIPA_GALV:     { nama: 'Pipa Galvanis 4" × 6 m (opstijg)',      satuan: 'btg', harga: 950000,  kategori: 'material' },
  TERMINASI:     { nama: 'Terminasi Kabel 24 kV Outdoor 3 Core',  satuan: 'set', harga: 2500000, kategori: 'material' },

  // --- Pengaman / aksesoris opsional ---
  ARRESTER:      { nama: 'Lightning Arrester 24 kV 5 kA',         satuan: 'bh',  harga: 750000,  kategori: 'pengaman' },
  FCO:           { nama: 'Fuse Cut Out 24 kV + Fuse Link',        satuan: 'bh',  harga: 850000,  kategori: 'pengaman' },
  GROUNDING:     { nama: 'Grounding Set (rod + BC + klem)',       satuan: 'set', harga: 650000,  kategori: 'pengaman' },
  GUYWIRE_SET:   { nama: 'Guy Wire / Schoor Set (komplit)',       satuan: 'set', harga: 1250000, kategori: 'pengaman' },

  // --- Penghantar utama (per meter) ---
  PH_AAAC70:     { nama: 'Penghantar AAAC 70 mm²',                satuan: 'm',   harga: 28000,   kategori: 'penghantar', fasa: 3 },
  PH_AAAC150:    { nama: 'Penghantar AAAC 150 mm²',               satuan: 'm',   harga: 52000,   kategori: 'penghantar', fasa: 3 },
  PH_AAAC240:    { nama: 'Penghantar AAAC 240 mm²',               satuan: 'm',   harga: 78000,   kategori: 'penghantar', fasa: 3 },
  PH_MVTIC150:   { nama: 'Kabel MVTIC 3×150 mm² (twisted)',       satuan: 'm',   harga: 185000,  kategori: 'penghantar', fasa: 1 },

  // --- Jasa ---
  JASA_TIANG:    { nama: 'Jasa Tanam Tiang + Pasang Konstruksi',  satuan: 'tiang', harga: 1500000,  kategori: 'jasa' },
  JASA_TARIK:    { nama: 'Jasa Penarikan Penghantar (per km rute)', satuan: 'km',  harga: 12000000, kategori: 'jasa' },
};

// ------------------------------------------------------------
// STANDAR KONSTRUKSI TIANG TM (SUTM 20 kV)
// bom = Bill of Material: { kodeMaterial: qty }
// Daftar & isi BOM bisa disesuaikan dengan Buku Standar
// Konstruksi Jaringan SUTM PLN yang berlaku di unit Anda.
// ------------------------------------------------------------
const KONSTRUKSI = {
  'TM-1': {
    nama: 'Tiang Penumpu (Lurus)',
    sudut: '0° – 15°',
    desc: 'Konstruksi tiang lurus / tumpu, traves tunggal, 3 isolator tumpu.',
    warna: '#1976d2',
    bom: { XARM: 1, BRACE: 2, ISOL_TUMPU: 3, BINDING: 1, BOLT_SET: 1 },
  },
  'TM-2': {
    nama: 'Tiang Sudut Kecil',
    sudut: '15° – 30°',
    desc: 'Konstruksi sudut kecil, traves ganda, 6 isolator tumpu (double pin).',
    warna: '#00897b',
    bom: { XARM: 2, BRACE: 2, ISOL_TUMPU: 6, BINDING: 2, BOLT_SET: 1 },
  },
  'TM-4': {
    nama: 'Tiang Awal / Akhir (Dead End)',
    sudut: 'awal / akhir jaringan',
    desc: 'Konstruksi tiang awal atau akhir, traves ganda, 3 isolator tarik + strain clamp.',
    warna: '#e53935',
    bom: { XARM: 2, BRACE: 4, ISOL_TARIK: 3, STRAIN_CLAMP: 3, BOLT_SET: 1 },
  },
  'TM-5': {
    nama: 'Tiang Penegang / Sudut Besar',
    sudut: '30° – 90°',
    desc: 'Konstruksi penegang atau sudut besar, 6 isolator tarik + jumper + 3 isolator tumpu.',
    warna: '#f57c00',
    bom: { XARM: 2, BRACE: 4, ISOL_TARIK: 6, STRAIN_CLAMP: 6, ISOL_TUMPU: 3, JUMPER: 12, BOLT_SET: 1 },
  },
  'TM-8': {
    nama: 'Tiang Penegang Seksi (Double Dead End)',
    sudut: 'pemisah seksi',
    desc: 'Konstruksi penegang antar seksi jaringan, 6 isolator tarik, jumper antar seksi.',
    warna: '#8e24aa',
    bom: { XARM: 2, BRACE: 4, ISOL_TARIK: 6, STRAIN_CLAMP: 6, ISOL_TUMPU: 3, JUMPER: 15, BOLT_SET: 1 },
  },
  'TM-10': {
    nama: 'Tiang Peralihan SKTM–SUTM (Opstijg)',
    sudut: 'kabel naik',
    desc: 'Konstruksi peralihan kabel tanah ke udara: terminasi, arrester, pipa galvanis, grounding.',
    warna: '#5d4037',
    bom: { XARM: 2, BRACE: 4, ISOL_TARIK: 3, STRAIN_CLAMP: 3, TERMINASI: 1, ARRESTER: 3, PIPA_GALV: 1, GROUNDING: 1, BOLT_SET: 1 },
  },
};

// ------------------------------------------------------------
// AKSESORIS OPSIONAL PER TIANG (dicentang saat taging)
// ------------------------------------------------------------
const AKSESORIS = {
  ARRESTER_SET:  { nama: 'Arrester Set (3 fasa + grounding)', bom: { ARRESTER: 3, GROUNDING: 1 } },
  FCO_SET:       { nama: 'FCO Set (3 fasa)',                  bom: { FCO: 3 } },
  GUYWIRE:       { nama: 'Guy Wire / Schoor',                 bom: { GUYWIRE_SET: 1 } },
  GROUNDING_SET: { nama: 'Grounding Set',                     bom: { GROUNDING: 1 } },
};

// ------------------------------------------------------------
// PENGATURAN BAWAAN
// ------------------------------------------------------------
const DEFAULT_SETTINGS = {
  penghantar: 'PH_AAAC70',  // jenis penghantar utama
  sagFactor: 1.03,          // faktor andongan (sag) 3%
  ppnAktif: true,
  ppnPersen: 11,
  hargaOverride: {},        // { kodeMaterial: hargaCustom } — diisi dari menu Pengaturan
  akurasiMin: 15,           // meter — di atas ini muncul konfirmasi sebelum tikor dipakai
};

const DEFAULT_TIANG = 'TIANG_12_200';
