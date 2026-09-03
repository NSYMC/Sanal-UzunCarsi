# Sanal Uzun Çarşı

Tarayıcıda çalışan üç boyutlu mağaza ve ürün inceleme uygulaması. Projede Güzel Optik,
Sude Home, Nişantaşı Kuyumculuk ve Zeka Teknoloji mağazaları bulunur.

## Kurulum

```bash
npm ci
npm run dev
```

Uygulama varsayılan olarak `http://127.0.0.1:5173` adresinde açılır. Büyük sahne dosyaları kurulum sırasında `runtime-assets` dizisindeki parçalardan oluşturulur.

## Üretim derlemesi

```bash
npm run build
```

## Testler

```bash
npm test
```

## Kontroller

- `W`, `A`, `S`, `D`: hareket
- Fare: bakış
- Sol tık: ürün inceleme
- `E`: hedefteki ürünü inceleme
- `Shift`: hızlı hareket
- `Esc`: fare kilidini veya açık ürün görünümünü kapatma

Son incelenen ürün, mağaza HUD'undaki **Son incelenen** düğmesinden yeniden açılabilir.

## Ürün inceleme

Ürün penceresindeki araç çubuğu modele göre değişir:

- **Parçalarına ayır**: telefon modellerini bileşenlerine ayırır. Parçalar ayrıldığında
  ekran, anakart, batarya gibi bileşenlerin teknik bilgileri işaret olarak görünür.
- **Kılıf dene**: incelenen telefona uyumlu kılıfları aynı sahnede giydirir. Kılıf
  takılıyken parçalara ayırma, telefonu önce birleştirir.
