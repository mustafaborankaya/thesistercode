#!/usr/bin/env python3
"""
Geçici MOCK görseller — Unsplash'ten serbest lisanslı (Unsplash License) fotoğraf indirir ve
src/assets/media/ altına marka görsel ad kuralıyla yazar. Unsplash+ (premium) görseller elenir.
Marka fotoğrafları geldiğinde aynı adlarla üzerine yazılır; CREDITS.md kaynak listesini tutar.

Kullanım: python3 scripts/fetch-mock-media.py
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'assets', 'media')
os.makedirs(OUT, exist_ok=True)
# Unsplash'in herkese açık arama uç noktası tarayıcı UA'larını reddediyor; curl/urllib UA'sı kabul ediliyor.
UA = {'Accept': 'application/json', 'User-Agent': 'curl/8.7.1'}
used_ids = set()
credits = []


def search(query, need, orientation=None, pages=3):
    out = []
    for page in range(1, pages + 1):
        url = f'https://unsplash.com/napi/search/photos?query={urllib.parse.quote(query)}&per_page=30&page={page}'
        if orientation:
            url += f'&orientation={orientation}'
        req = urllib.request.Request(url, headers=UA)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.load(r)
        except Exception as e:  # noqa: BLE001
            print('arama hatası', query, page, e, file=sys.stderr)
            break
        for item in data.get('results', []):
            raw = item.get('urls', {}).get('raw', '')
            if 'images.unsplash.com' not in raw or item.get('premium') or item.get('plus'):
                continue
            if item['id'] in used_ids:
                continue
            used_ids.add(item['id'])
            out.append(item)
            if len(out) >= need:
                return out
        time.sleep(0.4)
    return out


def download(item, name, w, h, crop='faces,entropy', q=72):
    base = item['urls']['raw'].split('?')[0]
    url = f'{base}?w={w}&h={h}&fit=crop&crop={crop}&q={q}&fm=jpg&auto=format'
    path = os.path.join(OUT, f'{name}.jpg')
    if os.path.exists(path):
        return
    req = urllib.request.Request(url, headers={'User-Agent': UA['User-Agent']})
    with urllib.request.urlopen(req, timeout=60) as r, open(path, 'wb') as f:
        f.write(r.read())
    user = item.get('user', {})
    credits.append((f'{name}.jpg', user.get('name', '?'), user.get('links', {}).get('html', ''), item.get('links', {}).get('html', '')))
    print('indirildi', name, file=sys.stderr)
    time.sleep(0.25)


def pick(items, i):
    return items[i % len(items)]


# ---- Ürün görselleri: 24 ürün × ön/arka/model + kumaş dokusu ----
front = search('woman dress studio minimal fashion', 24, 'portrait')
back = search('fashion model outfit neutral background', 24, 'portrait')
model = search('woman fashion editorial street style', 24, 'portrait')
fabric = search('fabric texture close up textile', 12, 'squarish')
print(f'bulunan: on={len(front)} arka={len(back)} model={len(model)} kumas={len(fabric)}', file=sys.stderr)

for n in range(1, 25):
    num = f'{n:02d}'
    if front:
        download(pick(front, n - 1), f'urun-{num}-on', 900, 1200)
    if back:
        download(pick(back, n - 1), f'urun-{num}-arka', 900, 1200)
    if model:
        download(pick(model, n - 1), f'urun-{num}-model', 900, 1200)
    if fabric:
        download(pick(fabric, n - 1), f'urun-{num}-kumas', 900, 1200, crop='entropy')

# ---- Marka alanları ----
hero = search('fashion editorial woman black and white', 3, 'landscape')
if hero:
    download(hero[0], 'acilis-masaustu', 1600, 640, crop='faces')
    download(hero[0], 'acilis-mobil', 780, 840, crop='faces')
    if len(hero) > 1:
        download(hero[1], 'koleksiyon', 1600, 1000, crop='faces')
auth = search('woman fashion portrait minimal', 2, 'portrait')
if auth:
    download(auth[0], 'giris', 900, 1200)
cut = search('tailor cutting fabric scissors', 2, 'portrait')
sew = search('sewing machine atelier hands', 2, 'portrait')
qc = search('tailor measuring garment workshop', 2, 'portrait')
for items, name in ((cut, 'uretim-kesim'), (sew, 'uretim-dikim'), (qc, 'uretim-kalite')):
    if items:
        download(items[0], name, 900, 1125, crop='entropy')

# ---- Kaynak listesi ----
with open(os.path.join(OUT, 'CREDITS.md'), 'w', encoding='utf-8') as f:
    f.write('# Geçici mock görseller — kaynak listesi\n\n')
    f.write('Bu klasördeki fotoğraflar **geçici mock** içeriktir; Unsplash License kapsamında, Unsplash\'ten indirilmiştir ')
    f.write('(`scripts/fetch-mock-media.py`). Markanın kendi fotoğrafları geldiğinde aynı dosya adlarıyla üzerine yazılır. ')
    f.write('Marka ürünlerini, gerçek modelleri veya gerçek koleksiyonu temsil etmezler.\n\n')
    f.write('| Dosya | Fotoğrafçı | Profil | Fotoğraf |\n|---|---|---|---|\n')
    for name, author, profile, photo in credits:
        f.write(f'| `{name}` | {author} | {profile} | {photo} |\n')
print(f'tamam: {len(credits)} dosya', file=sys.stderr)
