import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspace = process.cwd();
const assetsDirectory = path.join(workspace, 'runtime-assets');
const manifestPath = path.join(assetsDirectory, 'manifest.json');
const chunkSize = 48 * 1024 * 1024;
const originalSourcePaths = [
    'public/models/sude-home/store-raw.glb',
    'public/models/nisantasi/store-raw.glb',
    'public/models/guzel-optik/store-environment.glb',
    'public/models/world/always.glb',
    'public/models/world/outside.glb'
];
const compressedSourcePaths = [
    'public/models/etc1s/guzel-optik/store-environment.glb',
    'public/models/etc1s/world/outside.glb'
];

const fileHash = async (filename) => new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filename);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
});

const appendPart = async (partPath, output) => new Promise((resolve, reject) => {
    const input = createReadStream(partPath);
    input.on('error', reject);
    output.on('error', reject);
    input.on('end', resolve);
    input.pipe(output, { end: false });
});

const pack = async () => {
    await rm(assetsDirectory, { recursive: true, force: true });
    await mkdir(assetsDirectory, { recursive: true });
    const assets = [];

    const includeCompressed = process.argv.includes('--include-etc1s');
    const compressedReady = includeCompressed
        && (await Promise.all(compressedSourcePaths.map((source) => stat(path.join(workspace, source)).catch(() => null))))
        .every((info) => info?.isFile());
    const sourcePaths = compressedReady
        ? [...originalSourcePaths, ...compressedSourcePaths]
        : originalSourcePaths;

    for (const relativeSource of sourcePaths) {
        const source = path.join(workspace, relativeSource);
        const sourceStat = await stat(source);
        const handle = await open(source, 'r');
        const parts = [];
        try {
            let offset = 0;
            let partIndex = 1;
            while (offset < sourceStat.size) {
                const length = Math.min(chunkSize, sourceStat.size - offset);
                const buffer = Buffer.allocUnsafe(length);
                await handle.read(buffer, 0, length, offset);
                const partName = `${relativeSource.replaceAll('/', '__')}.part${String(partIndex).padStart(2, '0')}`;
                await writeFile(path.join(assetsDirectory, partName), buffer);
                parts.push(partName);
                offset += length;
                partIndex += 1;
            }
        } finally {
            await handle.close();
        }
        assets.push({ path: relativeSource, size: sourceStat.size, sha256: await fileHash(source), parts });
    }

    await writeFile(manifestPath, `${JSON.stringify({ version: 1, assets }, null, 2)}\n`, 'utf8');
    console.log(`${assets.length} runtime modeli parçalara ayrıldı.`);
};

const assemble = async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    for (const asset of manifest.assets) {
        const destination = path.join(workspace, asset.path);
        const current = await stat(destination).catch(() => null);
        if (current?.size === asset.size && await fileHash(destination) === asset.sha256) continue;

        await mkdir(path.dirname(destination), { recursive: true });
        const temporary = `${destination}.assembling`;
        const output = createWriteStream(temporary);
        for (const part of asset.parts) await appendPart(path.join(assetsDirectory, part), output);
        await new Promise((resolve, reject) => {
            output.on('error', reject);
            output.end(resolve);
        });

        const temporaryStat = await stat(temporary);
        const temporaryHash = await fileHash(temporary);
        if (temporaryStat.size !== asset.size || temporaryHash !== asset.sha256) {
            await rm(temporary, { force: true });
            throw new Error(`Runtime modeli doğrulanamadı: ${asset.path}`);
        }
        await rm(destination, { force: true });
        await rename(temporary, destination);
        console.log(`Oluşturuldu: ${asset.path}`);
    }
};

if (process.argv.includes('--pack')) await pack();
else await assemble();
