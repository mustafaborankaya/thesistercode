/**
 * İlk ziyaret önizlemesi — yalnızca geliştirme ortamında.
 * `http://localhost:5173/?onizleme=ilk-ziyaret` ile açıldığında çerez ve teklif durumu bellekte tutulur;
 * tarayıcıdaki kayıtlı tercihler, sepet ve hesap OKUNMAZ/YAZILMAZ. Gerçek ziyaretçinin tercihi sıfırlanmaz.
 */
const previewParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('onizleme') : null

export const firstVisitPreview: boolean = import.meta.env.DEV && previewParam === 'ilk-ziyaret'

/**
 * İçerik önizlemesi — yönetici panelindeki "Önizleme" iframe'i mağazayı `?onizleme=icerik` ile açar
 * (üretimde de çalışır). Parametre modül yüklenirken BİR KEZ okunur; sonraki SPA gezinmelerinde
 * sorgu düşse de mod açık kalır. Bu modda:
 * - çerez kararı bellekte "yalnızca gerekli" sayılır (banner gizli; panel isterse gösterilir),
 * - indirim teklifi paneli kendiliğinden açılmaz, ölçüm (analitik) tamamen kapalıdır,
 * - sepet/hesap/favoriler tarayıcı depolamasından OKUNMAZ ve oraya YAZILMAZ,
 * - taslak metinler yalnızca aynı origin'den gelen postMessage ile uygulanır (bkz. ContentPreviewBridge).
 */
export const contentPreview: boolean = previewParam === 'icerik'
