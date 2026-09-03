import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';

const FABRIC_COLORS = {
    stone: '#8d837a',
    navy: '#182944',
    cream: '#d7c7aa',
    lavender: '#786c91',
    sapphire: '#17527f',
    mink: '#78665f',
    emerald: '#0d503e',
    burgundy: '#721f30',
    olive: '#626a42',
    rose: '#a95b70',
    teal: '#12656b',
    plum: '#5a274e',
    black: '#111417'
};

const LEATHER_COLORS = {
    cream: '#d9c7a6',
    camel: '#a96d36',
    espresso: '#342119',
    tan: '#9e6234',
    grey: '#62646a',
    burgundy: '#681d2c',
    rose: '#a65366',
    plum: '#51223f',
    emerald: '#104d38',
    black: '#101214',
    navy: '#172a46'
};

const DISPLAY_COMPONENT_PATTERN = /(?:Pad|DisplayCard|Hanger|Hook)/i;

const numberedSuffix = (name) => {
    const match = name.match(/\.(\d{3})$/);
    return match ? Number(match[1]) : 0;
};

const identifyMavusV2Product = (name) => {
    let match = name.match(/^MavusV2_(Bangle|Ring|Diamond|GemSeat|Prong|Necklace|Pendant)(?:\.(\d{3}))?$/i);
    if (!match) return null;
    const type = match[1].toLowerCase();
    const index = match[2] ? Number(match[2]) : 0;
    if (type === 'bangle') return `MAV2-BANGLE-${String(index + 1).padStart(2, '0')}`;
    if (type === 'necklace' || type === 'pendant') return `MAV2-NECKLACE-${String(index + 1).padStart(2, '0')}`;
    const ringIndex = type === 'prong' ? Math.floor(index / 4) : index;
    return `MAV2-RING-${String(ringIndex + 1).padStart(2, '0')}`;
};

const identifyProduct = (name) => {
    let match = name.match(/^OPTIK_PRODUCT_(\d{3})(?:_V\d+)?$/i);
    if (match) return `OPTIK_PRODUCT_${match[1]}`;

    match = name.match(/^(PH_(?:BACK|SIDE|RIGHT|COUNTER|VITRINE)_\d{2})/i);
    if (match) return match[1].toUpperCase();

    match = name.match(/^(HAC_(?:COUNTER|VITRINE|WALL)_\d{2})/i);
    if (match) return match[1].toUpperCase();

    match = name.match(/(OZM-(?:CV|TC|PB)-\d{3})/i)
        || name.match(/(OZM-CT-\d{1,3})(?=_|$)/i);
    if (match) return match[1].toUpperCase();

    match = name.match(/(WEN-HS-\d{3})/i)
        || name.match(/(WEN-(?:CFS|CH|CS|CT|CWS)-\d{3})/i)
        || name.match(/(WEN-CPT-[LR]\d{2})/i);
    if (match) return match[1].toUpperCase();

    match = name.match(/^(MAWUS_(?:BANGLE_WALL|EARRING_WALL|RING_MAIN|RING_WALL)_\d{2})/i);
    if (match) return match[1].toUpperCase();

    const mavusV2 = identifyMavusV2Product(name);
    if (mavusV2) return mavusV2;

    if (/^MavusV3_(?:HeroSolitaireBand|HeroDiamond|HeroBasket|HeroProng_\d+)$/i.test(name)) {
        return 'MAV3-HERO-SOLITAIRE';
    }
    if (/^MavusV3_(?:HeroWeddingBand|WeddingMilgrain_\d+)$/i.test(name)) {
        return 'MAV3-HERO-WEDDING';
    }

    match = name.match(/^MAWUS_LUXE_Back(?:Necklace|Pendant)_(\d+)$/i);
    if (match) return `MAWUS-LUXE-NECKLACE-${String(match[1]).padStart(2, '0')}`;

    match = name.match(/^IC_(Arka_Raf_Urunleri|DisCama_Bakan_Urunler|SagDuvar_Urunleri|Sezonluk_Urun_Standı)$/i);
    if (match) return `IC-COLLECTION-${match[1].toUpperCase()}`;

    match = name.match(/^(PASTA_\d{2})_/i);
    if (match) {
        const copySuffix = name.match(/\.(\d{3})$/)?.[1];
        return `${match[1].toUpperCase()}${copySuffix ? `-${copySuffix}` : ''}`;
    }

    match = name.match(/^(Y_Pouch_\d+_\d+_\d+)/i);
    if (match) return match[1].toUpperCase();
    match = name.match(/^(Y_Jar_\d+_\d+_\d+)/i);
    if (match) return match[1].toUpperCase();
    match = name.match(/^Y_(?:DairyTub|DairyLabel)_(\d+_\d+)/i);
    if (match) return `Y_DAIRY_${match[1]}`;
    match = name.match(/^Y_(?:BulkFood|BulkGlass)_(\d+_\d+)/i);
    if (match) return `Y_BULK_${match[1]}`;
    match = name.match(/^Y_(?:HangingPack|HangingFood)_(\d+)/i);
    if (match) return `Y_HANGING_${match[1]}`;
    match = name.match(/^Y_Cloche(?:Jar|Fill|Knob|Plate)_(\d+)/i);
    if (match) return `Y_CLOCHE_${match[1]}`;
    match = name.match(/^F_Pack_L(\d+)_(?:Label_)?(\d+)$/i);
    if (match) return `F_PACK_${match[1]}_${match[2]}`;

    match = name.match(/^SUDE_CATALOG_(\d+)/i);
    if (match) return `SUDE_${match[1]}`;

    match = name.match(/^OZ_BAG_MASTER_MESH_(\d+)/i);
    if (match) return `OZ_BAG_${match[1]}`;

    match = name.match(/^GLASSES_(?:BackWall|RightWall)_Cube\.?(\d+)_S(\d+)_(\d+)/i);
    if (match) return `GLASSES_${match[1]}_${match[2]}_${match[3]}`;

    match = name.match(/^GLASSES_S\d+_(\w+)_Shelf\d+_Pos\d+_(\w+)(?:\.(\d+))?/i);
    if (match) return `GLASSES_SHELF_${match[1].toUpperCase()}_${match[2].toUpperCase()}${match[3] ? `_${match[3]}` : ''}`;

    match = name.match(/^TEMPLATE_GLASSES_(\d+)_(\w+)/i);
    if (match) return `GLASSES_TEMPLATE_${match[1]}_${match[2].toUpperCase()}`;

    match = name.match(/^GLASSES_([A-Za-z0-9_.]+)/i);
    if (match) return `GLASSES_${match[1].replace(/\./g, '_').toUpperCase()}`;

    match = name.match(/^Node_0*(\d+)(?:_primitive\d+)?$/i);
    if (match) {
        const num = Number(match[1]);
        if (num >= 30 && num <= 400) {
            return `GLASSES_BIGSHELF_${String(num).padStart(3, '0')}`;
        }
    }

    return null;
};

const productIdFromMetadata = (metadata) => {
    const extras = metadata?.gltf?.extras || metadata?.extras;
    const value = extras?.web_product_id ?? extras?.product_id;
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const id = String(value).trim();
    return id || null;
};

const productIdFromHierarchy = (node) => {
    let current = node;
    let depth = 0;
    while (current && depth < 12) {
        const id = productIdFromMetadata(current.metadata) || identifyProduct(current.name || '');
        if (id) return id;
        current = current.parent;
        depth += 1;
    }
    return null;
};

const numericLabel = (id) => Number(id.match(/(\d+)(?!.*\d)/)?.[1] || 1);

const haciogluType = (names) => {
    const text = names.join(' ');
    if (/BagBody/i.test(text)) return ['Valfli Kahve Paketi', 'Taze çekilmiş kahve için aromayı koruyan valfli paket.'];
    if (/AmberJar/i.test(text)) return ['Kahve Kavanozu', 'Kavrulmuş kahve çekirdeklerini koruyan amber renkli cam kavanoz.'];
    if (/TinBody/i.test(text)) return ['Kahve Tenekesi', 'Geleneksel kahve ve lokum sunumu için metal saklama kutusu.'];
    if (/CopperBody/i.test(text)) return ['Bakır Cezve', 'Türk kahvesi hazırlamak için metal sap detaylı bakır cezve.'];
    if (/CoffeeSurface|Saucer/i.test(text)) return ['Türk Kahvesi Fincanı', 'Tabak ve kulp detaylarıyla porselen Türk kahvesi fincanı.'];
    if (/Hopper|Crank/i.test(text)) return ['El Değirmeni', 'Ayarlanabilir öğütüm mekanizmalı geleneksel kahve değirmeni.'];
    return ['Hediyelik Kahve Kutusu', 'Kurdele ve kapak detaylı, seçili kahveler için hazırlanan hediye kutusu.'];
};

const pastaHomeType = (names) => {
    const text = names.join(' ');
    if (/Cup_|Icing|Carton/i.test(text)) return ['Butik Tatlı Kutusu', 'Pencere ve iç seperatör detaylı, günlük hazırlanan butik tatlı kutusu.'];
    if (/Bottle|Fill|Neck/i.test(text)) return ['Meyve Şurubu', 'Pastacılık ve sıcak içecekler için cam şişede yoğun aromalı şurup.'];
    if (/Jar|Jam/i.test(text)) return ['El Yapımı Reçel', 'Meyve dokusunu gösteren cam kavanozda el yapımı reçel.'];
    if (/Glass|Content/i.test(text)) return ['Kurabiye Kavanozu', 'Farklı biçimlerde fırınlanmış kurabiyelerle doldurulmuş cam kavanoz.'];
    if (/Crimp|Gusset/i.test(text)) return ['Pastacılık Paketi', 'Körüklü taban ve kapama çizgileriyle hazırlanmış raf paketi.'];
    if (/BandBottom|BandTop/i.test(text)) return ['Dekoratif Saklama Kutusu', 'Çay, kakao ve pastacılık ürünleri için kapaklı metal kutu.'];
    if (/Knob|Shoulder/i.test(text)) return ['Seramik Saklama Kabı', 'Kapak düğmesi ve omuz geçişleri detaylandırılmış seramik saklama kabı.'];
    return ['Hediyelik Tatlı Kutusu', 'Kurdeleli ve kapaklı hediye kutusu.'];
};

const descriptorFor = (id, names) => {
    const number = String(numericLabel(id)).padStart(2, '0');
    const normalizedId = id.toUpperCase();
    const base = {
        id,
        price: 'Mağazada bilgi alın',
        properties: 'Ürün modeli',
        previewType: 'modeled'
    };

    if (id.startsWith('PH_')) {
        const [type, description] = pastaHomeType(names);
        return { ...base, brand: 'Pasta Home', name: `${type} ${number}`, description };
    }
    if (id.startsWith('PASTA_')) {
        return { ...base, brand: 'Pasta Home', name: `Butik Pasta ${number}`, description: 'Kremalı ve süslemeli butik pasta.' };
    }
    if (id.startsWith('HAC_')) {
        const [type, description] = haciogluType(names);
        return { ...base, brand: 'Hacıoğlu', name: `${type} ${number}`, description };
    }
    if (id.startsWith('OZM-CV')) {
        return { ...base, brand: 'Özmin', name: `Uzun Tesettür Elbise ${number}`, description: 'Akışkan kumaş, gerçek dikiş ve askı detayları bulunan uzun tesettür elbise.' };
    }
    if (id.startsWith('OZM-TC')) {
        return { ...base, brand: 'Özmin', name: `Katlı Tesettür Ürünü ${number}`, description: 'Tezgâh sunumu için doğal kumaş kıvrımlarıyla katlanmış tesettür giyim ürünü.' };
    }
    if (id.startsWith('OZM-PB')) {
        return { ...base, brand: 'Özmin', name: `Kadın Çantası ${number}`, description: 'Gövde, kapak, kulp ve metal aksesuarları ayrı modellenmiş kadın çantası.' };
    }
    if (id.startsWith('OZM-CT')) {
        return { ...base, brand: 'Özmin', name: `Tezgâh Tesettür Ürünü ${number}`, description: 'Tezgâh üzerinde inceleme için doğal kumaş kıvrımlarıyla hazırlanmış tesettür ürünü.' };
    }
    if (id.startsWith('WEN-CFS')) {
        return { ...base, brand: 'Wenitto', name: `Katlı Gömlek ${number}`, description: 'Yaka, pat ve kumaş kıvrımları korunarak raf için katlanmış erkek gömleği.' };
    }
    if (id.startsWith('WEN-CPT')) {
        return { ...base, brand: 'Wenitto', name: `Katlı Takım Pantolonu ${number}`, description: 'Ütü izi ve kumaş katlarıyla tezgâh sunumuna hazırlanmış takım pantolonu.' };
    }
    if (id.startsWith('WEN-CH')) {
        return { ...base, brand: 'Wenitto', name: `Askılı Gömlek ${number}`, description: 'Yaka, düğme, manşet ve askı detaylarıyla modellenmiş erkek gömleği.' };
    }
    if (id.startsWith('WEN-CS') || id.startsWith('WEN-HS')) {
        return { ...base, brand: 'Wenitto', name: `Takım Elbise ${number}`, description: 'Ceket, gömlek, pantolon, cep ve klapa detayları bulunan takım elbise.' };
    }
    if (id.startsWith('WEN-CT')) {
        return { ...base, brand: 'Wenitto', name: `Askılı Pantolon ${number}`, description: 'Mağaza askısı ve klipsleriyle birlikte sergilenen klasik erkek pantolonu.' };
    }
    if (id.startsWith('WEN-CWS')) {
        return { ...base, brand: 'Wenitto', name: `Duvar Gömleği ${number}`, description: 'Duvar rafı sunumu için kumaş katları ve yaka ayrıntıları korunmuş gömlek.' };
    }
    if (/RING|SOLITAIRE|WEDDING/.test(id)) {
        return { ...base, brand: 'Nişantaşı Kuyumculuk', name: `Yüzük ${number}`, description: 'Taşlı metal yüzük.' };
    }
    if (/EARRING/.test(id)) {
        return { ...base, brand: 'Nişantaşı Kuyumculuk', name: `Küpe ${number}`, description: 'Metal ve taş parçaları ayrı yüzey özellikleriyle hazırlanmış küpe modeli.' };
    }
    if (/BANGLE/.test(id)) {
        return { ...base, brand: 'Nişantaşı Kuyumculuk', name: `Bilezik ${number}`, description: 'Parlatılmış metal ve taş detayları bulunan kuyumculuk bileziği.' };
    }
    if (id.startsWith('IC-COLLECTION-')) {
        return { ...base, brand: 'Uzun Çarşı', name: `Mağaza Ürün Grubu ${number}`, description: 'Mağaza ürün grubu.' };
    }
    if (id.startsWith('Y_')) {
        const type = id.includes('JAR') || id.includes('CLOCHE')
            ? 'Kavanozlu Ürün'
            : id.includes('DAIRY')
                ? 'Paketli Gıda'
                : id.includes('BULK')
                    ? 'Dökme Gıda Ürünü'
                    : 'Raf Ürünü';
        return { ...base, brand: 'Uzun Çarşı', name: `${type} ${number}`, description: 'Ambalajlı raf ürünü.' };
    }
    if (id.startsWith('F_PACK_')) {
        return { ...base, brand: 'Uzun Çarşı', name: `Paketli Ürün ${number}`, description: 'Etiketli paketli ürün.' };
    }
    if (id.startsWith('SUDE_')) {
        return { ...base, brand: 'Sude Züccaciye', name: `Züccaciye Ürünü ${number}`, description: 'Porselen tabak, çaydanlık, fincan takımı ve sofra sunum ürünleri.' };
    }
    if (id.startsWith('OZ_BAG_')) {
        return { ...base, brand: 'Özmin', name: `Özmin Kadın Çantası ${number}`, description: 'Gövde, kapak, dikiş ve metal kulp aksesuarları modellenmiş kadın çantası.' };
    }
    if (id.startsWith('GLASSES_')) {
        const text = names.join(' ').toLowerCase();
        let name = `Optik Çerçeve ${number}`;
        let description = 'Optik çerçeve modeli.';
        let price = '1.750 TL';
        let properties = 'Kategori: Optik Çerçeve';

        if (/sunglasses|sun/i.test(text)) {
            name = `Güneş Gözlüğü ${number}`;
            description = 'Güneş gözlüğü modeli.';
            price = '2.250 TL';
            properties = 'Kategori: Güneş Gözlüğü';
        } else if (/browline|clubmaster/i.test(text)) {
            name = `Browline Çerçeve ${number}`;
            description = 'Browline çerçeve modeli.';
            price = '2.450 TL';
            properties = 'Kategori: Optik Çerçeve';
        } else if (/rectangular|dikdortgen/i.test(text)) {
            name = `Dikdörtgen Çerçeve ${number}`;
            description = 'Dikdörtgen optik çerçeve modeli.';
            price = '1.850 TL';
            properties = 'Kategori: Optik Çerçeve';
        } else if (/metal/i.test(text)) {
            name = `Metal Çerçeve ${number}`;
            description = 'Metal çerçeve modeli.';
            price = '1.650 TL';
            properties = 'Kategori: Optik Çerçeve';
        } else if (/brown|havana|tortoise/i.test(text)) {
            name = `Kahverengi Çerçeve ${number}`;
            description = 'Kahverengi çerçeve modeli.';
            price = '2.100 TL';
            properties = 'Kategori: Optik Çerçeve';
        }
        return {
            ...base,
            brand: 'Uzun Çarşı Optik',
            name,
            description,
            price,
            properties
        };
    }
    if (normalizedId.startsWith('OPTIK_')) {
        return {
            ...base,
            brand: 'Güzel Optik',
            name: `Optik Gözlük ${number}`,
            description: 'Gözlük modeli.'
        };
    }
    return { ...base, brand: 'Nişantaşı Kuyumculuk', name: `Kolye ${number}`, description: 'Zincirli kolye.' };
};

const setPbrColor = (material, hex) => {
    if ('albedoColor' in material) material.albedoColor = Color3.FromHexString(hex);
    else if ('diffuseColor' in material) material.diffuseColor = Color3.FromHexString(hex);
};

const tuneMaterial = (material) => {
    if (!material?.name) return false;
    const name = material.name;
    const normalized = name.toLowerCase();
    const fabricMatch = normalized.match(/oz_bk_fabric_(\w+)/);
    const leatherMatch = normalized.match(/oz_bk_leather_(\w+)/);

    if (fabricMatch && FABRIC_COLORS[fabricMatch[1]]) {
        setPbrColor(material, FABRIC_COLORS[fabricMatch[1]]);
        if ('metallic' in material) material.metallic = 0;
        if ('roughness' in material) material.roughness = 0.82;
        if ('environmentIntensity' in material) material.environmentIntensity = 0.42;
        material.backFaceCulling = false;
        if ('twoSidedLighting' in material) material.twoSidedLighting = true;
        return true;
    }

    if (leatherMatch && LEATHER_COLORS[leatherMatch[1]]) {
        setPbrColor(material, LEATHER_COLORS[leatherMatch[1]]);
        if ('metallic' in material) material.metallic = 0;
        if ('roughness' in material) material.roughness = /black|navy|burgundy/.test(leatherMatch[1]) ? 0.38 : 0.46;
        if ('environmentIntensity' in material) material.environmentIntensity = 0.62;
        return true;
    }

    if (/^(ph|hac)_bk_/.test(normalized)) {
        if ('environmentIntensity' in material) material.environmentIntensity = 0.68;
        if (/package|pack_/.test(normalized) && 'roughness' in material) material.roughness = 0.48;
        if (/label_gold/.test(normalized)) {
            if ('metallic' in material) material.metallic = 0.72;
            if ('roughness' in material) material.roughness = 0.3;
        }
        if (/ceramic/.test(normalized) && 'roughness' in material) material.roughness = 0.25;
        if (/coffee|cookie|chocolate/.test(normalized) && 'roughness' in material) material.roughness = 0.78;
        if (/glass|jam/.test(normalized)) {
            material.alpha = /amber/.test(normalized) ? 0.66 : 0.42;
            material.transparencyMode = 2;
            material.needDepthPrePass = true;
            material.backFaceCulling = false;
            if ('roughness' in material) material.roughness = 0.18;
            if (material.subSurface) {
                material.subSurface.isRefractionEnabled = false;
                material.subSurface.isTranslucencyEnabled = false;
            }
        }
        return true;
    }

    if (/tripo_mat_|glasses|optik/i.test(normalized)) {
        if ('environmentIntensity' in material) material.environmentIntensity = 0.85;
        if ('roughness' in material) material.roughness = 0.32;
        if ('metallic' in material) material.metallic = 0.12;
        material.backFaceCulling = false;
        if ('twoSidedLighting' in material) material.twoSidedLighting = true;
        return true;
    }

    return false;
};

const LABEL_STYLES = {
    hacioglu: [
        ['#281817', '#d7b26a', 'TÜRK KAHVESİ', 'ORTA KAVRUM'],
        ['#143429', '#d9b76c', 'ÇEKİRDEK KAHVE', 'TAZE KAVRULMUŞ'],
        ['#172b49', '#d7b26a', 'FİLTRE KAHVE', 'ÖZEL HARMAN'],
        ['#6d2630', '#e0bd75', 'DİBEK KAHVESİ', 'GELENEKSEL'],
        ['#814523', '#f0cf86', 'MENENGİÇ', 'YUMUŞAK İÇİM'],
        ['#39255a', '#e2bd77', 'SEÇME KAHVE', 'USTA KAVRUM']
    ],
    pastaHome: [
        ['#6d2036', '#f1d6ab', 'BUTİK LEZZET', 'GÜNLÜK ÜRETİM'],
        ['#315244', '#f0d7ae', 'EL YAPIMI', 'ÖZEL TARİF'],
        ['#c06a3b', '#fff0ce', 'PASTACI SERİSİ', 'SEÇİLİ ÜRÜN'],
        ['#3f5478', '#f2dcb7', 'TATLI ATÖLYESİ', 'USTA İŞİ'],
        ['#7a3d67', '#f2dbbd', 'HEDİYELİK', 'ÖZEL SUNUM'],
        ['#8b7044', '#fff0c7', 'FIRINDAN', 'TAZE LEZZET']
    ]
};

const drawProductLabel = (texture, { brand, style, seed }) => {
    const context = texture.getContext();
    const width = texture.getSize().width;
    const height = texture.getSize().height;
    const [background, accent, title, subtitle] = style;
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, background);
    gradient.addColorStop(0.58, background);
    gradient.addColorStop(1, '#111111');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    let value = seed >>> 0;
    for (let index = 0; index < 150; index += 1) {
        value = Math.imul(value ^ (value >>> 15), 2246822519) >>> 0;
        const x = value % width;
        value = Math.imul(value ^ (value >>> 13), 3266489917) >>> 0;
        const y = value % height;
        context.fillStyle = index % 3 === 0 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.04)';
        context.fillRect(x, y, 1 + (value % 3), 1 + ((value >>> 3) % 2));
    }

    context.strokeStyle = accent;
    context.lineWidth = 7;
    context.strokeRect(15, 15, width - 30, height - 30);
    context.lineWidth = 2;
    context.strokeRect(27, 27, width - 54, height - 54);
    context.fillStyle = accent;
    context.fillRect(54, 58, width - 108, 2);
    context.fillRect(54, height - 57, width - 108, 2);

    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = accent;
    context.font = '700 34px Georgia, serif';
    context.fillText(brand, width / 2, 49);
    context.font = '700 43px Arial, sans-serif';
    context.fillText(title, width / 2, 119);
    context.font = '600 20px Arial, sans-serif';
    context.letterSpacing = '3px';
    context.fillText(subtitle, width / 2, 164);
    context.font = 'italic 16px Georgia, serif';
    context.fillText('Uzun Çarşı · Kahramanmaraş', width / 2, 205);
    texture.update(false);
};

const createLabelMaterial = (scene, brandKey, variant) => {
    const style = LABEL_STYLES[brandKey][variant % LABEL_STYLES[brandKey].length];
    const brand = brandKey === 'hacioglu' ? 'HACIOĞLU' : 'PASTA HOME';
    const texture = new DynamicTexture(
        `runtime_${brandKey}_label_${variant}`,
        { width: 512, height: 256 },
        scene,
        false,
        Texture.TRILINEAR_SAMPLINGMODE
    );
    texture.hasAlpha = false;
    texture.anisotropicFilteringLevel = 4;
    drawProductLabel(texture, { brand, style, seed: 173 + variant * 7919 });

    const material = new PBRMaterial(`runtime_${brandKey}_label_material_${variant}`, scene);
    material.albedoTexture = texture;
    material.albedoColor = Color3.White();
    material.metallic = 0.08;
    material.roughness = 0.46;
    material.environmentIntensity = 0.62;
    material.backFaceCulling = false;
    material.metadata = { runtimeProductLabel: { brandKey, variant } };
    return material;
};

const applyProductLabels = (meshes) => {
    const cache = new Map();
    let assigned = 0;
    for (const mesh of meshes) {
        const name = String(mesh?.name || '');
        if (!/(?:^|_)Label(?:$|[._])/i.test(name)) continue;
        const brandKey = name.startsWith('HAC_')
            ? 'hacioglu'
            : name.startsWith('PH_')
                ? 'pastaHome'
                : null;
        if (!brandKey || !mesh.getScene?.()) continue;
        const productNumber = Number(name.match(/_(\d{2})(?:_|$)/)?.[1] || 0);
        const variant = productNumber % LABEL_STYLES[brandKey].length;
        const key = `${brandKey}:${variant}`;
        let material = cache.get(key);
        if (!material) {
            material = createLabelMaterial(mesh.getScene(), brandKey, variant);
            cache.set(key, material);
        }
        mesh.material = material;
        assigned += 1;
    }
    return { assigned, materials: cache.size };
};

export const applyProductMaterialQuality = (meshes) => {
    const materials = new Set();
    for (const mesh of meshes) {
        const candidates = mesh?.material?.subMaterials || [mesh?.material];
        candidates.filter(Boolean).forEach((candidate) => materials.add(candidate));
    }

    let tuned = 0;
    materials.forEach((material) => {
        const wasFrozen = material.isFrozen;
        if (wasFrozen) material.unfreeze();
        if (tuneMaterial(material)) tuned += 1;
        if (wasFrozen) material.freeze();
    });
    const labels = applyProductLabels(meshes);
    return { total: materials.size, tuned, labels };
};

export const createModeledProductCatalog = (meshes) => {
    const products = new Map();
    const originalState = new Map();

    for (const mesh of meshes) {
        if (!mesh?.geometry && !mesh?.sourceMesh?.geometry) continue;
        let productId = mesh?.metadata?.modeledProductId
            || productIdFromHierarchy(mesh)
            || identifyProduct(mesh.name || '');

        // Genel düğüm adları Güzel Optik sahne konumuyla sınırlandırılır.
        if (productId?.startsWith('GLASSES_BIGSHELF_')) {
            mesh.computeWorldMatrix(true);
            const pos = mesh.getAbsolutePosition();
            const absX = Math.abs(pos.x);
            const isOptikStore = absX >= 23 && absX <= 33 && pos.z >= -4 && pos.z <= 22;
            if (!isOptikStore) {
                productId = null;
            }
        }

        if (!productId) continue;

        if (!products.has(productId)) products.set(productId, { id: productId, meshes: [], names: [] });
        const product = products.get(productId);
        product.meshes.push(mesh);
        product.names.push(mesh.name || productId);
        originalState.set(mesh, { isPickable: mesh.isPickable, metadata: mesh.metadata });
        mesh.isPickable = true;
        mesh.metadata = { ...(mesh.metadata || {}), modeledProductId: productId };
    }

    for (const [id, product] of products) {
        product.details = descriptorFor(id, product.names);
        product.meshes.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
        product.inspectMeshes = product.meshes.filter((mesh) => !DISPLAY_COMPONENT_PATTERN.test(mesh.name));
        if (product.inspectMeshes.length === 0) product.inspectMeshes = product.meshes;
    }

    const productMeshes = [...products.values()].reduce((sum, product) => sum + product.meshes.length, 0);
    return {
        products,
        productCount: products.size,
        meshCount: productMeshes,
        get(productId) {
            return products.get(productId) || null;
        },
        dispose() {
            originalState.forEach((state, mesh) => {
                if (mesh.isDisposed?.()) return;
                mesh.isPickable = state.isPickable;
                mesh.metadata = state.metadata;
            });
        }
    };
};

export const __productCatalogInternals = {
    identifyProduct,
    productIdFromMetadata,
    productIdFromHierarchy,
    descriptorFor,
    numberedSuffix
};
