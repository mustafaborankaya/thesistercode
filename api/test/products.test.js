/**
 * Ürün yönetimi: zod şemaları (renk id biçimi, 20 renk sınırı, etiket uzunluğu, ürün id biçimi) ve
 * `deleteProduct` (yalnızca PRODUCTS_DB_TEST=1 ile — gerçek bir MariaDB/MySQL gerekir; migration'lar
 * uygulanmış olmalı. Örn. Docker test DB'si:
 *   PRODUCTS_DB_TEST=1 DB_HOST=127.0.0.1 DB_PORT=3307 DB_NAME=tsc_test DB_USER=tsc DB_PASSWORD=tscpass node --test test/products.test.js
 * ).
 *   cd api && node --test test/
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

process.env.DB_HOST ??= '127.0.0.1'
process.env.DB_NAME ??= 'x'
process.env.DB_USER ??= 'x'
process.env.SESSION_SECRET ??= 'test-secret-0123456789abcdef'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'adminpass123'
process.env.UPLOAD_DIR ??= await fsp.mkdtemp(path.join(os.tmpdir(), 'tsc-products-test-'))
process.env.UPLOAD_PUBLIC_BASE ??= '/uploads'
process.env.CORS_ORIGIN ??= 'http://localhost:5173'

const { colorSchema, createSchema, updateSchema, PRODUCT_ID_RE, COLOR_ID_RE, MAX_COLORS } = await import('../src/routes/admin-products.js')

const color = (i) => ({ id: `renk-${i}`, label: `Renk ${i}` })

test('colorSchema: id yalnızca [a-z0-9-]{1,32}; etiket 1–64', () => {
  assert.ok(colorSchema.safeParse({ id: 'renk-1', label: 'Siyah' }).success)
  assert.ok(colorSchema.safeParse({ id: 'renk-20', label: 'Lacivert', labelEn: 'Navy' }).success)
  assert.ok(!colorSchema.safeParse({ id: 'Renk-1', label: 'Siyah' }).success, 'büyük harf reddedilir')
  assert.ok(!colorSchema.safeParse({ id: 'renk_1', label: 'Siyah' }).success, 'alt çizgi reddedilir')
  assert.ok(!colorSchema.safeParse({ id: '', label: 'Siyah' }).success, 'boş id reddedilir')
  assert.ok(!colorSchema.safeParse({ id: 'a'.repeat(33), label: 'Siyah' }).success, '33 karakter reddedilir')
  assert.ok(colorSchema.safeParse({ id: 'a'.repeat(32), label: 'Siyah' }).success, '32 karakter kabul edilir')
  assert.ok(!colorSchema.safeParse({ id: 'renk-1', label: '' }).success, 'boş etiket reddedilir')
  assert.ok(!colorSchema.safeParse({ id: 'renk-1', label: 'x'.repeat(65) }).success, '65 karakterlik etiket reddedilir')
  assert.ok(colorSchema.safeParse({ id: 'renk-1', label: 'x'.repeat(64) }).success)
  assert.equal(COLOR_ID_RE.source, '^[a-z0-9-]{1,32}$')
})

test('updateSchema/createSchema: en az 1 (güncelleme), en fazla 20 renk', () => {
  assert.equal(MAX_COLORS, 20)
  const twenty = Array.from({ length: 20 }, (_, i) => color(i + 1))
  assert.ok(updateSchema.safeParse({ colors: twenty }).success)
  assert.ok(!updateSchema.safeParse({ colors: [...twenty, color(21)] }).success, '21 renk reddedilir')
  assert.ok(!updateSchema.safeParse({ colors: [] }).success, 'güncellemede boş renk listesi reddedilir')
  assert.ok(createSchema.safeParse({ category: 'elbiseler', price: 100, colors: twenty }).success)
  assert.ok(!createSchema.safeParse({ category: 'elbiseler', price: 100, colors: [...twenty, color(21)] }).success)
  assert.ok(createSchema.safeParse({ category: 'elbiseler', price: 100 }).success, 'oluşturmada renk listesi isteğe bağlı')
  const bad = updateSchema.safeParse({ colors: [{ id: 'RENK 1', label: 'Siyah' }] })
  assert.ok(!bad.success)
  assert.match(bad.error.issues[0].message, /küçük harf/)
})

test('PRODUCT_ID_RE: urun-NN (2–4 basamak)', () => {
  assert.ok(PRODUCT_ID_RE.test('urun-01'))
  assert.ok(PRODUCT_ID_RE.test('urun-1234'))
  assert.ok(!PRODUCT_ID_RE.test('urun-1'))
  assert.ok(!PRODUCT_ID_RE.test('urun-01; DROP'))
  assert.ok(!PRODUCT_ID_RE.test('URUN-01'))
})

/* ---------------- DB'li uçtan uca: deleteProduct ---------------- */

const dbTest = process.env.PRODUCTS_DB_TEST === '1' ? test : test.skip

dbTest('deleteProduct: ilişkiler + cascade + kullanılmayan görsel dosyası silinir; order_items korunur', async () => {
  const { pool } = await import('../src/db.js')
  const { env } = await import('../src/env.js')
  const { createProduct, deleteProduct, updateProduct, getProductById, listProducts } = await import('../src/services/products.js')
  const { ApiError } = await import('../src/errors.js')

  // İki ürün: B, A'ya ilişki verir (A silinince B'nin ilişkisi de temizlenmeli).
  const a = await createProduct({ category: 'elbiseler', price: 10, hidden: true, name: 'TEST-SIL-A', colors: [color(1), color(2)] })
  const b = await createProduct({ category: 'ust-giyim', price: 20, hidden: true, name: 'TEST-SIL-B' })
  try {
    await updateProduct(b.id, { similarProductIds: [a.id], completeLookProductIds: [a.id] })
    // A'ya sahte bir yüklenmiş görsel: dosya UPLOAD_DIR altında, URL UPLOAD_PUBLIC_BASE altında.
    await fsp.mkdir(path.resolve(env.UPLOAD_DIR), { recursive: true })
    const filename = `${a.id}-on-test.jpg`
    const filePath = path.resolve(env.UPLOAD_DIR, filename)
    await fsp.writeFile(filePath, 'x')
    const url = `${env.UPLOAD_PUBLIC_BASE.replace(/\/$/, '')}/${filename}`
    await updateProduct(a.id, { media: { front: url } })
    // Geçmiş sipariş kalemi (FK yok): ürün silinse de kalmalı.
    const orderId = `TEST-SIL-${Date.now()}`
    await pool.query(
      `INSERT INTO orders (id, status, email, phone, first_name, last_name, address, district, city, postal_code, subtotal, total)
       VALUES (?, 'new', 'test@example.com', '0', 'Test', 'Sil', 'adres', 'ilce', 'il', '34000', 10, 10)`,
      [orderId],
    )
    await pool.query('INSERT INTO order_items (order_id, product_id, product_name, color_id, color_label, size, qty, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [orderId, a.id, 'TEST-SIL-A', 'renk-1', 'Renk 1', 'M', 1, 10])

    const result = await deleteProduct(a.id)
    assert.deepEqual(result, { orderItems: 1 })

    assert.equal(await getProductById(a.id), null, 'ürün satırı silindi')
    const [[{ n: colorRows }]] = await pool.query('SELECT COUNT(*) AS n FROM product_colors WHERE product_id = ?', [a.id])
    const [[{ n: stockRows }]] = await pool.query('SELECT COUNT(*) AS n FROM product_stock WHERE product_id = ?', [a.id])
    const [[{ n: mediaRows }]] = await pool.query('SELECT COUNT(*) AS n FROM product_media WHERE product_id = ?', [a.id])
    const [[{ n: relRows }]] = await pool.query('SELECT COUNT(*) AS n FROM product_relations WHERE related_id = ? OR product_id = ?', [a.id, a.id])
    assert.equal(Number(colorRows) + Number(stockRows) + Number(mediaRows) + Number(relRows), 0, 'cascade + related_id temizliği')
    const fresh = await getProductById(b.id)
    assert.equal(fresh.similarProductIds, undefined, "B'nin A'ya verdiği ilişki kalktı")
    const [[{ n: itemRows }]] = await pool.query('SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?', [a.id])
    assert.equal(Number(itemRows), 1, 'sipariş kalemi korunur')
    await assert.rejects(fsp.access(filePath), 'kullanılmayan görsel dosyası silindi')
    assert.ok(!(await listProducts({ includeHidden: true })).some((p) => p.id === a.id))

    await assert.rejects(deleteProduct(a.id), (e) => e instanceof ApiError && e.status === 404, 'ikinci silme 404')

    await pool.query('DELETE FROM orders WHERE id = ?', [orderId])
  } finally {
    await pool.query('DELETE FROM products WHERE id IN (?, ?)', [a.id, b.id])
    await pool.end()
  }
})
