# Sanal Uzun Çarşı

Tarayıcıda çalışan üç boyutlu mağaza ve ürün inceleme uygulaması. Projede Güzel Optik, Sude Home ve Mawuş mağazaları bulunur.

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
- `Shift`: hızlı hareket
- `Esc`: fare kilidini veya açık ürün görünümünü kapatma
