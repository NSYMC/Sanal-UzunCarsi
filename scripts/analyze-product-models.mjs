import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const sourceDirectory = path.join(process.cwd(), 'Products');

const readDocument = (buffer) => {
    if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') return null;
    if (buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) return null;
    const jsonLength = buffer.readUInt32LE(12);
    if (buffer.readUInt32LE(16) !== 0x4E4F534A || 20 + jsonLength > buffer.length) return null;
    try {
        return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trim());
    } catch {
        return null;
    }
};

const primitiveTriangles = (primitive, accessors) => {
    const count = primitive.indices == null
        ? accessors[primitive.attributes?.POSITION]?.count || 0
        : accessors[primitive.indices]?.count || 0;
    const mode = primitive.mode ?? 4;
    if (mode === 4) return Math.floor(count / 3);
    if (mode === 5 || mode === 6) return Math.max(0, count - 2);
    return 0;
};

const files = (await readdir(sourceDirectory))
    .filter((filename) => path.extname(filename).toLowerCase() === '.glb')
    .sort((a, b) => a.localeCompare(b, 'tr'));

const rows = [];
for (const filename of files) {
    const buffer = await readFile(path.join(sourceDirectory, filename));
    const document = readDocument(buffer);
    if (!document) {
        rows.push({ filename, valid: false, sizeMB: buffer.length / 1024 / 1024 });
        continue;
    }
    const primitives = (document.meshes || []).flatMap((mesh) => mesh.primitives || []);
    if (!document.meshes?.length || !primitives.length) {
        rows.push({ filename, valid: false, sizeMB: buffer.length / 1024 / 1024 });
        continue;
    }
    const triangles = primitives.reduce((sum, primitive) => sum + primitiveTriangles(primitive, document.accessors || []), 0);
    rows.push({
        filename,
        valid: true,
        sizeMB: buffer.length / 1024 / 1024,
        nodes: document.nodes?.length || 0,
        meshes: document.meshes?.length || 0,
        primitives: primitives.length,
        triangles,
        materials: document.materials?.length || 0,
        textures: document.textures?.length || 0,
        images: document.images?.length || 0,
        materialNames: (document.materials || []).map((material) => material.name).filter(Boolean).slice(0, 8).join(', '),
        meshNames: (document.meshes || []).map((mesh) => mesh.name).filter(Boolean).slice(0, 8).join(', ')
        ,nodeNames: (document.nodes || []).map((node) => node.name).filter(Boolean).slice(0, 12).join(', ')
    });
}

console.table(rows.map((row) => ({
    dosya: row.filename,
    durum: row.valid ? 'geçerli' : 'BOZUK',
    MB: row.sizeMB.toFixed(2),
    mesh: row.meshes ?? '-',
    primitive: row.primitives ?? '-',
    üçgen: row.triangles?.toLocaleString('tr-TR') ?? '-',
    materyal: row.materials ?? '-',
    doku: row.textures ?? '-'
})));

const valid = rows.filter((row) => row.valid);
const invalid = rows.filter((row) => !row.valid);
console.log(`Toplam: ${rows.length} dosya, ${valid.length} geçerli, ${invalid.length} bozuk, ${valid.reduce((sum, row) => sum + row.triangles, 0).toLocaleString('tr-TR')} üçgen.`);
for (const row of valid.filter((entry) => entry.meshes > 40 || entry.triangles > 250000)) {
    console.warn(`Ağır ürün: ${row.filename} · ${row.meshes} mesh · ${row.triangles.toLocaleString('tr-TR')} üçgen · materyaller: ${row.materialNames || 'adsız'}`);
}
for (const row of invalid) console.warn(`Geçersiz GLB: ${row.filename}`);
if (process.argv.includes('--details')) {
    for (const row of valid) {
        console.log(`\n${row.filename}`);
        console.log(`  Materyaller: ${row.materialNames || 'adsız'}`);
        console.log(`  Meshler: ${row.meshNames || 'adsız'}`);
        console.log(`  Düğümler: ${row.nodeNames || 'adsız'}`);
    }
}
