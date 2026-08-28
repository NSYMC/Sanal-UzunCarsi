import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { __productCatalogInternals } from '../src/product-catalog.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scenePath = process.argv[2]
    ? path.resolve(projectRoot, process.argv[2])
    : path.join(projectRoot, 'public', 'models', 'tour-v2', 'scene-sahne-ktx2-arch-lod.glb');
const file = await readFile(scenePath);
if (file.toString('ascii', 0, 4) !== 'glTF') throw new Error('Geçersiz GLB dosyası.');

const jsonLength = file.readUInt32LE(12);
const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8').trim());
const products = new Map();
let explicitProductNodes = 0;

for (const node of json.nodes ?? []) {
    if (node.mesh == null) continue;
    const extras = node.extras || {};
    const explicitId = extras.web_product_id ?? extras.product_id;
    const id = (typeof explicitId === 'string' || typeof explicitId === 'number')
        ? String(explicitId).trim()
        : __productCatalogInternals.identifyProduct(node.name || '');
    if (!id) continue;
    if (explicitId != null) explicitProductNodes += 1;
    if (!products.has(id)) products.set(id, []);
    products.get(id).push(node.name || id);
}

const countPrefix = (prefix) => [...products.keys()].filter((id) => id.startsWith(prefix)).length;
const hasExplicitCatalog = explicitProductNodes > 0;
const isSingleOptikStore = countPrefix('OPTIK_PRODUCT_') > 0;
const requirements = isSingleOptikStore
    ? [
        ['Güzel Optik', 'OPTIK_PRODUCT_', 1]
    ]
    : hasExplicitCatalog
    ? [
        ['Gözlük & Optik extras kimliği', 'optik_', 180],
        ['Mawuş extras kimliği', 'MAWUS_', 90]
    ]
    : [
        ['Sude Züccaciye', 'SUDE_', 50],
        ['Özmin Çantaları', 'OZ_BAG_', 10],
        ['Gözlük & Optik', 'GLASSES_', 60],
        ['Mawuş Kuyumculuk', 'MAW', 20],
        ['Y-serisi raf ürünleri', 'Y_', 100]
    ];

const failures = requirements
    .map(([label, prefix, minimum]) => ({ label, minimum, actual: countPrefix(prefix) }))
    .filter(({ actual, minimum }) => actual < minimum);

const minimumProductCount = isSingleOptikStore ? 1 : 250;
if (products.size < minimumProductCount) {
    failures.push({ label: 'Toplam incelenebilir ürün', minimum: minimumProductCount, actual: products.size });
}

if (failures.length) {
    const list = failures
        .map(({ label, minimum, actual }) => `${label}: ${actual} (beklenen en az ${minimum})`)
        .join('\n');
    throw new Error(`Ürün kataloğu doğrulanamadı:\n${list}`);
}

const meshCount = [...products.values()].reduce((total, meshes) => total + meshes.length, 0);
console.log(
    `Ürün kataloğu doğrulandı: ${products.size} ürün grubu, ${meshCount} gerçek model parçası, `
    + `${explicitProductNodes} extras kimlikli mesh.`
);
