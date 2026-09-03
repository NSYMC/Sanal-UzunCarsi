import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const projectRoot = process.cwd();
const outputDirectory = path.join(projectRoot, 'public', 'models', 'selection');
const outputPath = path.join(outputDirectory, 'selection-world.glb');
const manifestPath = path.join(outputDirectory, 'manifest.json');
const temporaryPath = path.join(outputDirectory, 'selection-world.building.glb');

const sources = [
    { id: 'outside', path: 'public/models/world/outside.glb', preserveWorldTextures: true },
    { id: 'always', path: 'public/models/world/always.glb' },
    { id: 'guzel-optik', path: 'public/models/guzel-optik/store-environment.glb' },
    { id: 'sude-home', path: 'public/models/sude-home/store-raw.glb' },
    { id: 'nisantasi', path: 'public/models/nisantasi/store-raw.glb' },
    { id: 'telefon', path: 'public/models/telefon/store-raw.glb' }
];

const palettes = {
    outside: [
        ['city-ivory', [0.91, 0.86, 0.78, 1]], ['city-sand', [0.82, 0.75, 0.65, 1]],
        ['city-clay', [0.76, 0.66, 0.58, 1]], ['city-fog', [0.78, 0.80, 0.78, 1]],
        ['city-sage', [0.70, 0.76, 0.68, 1]], ['city-peach', [0.88, 0.72, 0.62, 1]],
        ['city-stone', [0.64, 0.62, 0.59, 1]]
    ],
    always: [
        ['carsi-cream', [0.94, 0.87, 0.75, 1]], ['carsi-sand', [0.85, 0.76, 0.63, 1]],
        ['carsi-sage', [0.72, 0.78, 0.68, 1]], ['carsi-sky', [0.69, 0.78, 0.84, 1]],
        ['carsi-lilac', [0.78, 0.72, 0.82, 1]], ['carsi-apricot', [0.91, 0.72, 0.57, 1]],
        ['carsi-stone', [0.66, 0.63, 0.59, 1]]
    ],
    'guzel-optik': [
        ['optik-pearl', [0.98, 0.88, 0.91, 1]], ['optik-blush', [0.93, 0.61, 0.70, 1]],
        ['optik-rose', [0.84, 0.48, 0.60, 1]], ['optik-sky', [0.67, 0.79, 0.90, 1]],
        ['optik-lilac', [0.78, 0.68, 0.88, 1]], ['optik-coral', [0.94, 0.67, 0.62, 1]],
        ['optik-plum', [0.54, 0.43, 0.54, 1]]
    ],
    'sude-home': [
        ['sude-ivory', [0.92, 0.96, 0.88, 1]], ['sude-mint', [0.57, 0.82, 0.70, 1]],
        ['sude-sage', [0.43, 0.70, 0.60, 1]], ['sude-aqua', [0.57, 0.79, 0.80, 1]],
        ['sude-blue', [0.58, 0.70, 0.82, 1]], ['sude-lime', [0.76, 0.84, 0.59, 1]],
        ['sude-forest', [0.34, 0.52, 0.46, 1]]
    ],
    nisantasi: [
        ['nisantasi-cream', [0.98, 0.91, 0.77, 1]], ['nisantasi-apricot', [0.95, 0.72, 0.47, 1]],
        ['nisantasi-honey', [0.87, 0.61, 0.31, 1]], ['nisantasi-champagne', [0.91, 0.79, 0.59, 1]],
        ['nisantasi-mauve', [0.73, 0.61, 0.70, 1]], ['nisantasi-coral', [0.91, 0.61, 0.49, 1]],
        ['nisantasi-cocoa', [0.53, 0.42, 0.35, 1]]
    ],
    telefon: [
        ['telefon-frost', [0.93, 0.95, 0.97, 1]], ['telefon-steel', [0.72, 0.77, 0.83, 1]],
        ['telefon-slate', [0.46, 0.53, 0.62, 1]], ['telefon-ink', [0.24, 0.28, 0.34, 1]],
        ['telefon-azure', [0.58, 0.74, 0.88, 1]], ['telefon-mint', [0.66, 0.84, 0.80, 1]],
        ['telefon-amber', [0.92, 0.72, 0.45, 1]]
    ]
};

const hashFile = (filename) => new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filename);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
});

const isGlb = async (filename) => {
    const handle = await import('node:fs/promises').then(({ open }) => open(filename, 'r')).catch(() => null);
    if (!handle) return false;
    try {
        const header = Buffer.alloc(12);
        await handle.read(header, 0, header.length, 0);
        return header.toString('ascii', 0, 4) === 'glTF'
            && header.readUInt32LE(4) === 2
            && header.readUInt32LE(8) === (await handle.stat()).size;
    } finally {
        await handle.close();
    }
};

const stablePaletteIndex = (value, paletteLength) => {
    let hash = 2166136261;
    for (const character of value) {
        hash ^= character.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash) % paletteLength;
};

const triangleCount = (document) => document.getRoot().listMeshes().reduce((total, mesh) => (
    total + mesh.listPrimitives().reduce((meshTotal, primitive) => {
        const indices = primitive.getIndices();
        const positions = primitive.getAttribute('POSITION');
        return meshTotal + Math.floor((indices?.getCount() || positions?.getCount() || 0) / 3);
    }, 0)
), 0);

const materialForName = (materials, name = '') => {
    const normalized = name.toLocaleLowerCase('tr-TR');
    if (/cam|glass|lens|ayna|mirror|window|vitrin/.test(normalized)) return materials[3];
    if (/gold|alt.n|metal|silver|chrome|bak.r|copper/.test(normalized)) return materials[5];
    if (/wood|ah.ap|tahta|timber/.test(normalized)) return materials[0];
    if (/black|siyah|dark|rubber|lastik/.test(normalized)) return materials[6];
    return materials[stablePaletteIndex(normalized || 'default', materials.length)];
};

const createPastelPalette = (document, sourceId, unlitExtension) => (palettes[sourceId] || palettes.always).map(([name, color]) => document
    .createMaterial(`${sourceId}:${name}`)
    .setBaseColorFactor(color)
    .setMetallicFactor(0)
    .setRoughnessFactor(0.92)
    .setDoubleSided(false)
    .setExtension('KHR_materials_unlit', unlitExtension.createUnlit()));

const applyPastelMaterials = (document, sourceId) => {
    const root = document.getRoot();
    const originalMaterials = [...root.listMaterials()];
    const originalTextures = [...root.listTextures()];
    const unlitExtension = document.createExtension(KHRMaterialsUnlit);
    const materials = createPastelPalette(document, sourceId, unlitExtension);

    for (const mesh of root.listMeshes()) {
        for (const primitive of mesh.listPrimitives()) {
            const originalName = primitive.getMaterial()?.getName() || mesh.getName();
            primitive.setMaterial(materialForName(materials, originalName));
        }
    }

    for (const material of originalMaterials) material.dispose();
    for (const texture of originalTextures) texture.dispose();
    return materials.length;
};

const applyWorldMaterials = (document, sourceId) => {
    const root = document.getRoot();
    const originalMaterials = [...root.listMaterials()];
    const originalTextures = [...root.listTextures()];
    const unlitExtension = document.createExtension(KHRMaterialsUnlit);
    const pastelMaterials = createPastelPalette(document, sourceId, unlitExtension);
    const texturedMaterials = new Set();
    const retainedTextures = new Set();

    for (const mesh of root.listMeshes()) {
        for (const primitive of mesh.listPrimitives()) {
            const material = primitive.getMaterial();
            const baseColorTexture = material?.getBaseColorTexture();
            const worldTextureName = `${mesh.getName()} ${material?.getName() || ''} ${baseColorTexture?.getName() || ''}`;
            const isRealWorldTexture = /GIS_Terrain_2km|GIS_LongCarsi_Terrain_Collar|GIS_SATELLITE|GIS_LONG_CARSI_LOCAL|terrain_imagery|long_carsi_imagery/i.test(worldTextureName);
            if (!material || !baseColorTexture || !isRealWorldTexture) {
                primitive.setMaterial(materialForName(pastelMaterials, material?.getName() || mesh.getName()));
                continue;
            }

            texturedMaterials.add(material);
            retainedTextures.add(baseColorTexture);
            for (const extension of material.listExtensions()) extension.dispose();
            material
                .setNormalTexture(null)
                .setOcclusionTexture(null)
                .setEmissiveTexture(null)
                .setMetallicRoughnessTexture(null)
                .setEmissiveFactor([0, 0, 0])
                .setMetallicFactor(0)
                .setRoughnessFactor(1)
                .setAlphaMode('OPAQUE')
                .setDoubleSided(false)
                .setExtension('KHR_materials_unlit', unlitExtension.createUnlit());
        }
    }

    for (const material of originalMaterials) {
        if (!texturedMaterials.has(material)) material.dispose();
    }
    for (const texture of originalTextures) {
        if (!retainedTextures.has(texture)) texture.dispose();
    }
    return {
        materials: texturedMaterials.size + pastelMaterials.length,
        textures: retainedTextures.size
    };
};

const sourceRecords = await Promise.all(sources.map(async (source) => {
    const absolutePath = path.join(projectRoot, source.path);
    const sourceStat = await stat(absolutePath);
    return {
        ...source,
        absolutePath,
        bytes: sourceStat.size,
        sha256: await hashFile(absolutePath)
    };
}));

const previousManifest = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(() => null);
const outputStat = await stat(outputPath).catch(() => null);
const unchanged = outputStat?.isFile()
    && await isGlb(outputPath)
    && previousManifest?.version === 4
    && sourceRecords.every((source) => previousManifest.sources?.some((record) => (
        record.path === source.path && record.sha256 === source.sha256
    )));

if (unchanged) {
    console.log(`Seçim dünyası güncel: ${path.relative(projectRoot, outputPath)}`);
    process.exit(0);
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
        'meshopt.decoder': MeshoptDecoder,
        'meshopt.encoder': MeshoptEncoder
    });
const target = new Document();
const targetScene = target.createScene('SELECTION_WORLD');
const summaries = [];

for (const source of sourceRecords) {
    console.log(`Seçim kaynağı hazırlanıyor: ${source.id}`);
    const document = await io.read(source.absolutePath);
    const beforeTriangles = triangleCount(document);
    const beforeMaterials = document.getRoot().listMaterials().length;
    const beforeTextures = document.getRoot().listTextures().length;
    let pastelMaterials = 0;
    let retainedTextures = 0;
    if (source.preserveWorldTextures) {
        const worldSummary = applyWorldMaterials(document, source.id);
        pastelMaterials = worldSummary.materials;
        retainedTextures = worldSummary.textures;
    } else {
        pastelMaterials = applyPastelMaterials(document, source.id);
    }

    for (const node of document.getRoot().listNodes()) node.setName(`${source.id}:${node.getName() || 'node'}`);
    for (const mesh of document.getRoot().listMeshes()) mesh.setName(`${source.id}:${mesh.getName() || 'mesh'}`);

    const propertyMap = mergeDocuments(target, document);
    for (const sourceScene of document.getRoot().listScenes()) {
        for (const child of sourceScene.listChildren()) {
            const mergedChild = propertyMap.get(child);
            if (mergedChild) targetScene.addChild(mergedChild);
        }
        propertyMap.get(sourceScene)?.dispose();
    }

    summaries.push({
        id: source.id,
        path: source.path,
        bytes: source.bytes,
        sha256: source.sha256,
        triangles: beforeTriangles,
        materialsBefore: beforeMaterials,
        texturesBefore: beforeTextures,
        materialsAfter: pastelMaterials,
        texturesAfter: retainedTextures,
        preservedWorldTextures: Boolean(source.preserveWorldTextures)
    });
}

const expectedTriangles = summaries.reduce((total, source) => total + source.triangles, 0);
const outputTriangles = triangleCount(target);
if (expectedTriangles !== outputTriangles) {
    throw new Error(`Seçim geometrisi değişti: ${expectedTriangles} → ${outputTriangles} üçgen.`);
}

await target.transform(unpartition());
await io.write(temporaryPath, target);
await rm(outputPath, { force: true });
await rename(temporaryPath, outputPath);

const finalStat = await stat(outputPath);
const manifest = {
    version: 4,
    generatedAt: new Date().toISOString(),
    output: 'public/models/selection/selection-world.glb',
    outputBytes: finalStat.size,
    outputSha256: await hashFile(outputPath),
    triangles: outputTriangles,
    sources: summaries
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Seçim dünyası hazır: ${(finalStat.size / 1024 / 1024).toFixed(1)} MB, ${outputTriangles.toLocaleString('tr-TR')} üçgen.`);
