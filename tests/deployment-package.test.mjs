import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readProjectFile = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('Docker derlemesi runtime parçalarını build context içine alır', async () => {
    const dockerfile = await readProjectFile('Dockerfile');
    // scripts/runtime-assets.mjs büyük GLB'leri bu parçalardan birleştirir;
    // dizin kopyalanmazsa prebuild manifest bulunamadığı için çöker.
    assert.match(dockerfile, /COPY runtime-assets \.\/runtime-assets/);
    const copyIndex = dockerfile.indexOf('COPY runtime-assets');
    const buildIndex = dockerfile.indexOf('RUN npm run build');
    assert.ok(copyIndex >= 0 && copyIndex < buildIndex, 'Parçalar derlemeden önce kopyalanmalı.');
});

test('dockerignore yalnızca yeniden üretilebilen GLB dosyalarını dışarıda bırakır', async () => {
    const ignore = await readProjectFile('.dockerignore');
    const rules = ignore.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));

    // Genel `**/*.glb` kuralı ürün modellerini ve telefon sahnesini de eliyordu;
    // bunlar parçalardan üretilemediği için imajdan tamamen düşüyordu.
    assert.ok(!rules.includes('**/*.glb'), 'Tüm GLB dosyalarını eleyen kural imajı eksik bırakır.');
    for (const reproducible of [
        '/public/models/world/outside.glb',
        '/public/models/world/always.glb',
        '/public/models/guzel-optik/store-environment.glb',
        '/public/models/sude-home/store-raw.glb',
        '/public/models/nisantasi/store-raw.glb'
    ]) {
        assert.ok(rules.includes(reproducible), `${reproducible} parçalardan üretildiği için elenmeli.`);
    }
    for (const required of ['/public/models/telefon/store-raw.glb', '/public/models/products/']) {
        assert.ok(!rules.includes(required), `${required} imaja girmeli.`);
    }
});

test('imaj çıktısı ürün modellerini ve dördüncü mağazayı doğrular', async () => {
    const dockerfile = await readProjectFile('Dockerfile');
    assert.match(dockerfile, /test -f dist\/models\/telefon\/store-raw\.glb/);
    assert.match(dockerfile, /test -f dist\/models\/products\//);
});
