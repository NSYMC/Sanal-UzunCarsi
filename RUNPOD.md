# RunPod Dağıtımı

Uygulama statik olarak derlenir; üç boyutlu görüntü istemci tarayıcısında oluşturulur.

## Docker

Depodaki `Dockerfile` iki aşamalı bir üretim imajı oluşturur:

1. Node.js bağımlılıkları kurar ve Vite derlemesini üretir.
2. Nginx `dist` dizisini sunar.

İmajı yerel olarak oluşturmak için:

```bash
docker build -t sanal-uzun-carsi .
docker run --rm -p 8080:80 sanal-uzun-carsi
```

RunPod üzerinde HTTP portu `80` olarak tanımlanmalıdır. Uygulama GPU gerektirmez; gerekli kaynak miktarı eş zamanlı ziyaretçi sayısına ve ağ trafiğine göre belirlenebilir.

`.github/workflows/publish-runpod-image.yml` iş akışı, üretim imajını GitHub Container Registry'ye gönderir.
