#!/usr/bin/env node
/**
 * Ghost mannequin / packshot ÜRÜN görselleri (ön + arka) — Unsplash'in herkese açık arama uç
 * noktasından. scripts/fetch-mock-media.py ile aynı yaklaşım (aynı uç nokta, curl User-Agent'ı,
 * premium/plus eleme, raw URL + ?w=&h=&fit=crop&crop=entropy indirme şablonu), Node ile yazıldı
 * (bu makinede python3 Xcode lisans hatası verebiliyor). Node 22+ (global fetch) gerekir.
 *
 * İki aşama:
 *   node scripts/fetch-ghost-media.mjs            → ADAY havuzu: her kategori için çok sayıda
 *        sorgu × sayfa taranır, adaylar src/ DIŞINDA bir sahne klasörüne küçük önizleme olarak
 *        (nihai kırpmayla aynı 3:4 oran, crop=entropy) iner, manifest.json yazılır. Adaylar
 *        elle / gözle doğrulanır (insan, koyu/dokulu fon, askı, flat-lay, kategori dışı → red).
 *   node scripts/fetch-ghost-media.mjs --apply    → aşağıdaki PICKS tablosundaki kabul edilmiş
 *        fotoğrafları 900×1200 olarak src/assets/media/urun-NN-{on,arka}.jpg adlarına indirir ve
 *        CREDITS.md'de yalnızca o satırları günceller.
 *
 * Sahne klasörü: GHOST_STAGE_DIR ortam değişkeni ya da işletim sisteminin geçici klasörü.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(__dirname)
const MEDIA_DIR = path.join(ROOT, 'src', 'assets', 'media')
const CREDITS_PATH = path.join(MEDIA_DIR, 'CREDITS.md')
const STAGE_DIR = process.env.GHOST_STAGE_DIR || path.join(os.tmpdir(), 'ghost-media-stage')
const APPLY = process.argv.includes('--apply')
const W = 900
const H = 1200

// Unsplash'in herkese açık arama uç noktası tarayıcı UA'larını reddediyor (401); curl UA'sı kabul ediliyor.
const UA = { Accept: 'application/json', 'User-Agent': 'curl/8.7.1' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Metadata ön filtresi (yalnızca alt_description, kelime sınırlı): insan / askı / aksesuar anlatanları ele. */
const BANNED_RE =
  /\b(woman|women|girl|girls|man|men|boy|lady|person|people|child|kid|bride|wearing|wears|worn|model|poses?|posing|standing|sitting|walking|holding|hands?|legs?|face|hanger|hangers|hangs?|hanging|hanged|rack|flat ?lay|shoes?|sneakers?|boots?|heels?|sandals?|bag|purse|sketch|drawing|illustration|watercolor|window|store|shop|mockups?)\b/i
/** Kategori sınıflandırması (alt_description anahtar kelimesinden). Sıra önemli: ilk eşleşen kazanır. */
const CATEGORY_RE = [
  ['takim', /\b(suit|pantsuit|blazer|tuxedo|two[- ]piece|co-?ord)\b/i],
  ['dis', /\b(coat|jacket|trench|parka|overcoat|cape|poncho)\b/i],
  ['elbise', /\b(dress|gown|jumpsuit)\b/i],
  ['alt', /\b(skirt|pants|trousers|jeans|shorts|culottes|leggings)\b/i],
  ['ust', /\b(shirt|t-shirt|blouse|top|tank top|camisole|sweater|cardigan|pullover|hoodie|sweatshirt|knit|tee|polo|bodysuit|vest)\b/i],
]
/** "Packshot" işareti: bu ifadeleri taşıyan isabetler BFS tohumu olur (related + fotoğrafçı portföyü). */
const SEED_RE = /(white|light|plain|grey|gray|neutral) (background|backdrop|surface|wall)|mannequin|dress form|isolated/i

const QUERIES = [
  'ghost mannequin', 'invisible mannequin', 'dress isolated white background', 'dress product photo white background',
  'dress on white background', 'dress on mannequin white background', 'blouse white background product',
  'shirt on white background', 'shirt packshot', 'top on white background', 'sweater on white background',
  'trousers white background product photo', 'pants on white background', 'skirt isolated white background',
  'skirt on white background', 'jeans on white background', 'coat isolated white background', 'coat on white background',
  'jacket packshot white background', 'jacket on white background', 'blazer on white background',
  'suit on mannequin', 'blazer on mannequin', 'clothing product photography studio white', 'apparel product photography',
  // Unsplash'in otomatik alt metin kalıbıyla ("a … on a white background") eşleşen sorgular daha verimli.
  'a dress on a white background', 'black dress on a white background', 'white dress on a white background',
  'a blouse on a white background', 'a shirt on a white background', 'a sweater on a white background',
  'a skirt on a white background', 'trousers on a white background', 'a pair of jeans on a white background',
  'a coat on a white background', 'a jacket on a white background', 'a blazer on a white background',
  'a suit jacket on a white background', 'dress on a mannequin', 'dress on dress form', 'garment on mannequin studio',
]
const SEARCH_PAGES = 8
const BFS_LIMIT = Number(process.env.GHOST_BFS_LIMIT || 120)

function classify(item) {
  const alt = item.alt_description || ''
  if (!alt || BANNED_RE.test(alt)) return null
  for (const [cat, re] of CATEGORY_RE) if (re.test(alt)) return cat
  return null
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.json()
}

function imageUrl(rawBase, w, h) {
  return `${rawBase}?w=${w}&h=${h}&fit=crop&crop=entropy&q=72&fm=jpg&auto=format`
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA['User-Agent'] } })
  if (!res.ok) throw new Error(`indirme HTTP ${res.status}`)
  if (!(res.headers.get('content-type') || '').startsWith('image/')) throw new Error('görsel değil')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1000) throw new Error(`çok küçük (${buf.length} bayt)`)
  fs.writeFileSync(dest, buf)
}

async function stageMode() {
  fs.mkdirSync(STAGE_DIR, { recursive: true })
  const seen = new Set()
  const hits = new Map() // id -> { item, cat, via }
  const seeds = []
  const seenUsers = new Set()
  const consider = (item, via) => {
    if (!item?.id || seen.has(item.id)) return
    seen.add(item.id)
    const raw = item.urls?.raw ?? ''
    if (!raw.includes('images.unsplash.com') || item.premium || item.plus) return
    const cat = classify(item)
    if (!cat) return
    hits.set(item.id, { item, cat, via })
    if (SEED_RE.test(item.alt_description || '')) seeds.push(item)
  }

  // 1) Anahtar kelime aramaları (napi sayfa başına ~15-20 sonuç döndürür; boş sayfaya / total_pages'e kadar).
  for (const q of QUERIES) {
    for (let page = 1; page <= SEARCH_PAGES; page++) {
      let data
      try {
        data = await fetchJson(`https://unsplash.com/napi/search/photos?query=${encodeURIComponent(q)}&per_page=30&page=${page}`)
      } catch (e) {
        console.error('arama hatası', q, page, e.message)
        break
      }
      for (const it of data.results ?? []) consider(it, `q:${q}`)
      if (!data.results?.length || page >= (data.total_pages ?? 1)) break
      await sleep(300)
    }
  }
  console.error(`arama: ${hits.size} isabet, ${seeds.length} tohum`)

  // 2) Tohumlardan genişleme: benzer fotoğraflar + aynı fotoğrafçının portföyü (ön/arka çift ihtimali).
  let expanded = 0
  while (seeds.length && expanded < BFS_LIMIT) {
    const s = seeds.shift()
    expanded++
    try {
      const rel = await fetchJson(`https://unsplash.com/napi/photos/${s.id}/related`)
      for (const it of rel.results ?? []) consider(it, `related:${s.id}`)
    } catch (e) {
      console.error('related hatası', s.id, e.message)
    }
    const u = s.user?.username
    if (u && !seenUsers.has(u)) {
      seenUsers.add(u)
      for (let page = 1; page <= 3; page++) {
        try {
          const list = await fetchJson(`https://unsplash.com/napi/users/${encodeURIComponent(u)}/photos?per_page=30&page=${page}`)
          const arr = Array.isArray(list) ? list : list.results ?? []
          for (const it of arr) consider(it, `user:${u}`)
          if (arr.length < 30) break
        } catch (e) {
          console.error('portföy hatası', u, e.message)
          break
        }
      }
    }
    await sleep(300)
  }
  console.error(`genişleme: ${expanded} tohum işlendi, toplam ${hits.size} isabet`)

  // 3) Önizlemeleri nihai kırpmayla aynı 3:4 oranda indir.
  const manifest = []
  for (const { item, cat, via } of hits.values()) {
    const rawBase = item.urls.raw.split('?')[0]
    const file = `${cat}-${item.id}.jpg`
    const dest = path.join(STAGE_DIR, file)
    if (!fs.existsSync(dest)) {
      try {
        await download(imageUrl(rawBase, 300, 400), dest)
      } catch (e) {
        console.error('önizleme indirilemedi', item.id, e.message)
        continue
      }
      await sleep(120)
    }
    manifest.push({
      file, category: cat, id: item.id, via, rawBase,
      alt: item.alt_description || '',
      username: item.user?.username || '',
      author: item.user?.name || '?',
      authorProfile: item.user?.links?.html || '',
      photoLink: item.links?.html || `https://unsplash.com/photos/${item.id}`,
    })
  }
  fs.writeFileSync(path.join(STAGE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.error(`tamam: ${manifest.length} aday -> ${STAGE_DIR}`)
}

/**
 * Görsel doğrulamadan geçen seçimler. Anahtar: hedef dosya adı (uzantısız).
 * Değer: [unsplash foto id, raw taban URL, fotoğrafçı adı, fotoğrafçı profili, foto bağlantısı]
 */
const PICKS = {
  "urun-02-on": ["wkcZ5BPFyAk", "https://images.unsplash.com/photo-1666358054407-9ea933dadf41", "Or Hakim", "https://unsplash.com/@orhakim", "https://unsplash.com/photos/wkcZ5BPFyAk"],
  "urun-02-arka": ["SGWunndRloY", "https://images.unsplash.com/photo-1666358059751-3accf39c2d95", "Or Hakim", "https://unsplash.com/@orhakim", "https://unsplash.com/photos/SGWunndRloY"],
  "urun-03-on": ["9yoXrG6Er_g", "https://images.unsplash.com/photo-1714143136372-ddaf8b606da7", "TuanAnh Blue", "https://unsplash.com/@blueeyeaa", "https://unsplash.com/photos/9yoXrG6Er_g"],
  "urun-03-arka": ["UinXCaBz44A", "https://images.unsplash.com/photo-1714143136367-7bb68f3f0669", "TuanAnh Blue", "https://unsplash.com/@blueeyeaa", "https://unsplash.com/photos/UinXCaBz44A"],
}

async function applyMode() {
  const entries = Object.entries(PICKS)
  if (!entries.length) {
    console.error('PICKS boş — önce aday aşamasını çalıştırıp görsel doğrulama yapın.')
    process.exit(1)
  }
  const ids = entries.map(([, p]) => p[0])
  if (new Set(ids).size !== ids.length) throw new Error('aynı fotoğraf iki kez seçilmiş')
  const done = []
  for (const [slot, [id, rawBase, author, profile, link]] of entries) {
    const dest = path.join(MEDIA_DIR, `${slot}.jpg`)
    const tmp = `${dest}.tmp`
    try {
      await download(imageUrl(rawBase, W, H), tmp)
      fs.renameSync(tmp, dest)
    } catch (e) {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
      console.error('ATLANDI (eski dosya korunuyor)', slot, id, e.message)
      continue
    }
    done.push({ slot, author, profile, link })
    console.error('yazıldı', slot, id)
    await sleep(200)
  }
  const lines = fs.readFileSync(CREDITS_PATH, 'utf8').split('\n')
  for (const r of done) {
    const cell = `\`${r.slot}.jpg\``
    const row = `| ${cell} | ${r.author} | ${r.profile} | ${r.link} |`
    const i = lines.findIndex((l) => l.startsWith(`| ${cell} `))
    if (i >= 0) lines[i] = row
    else {
      const last = lines.reduce((acc, l, k) => (l.startsWith('| `') ? k : acc), -1)
      lines.splice(last + 1, 0, row)
    }
  }
  fs.writeFileSync(CREDITS_PATH, lines.join('\n'))
  console.error(`tamam: ${done.length}/${entries.length} dosya yazıldı, CREDITS.md güncellendi`)
}

await (APPLY ? applyMode() : stageMode())
