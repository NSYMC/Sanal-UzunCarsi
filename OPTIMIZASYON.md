# Teknik Notlar

## Sahne dosyaları

- Büyük GLB dosyaları `runtime-assets` altında parçalara ayrılmıştır.
- `scripts/runtime-assets.mjs` eksik veya güncelliğini yitirmiş çalışma dosyalarını yeniden oluşturur.
- Kaynak geometri ve üçgen sayısı derleme sırasında değiştirilmez.

## Görüntüleme

- Sahne Babylon.js üzerinde PBR materyallerle işlenir.
- Gölge haritaları mağaza bazında ve sınırlı sayıda gölge üreticisiyle hazırlanır.
- Görünürlük, çarpışma ve ürün seçim yüzeyleri geçiş sırasında kademeli etkinleştirilir.

## Yükleme

- Harita açıldıktan sonra sahne ve ürün dosyaları tarayıcı önbelleğine alınır.
- Mağaza sahneleri konuma ve kullanıcı seçimine göre çalışma zamanında hazırlanır.
