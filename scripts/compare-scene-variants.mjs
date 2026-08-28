import { open } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const pairs = [
    ['public/models/world/outside.glb', 'public/models/etc1s/world/outside.glb'],
    ['public/models/guzel-optik/store-environment.glb', 'public/models/etc1s/guzel-optik/store-environment.glb']
];

const readDocument = async (relativePath) => {
    const handle = await open(path.join(projectRoot, relativePath), 'r');
    try {
        const header = Buffer.alloc(20);
        await handle.read(header, 0, header.length, 0);
        if (header.toString('ascii', 0, 4) !== 'glTF') throw new Error(`GLB değil: ${relativePath}`);
        const jsonLength = header.readUInt32LE(12);
        const json = Buffer.alloc(jsonLength);
        await handle.read(json, 0, jsonLength, 20);
        return JSON.parse(json.toString('utf8').trimEnd());
    } finally {
        await handle.close();
    }
};

const summarize = (document) => {
    const primitives = (document.meshes || []).flatMap((mesh) => mesh.primitives || []);
    const accessorCount = (index) => document.accessors?.[index]?.count || 0;
    return {
        scenes: document.scenes?.length || 0,
        nodes: document.nodes?.length || 0,
        meshes: document.meshes?.length || 0,
        materials: document.materials?.length || 0,
        primitives: primitives.length,
        vertices: primitives.reduce((sum, primitive) => sum + accessorCount(primitive.attributes?.POSITION), 0),
        indices: primitives.reduce((sum, primitive) => sum + accessorCount(primitive.indices), 0),
        nodeNames: (document.nodes || []).map((node) => node.name || ''),
        meshNames: (document.meshes || []).map((mesh) => mesh.name || '')
    };
};

let failed = false;
for (const [originalPath, compressedPath] of pairs) {
    const original = await readDocument(originalPath);
    const compressed = await readDocument(compressedPath);
    const originalSummary = summarize(original);
    const compressedSummary = summarize(compressed);
    const same = JSON.stringify(originalSummary) === JSON.stringify(compressedSummary);
    const basisu = compressed.extensionsUsed?.includes('KHR_texture_basisu') || !(compressed.textures?.length);
    console.log(`${same && basisu ? 'OK' : 'HATA'} ${path.basename(originalPath)}: ${originalSummary.nodes} düğüm, ${originalSummary.meshes} mesh, ${originalSummary.primitives} primitive`);
    if (!same || !basisu) failed = true;
}

if (failed) throw new Error('Sıkıştırılmış sahne yapısı orijinalle eşleşmiyor.');
