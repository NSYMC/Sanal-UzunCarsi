/**
 * Telefon mağazasının ürün verisini üretir.
 *
 * `public/models/products/telefon/` altındaki 52 modeli okur ve
 * `src/data/telefon-product-matches.js` dosyasını yazar. Ürün kimlikleri
 * sahnedeki mesh adlarından türetilenlerle birebir aynı olmak zorunda:
 * çalışma zamanı kataloğu kimliği bulamazsa yüksek kaliteli model açılmaz.
 */

import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspace = process.cwd();
const modelDirectory = path.join(workspace, 'public', 'models', 'products', 'telefon');
const outputPath = path.join(workspace, 'src', 'data', 'telefon-product-matches.js');
const MODEL_URL = '/models/products/telefon';

// Model adları seri harfi, numara ve kademe ekinden oluşur. `slug` diskteki
// .glb adıdır ve değiştirilemez; görünen ad serbesttir.
const TELEFON = {
    compact: { slug: 'compact', ad: 'Z5 Mini', ekranBoyu: '6,1"', olcu: '70,0 × 143,0 × 7,6 mm', fiyat: 18900 },
    promax: { slug: 'pro-max', ad: 'Z9 Pro Max', ekranBoyu: '6,9"', olcu: '77,6 × 163,0 × 8,25 mm', fiyat: 54900 },
    bar: { slug: 'bar', ad: 'Z7 Plus', ekranBoyu: '6,6"', olcu: '73,5 × 155,0 × 8,6 mm', fiyat: 32900 },
    budget: { slug: 'budget', ad: 'A3 Lite', ekranBoyu: '6,7"', olcu: '76,0 × 164,5 × 9,2 mm', fiyat: 12900 },
    rugged: { slug: 'rugged', ad: 'X6 Active', ekranBoyu: '6,8"', olcu: '78,5 × 166,0 × 9,9 mm', fiyat: 27900 }
};

// Kılıflar dokusu ve rengiyle listelenir; değerler modeldeki görünümle aynıdır.
const FINIS = {
    duz: { slug: 'duz-gece', ad: 'Mat Silikon', renk: 'Siyah', doku: 'düz mat silikon', fiyat: 249 },
    serit: { slug: 'serit-kum', ad: 'Çizgi Dokulu', renk: 'Bej', doku: 'ince çizgi dokulu', fiyat: 279 },
    nokta: { slug: 'nokta-mercan', ad: 'Nokta Dokulu', renk: 'Mercan', doku: 'kabartma nokta dokulu', fiyat: 299 },
    altigen: { slug: 'altigen-okyanus', ad: 'Petek Dokulu', renk: 'Turkuaz', doku: 'altıgen petek dokulu', fiyat: 329 },
    dokuma: { slug: 'dokuma-orman', ad: 'Örgü Dokulu', renk: 'Haki', doku: 'çapraz örgü dokulu', fiyat: 349 }
};

// Parçalarına ayrılan modelde her parçanın üzerinde görünen teknik bilgi.
// nodeName değerleri telefon .glb'sindeki düğüm adlarıyla birebir aynı olmalı;
// inceleyici işareti `name === nodeName || name.endsWith('_' + nodeName)` ile
// eşler.
const TELEFON_DETAY = {
    compact: {
        ekran: '6,1" OLED · 120 Hz · 2340 × 1080', ekranNot: 'Gorilla Glass Victus, 1600 nit tepe parlaklık',
        islemci: 'Sekiz çekirdekli 2,8 GHz', ram: '8 GB LPDDR5', depolama: '128 GB UFS 3.1',
        pil: 3400, sarj: '25W', kablosuz: '10W',
        kamera: 'Çift kamera · 50 MP ana (OIS) + 12 MP ultra geniş',
        onKamera: '12 MP · otomatik odak, yüz tanıma sensörleri',
        hoparlor: 'üst kulaklıkla stereo çift',
        kasa: 'Alüminyum çerçeve · IP68 toz ve su dayanımı',
        arka: 'Mat seramik arka kapak',
        sim: 'Nano SIM + eSIM · contalı tepsi'
    },
    promax: {
        ekran: '6,9" LTPO OLED · 1-120 Hz · 2868 × 1320', ekranNot: 'her zaman açık ekran, 2600 nit tepe parlaklık',
        islemci: 'Sekiz çekirdekli 3,4 GHz', ram: '16 GB LPDDR5X', depolama: '512 GB UFS 4.0',
        pil: 5000, sarj: '65W', kablosuz: '15W mıknatıslı',
        kamera: 'Üçlü kamera · 50 MP ana (OIS) + 48 MP ultra geniş + 12 MP 5× telefoto',
        onKamera: '32 MP · otomatik odak, 4K video',
        hoparlor: 'çift bobinli stereo çift',
        kasa: 'Titanyum çerçeve · IP68 toz ve su dayanımı',
        arka: 'Mat füzyon cam arka kapak',
        sim: 'Çift eSIM + Nano SIM · contalı tepsi'
    },
    bar: {
        ekran: '6,6" OLED · 120 Hz · 2412 × 1080', ekranNot: 'düz panel, 1800 nit tepe parlaklık',
        islemci: 'Sekiz çekirdekli 3,0 GHz', ram: '12 GB LPDDR5X', depolama: '256 GB UFS 3.1',
        pil: 4600, sarj: '45W', kablosuz: '15W',
        kamera: 'Yatay bar üçlü kamera · 50 MP ana (OIS) + 48 MP ultra geniş + 10 MP 3× telefoto',
        onKamera: '16 MP · sabit odak, HDR',
        hoparlor: 'üst kulaklıkla stereo çift',
        kasa: 'Alüminyum çerçeve · IP68 toz ve su dayanımı',
        arka: 'Mat cam arka kapak',
        sim: 'Nano SIM + eSIM · contalı tepsi'
    },
    budget: {
        ekran: '6,7" IPS LCD · 90 Hz · 2400 × 1080', ekranNot: '600 nit parlaklık, damla çentik',
        islemci: 'Sekiz çekirdekli 2,2 GHz', ram: '4 GB LPDDR4X', depolama: '128 GB eMMC 5.1',
        pil: 5200, sarj: '18W', kablosuz: '10W',
        kamera: 'Dörtlü kamera · 48 MP ana + 8 MP ultra geniş + 2 MP makro + 2 MP derinlik',
        onKamera: '8 MP · sabit odak',
        hoparlor: 'tek hoparlör',
        kasa: 'Polikarbonat gövde · IP54 sıçrama dayanımı',
        arka: 'Sedef dokulu polikarbonat arka kapak',
        sim: 'Çift Nano SIM · hafıza kartı yuvalı tepsi'
    },
    rugged: {
        ekran: '6,8" OLED · 144 Hz · 2460 × 1080', ekranNot: 'eldivenle kullanım modu, 1500 nit tepe parlaklık',
        islemci: 'Sekiz çekirdekli 2,8 GHz', ram: '8 GB LPDDR5', depolama: '256 GB UFS 3.1',
        pil: 6000, sarj: '33W', kablosuz: '12W',
        kamera: 'Dairesel üçlü kamera · 50 MP ana (OIS) + 13 MP ultra geniş + 5 MP makro',
        onKamera: '16 MP · sabit odak',
        hoparlor: '2,5W yüksek sesli tek hoparlör',
        kasa: 'Takviyeli çerçeve · IP68 ve MIL-STD-810H darbe dayanımı',
        arka: 'Kaymaz mat kauçuk arka kapak',
        sim: 'Çift Nano SIM · contalı tepsi'
    }
};

const parcalar = (d) => [
    ['PH_Display', 'Ekran', `${d.ekran} · ${d.ekranNot}.`],
    ['PH_LogicBoard', 'Anakart', `${d.islemci} işlemci · ${d.ram} RAM · ${d.depolama} depolama. Yonga ve modem EMI kalkanının altında.`],
    ['PH_Battery', 'Batarya', `${d.pil} mAh lityum-polimer · ${d.sarj} kablolu hızlı şarj.`],
    ['PH_CameraRear', 'Arka kamera', `${d.kamera}.`],
    ['PH_CameraFront', 'Ön kamera', `${d.onKamera}.`],
    ['PH_CoilMagSafe', 'Kablosuz şarj', `${d.kablosuz} kablosuz şarj bobini.`],
    ['PH_TapticEngine', 'Titreşim motoru', 'Doğrusal titreşim motoru · dokunsal geri bildirim.'],
    ['PH_SpeakerBottom', 'Hoparlör', `Alt hoparlör modülü · ${d.hoparlor}.`],
    ['PH_Chassis', 'Kasa', `${d.kasa}.`],
    ['PH_BackGlass', 'Arka kapak', `${d.arka}.`],
    ['PH_SimTray', 'SIM tepsisi', `${d.sim}.`]
].map(([nodeName, label, description]) => ({ nodeName, label, description }));

// Her aksesuarın iki rafı var; sıralama sahnedeki PK_aks_<tür>_<0|1> ile aynı.
const AKSESUAR = {
    kulaklik: {
        slug: 'kulaklik',
        tur: 'Kablosuz Kulaklık',
        modeller: [
            { ad: 'Air 20 TWS Kablosuz Kulaklık', not: 'Yarım kulak içi · 24 saat toplam pil · Bluetooth 5.3', fiyat: 899 },
            { ad: 'Air 40 ANC Kablosuz Kulaklık', not: 'Aktif gürültü engelleme · 36 saat toplam pil · kablosuz şarj kutusu', fiyat: 1790 }
        ]
    },
    sarj: {
        slug: 'sarj-adaptoru',
        tur: 'Şarj Adaptörü',
        modeller: [
            { ad: 'PD 35W GaN Şarj Adaptörü', not: 'Tek USB-C · Power Delivery 3.0 · katlanır fiş', fiyat: 549 },
            { ad: 'PD 65W Çift Portlu Şarj Adaptörü', not: 'USB-C + USB-A · dizüstü şarj edebilir · GaN', fiyat: 949 }
        ]
    },
    powerbank: {
        slug: 'powerbank',
        tur: 'Powerbank',
        modeller: [
            { ad: 'PB10 10.000 mAh Powerbank', not: '22,5W hızlı şarj · dijital göstergeli', fiyat: 749 },
            { ad: 'PB20 20.000 mAh Powerbank', not: '30W çift yönlü şarj · iki cihaz aynı anda', fiyat: 1290 }
        ]
    },
    kablo: {
        slug: 'kablo',
        tur: 'USB-C Kablo',
        modeller: [
            { ad: 'USB-C Örgü Kablo 1 m', not: '60W · örgü kaplama · 10.000 bükülme testi', fiyat: 189 },
            { ad: 'USB-C Örgü Kablo 2 m', not: '100W · örgü kaplama · veri aktarımı destekli', fiyat: 279 }
        ]
    },
    ekran: {
        slug: 'ekran-cami',
        tur: 'Ekran Koruyucu',
        modeller: [
            { ad: '9H Temperli Ekran Koruyucu', not: 'Tam kaplama · parmak izi tutmaz kaplama · hizalama aparatlı', fiyat: 249 },
            { ad: 'Hayalet Temperli Ekran Koruyucu', not: 'Yandan bakışta görüntüyü gizler · 9H sertlik', fiyat: 379 }
        ]
    }
};

// Aynı model dükkânda onlarca kez tekrarladığından bağlantı mesh adıyla değil
// desenle kurulur.
const baglanti = (id, desen) => ({
    id: `binding:telefon:${id}`,
    storeId: 'telefon',
    productId: id,
    meshNames: [],
    meshNamePatterns: [desen]
});

const urun = ({ id, name, brand, category, price, description, tags, model, extra = {} }) => ({
    id,
    storeId: 'telefon',
    name,
    brand,
    category,
    price,
    currency: 'TRY',
    priceType: 'catalog',
    priceNote: 'Mağaza katalog fiyatıdır.',
    description,
    tags,
    highQualityModel: `${MODEL_URL}/${model}.glb`,
    previewTransform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    active: true,
    ...extra
});

const build = (mevcut) => {
    const products = [];
    const bindings = [];
    const eksik = [];
    const ekle = (spec) => {
        if (!mevcut.has(spec.model)) {
            eksik.push(spec.model);
            return;
        }
        products.push(urun(spec));
        if (spec.desen) bindings.push(baglanti(spec.id, spec.desen));
    };

    for (const [anahtar, t] of Object.entries(TELEFON)) {
        ekle({
            id: `TEL_PHONE_${anahtar.toUpperCase()}`,
            name: `ZEKA ${t.ad}`,
            brand: 'ZEKA',
            category: 'Telefon',
            price: t.fiyat,
            description: `${t.ekranBoyu} ekran · ${TELEFON_DETAY[anahtar].ram} RAM · `
                + `${TELEFON_DETAY[anahtar].depolama} · ${TELEFON_DETAY[anahtar].pil} mAh. `
                + `${t.olcu}. Parçalarına ayırarak iç donanımı inceleyebilirsiniz.`,
            tags: ['telefon', 'cep telefonu', t.ad.toLowerCase(), 'zeka'],
            model: `telefon-${t.slug}`,
            // Şablon dizesinde ters bölü kaçışı yenildiğinden \d yerine [0-9]
            desen: `^TEL_${anahtar}_Cube_[0-9]+_[0-9]+`,
            extra: {
                // autoPlay tanımlanmaz; parçalanmayı kullanıcı düğmeden başlatır.
                animationClip: 'Animation',
                hotspots: parcalar(TELEFON_DETAY[anahtar]),
                caseGroup: anahtar.toUpperCase()
            }
        });
    }

    for (const [tk, t] of Object.entries(TELEFON)) {
        for (const [fk, f] of Object.entries(FINIS)) {
            // Listeleme sırası: marka, uyumlu model, tür, renk.
            const kilifAdi = `ARKA ${t.ad} ${f.ad} Kılıf · ${f.renk}`;
            const kilifEtiket = ['kılıf', 'telefon kılıfı', 'arka', t.ad.toLowerCase(),
                f.ad.toLowerCase(), f.renk.toLowerCase()];
            ekle({
                id: `TEL_CASE_${tk.toUpperCase()}_${fk.toUpperCase()}`,
                name: kilifAdi,
                brand: 'ARKA',
                category: 'Kılıf',
                price: f.fiyat,
                description: `ZEKA ${t.ad} için ${f.doku} koruyucu arka kapak. `
                    + 'Kamera çıkıntısını koruyan yükseltilmiş kenar.',
                tags: kilifEtiket,
                model: `kilif-${t.slug}-${f.slug}`
            });
            ekle({
                id: `TEL_BOX_KILIF_${tk.toUpperCase()}_${fk.toUpperCase()}`,
                name: `${kilifAdi} (Askılı Paket)`,
                brand: 'ARKA',
                category: 'Kılıf',
                price: f.fiyat,
                description: `ZEKA ${t.ad} için ${f.doku} koruyucu arka kapak, `
                    + 'raf askılığına takılı perakende ambalajında.',
                tags: [...kilifEtiket, 'kutulu'],
                model: `kutu-kilif-${t.slug}-${f.slug}`,
                desen: `^PK_kilif_${tk}_${fk}_`
            });
        }
    }

    for (const [ak, a] of Object.entries(AKSESUAR)) {
        a.modeller.forEach((m, index) => {
            const n = index + 1;
            ekle({
                id: `TEL_BOX_${ak.toUpperCase()}_${n}`,
                name: `VOLT ${m.ad}`,
                brand: 'VOLT',
                category: 'Aksesuar',
                price: m.fiyat,
                description: `${m.not}.`,
                tags: ['aksesuar', 'volt', a.tur.toLowerCase(), m.ad.toLowerCase()],
                model: `kutu-${a.slug}${n}`,
                desen: `^PK_aks_${ak}_${index}_`
            });
        });
    }
    return { products, bindings, eksik };
};

const dosyalar = (await readdir(modelDirectory))
    .filter((f) => f.toLowerCase().endsWith('.glb'))
    .map((f) => path.basename(f, '.glb'));
const { products, bindings, eksik } = build(new Set(dosyalar));

const kullanilan = new Set(products.map((p) => path.basename(p.highQualityModel, '.glb')));
const bagsiz = dosyalar.filter((f) => !kullanilan.has(f));

const govde = `// Bu dosya scripts/build-telefon-products.mjs tarafından üretilir; elle düzenlemeyin.
// Ürün kimlikleri src/main.js içindeki telefonProductIdForName() ile birebir eşleşir.
const products = ${JSON.stringify(products, null, 4)};

const bindings = ${JSON.stringify(bindings, null, 4)};


export default { schemaVersion: 1, products, bindings };
export { products, bindings };
`;

await writeFile(outputPath, govde, 'utf8');
console.log(`Telefon ürünleri: ${products.length} ürün, ${bindings.length} bağlantı yazıldı.`);
if (eksik.length) console.warn(`UYARI modeli olmayan: ${eksik.join(', ')}`);
if (bagsiz.length) console.warn(`UYARI ürüne bağlanmayan model: ${bagsiz.join(', ')}`);
