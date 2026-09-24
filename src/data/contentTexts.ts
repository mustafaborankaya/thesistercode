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
      'C: Hesap oluşturduğunuzda ilk siparişinizde %10 indirim sepetinizde otomatik uygulanır; sonraki siparişlerde geçerli değildir.',
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

/* ======================================================================================
 * İNGİLİZCE VARSAYILAN METİNLER (`/en` sitesi)
 * Yukarıdaki Türkçe metinlerin karşılıkları; anahtarlar birebir aynıdır. content.ts EN sitede
 * şu sırayla düşer: API `fieldsEn` > panel EN override'ı > buradaki metin > Türkçe zincir.
 * Aynı kurallar geçerlidir: gerçek işletme bilgisi yok, [Company name] / [Address] / [E-mail]
 * yer tutucuları marka bilgileri gelince doldurulur. Hukuki metinler (privacy notice, cookie policy,
 * distance sales summary, terms of use) şablon niteliğindedir ve Türk mevzuatına (KVKK — Kanun
 * No. 6698, Mesafeli Sözleşmeler Yönetmeliği) atıf yapar; yayına alınmadan önce hukuk danışmanı
 * incelemesinden geçirilmelidir. NOT: Panelde Türkçe metin değiştirildiğinde buradaki İngilizce
 * varsayılan kendiliğinden güncellenmez — panelde EN alanı ayrıca doldurulmalıdır.
 * ====================================================================================== */

const SIZE_TABLE_EN = [
  'Measurements are in centimetres; small variations may occur between styles.',
  'XS: Bust 80–84 cm · Waist 62–66 cm · Hips 86–90 cm',
  'S: Bust 84–88 cm · Waist 66–70 cm · Hips 90–94 cm',
  'M: Bust 88–92 cm · Waist 70–74 cm · Hips 94–98 cm',
  'L: Bust 92–98 cm · Waist 74–80 cm · Hips 98–104 cm',
  'XL: Bust 98–104 cm · Waist 80–86 cm · Hips 104–110 cm',
].join('\n')

const SIZE_NOTE_EN = [
  'To find your size, we recommend measuring yourself with a soft tape measure while wearing light clothing.',
  'Measure your bust at its fullest point, your waist at its narrowest point and your hips at their fullest point.',
  'Compare your measurements with the table above to find the size that suits you best.',
  'If you are between two sizes, we recommend choosing the larger size, depending on the cut of the garment.',
].join(' ')

const SHIPPING_FEE_TEXT_EN =
  'The shipping fee is shown at checkout. Free shipping terms that apply during specific campaign periods are announced separately on the site for the duration of the campaign.'

const DELIVERY_TIME_TEXT_EN =
  'Orders are handed over to the carrier within 1–3 business days of confirmation. Once shipped, orders usually reach you within 1–4 business days, depending on the carrier and the delivery region. These times may be briefly extended during busy campaign periods.'

export const contentTextsEn: Record<string, string> = {
  // --- Brand ---
  'brand.collectionTitle': 'Autumn / Winter 2026 Collection',
  'brand.collectionIntro':
    'This autumn-winter season, Teshvikiye brings together understated, timeless pieces made to accompany every moment of the day. Soft textures, balanced cuts and a neutral palette are designed for those who prepare for the cold without compromising on elegance. Every piece in the collection is conceived to hold its place in your wardrobe for a long time.',
  'brand.workingHours': 'We are here for you on weekdays from 09:00 to 18:00.',
  // brand.companyName / address / phone / email: real business details — intentionally not defined (same as Turkish).

  // --- Cookies ---
  'cookie.bannerText':
    'This website uses cookies to improve your experience. Cookies other than those strictly necessary are only activated with your consent, and you can change your preferences at any time.',
  'cookie.necessary': 'Required to keep the core functions of the site, your session and your cart working; they therefore cannot be turned off.',
  'cookie.analytics': 'Help us improve the experience by analysing site usage anonymously; only activated with your consent.',
  'cookie.marketing': 'Used to offer you content and campaigns that may interest you; only activated with your consent.',

  // --- Production ---
  'production.intro':
    'Every piece goes through a carefully monitored process, from design to quality control. The care taken in choosing the fabric, cutting and sewing is reflected directly in the finished garment, so you can be confident in both the drape and the feel of every piece you receive.',
  'production.kesim.title': 'Careful Cutting',
  'production.kesim.text':
    'Fabrics are laid out to suit the pattern as closely as possible and cut with care. The attention given at this stage directly shapes the final fit and quality of the piece.',
  'production.dikim.title': 'Meticulous Sewing',
  'production.dikim.text':
    'The cut pieces are assembled step by step by experienced hands. Stitch quality is one of the most important factors in both the look and the durability of a garment.',
  'production.kalite.title': 'Quality Control',
  'production.kalite.text':
    'Before dispatch, every garment is checked individually against our stitching, fabric and measurement standards. Pieces that do not meet expectations are not included in the collection.',

  // --- Size guide ---
  'sizeGuide.table': SIZE_TABLE_EN,
  'sizeGuide.note': SIZE_NOTE_EN,
}

export const infoSectionTextsEn: Record<string, string[]> = {
  hakkimizda: [
    'Teshvikiye takes its name from Teşvikiye, the Istanbul neighbourhood long associated with fashion and elegance. The name is a point of reference that inspires the brand’s simple, refined stance. Teshvikiye offers womenswear that keeps pace with everyday life while being made with careful craftsmanship. Our collections favour designs that can be worn for years over short-lived trends. Our aim is to offer a wardrobe in which every woman can comfortably express her own style.',
    'Clean lines and balanced cuts come first in our design process. We choose quality fabrics with both comfort and durability in mind. Our colour palette is made up of timeless tones that are easy to combine with one another. Thanks to this approach, our pieces keep their place in your wardrobe even as the seasons change.',
  ],

  teslimat: [
    DELIVERY_TIME_TEXT_EN,
    SHIPPING_FEE_TEXT_EN,
    'We deliver to all addresses within Türkiye. For international delivery requests, please get in touch with us through our contact channels.',
  ],

  'iade-degisim': [
    'Under the Turkish Distance Contracts Regulation, you may exercise your right of withdrawal without giving any reason within 14 days of receiving your order. Items to be returned must be unused, unwashed and sent with their original tags attached. Returns that do not meet these conditions may not be accepted.',
    'If you would like a different size or colour, an exchange can be arranged provided the item meets the return conditions. Exchange requests are subject to stock availability; if the requested alternative is out of stock, you will be directed to the return process instead.',
    [
      '1. Go to My orders in your Account, select the order and create a return or exchange request.',
      '2. Pack the item with its original packaging and tags.',
      '3. Send the item using the shipping details provided to you.',
      '4. Once the item reaches us and passes inspection, the refund is issued to your original payment method.',
    ].join('\n'),
  ],

  'beden-rehberi': [SIZE_TABLE_EN, SIZE_NOTE_EN],

  sss: [
    [
      'Q: How can I track my order?',
      'A: You can follow the status of your order from My orders in your Account.',
      'Q: Can I change an item or size after placing my order?',
      'A: Before your order is shipped, you can contact our support team with your change request.',
      'Q: Can I cancel my order?',
      'A: For orders that have not yet been shipped, you can submit a cancellation request from My orders in your Account.',
    ].join('\n'),
    [
      'Q: When will my order arrive?',
      'A: Orders are shipped within 1–3 business days of confirmation; delivery usually takes 1–4 business days, depending on the carrier and region.',
      'Q: How much is shipping?',
      'A: The shipping fee is shown at checkout; free shipping terms are announced during campaign periods.',
      'Q: Do you deliver internationally?',
      'A: For international delivery requests, please reach us through our contact channels.',
    ].join('\n'),
    [
      'Q: How many days do I have to return an item?',
      'A: You can return an item by exercising your right of withdrawal within 14 days of receiving it.',
      'Q: When will I receive my refund?',
      'A: Once the item reaches us and passes inspection, the refund is issued to your original payment method.',
      'Q: Can I return an item whose tag has been removed?',
      'A: To be eligible for a return, the item must be unused and have its original tags attached.',
    ].join('\n'),
    [
      'Q: How is the member discount applied?',
      'A: When you create an account, 10% off is applied automatically to your first order in your cart; it does not apply to later orders.',
      'Q: Are there any conditions for the member discount?',
      'A: Campaign terms may be updated from time to time; the current terms are stated on the site.',
      'Q: Can I shop without an account?',
      'A: Yes, you can also order as a guest; to benefit from the member discount, you need to create an account.',
    ].join('\n'),
  ],

  gizlilik: [
    'At [Company name], we care about the security of your personal data. This privacy policy explains for which purposes the personal data obtained while you use our site is processed, how it is stored and what your rights are. During ordering, membership and communication, data such as your name, address, telephone number, e-mail address and order details is processed in order to fulfil your orders, provide customer service and meet our legal obligations. Your data is kept for as long as the purpose of processing requires and within the retention periods set out in the applicable legislation. Under the Turkish Personal Data Protection Law No. 6698 (KVKK), you have the right to access your data, request its correction or deletion and object to its processing. To exercise these rights, you can contact us at [E-mail].',
    [
      'Identity of the Data Controller',
      'Pursuant to the Turkish Personal Data Protection Law No. 6698, [Company name], located at [Address], acts as the data controller.',
      '',
      'Personal Data Processed and Purposes of Processing',
      'Your name, contact details, delivery address and order details are processed to create your orders, arrange delivery, provide customer service and fulfil our legal obligations.',
      '',
      'Transfer of Personal Data',
      'Your personal data may be shared, to a limited extent and with the necessary security measures in place, with the business partners we work with for legitimate purposes such as carrying out shipping and payment processes and meeting legal obligations.',
      '',
      'Method and Legal Basis of Collection',
      'Your data is collected electronically during the transactions you carry out on our site, on the legal grounds of the establishment and performance of a contract and compliance with a legal obligation.',
      '',
      'Your Rights',
      'Under Article 11 of the Law, you have the right to learn whether your personal data is processed, to request information about such processing, and to request its correction or deletion. You can send your requests to [E-mail].',
    ].join('\n'),
  ],

  'cerez-politikasi': [
    [
      'Cookies are small text files saved to your browser by the websites you visit. They are used to make the site work properly, remember your preferences and improve your experience.',
      '',
      'We use three categories of cookies on our site. Necessary cookies are required to keep your session, your cart and your cookie choice, and cannot be turned off. Analytics cookies help us improve the experience by measuring site usage anonymously and are only activated with your consent. Marketing cookies are used to offer you content and campaigns that may interest you and are only activated with your consent.',
      '',
      'You can change your cookie preferences at any time using the "Cookie preferences" link at the bottom of the page. You can also manage or delete cookies in your browser settings. If you disable cookies entirely in your browser, some parts of the site may not work as expected.',
      '',
      'Cookies are kept for different periods depending on their type: session cookies are deleted when you close your browser, while persistent cookies remain on your device for a predefined period or until you delete them.',
      '',
      'For any questions about our cookie policy, you can contact us at [E-mail].',
    ].join('\n'),
  ],

  'alisveris-kosullari': [
    'This text summarises the general principles of the distance sales contract concluded between [Company name] ("Seller") and the customer shopping on our site ("Buyer"). The subject of the contract is the sale and delivery of the product the Buyer orders electronically through our site. The Buyer may exercise the right of withdrawal within 14 days without giving any reason; details of the right of withdrawal can be found on our Returns & Exchanges page. Disputes arising from the performance of the contract fall under the jurisdiction of the Consumer Arbitration Committees within the monetary limits announced by the Turkish Ministry of Trade, and of the Consumer Courts for disputes above those limits.',
    'By using this site, you are deemed to have accepted the following terms. Product images, descriptions and prices on the site are provided for promotional purposes; in the event of any discrepancies caused by typing or system errors, the current information on the site prevails. You are responsible for all transactions carried out with your account and for keeping your account details confidential. Copying or reproducing the site content (text, images, design) without permission is prohibited.',
  ],
}
