# Sanal-UzunCarsi: Sanal Gerçeklik ve E-Ticaret Simülasyonu

Bu proje, Kahramanmaraş'ın tarihi dokularından biri olan **Uzun Çarşı**'yı dijital dünyaya taşımayı amaçlayan yenilikçi bir staj projesidir. Proje kapsamında kullanıcılar, sanal ortamda çarşıyı gezebilecek, esnafın dükkanlarına yaklaşarak vitrinlerdeki ürünleri üç boyutlu olarak inceleyebilecek ve fiyatlarını anlık olarak görebileceklerdir.

## Projenin Amacı ve Vizyonu
Geleneksel alışveriş kültürünü modern teknolojilerle birleştirmeyi hedefleyen bu simülasyon, tarihi ticaret merkezlerini e-ticaret ekosistemine entegre eden bir öncü prototiptir. Sistem, 3D topografya modellemesi ve web tabanlı VR teknolojilerini kullanarak kullanıcılara gerçekçi bir deneyim sunar. 

### Temel Hedefler:
- Tarihi çarşının gerçek coğrafi koordinatlara (37.5846 Enlem, 36.9272 Boylam) sadık kalınarak 1:1 ölçekte modellenmesi.
- WebGL ve Babylon.js altyapısı kullanılarak tarayıcı üzerinden yüksek performanslı 3D gezinti imkanı sağlanması.
- Dükkanların sanal vitrinleriyle etkileşime girerek dinamik e-ticaret verilerinin (ürün, stok, fiyat) kullanıcıya sunulması.

## Ekran Görüntüleri ve İlerleme
*(Not: Blender üzerinden çekilen gerçek dünya (topografya ve uydu) verilerinin 3D modellenmiş render görüntüleri buraya eklenecektir. Bu modeller Babylon.js ortamına aktarılarak web üzerinden gezilebilir hale getirilecektir.)*

![Blender Arazi Modeli](./public/screenshot1.png)
*(Örnek Görsel Yeri)*

## Mimari ve Kullanılan Teknolojiler

Proje üç ana katmandan oluşmaktadır:

1. **Topografya ve Veri İşleme Katmanı (Python):** 
   - Açık kaynaklı uydu ve yükseklik (DEM) sağlayıcılarından Kahramanmaraş merkezli coğrafi veriler indirilir. 
   - Veri indirme işlemi, `concurrent.futures` kullanılarak Multi-threading (çoklu iş parçacığı) mantığıyla yüksek hızda gerçekleştirilir.

2. **3D Modelleme Katmanı (Blender & Python API):** 
   - İndirilen coğrafi veriler, Blender'ın Python API'si (`bpy`) kullanılarak otomatik olarak 3D yüzeylere dönüştürülür. 
   - Yükseklik haritaları `Displace` mantığıyla 1:1 ölçekte yüzeye uygulanır ve ultra yüksek çözünürlüklü uydu görselleriyle kaplanır.

3. **Sunum ve Etkileşim Katmanı (Babylon.js):** 
   - Üretilen 3D modeller (`.glb`), modern bir web motoru olan Babylon.js kullanılarak tarayıcıda render edilir. 
   - Kullanıcıların kamera kontrolleri (WASD) ve VR etkileşimleri bu katmanda yönetilir.

## Kurulum ve Çalıştırma

Projenin web arayüzünü yerel ortamda çalıştırmak için aşağıdaki adımları izleyebilirsiniz:

```bash
# Bağımlılıkların yüklenmesi
npm install

# Geliştirme sunucusunun başlatılması
npm run dev
```

Harita ve model güncelleme betiklerini (Python) çalıştırmak isterseniz:

```bash
# Gerekli kütüphanelerin yüklenmesi
pip install requests pillow

# Harita verilerinin indirilmesi (public/ klasörüne kaydedilir)
python scripts/fetch_terrain.py

# Blender ile 3D arazinin oluşturulması (Sisteminizde Blender kurulu olmalıdır)
# Not: Bu işlem yüksek RAM gerektirebilir.
blender --background --python scripts/blender_terrain.py
```

## Lisans ve Kullanım Şartları
Bu proje bir staj projesi prototipi olarak geliştirilmiştir. İzinsiz ticari amaçla kullanılamaz.
