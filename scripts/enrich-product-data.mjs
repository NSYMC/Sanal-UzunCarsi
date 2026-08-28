import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspace = process.cwd();
const productsPath = path.join(workspace, 'src', 'data', 'products.json');
const manifestPath = path.join(workspace, 'public', 'models', 'guzel-optik', 'products.json');
const bindingsPath = path.join(workspace, 'src', 'data', 'scene-product-bindings.json');

const profiles = {
    1: {
        name: 'Kırmızı Camlı Metal Güneş Gözlüğü', price: 2290, model: 'kirmizi-camli-gozluk',
        description: 'Kırmızı camlı metal güneş gözlüğü.',
        tags: ['kırmızı cam', 'metal çerçeve', 'güneş gözlüğü']
    },
    2: {
        name: 'Yeşil Metal Çerçeveli Gözlük', price: 1790, model: 'yesil-gozluk',
        description: 'Yeşil camlı metal gözlük.',
        tags: ['yeşil', 'metal çerçeve']
    },
    3: {
        name: 'Sarı Plastik Çerçeveli Gözlük', price: 790, model: 'plastik-sari-gozluk',
        description: 'Sarı plastik çerçeveli gözlük.',
        tags: ['sarı', 'plastik çerçeve']
    },
    4: {
        name: 'Turuncu Camlı Gözlük', price: 1690, model: 'turuncu-gozluk-turuncu-cam',
        description: 'Turuncu camlı güneş gözlüğü.',
        tags: ['turuncu cam', 'güneş gözlüğü']
    },
    5: {
        name: 'Yeşil Camlı Plastik Gözlük', price: 990, model: 'plastik-yesil-cam-gozluk',
        description: 'Yeşil camlı plastik gözlük.',
        tags: ['yeşil cam', 'plastik çerçeve']
    },
    6: {
        name: 'Mavi Camlı Gözlük', price: 1890, model: 'mavi-camli-gozluk',
        description: 'Mavi camlı gözlük.',
        tags: ['mavi cam', 'güneş gözlüğü']
    },
    7: {
        name: 'Siyah Çerçevesiz Gözlük', price: 1490, model: 'siyah-cercevesiz-gozluk',
        description: 'Siyah çerçevesiz gözlük.',
        tags: ['siyah', 'çerçevesiz']
    },
    8: {
        name: 'Turuncu Metal Gözlük', price: 1990, model: 'turuncu-gozluk',
        description: 'Turuncu metal çerçeveli gözlük.',
        tags: ['turuncu', 'metal çerçeve']
    },
    9: {
        name: 'Mavi Camlı Gözlük', price: 1890, model: 'mavi-camli-gozluk',
        description: 'Mavi camlı gözlük.',
        tags: ['mavi cam', 'güneş gözlüğü']
    },
    10: {
        name: 'Yeşil Camlı Metal Güneş Gözlüğü', price: 2290, model: 'yesil-camli-gozluk',
        description: 'Yeşil camlı metal güneş gözlüğü.',
        tags: ['yeşil cam', 'metal çerçeve', 'güneş gözlüğü']
    },
    11: {
        name: 'Siyah Çerçevesiz Gözlük', price: 1490, model: 'siyah-cercevesiz-gozluk',
        description: 'Siyah çerçevesiz gözlük.',
        tags: ['siyah', 'çerçevesiz']
    },
    12: {
        name: 'Yeşil Plastik Gözlük', price: 890, model: 'yesil-plastik-gozluk',
        description: 'Yeşil plastik çerçeveli gözlük.',
        tags: ['yeşil', 'plastik çerçeve']
    },
    13: {
        name: 'Çerçevesiz Güneş Gözlüğü', price: 1590, model: 'cercevesiz-gozluk',
        description: 'Çerçevesiz güneş gözlüğü.',
        tags: ['çerçevesiz', 'güneş gözlüğü']
    },
    14: {
        name: 'Turuncu Metal Gözlük', price: 1990, model: 'turuncu-gozluk',
        description: 'Turuncu metal çerçeveli gözlük.',
        tags: ['turuncu', 'metal çerçeve']
    }
};

const productData = JSON.parse(await readFile(productsPath, 'utf8'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const bindingData = JSON.parse(await readFile(bindingsPath, 'utf8'));
const variantById = new Map(manifest.products.map((entry) => [entry.id, Number(entry.variant)]));

let enriched = 0;
const existingById = new Map(productData.products.filter(({ storeId }) => storeId === 'guzel-optik').map((product) => [product.id, product]));
const opticalProducts = manifest.products.map((entry) => {
    const product = existingById.get(entry.id) || {
        id: entry.id,
        storeId: 'guzel-optik',
        name: `Optik Ürün ${entry.id.split('_').at(-1)}`,
        category: 'Gözlük',
        price: null,
        currency: 'TRY',
        tags: ['güzel optik', 'gözlük'],
        highQualityModel: null,
        previewTransform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        active: true
    };
    const variant = variantById.get(product.id);
    const profile = profiles[variant];
    if (!profile) return product;
    const code = product.id.split('_').at(-1);
    Object.assign(product, {
        name: `${profile.name} · ${code}`,
        brand: 'Güzel Optik',
        category: 'Gözlük',
        price: profile.price,
        currency: 'TRY',
        priceType: 'catalog',
        priceNote: 'Mağaza tarafından tanımlanan katalog fiyatıdır.',
        description: profile.description,
        tags: ['güzel optik', 'gözlük', ...profile.tags],
        highQualityModel: `/models/products/guzel-optik/${profile.model}.glb`,
        modelVariant: variant
    });
    enriched += 1;
    return product;
});

productData.products = [
    ...productData.products.filter(({ storeId }) => storeId !== 'guzel-optik'),
    ...opticalProducts
];

bindingData.bindings = [
    ...bindingData.bindings.filter(({ storeId }) => storeId !== 'guzel-optik'),
    ...manifest.products.map((entry) => ({
        id: `binding:guzel-optik:${entry.id}`,
        storeId: 'guzel-optik',
        productId: entry.id,
        meshNames: [entry.sourceName],
        meshNamePatterns: [`^${entry.id}(?:_V\\d+)?$`],
        bounds: { center: entry.center, size: entry.size }
    }))
];

await writeFile(productsPath, `${JSON.stringify(productData, null, 2)}\n`, 'utf8');
await writeFile(bindingsPath, `${JSON.stringify(bindingData, null, 2)}\n`, 'utf8');
console.log(`${enriched} optik ürün kaydı GLB varyantlarıyla eşleştirildi.`);
