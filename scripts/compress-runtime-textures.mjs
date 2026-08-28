import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, 'public', 'models', 'etc1s');
const manifestPath = path.join(outputRoot, 'manifest.json');
const cliPath = path.join(projectRoot, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');
const localKtxBin = path.join(projectRoot, '.cache', 'ktx-software', 'bin');
const settings = Object.freeze({ quality: 192, compression: 2, rdoThreshold: 1.0, jobs: 4, mipmaps: true });
const assets = [
    ['public/models/world/outside.glb', 'world/outside.glb'],
    ['public/models/guzel-optik/store-environment.glb', 'guzel-optik/store-environment.glb']
];

const hashFile = (filename) => new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filename);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
});

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${code} koduyla kapandı.`)));
});

const readPreviousManifest = async () => JSON.parse(await readFile(manifestPath, 'utf8'));

const commandEnvironment = () => {
    const separator = process.platform === 'win32' ? ';' : ':';
    const environment = { ...process.env };
    const currentPath = Object.entries(environment).find(([key]) => key.toLowerCase() === 'path')?.[1] || '';
    for (const key of Object.keys(environment)) {
        if (key.toLowerCase() === 'path') delete environment[key];
    }
    environment.Path = `${localKtxBin}${separator}${currentPath}`;
    environment.CI = environment.CI || '1';
    return environment;
};

const validateEmbeddedGlb = async (filename) => {
    const info = await stat(filename);
    const handle = await open(filename, 'r');
    try {
        const header = Buffer.alloc(20);
        await handle.read(header, 0, header.length, 0);
        if (header.toString('ascii', 0, 4) !== 'glTF' || header.readUInt32LE(8) !== info.size) {
            throw new Error(`Gömülü GLB üretilemedi: ${path.relative(projectRoot, filename)}`);
        }
        const jsonLength = header.readUInt32LE(12);
        const json = Buffer.alloc(jsonLength);
        await handle.read(json, 0, jsonLength, 20);
        const document = JSON.parse(json.toString('utf8').trimEnd());
        if ((document.textures?.length || 0) > 0 && !document.extensionsUsed?.includes('KHR_texture_basisu')) {
            throw new Error(`KHR_texture_basisu bulunamadı: ${path.relative(projectRoot, filename)}`);
        }
    } finally {
        await handle.close();
    }
};

const compress = async () => {
    const oldManifest = await readPreviousManifest().catch(() => null);
    const settingsMatch = JSON.stringify(oldManifest?.settings) === JSON.stringify(settings);
    const previous = new Map((settingsMatch ? oldManifest?.assets || [] : [])
        .map((asset) => [asset.source, asset]));
    const records = [];
    await mkdir(outputRoot, { recursive: true });

    for (const [sourceRelative, outputRelative] of assets) {
        const source = path.join(projectRoot, sourceRelative);
        const output = path.join(outputRoot, outputRelative);
        const sourceInfo = await stat(source);
        const sourceHash = await hashFile(source);
        const old = previous.get(sourceRelative);
        const outputInfo = await stat(output).catch(() => null);
        if (old?.sourceSha256 === sourceHash && outputInfo?.size === old.outputBytes) {
            await validateEmbeddedGlb(output);
            const outputHash = await hashFile(output);
            if (outputHash === old.outputSha256) {
                console.log(`Hazır: ${outputRelative}`);
                records.push(old);
                continue;
            }
        }

        await mkdir(path.dirname(output), { recursive: true });
        const temporary = `${output}.building.glb`;
        await rm(temporary, { force: true });
        console.log(`ETC1S oluşturuluyor: ${sourceRelative}`);
        await run(process.execPath, [
            cliPath,
            'etc1s',
            source,
            temporary,
            '--quality', String(settings.quality),
            '--compression', String(settings.compression),
            '--rdo-threshold', String(settings.rdoThreshold),
            '--jobs', String(settings.jobs),
            '--mipmaps', String(settings.mipmaps)
        ], { env: commandEnvironment() });

        await validateEmbeddedGlb(temporary);
        const outputSize = (await stat(temporary)).size;
        await rm(output, { force: true });
        await rename(temporary, output);
        const outputHash = await hashFile(output);
        records.push({
            source: sourceRelative,
            output: `public/models/etc1s/${outputRelative}`,
            sourceBytes: sourceInfo.size,
            outputBytes: outputSize,
            sourceSha256: sourceHash,
            outputSha256: outputHash
        });
        console.log(`Tamam: ${(sourceInfo.size / 1048576).toFixed(1)} MB → ${(outputSize / 1048576).toFixed(1)} MB`);
    }

    await writeFile(manifestPath, `${JSON.stringify({
        version: 1,
        codec: 'KTX2 ETC1S',
        settings,
        generatedAt: new Date().toISOString(),
        assets: records
    }, null, 2)}\n`, 'utf8');

    const originalBytes = records.reduce((sum, asset) => sum + asset.sourceBytes, 0);
    const compressedBytes = records.reduce((sum, asset) => sum + asset.outputBytes, 0);
    console.log(`Toplam: ${(originalBytes / 1048576).toFixed(1)} MB → ${(compressedBytes / 1048576).toFixed(1)} MB`);
};

await compress();
