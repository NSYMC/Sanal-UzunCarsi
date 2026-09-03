import { open, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const publicDirectory = path.resolve('public');
const variantIndex = process.argv.indexOf('--variant');
const assetVariant = variantIndex >= 0 ? process.argv[variantIndex + 1] : 'original';

const filesUnder = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await filesUnder(target));
        else files.push(target);
    }
    return files;
};

const validateGlb = async (file) => {
    const info = await stat(file);
    if (info.size < 20) throw new Error(`Boş veya eksik GLB: ${path.relative('.', file)}`);
    const handle = await open(file, 'r');
    try {
        const header = Buffer.alloc(12);
        await handle.read(header, 0, header.length, 0);
        if (header.toString('ascii', 0, 4) !== 'glTF' || header.readUInt32LE(4) !== 2) {
            throw new Error(`Geçersiz GLB başlığı: ${path.relative('.', file)}`);
        }
        if (header.readUInt32LE(8) !== info.size) {
            throw new Error(`Eksik GLB verisi: ${path.relative('.', file)}`);
        }
    } finally {
        await handle.close();
    }
};

const validateEtc1sGlb = async (file) => {
    const handle = await open(file, 'r');
    try {
        const chunkHeader = Buffer.alloc(8);
        await handle.read(chunkHeader, 0, 8, 12);
        const jsonLength = chunkHeader.readUInt32LE(0);
        if (chunkHeader.toString('ascii', 4, 8) !== 'JSON') {
            throw new Error(`GLB JSON bölümü bulunamadı: ${path.relative('.', file)}`);
        }
        const jsonBuffer = Buffer.alloc(jsonLength);
        await handle.read(jsonBuffer, 0, jsonLength, 20);
        const document = JSON.parse(jsonBuffer.toString('utf8').trimEnd());
        if ((document.textures?.length || 0) > 0 && !document.extensionsUsed?.includes('KHR_texture_basisu')) {
            throw new Error(`ETC1S dokuları bulunamadı: ${path.relative('.', file)}`);
        }
    } finally {
        await handle.close();
    }
};

const runtimeFiles = await filesUnder(publicDirectory);
const glbFiles = runtimeFiles.filter((file) => path.extname(file).toLowerCase() === '.glb');
if (glbFiles.length === 0) throw new Error('Runtime GLB dosyaları bulunamadı. Git LFS dosyalarını indirin.');
for (const file of glbFiles) await validateGlb(file);

const requiredFiles = [
    'public/models/world/always.glb',
    'public/models/world/outside.glb',
    'public/models/guzel-optik/store-environment.glb',
    'public/models/guzel-optik/product-proxies.glb',
    'public/models/guzel-optik/product-library.glb',
    'public/models/sude-home/store-raw.glb',
    'public/models/nisantasi/store-raw.glb',
    'public/environments/store-ocean-sky.hdr'
];

for (const required of requiredFiles) {
    const info = await stat(path.resolve(required)).catch(() => null);
    if (!info?.isFile() || info.size === 0) throw new Error(`Runtime dosyası eksik: ${required}`);
}

if (assetVariant === 'etc1s') {
    const compressedFiles = [
        'public/models/etc1s/world/outside.glb',
        'public/models/etc1s/guzel-optik/store-environment.glb',
        'public/models/materials-optimized/etc1s/guzel-optik/store-environment.glb'
    ];
    for (const required of compressedFiles) {
        const file = path.resolve(required);
        await validateGlb(file);
        await validateEtc1sGlb(file);
    }
}

console.log(`${glbFiles.length} GLB ve ${requiredFiles.length} zorunlu runtime dosyası doğrulandı (${assetVariant}).`);
