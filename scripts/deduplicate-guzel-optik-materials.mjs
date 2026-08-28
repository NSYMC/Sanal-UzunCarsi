import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const cliPath = path.join(projectRoot, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
const outputRoot = path.join(projectRoot, 'public', 'models', 'materials-optimized');
const manifestPath = path.join(outputRoot, 'manifest.json');
const assets = [
    ['public/models/guzel-optik/store-environment.glb', 'guzel-optik/store-environment.glb']
];

const hashFile = (filename) => new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filename);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
});

const run = (command, args) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${code} koduyla kapandı.`)));
});

const readGlb = async (filename) => {
    const file = await readFile(filename);
    if (file.toString('ascii', 0, 4) !== 'glTF' || file.readUInt32LE(4) !== 2 || file.readUInt32LE(8) !== file.length) {
        throw new Error(`Geçersiz GLB: ${path.relative(projectRoot, filename)}`);
    }
    const jsonLength = file.readUInt32LE(12);
    return JSON.parse(file.toString('utf8', 20, 20 + jsonLength).trimEnd());
};

const geometrySummary = (document) => {
    const primitives = (document.meshes || []).flatMap((mesh) => mesh.primitives || []);
    return {
        nodes: document.nodes?.length || 0,
        meshes: document.meshes?.length || 0,
        primitives: primitives.length,
        triangles: primitives.reduce((total, primitive) => total + Math.floor((document.accessors?.[primitive.indices]?.count || 0) / 3), 0),
        materials: document.materials?.length || 0,
        textures: document.textures?.length || 0
    };
};

const validateOutput = async (source, output) => {
    const [sourceDocument, outputDocument] = await Promise.all([readGlb(source), readGlb(output)]);
    const before = geometrySummary(sourceDocument);
    const after = geometrySummary(outputDocument);
    for (const key of ['nodes', 'meshes', 'primitives', 'triangles']) {
        if (before[key] !== after[key]) throw new Error(`Geometri değişti (${key}): ${before[key]} → ${after[key]}`);
    }
    if (after.materials > before.materials || after.textures > before.textures) {
        throw new Error('Materyal veya texture sayısı beklenmedik biçimde arttı.');
    }
    if (sourceDocument.extensionsUsed?.includes('KHR_texture_basisu') && !outputDocument.extensionsUsed?.includes('KHR_texture_basisu')) {
        throw new Error('ETC1S texture uzantısı kayboldu.');
    }
    return { before, after };
};

await mkdir(outputRoot, { recursive: true });
const records = [];
for (const [sourceRelative, outputRelative] of assets) {
    const source = path.join(projectRoot, sourceRelative);
    const sourceInfo = await stat(source).catch(() => null);
    if (!sourceInfo?.isFile()) continue;
    const output = path.join(outputRoot, outputRelative);
    const temporary = `${output}.building.glb`;
    const legacyTemporary = output.replace(/\.glb$/, '.building.glb');
    await mkdir(path.dirname(output), { recursive: true });
    await rm(legacyTemporary, { force: true });
    await rm(temporary, { force: true });
    await run(process.execPath, [cliPath, 'dedup', source, temporary, '--accessors', 'false', '--meshes', 'false', '--skins', 'false']);
    const summary = await validateOutput(source, temporary);
    await rm(output, { force: true });
    await rename(temporary, output);
    const outputInfo = await stat(output);
    records.push({
        source: sourceRelative,
        output: `public/models/materials-optimized/${outputRelative}`,
        sourceBytes: sourceInfo.size,
        outputBytes: outputInfo.size,
        sourceSha256: await hashFile(source),
        outputSha256: await hashFile(output),
        ...summary
    });
    console.log(`${outputRelative}: ${summary.before.materials} materyal → ${summary.after.materials} materyal`);
}
await writeFile(manifestPath, `${JSON.stringify({ version: 1, assets: records }, null, 2)}\n`, 'utf8');
