/**
 * Analitik ve pazarlama servisleri için sınır.
 * Yalnızca kullanıcı ilgili çerez iznini verdiğinde ConsentContext tarafından çağrılır.
 * Gerçek sağlayıcı (ör. ölçüm betiği) bağlanınca bu fonksiyonların içi doldurulur.
 */

let analyticsStarted = false
let marketingStarted = false

export function startAnalytics(): void {
  if (analyticsStarted) return
  analyticsStarted = true
  // Gerçek analitik servisi burada başlatılacak.
}

export function startMarketing(): void {
  if (marketingStarted) return
  marketingStarted = true
  // Gerçek pazarlama servisi burada başlatılacak.
}
