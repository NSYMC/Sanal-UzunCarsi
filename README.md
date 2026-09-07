# Sanal Uzun Çarşı

Tarayıcıda çalışan üç boyutlu mağaza ve ürün inceleme uygulaması. Projede Güzel Optik,
Sude Home, Nişantaşı Kuyumculuk ve Zeka Teknoloji mağazaları bulunur.

## Kurulum

```bash
npm ci
npm run dev
```

Uygulama varsayılan olarak `http://127.0.0.1:5173` adresinde açılır. Büyük sahne dosyaları geliştirme sunucusu veya derleme başlatılırken `runtime-assets` dizisindeki parçalardan oluşturulur.

## Üretim derlemesi

```bash
npm run build
```

## Testler

```bash
npm test
```

Yayın öncesi bütün test ve varlık kontrolleri için `npm run prebuild && npm run check`
çalıştırılır. Docker imajı ve GHCR yayın akışı da bu kontrolleri zorunlu tutar.
Güncel Güzel Optik sahnesi `optik-raw` profiliyle doğrulanır (350 tahmini çizim
çağrısı, 250.000 üçgen, 75 materyal sınırı); eski instancing paketi için
doğrulayıcıya üçüncü argüman olarak `optik` verilebilir.

Model ve manifest URL'lerine derlemede içerikten üretilen `rev` sürümü eklenir.
Model değiştiğinde URL de değişir; önceki sürüm tarayıcı önbelleğinde kalsa bile
yeni model indirilir. Altın fiyatı önbelleği beş dakika kullanılır; bağlantı
kesilirse son bilinen veriyle devam edilir. Ürün detayından yapılan fiyat
yenilemesi talep listesini ve taksit tutarlarını da aynı veriyle günceller.

## Kontroller

- `W`, `A`, `S`, `D`: hareket
- Fare: bakış
- Sol tık: ürün inceleme
- `E`: hedefteki ürünü inceleme
- `Shift`: hızlı hareket
- Telefon/tablet: soldaki yön pediyle hareket, sağdaki pedle bakış; ürüne dokunarak inceleme
- `Esc`: açık talep listesi panelini, fare kilidini veya ürün görünümünü kapatma

Son incelenen ürün, mağaza HUD'undaki **Son incelenen** düğmesinden yeniden açılabilir.

## Ürün inceleme

Ürün penceresindeki araç çubuğu modele göre değişir:

- **Parçalarına ayır**: telefon modellerini bileşenlerine ayırır. Parçalar ayrıldığında
  ekran, anakart, batarya gibi bileşenlerin teknik bilgileri işaret olarak görünür.
- **Kılıf dene**: incelenen telefona uyumlu kılıfları aynı sahnede giydirir. Kılıf
  takılıyken parçalara ayırma, telefonu önce birleştirir.

## Talep listesi ve favoriler

Talep ve favori listesi tarayıcıda saklanır; sekme kapansa da kalır. Uygulamada
sipariş veya ödeme alınmaz; fiyat ve stok mağazayla görüşülerek kesinleşir.

- **Talep listesi**: ürün penceresinden adet seçilerek, katalogdaki ürün kartlarından veya
  favori listesinden eklenir. Talep listesi düğmesi tur HUD'unda, harita ekranında ve
  katalogda bulunur; panelde satır adedi değiştirilebilir ve toplam gösterilir.
- **Favoriler**: ürün penceresindeki kalp düğmesiyle veya katalog kartlarından
  eklenir; listeden ürün doğrudan açılabilir ya da talep listesine atılabilir.
- **Stok ve teslimat**: her ürünün tahmini stok durumu ve teslimat süresi ürün
  penceresinde görünür. Stoğu biten ürün talep listesine eklenemez.
- **Taksit**: 1.500 TL üzeri ürünlerde 3/6/12 taksit tutarı hesaplanır.

Katalog ekranındaki **Ürünler** görünümü bütün mağazaların ürünlerini tek listede
gösterir; arama ve filtre uygulandığında bu görünüme kendiliğinden geçilir. Sonuçlar
fiyata, ada veya stok durumuna göre sıralanabilir. Katalog, mağaza ve ürün durumları
URL'ye yazıldığı için sayfa adresi paylaşılabilir; tarayıcının geri/ileri düğmeleri
açık katalog ve ürün görünümüyle uyumlu çalışır.

## Performans notları

Güzel Optik sahnesi 1.097.406 üçgen ve 496 materyal içerir; mevcut model
performans sınırlarını aştığı için `npm run check` başarısız olur. Bu kontrol
Docker ve GHCR imajının yayınlanmasını da engeller.

Dokular ayrı iş parçacığında çözülür (`enableOffThreadTextureDecode`). Sahne
materyallerinde eşzamanlı ışık sayısı beşle sınırlandırılır. Geliştirme
sürümünde yükleme süreleri `window.__UZUNCARSI_DEBUG__.phaseTimings` üzerinden okunabilir.

Harita açıldığında yalnız seçili mağaza ile ortak çevre hazırlanır. Diğer mağaza ve
ürün modelleri kullanıcı ilgili mağazaya veya ürüne yöneldiğinde yüklenir; böylece
ilk ziyarette yüzlerce megabaytlık kataloğun tamamı indirilmez.
