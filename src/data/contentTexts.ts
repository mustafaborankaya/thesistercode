/**
 * İÇERİK METİNLERİ
 * src/data/content.ts içindeki alanlar için hazırlanmış profesyonel Türkçe metinler.
 * Öncelik sırası (bkz. content.ts → field()): yönetici paneli override'ı > buradaki metin > null (alan adı).
 *
 * Uydurma bilgi yasağı: şirket unvanı, adres, telefon, vergi no, kargo firması adı ve ücret tutarı gibi
 * gerçek işletme bilgileri BURADA YER ALMAZ. Bu alanlar (brand.companyName, brand.address, brand.phone,
 * brand.email) contentTexts'e dahil edilmemiştir; content.ts'te panel override'ı yoksa "içerik eklenecek"
 * olarak görünmeye devam eder. Yasal metinlerdeki [Şirket unvanı] / [Adres] / [E-posta] köşeli parantezli
 * ifadeler, marka bu bilgileri sağladığında doldurulacak yer tutuculardır.
 *
 * NOT: Bu dosyadaki hukuki nitelikli metinler (gizlilik, aydınlatma, çerez politikası, mesafeli satış
 * sözleşmesi, kullanım koşulları) şablon niteliğindedir; yayına alınmadan önce hukuk danışmanı
 * incelemesinden geçirilmelidir.
 */

/** Beden ölçü tablosu — sizeGuide ve beden-rehberi bilgi sayfasında birebir aynı metin kullanılır. */
const SIZE_TABLE = [
  'Ölçüler santimetre cinsindendir; modele göre küçük farklar olabilir.',
  'XS: Göğüs 80–84 cm · Bel 62–66 cm · Kalça 86–90 cm',
  'S: Göğüs 84–88 cm · Bel 66–70 cm · Kalça 90–94 cm',
  'M: Göğüs 88–92 cm · Bel 70–74 cm · Kalça 94–98 cm',
  'L: Göğüs 92–98 cm · Bel 74–80 cm · Kalça 98–104 cm',
  'XL: Göğüs 98–104 cm · Bel 80–86 cm · Kalça 104–110 cm',
].join('\n')

/** Ölçü alma açıklaması — sizeGuide ve beden-rehberi bilgi sayfasında birebir aynı metin kullanılır. */
const SIZE_NOTE = [
  'Doğru bedeni seçebilmeniz için ölçülerinizi ince bir mezura ile, ince bir kıyafetle üzerinizdeyken almanızı öneririz.',
  'Göğüs ölçüsü göğsün en geniş noktasından, bel ölçüsü belin en ince noktasından, kalça ölçüsü ise kalçanın en geniş noktasından alınır.',
  'Ölçtüğünüz değerleri yukarıdaki tabloyla karşılaştırarak size en uygun bedeni belirleyebilirsiniz.',
  'İki beden arasında kaldığınızda, ürünün kesimine göre bir beden büyüğünü tercih etmenizi öneririz.',
].join(' ')

/** Kargo ücreti bilgisi — teslimat sayfası ve SSS'de aynı ifade kullanılır (uydurma tutar yok). */
const SHIPPING_FEE_TEXT =
  'Kargo ücreti ödeme adımında gösterilir. Belirli kampanya dönemlerinde geçerli olan ücretsiz kargo koşulları, ilgili kampanya süresince sitede ayrıca duyurulur.'

/** Teslimat süresi bilgisi — teslimat sayfasında ve SSS'de tutarlı biçimde kullanılır. */
const DELIVERY_TIME_TEXT =
  'Siparişleriniz onaylandıktan sonra 1–3 iş günü içinde kargoya teslim edilir. Kargoya verilen siparişler, kargo firmasına ve teslimat bölgesine göre değişmekle birlikte ortalama 1–4 iş günü içinde adresinize ulaşır. Yoğun kampanya dönemlerinde bu süreler kısa süreli olarak uzayabilir.'

export const contentTexts: Record<string, string> = {
  // --- Marka ---
  'brand.collectionTitle': 'Sonbahar / Kış 2026 Koleksiyonu',
  'brand.collectionIntro':
    'Bu sonbahar-kış sezonunda Teshvikiye, günün her anına eşlik eden sade ve zamansız parçaları bir araya getiriyor. Yumuşak dokular, dengeli kesimler ve nötr bir renk paleti, kışın soğuğuna hazırlanırken şıklıktan ödün vermek istemeyenler için tasarlandı. Koleksiyondaki her parça, gardırobunuzda uzun süre yer bulacak şekilde düşünüldü.',
  'brand.workingHours': 'Hafta içi 09.00 – 18.00 saatleri arasında hizmetinizdeyiz.',
  // brand.companyName / brand.address / brand.phone / brand.email: gerçek işletme bilgisi gerektirdiği için
  // burada TANIMLANMAMIŞTIR — bkz. rapor: "marka tarafından doldurulacak".

  // --- Çerez ---
  'cookie.bannerText':
    'Bu internet sitesinde deneyiminizi iyileştirmek amacıyla çerezler kullanılmaktadır. Gerekli çerezler dışındaki çerezler yalnızca onayınızla etkinleştirilir; tercihlerinizi dilediğiniz zaman değiştirebilirsiniz.',
  'cookie.necessary': 'Sitenin temel işlevlerini, oturumunuzu ve sepetinizi çalışır tutmak için gereklidir; bu nedenle devre dışı bırakılamaz.',
  'cookie.analytics': 'Site kullanımını anonim biçimde analiz ederek deneyimi geliştirmemize yardımcı olur; yalnızca onayınızla etkinleştirilir.',
  'cookie.marketing': 'İlginizi çekebilecek içerik ve kampanyaları size özel sunmak için kullanılır; yalnızca onayınızla etkinleştirilir.',

  // --- Üretim ---
  'production.intro':
    'Her parça, tasarım aşamasından kalite kontrolüne kadar özenle takip edilen bir süreçten geçer. Kumaş seçimi, kesim ve dikim adımlarında gösterilen özen, ürünün son haline doğrudan yansır. Böylece elinize ulaşan her parçanın hem duruşundan hem de dokusundan emin olabilirsiniz.',
  'production.kesim.title': 'Özenli Kesim',
  'production.kesim.text':
    'Kumaşlar, kalıba en uygun şekilde yerleştirilerek dikkatle kesilir. Bu aşamada gösterilen özen, parçanın nihai duruşunu ve kalitesini doğrudan etkiler.',
  'production.dikim.title': 'Titiz Dikim',
  'production.dikim.text':
    'Kesilen parçalar, deneyimli ellerde adım adım birleştirilir. Dikiş kalitesi, ürünün hem görünümünü hem de dayanıklılığını belirleyen en önemli unsurlardan biridir.',
  'production.kalite.title': 'Kalite Kontrolü',
  'production.kalite.text':
    'Her ürün, sevkiyat öncesinde dikiş, kumaş ve ölçü standartları açısından tek tek kontrol edilir. Beklentileri karşılamayan parçalar koleksiyona dahil edilmez.',

  // --- Beden Rehberi ---
  'sizeGuide.table': SIZE_TABLE,
  'sizeGuide.note': SIZE_NOTE,
}

export const infoSectionTexts: Record<string, string[]> = {
  hakkimizda: [
    "Teshvikiye ismini, İstanbul'un uzun yıllardır moda ve zarafetle anılan semti Teşvikiye'den alır. Bu isim, markanın sade ve şık duruşuna ilham veren bir referans noktasıdır. Teşvikiye, günlük hayatın temposuna uyum sağlayan, aynı zamanda özenli bir işçilikle üretilen kadın giyim parçaları sunar. Koleksiyonlar hazırlanırken kısa ömürlü trendler yerine uzun süre giyilebilecek tasarımlar ön planda tutulur. Amacımız, her kadının kendi tarzını rahatça yansıtabileceği bir gardırop sunmaktır.",
    'Tasarım sürecimizde sade çizgiler ve dengeli kesimler öncelik taşır. Kaliteli kumaşlar seçilerek hem konfor hem de dayanıklılık bir arada gözetilir. Renk paletimiz, birbiriyle kolayca kombinlenebilen ve zamana direnen tonlardan oluşur. Bu yaklaşım sayesinde ortaya çıkan parçalar, sezon değişse de gardırobunuzda yerini korur.',
  ],

  teslimat: [
    DELIVERY_TIME_TEXT,
    SHIPPING_FEE_TEXT,
    'Siparişleriniz Türkiye genelindeki tüm adreslere teslim edilir. Yurt dışına teslimat talepleriniz için lütfen iletişim kanallarımız üzerinden bizimle irtibata geçin.',
  ],

  'iade-degisim': [
    "Mesafeli Sözleşmeler Yönetmeliği kapsamında, ürünü teslim aldığınız tarihten itibaren 14 gün içinde herhangi bir gerekçe göstermeksizin cayma hakkınızı kullanabilirsiniz. İade edilecek ürünün kullanılmamış, yıkanmamış ve orijinal etiketleri üzerinde olacak şekilde gönderilmesi gerekir. Bu koşulları taşımayan ürünler için iade kabul edilmeyebilir.",
    "Satın aldığınız üründe beden veya renk değişikliği talep etmeniz halinde, ürün iade koşullarını taşıması kaydıyla değişim işlemi başlatılabilir. Değişim talebiniz stok durumuna göre değerlendirilir; talep edilen alternatif üründe stok bulunmaması durumunda iade sürecine yönlendirilirsiniz.",
    [
      '1. Hesabım bölümündeki Siparişlerim sayfasından ilgili siparişi seçip iade veya değişim talebi oluşturun.',
      '2. Ürünü orijinal ambalajı ve etiketleriyle birlikte paketleyin.',
      '3. Size iletilen kargo bilgileriyle ürünü gönderime verin.',
      '4. Ürün tarafımıza ulaştıktan ve kontrolden geçtikten sonra iade tutarı ödeme yönteminize aktarılır.',
    ].join('\n'),
  ],

  'beden-rehberi': [SIZE_TABLE, SIZE_NOTE],

  sss: [
    [
      'S: Siparişimi nasıl takip edebilirim?',
      'C: Sipariş durumunuzu Hesabım bölümündeki Siparişlerim sayfasından takip edebilirsiniz.',
      'S: Sipariş verdikten sonra ürün veya beden değişikliği yapabilir miyim?',
      'C: Sipariş kargoya verilmeden önce değişiklik talebiniz için destek ekibimizle iletişime geçebilirsiniz.',
      'S: Siparişimi iptal edebilir miyim?',
      'C: Kargoya verilmemiş siparişler için Hesabım bölümündeki Siparişlerim üzerinden iptal talebi oluşturabilirsiniz.',
    ].join('\n'),
    [
      'S: Siparişim ne zaman elime ulaşır?',
      'C: Siparişler onaylandıktan sonra 1–3 iş günü içinde kargoya verilir; teslimat süresi kargo firmasına ve bölgeye göre değişmekle birlikte ortalama 1–4 iş günü sürer.',
      'S: Kargo ücreti ne kadar?',
      'C: Kargo ücreti ödeme adımında gösterilir; ücretsiz kargo koşulları kampanya dönemlerinde duyurulur.',
      'S: Yurt dışına teslimat yapıyor musunuz?',
      'C: Yurt dışı teslimat talepleriniz için iletişim kanallarımız üzerinden bize ulaşabilirsiniz.',
    ].join('\n'),
    [
      'S: Ürünü kaç gün içinde iade edebilirim?',
      'C: Teslim aldığınız tarihten itibaren 14 gün içinde cayma hakkınızı kullanarak iade edebilirsiniz.',
      'S: İade ettiğim ürünün bedelini ne zaman geri alırım?',
      'C: Ürün elimize ulaşıp kontrolden geçtikten sonra iade tutarı ödeme yönteminize aktarılır.',
      'S: Etiketi çıkarılmış ürünü iade edebilir miyim?',
      'C: İade için ürünün kullanılmamış olması ve orijinal etiketlerinin üzerinde bulunması gerekir.',
    ].join('\n'),
    [
      'S: Üyelik indirimi nasıl uygulanır?',
      'C: Hesap oluşturduğunuzda %10 üyelik indirimi sepetinizde otomatik olarak uygulanır.',
      'S: Üyelik indiriminin bir kullanım şartı var mı?',
      'C: Kampanya koşulları zaman zaman güncellenebilir; güncel koşullar sitede belirtilir.',
      'S: Üye olmadan alışveriş yapabilir miyim?',
      'C: Evet, misafir olarak da sipariş verebilirsiniz; üyelik indiriminden yararlanmak için ise hesap oluşturmanız gerekir.',
    ].join('\n'),
  ],

  gizlilik: [
    '[Şirket unvanı] olarak kişisel verilerinizin güvenliğine önem veriyoruz. Bu gizlilik politikası, sitemizi kullanırken elde edilen kişisel verilerin hangi amaçlarla işlendiğini, nasıl saklandığını ve haklarınızın neler olduğunu açıklamak amacıyla hazırlanmıştır. Sipariş, üyelik ve iletişim süreçlerinde ad-soyad, adres, telefon, e-posta ve sipariş bilgileriniz gibi veriler; siparişlerinizin işlenmesi, müşteri hizmetlerinin sağlanması ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir. Verileriniz, işlenme amacının gerektirdiği süre boyunca ve ilgili mevzuatta öngörülen saklama süreleri çerçevesinde saklanır. 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında; verilerinize erişme, düzeltilmesini talep etme, silinmesini isteme ve işlenmesine itiraz etme gibi haklara sahipsiniz. Bu haklarınızı kullanmak için [E-posta] adresi üzerinden bizimle iletişime geçebilirsiniz.',
    [
      'Veri Sorumlusunun Kimliği',
      '6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca veri sorumlusu sıfatıyla [Şirket unvanı], [Adres] adresinde faaliyet göstermektedir.',
      '',
      'İşlenen Kişisel Veriler ve İşlenme Amaçları',
      'Ad-soyad, iletişim bilgileri, teslimat adresi ve sipariş bilgileriniz; siparişlerinizin oluşturulması, teslimatın sağlanması, müşteri hizmetleri sunulması ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işlenir.',
      '',
      'Kişisel Verilerin Aktarılması',
      'Kişisel verileriniz; kargo ve ödeme süreçlerinin yürütülmesi ile yasal yükümlülüklerin karşılanması gibi meşru amaçlarla, gerekli güvenlik tedbirleri alınarak hizmet aldığımız iş ortaklarıyla sınırlı biçimde paylaşılabilir.',
      '',
      'Kişisel Veri Toplamanın Yöntemi ve Hukuki Sebebi',
      'Verileriniz, sitemiz üzerinden gerçekleştirdiğiniz işlemler sırasında elektronik ortamda; sözleşmenin kurulması ve ifası ile hukuki yükümlülüğün yerine getirilmesi hukuki sebeplerine dayanılarak toplanır.',
      '',
      'Haklarınız',
      'Kanunun 11. maddesi uyarınca kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, düzeltilmesini veya silinmesini isteme haklarına sahipsiniz. Taleplerinizi [E-posta] adresine iletebilirsiniz.',
    ].join('\n'),
  ],

  'cerez-politikasi': [
    [
      'Çerezler, ziyaret ettiğiniz internet siteleri tarafından tarayıcınıza kaydedilen küçük metin dosyalarıdır. Bu dosyalar, sitenin düzgün çalışmasını sağlamak, tercihlerinizi hatırlamak ve deneyiminizi iyileştirmek amacıyla kullanılır.',
      '',
      'Sitemizde üç kategori çerez kullanılır. Gerekli çerezler; oturumunuzun, sepetinizin ve çerez tercihinizin saklanması için zorunludur ve kapatılamaz. Analitik çerezler; site kullanımını anonim biçimde ölçerek deneyimi geliştirmemize yardımcı olur ve yalnızca onayınızla etkinleştirilir. Pazarlama çerezleri; ilginizi çekebilecek içerik ve kampanyaları size özel sunmak için kullanılır ve yalnızca onayınızla etkinleştirilir.',
      '',
      'Çerez tercihlerinizi dilediğiniz zaman değiştirebilirsiniz. Bunun için sayfanın alt kısmındaki "Çerez Tercihleri" bağlantısını kullanabilir, ayrıca tarayıcınızın ayarlarından çerezleri yönetebilir veya silebilirsiniz. Tarayıcı ayarlarından çerezleri tamamen devre dışı bırakmanız halinde sitenin bazı bölümleri beklendiği gibi çalışmayabilir.',
      '',
      'Çerezler, türlerine göre farklı sürelerde saklanır; oturum çerezleri tarayıcınızı kapattığınızda silinirken, kalıcı çerezler önceden belirlenmiş bir süre boyunca veya siz silene kadar cihazınızda kalır.',
      '',
      'Çerez politikamızla ilgili sorularınız için [E-posta] adresinden bizimle iletişime geçebilirsiniz.',
    ].join('\n'),
  ],

  'alisveris-kosullari': [
    'Bu metin, [Şirket unvanı] ("Satıcı") ile sitemiz üzerinden alışveriş yapan müşteri ("Alıcı") arasında kurulan mesafeli satış sözleşmesinin genel esaslarını özetler. Sözleşmenin konusunu, Alıcı\'nın sitemiz üzerinden elektronik ortamda sipariş verdiği ürünün satışı ve teslimi oluşturur. Alıcı, 14 gün içinde herhangi bir gerekçe göstermeksizin cayma hakkını kullanabilir; cayma hakkına ilişkin ayrıntılar İade ve Değişim sayfamızda yer alır. Sözleşmenin uygulanmasından doğabilecek uyuşmazlıklarda, değeri Ticaret Bakanlığınca ilan edilen parasal sınırlar dahilinde Tüketici Hakem Heyetleri, bu sınırların üzerindeki uyuşmazlıklarda ise Tüketici Mahkemeleri yetkilidir.',
    "Bu siteyi kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız. Sitedeki ürün görselleri, açıklamaları ve fiyat bilgileri tanıtım amaçlıdır; olası yazım ve sistem hatalarından doğabilecek farklılıklar için sitedeki güncel bilgiler esas alınır. Hesabınızla gerçekleştirdiğiniz tüm işlemlerden ve hesap bilgilerinizin gizliliğinin korunmasından siz sorumlusunuz. Site içeriğinin (metin, görsel, tasarım) izinsiz kopyalanması veya çoğaltılması yasaktır.",
  ],
}
