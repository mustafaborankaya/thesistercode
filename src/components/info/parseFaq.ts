/**
 * SSS düz metin ayrıştırıcısı.
 * Panelden/DB'den gelen metin şu biçimdedir (TR `S:`/`C:`, EN `Q:`/`A:`):
 *
 *   S: Siparişimi nasıl takip edebilirim?
 *   C: Hesabım → Siparişlerim sayfasından.
 *   Cevap birden çok satır sürebilir.
 *
 *   S: Sonraki soru?
 *   C: …
 *
 * Kurallar:
 * - Satır başındaki `S:`/`Q:` (büyük/küçük harf fark etmez) yeni bir soru başlatır.
 * - `C:`/`A:` o sorunun cevabını başlatır; sonraki etiketsiz satırlar cevaba eklenir.
 * - Boş satır bölücüdür: cevap içinde yeni paragraf açar.
 * - İlk sorudan önceki etiketsiz metin "giriş paragrafı" olarak döner.
 * - Cevap gelmeden önceki etiketsiz satırlar sorunun devamı sayılır.
 * - Hiç soru bulunamazsa `items` boş döner; çağıran taraf düz metin görünümüne düşer.
 */

export interface FaqItem {
  question: string
  /** Paragraflar; paragraf içindeki tek satır sonları korunur. */
  answer: string[]
}

export interface ParsedFaq {
  intro: string[]
  items: FaqItem[]
}

const Q_RE = /^(?:S|Q)\s*:\s*(.*)$/i
const A_RE = /^(?:C|A)\s*:\s*(.*)$/i

export function parseFaq(text: string | null | undefined): ParsedFaq {
  const intro: string[] = []
  const items: FaqItem[] = []
  if (!text) return { intro, items }

  let current: { question: string; answer: string[]; inAnswer: boolean } | null = null
  let para: string[] = []

  const flush = () => {
    if (!para.length) return
    const joined = para.join('\n').trim()
    para = []
    if (!joined) return
    if (current) current.answer.push(joined)
    else intro.push(joined)
  }
  const close = () => {
    flush()
    if (current && current.question) items.push({ question: current.question, answer: current.answer })
    current = null
  }

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    const q = Q_RE.exec(line)
    if (q) {
      close()
      current = { question: q[1].trim(), answer: [], inAnswer: false }
      continue
    }
    const a = A_RE.exec(line)
    if (a && current) {
      flush()
      current.inAnswer = true
      if (a[1].trim()) para.push(a[1].trim())
      continue
    }
    if (current && !current.inAnswer) {
      // Soru birden fazla satıra taşmış.
      current.question = [current.question, line].filter(Boolean).join(' ')
      continue
    }
    // Cevap satırı ya da (soru yokken) giriş metni; `C:` etiketi sorusuz gelirse giriş sayılır.
    para.push(a && !current ? a[1].trim() || line : line)
  }
  close()

  return { intro, items }
}
