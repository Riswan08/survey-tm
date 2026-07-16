/* ============================================================
   SERVICE WORKER — MODE OFFLINE SURVEY TAGING TM
   ------------------------------------------------------------
   - App shell (HTML/CSS/JS/Leaflet/ikon) di-cache saat install
     → aplikasi bisa dibuka tanpa internet sama sekali.
   - Tile peta (OSM & satelit) di-cache saat dilihat
     → area yang pernah dibuka online tetap tampil saat offline.
   - Data survey sendiri tersimpan di localStorage (bukan urusan
     SW), jadi taging offline aman.
   ============================================================ */

const VERSI = 'v14';
const CACHE_APP = 'stm-app-' + VERSI;
const CACHE_TILE = 'stm-tiles-v1';
const MAKS_TILE = 4000; // batas jumlah tile tersimpan

const ASET_APP = [
  './',
  './index.html',
  './css/style.css?v=14',
  './js/data.js?v=14',
  './js/app.js?v=14',
  './dasbor.html',
  './js/dasbor.js?v=14',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json',
  './data/aset-tm.json',
];

const HOST_TILE = ['tile.openstreetmap.org', 'server.arcgisonline.com', 'basemaps.cartocdn.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_APP).then((c) => c.addAll(ASET_APP)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((kunci) =>
      Promise.all(kunci.filter((k) => k.startsWith('stm-app-') && k !== CACHE_APP).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function batasiTile() {
  const c = await caches.open(CACHE_TILE);
  const semua = await c.keys();
  if (semua.length > MAKS_TILE) {
    // buang yang paling lama (urutan keys ≈ urutan masuk)
    await Promise.all(semua.slice(0, semua.length - MAKS_TILE).map((req) => c.delete(req)));
  }
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Tile peta: cache-first, isi cache saat online
  if (HOST_TILE.some((h) => url.hostname.endsWith(h))) {
    e.respondWith(
      caches.open(CACHE_TILE).then(async (c) => {
        const ada = await c.match(e.request);
        if (ada) return ada;
        try {
          const res = await fetch(e.request);
          if (res && (res.ok || res.type === 'opaque')) {
            c.put(e.request, res.clone());
            batasiTile();
          }
          return res;
        } catch (err) {
          // offline & tile belum pernah dilihat → biarkan kosong
          return new Response('', { status: 404, statusText: 'tile offline' });
        }
      })
    );
    return;
  }

  // Aset aplikasi (same-origin): cache-first (kecocokan persis) → jaringan
  // → versi lama di cache sebagai penyelamat terakhir saat offline.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((ada) =>
        ada ||
        fetch(e.request).then((res) => {
          if (res.ok) {
            const salin = res.clone();
            caches.open(CACHE_APP).then((c) => c.put(e.request, salin));
          }
          return res;
        }).catch(() => caches.match(e.request, { ignoreSearch: true }))
      )
    );
  }
});
