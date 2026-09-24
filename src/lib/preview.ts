/**
 * İlk ziyaret önizlemesi — yalnızca geliştirme ortamında.
 * `http://localhost:5173/?onizleme=ilk-ziyaret` ile açıldığında çerez ve teklif durumu bellekte tutulur;
 * tarayıcıdaki kayıtlı tercihler, sepet ve hesap OKUNMAZ/YAZILMAZ. Gerçek ziyaretçinin tercihi sıfırlanmaz.
 */
export const firstVisitPreview: boolean =
  import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('onizleme') === 'ilk-ziyaret'
