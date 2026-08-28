import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspace = process.cwd();
const sourceDirectory = path.join(workspace, 'Products');
const publicDirectory = path.join(workspace, 'public', 'models', 'products');

const turkishAscii = (value) => String(value)
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C');

const slugify = (value) => turkishAscii(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const displayName = (value) => String(value)
    .replace(/([a-zçğıöşü])([A-ZÇĞİÖŞÜ])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase('tr-TR'));

const isGlb = (buffer) => buffer.length >= 20
    && buffer.toString('ascii', 0, 4) === 'glTF'
    && buffer.readUInt32LE(4) === 2
    && buffer.readUInt32LE(8) === buffer.length;

const glbJson = (buffer) => {
    if (!isGlb(buffer) || buffer.readUInt32LE(16) !== 0x4E4F534A) return null;
    try {
        const jsonLength = buffer.readUInt32LE(12);
        return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trim());
    } catch {
        return null;
    }
};

const semanticText = (document, basename) => turkishAscii([
    basename,
    ...(document?.nodes || []).map((entry) => entry?.name),
    ...(document?.meshes || []).map((entry) => entry?.name),
    ...(document?.materials || []).map((entry) => entry?.name)
].filter(Boolean).join(' ')).toLowerCase();

const classifyProduct = (document, basename) => {
    const semantic = semanticText(document, basename);
    const basenameSemantic = turkishAscii(basename).toLowerCase();
    const eyewearSignals = ['gozluk', 'cerceve', 'camli', 'lens', 'eyeglass', 'sunglass', 'frame']
        .filter((term) => semantic.includes(term));
    const jewelrySignals = ['yuzuk', 'altin', 'gold', 'diamond', 'elmas', 'yakut', 'zumrut', 'ring', 'gem', 'ceyrek', 'gram']
        .filter((term) => semantic.includes(term));
    const homeSignals = ['tencere', 'tava', 'kase', 'vazo', 'kavanoz', 'termos', 'surahi', 'caydanlik', 'ketil', 'porselen', 'bakir']
        .filter((term) => semantic.includes(term));
    const explicitEyewear = /gozluk|cerceve/.test(basenameSemantic);
    const explicitJewelry = /yuzuk|altin/.test(basenameSemantic);
    const explicitHome = /tencere|tava|kase|vazo|kavanoz|termos|surahi|caydanlik|ketil|porselen|bakir/.test(basenameSemantic);
    const productType = explicitHome
        ? 'home'
        : explicitEyewear
        ? 'eyewear'
        : explicitJewelry
            ? 'jewelry'
            : homeSignals.length > Math.max(eyewearSignals.length, jewelrySignals.length)
                ? 'home'
                : eyewearSignals.length > jewelrySignals.length ? 'eyewear' : 'jewelry';
    return {
        productType,
        storeId: productType === 'eyewear' ? 'guzel-optik' : productType === 'home' ? 'sude-home' : 'mawus',
        confidence: explicitEyewear || explicitJewelry || explicitHome || Math.max(eyewearSignals.length, jewelrySignals.length, homeSignals.length) >= 2
            ? 'high'
            : 'medium',
        signals: productType === 'eyewear' ? eyewearSignals : productType === 'home' ? homeSignals : jewelrySignals
    };
};

const categoryFor = (basename) => {
    const normalized = turkishAscii(basename).toLowerCase();
    if (/gozluk|cerceve|camli/.test(normalized)) return 'Gözlük';
    if (/yuzuk/.test(normalized)) return 'Yüzük';
    if (/altin/.test(normalized)) return 'Altın';
    if (/termos|ketil/.test(normalized)) return 'Termos & Kettle';
    if (/caydanlik/.test(normalized)) return 'Çaydanlık';
    if (/tencere/.test(normalized)) return 'Tencere';
    if (/tava/.test(normalized)) return 'Tava';
    if (/surahi/.test(normalized)) return 'Sürahi';
    if (/kavanoz/.test(normalized)) return 'Kavanoz';
    if (/kase/.test(normalized)) return 'Kase';
    if (/vazo/.test(normalized)) return 'Vazo';
    return 'Diğer';
};

const filenames = (await readdir(sourceDirectory))
    .filter((filename) => path.extname(filename).toLowerCase() === '.glb')
    .sort((a, b) => a.localeCompare(b, 'tr'));

const models = [];
const expectedDestinations = new Set();
for (const filename of filenames) {
    const sourcePath = path.join(sourceDirectory, filename);
    const buffer = await readFile(sourcePath);
    const document = glbJson(buffer);
    const basename = path.basename(filename, path.extname(filename));
    const slug = slugify(basename) || `product-${models.length + 1}`;
    const classification = classifyProduct(document, basename);
    const storeId = classification.storeId;
    const destinationDirectory = path.join(publicDirectory, storeId);
    const destinationFilename = `${slug}.glb`;
    const destinationPath = path.join(destinationDirectory, destinationFilename);
    await mkdir(destinationDirectory, { recursive: true });
    if (!document?.meshes?.length) {
        await rm(destinationPath, { force: true });
        console.warn(`Geçersiz GLB atlandı: ${filename}`);
        continue;
    }
    await copyFile(sourcePath, destinationPath);
    expectedDestinations.add(path.resolve(destinationPath));
    models.push({
        id: slug.toUpperCase().replace(/-/g, '_'),
        name: displayName(basename),
        filename,
        url: `/models/products/${storeId}/${destinationFilename}`,
        storeId,
        productType: classification.productType,
        classification: {
            confidence: classification.confidence,
            signals: classification.signals
        },
        category: categoryFor(basename),
        sizeBytes: buffer.length,
        meshCount: document.meshes.length
    });
}

for (const storeId of ['guzel-optik', 'sude-home', 'mawus']) {
    const directory = path.join(publicDirectory, storeId);
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.glb') continue;
        const candidate = path.resolve(directory, entry.name);
        if (!expectedDestinations.has(candidate)) await rm(candidate, { force: true });
    }
}

await mkdir(publicDirectory, { recursive: true });
await writeFile(
    path.join(publicDirectory, 'catalog.json'),
    `${JSON.stringify({ version: 1, models }, null, 2)}\n`,
    'utf8'
);

console.log(`Ürün kataloğu: ${models.length} geçerli GLB.`);
