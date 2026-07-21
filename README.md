# Sanal Uzunçarşı 3D

Sanal Uzunçarşı, Babylon.js kullanılarak geliştirilmiş, tarayıcı tabanlı, fotogerçekçi ve interaktif bir 3D e-ticaret/gezinme simülasyonudur.

Bu projede devasa "Uzunçarşı" modelinin içerisinde özgürce dolaşabilir, ürünleri (Örn: valizler, t-shirtler vb.) tezgahların üzerinde inceleyebilir ve kendi ürünlerinizi Editör modunu kullanarak sahneye yerleştirebilirsiniz.

## Özellikler

- **Fotogerçekçi Grafikler:** ACES Tone Mapping, IBL (Çevresel Işık) ve özel iç mekan ışıklandırmaları (Point Lights).
- **Editör Modu:** Sahneye ürün (Valiz, Kutu vb.) ekleme, XYZ eksenlerinde serbest taşıma ve döndürme (Gizmo).
- **Tıklanabilir Ürünler:** Ürünlerin üzerine tıklandığında açılan ürün bilgi kartları.
- **Yüksek Performans:** 240MB'lık devasa sahnelere rağmen objelerin dondurulması (Mesh Freezing) sayesinde akıcı 60 FPS deneyimi.

## Motordan Görüntüler
![Sanal Uzunçarşı Motordan Görüntü](dukkan.png)

## Nasıl Çalıştırılır?

Projeyi kendi bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin:

### Gereksinimler
- Bilgisayarınızda **Node.js** yüklü olmalıdır.

### Kurulum Adımları
1. Bu depoyu (repository) bilgisayarınıza indirin (ZIP olarak indirin veya `git clone` komutunu kullanın).
2. İndirdiğiniz klasörün içine girin ve komut satırını (Terminal/CMD) açın.
3. Gerekli kütüphaneleri yüklemek için aşağıdaki komutu çalıştırın:
   ```bash
   npm install
   ```
4. Yükleme tamamlandıktan sonra, projeyi başlatmak için şu komutu çalıştırın:
   ```bash
   npm run dev
   ```
5. Komut çalıştıktan sonra ekranda beliren adresi (genellikle `http://localhost:5173/`) tarayıcınıza kopyalayıp enter'a basın.

## Kontroller
- **W, A, S, D:** Kamerayı hareket ettirir (İleri, Sola, Geri, Sağa).
- **Fare (Sol Tık Basılı Tutarak):** Etrafa bakmanızı sağlar.
- **Fare (Sol Tık):** Ürünlere tıklayarak bilgi ekranını açar veya Editör modundayken objeleri seçmenizi sağlar.

İyi gezintiler!
