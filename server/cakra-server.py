"""
CAKRA SERVER (versi Python) — fungsi identik dengan cakra-server.js.
Gunakan yang ini jika komputer kantor punya Python tapi tidak ada Node.js.

    python3 cakra-server.py            → port 8787
    PORT=9000 python3 cakra-server.py  → port lain

Menyajikan aplikasi CAKRA + API sinkronisasi:
    GET  /api/data  (header X-Kode-Unit)
    POST /api/sync  (header X-Kode-Unit, body {"poles": [...]})
Data per unit tersimpan di ./data/<KODE>.json — backup folder ini rutin.
"""
import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get('PORT', 8787))
DIR_SERVER = os.path.dirname(os.path.abspath(__file__))
DIR_DATA = os.path.join(DIR_SERVER, 'data')
DIR_APP = os.path.dirname(DIR_SERVER)
os.makedirs(DIR_DATA, exist_ok=True)

MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8', '.json': 'application/json',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'}


def kode_valid(kode):
    return bool(kode) and re.fullmatch(r'[A-Za-z0-9_-]{3,60}', kode) is not None


def file_unit(kode):
    return os.path.join(DIR_DATA, kode.upper() + '.json')


def baca_unit(kode):
    try:
        with open(file_unit(kode), encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {'poles': [], 'diperbarui': 0}


def tulis_unit(kode, data):
    f = file_unit(kode)
    with open(f + '.tmp', 'w', encoding='utf-8') as h:
        json.dump(data, h)
    os.replace(f + '.tmp', f)  # tulis atomik


def gabung(lama, masuk):
    peta = {p['uid']: p for p in (lama or []) if isinstance(p, dict) and p.get('uid')}
    baru = diperbarui = 0
    for p in (masuk if isinstance(masuk, list) else []):
        if not isinstance(p, dict):
            continue
        uid = p.get('uid')
        if not isinstance(uid, str) or len(uid) < 3:
            continue
        try:
            float(p.get('lat')), float(p.get('lng'))
        except (TypeError, ValueError):
            continue
        ada = peta.get(uid)
        if ada is None:
            peta[uid] = p
            baru += 1
        elif (p.get('diubah') or 0) > (ada.get('diubah') or 0):
            peta[uid] = p
            diperbarui += 1
    return list(peta.values()), baru, diperbarui


class Handler(BaseHTTPRequestHandler):
    def _json(self, kode, obj):
        isi = json.dumps(obj).encode()
        self.send_response(kode)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Kode-Unit')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Content-Length', str(len(isi)))
        self.end_headers()
        self.wfile.write(isi)

    def do_OPTIONS(self):
        self._json(204, {})

    def do_GET(self):
        if self.path.startswith('/api/data'):
            kode = self.headers.get('X-Kode-Unit', '')
            if not kode_valid(kode):
                return self._json(401, {'error': 'kode unit tidak valid'})
            d = baca_unit(kode)
            return self._json(200, {'poles': d.get('poles', []), 'diperbarui': d.get('diperbarui', 0)})
        # sajikan file aplikasi
        rel = self.path.split('?')[0]
        if rel == '/':
            rel = '/index.html'
        f = os.path.normpath(os.path.join(DIR_APP, rel.lstrip('/')))
        if not f.startswith(DIR_APP) or os.sep + 'server' + os.sep in f or '.git' in f:
            self.send_response(403); self.end_headers(); return
        try:
            with open(f, 'rb') as h:
                isi = h.read()
            self.send_response(200)
            self.send_header('Content-Type', MIME.get(os.path.splitext(f)[1], 'application/octet-stream'))
            self.send_header('Content-Length', str(len(isi)))
            self.end_headers()
            self.wfile.write(isi)
        except OSError:
            self.send_response(404); self.end_headers()

    def do_POST(self):
        if not self.path.startswith('/api/sync'):
            return self._json(404, {'error': 'endpoint tidak dikenal'})
        kode = self.headers.get('X-Kode-Unit', '')
        if not kode_valid(kode):
            return self._json(401, {'error': 'kode unit tidak valid'})
        panjang = int(self.headers.get('Content-Length', 0))
        if panjang > 100 * 1024 * 1024:
            return self._json(413, {'error': 'data terlalu besar'})
        try:
            masuk = json.loads(self.rfile.read(panjang))
            lama = baca_unit(kode)
            poles, baru, diperbarui = gabung(lama.get('poles', []), masuk.get('poles'))
            tulis_unit(kode, {'poles': poles, 'diperbarui': int(time.time() * 1000)})
            print(f"[sync] {kode}: +{baru} baru, {diperbarui} diperbarui, total {len(poles)}")
            self._json(200, {'total': len(poles), 'baru': baru, 'diperbarui': diperbarui})
        except (ValueError, KeyError):
            self._json(400, {'error': 'JSON tidak valid'})

    def log_message(self, *args):
        pass  # senyap


if __name__ == '__main__':
    print('============================================')
    print(f'  CAKRA SERVER (Python) di port {PORT}')
    print(f'  Aplikasi : http://<ip-komputer-ini>:{PORT}/')
    print(f'  Dasbor   : http://<ip-komputer-ini>:{PORT}/dasbor.html')
    print(f'  Data     : {DIR_DATA}')
    print('============================================')
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
