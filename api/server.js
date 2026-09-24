/**
 * Giriş dosyası — Passenger `startup file` olarak bunu çalıştırır.
 * Passenger PORT'u kendisi belirler/yoksayabilir; app.listen bu yüzden PORT ortam değişkenine
 * (yoksa 3000'e) düşer. Top-level await KULLANILMAZ (Passenger bazı kurulumlarda bu dosyayı
 * require() ile yükleyebilir; Node 22'de require edilen bir ESM modülünün import zincirinde TLA
 * bulunması desteklenmez).
 */
import { env } from './src/env.js'
import { createApp } from './src/app.js'

const app = createApp()
const port = process.env.PORT || env.PORT || 3000

app.listen(port, () => {
  console.log(`[api] Teşvikiye API ${env.NODE_ENV} modunda ${port} portunda dinliyor`)
})
