import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hardwareScalingForDpr } from '../src/render-resolution.js';

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('sharpen işlemi sahnenin ana renk katkısını azaltmaz', async () => {
    const source = await readProjectFile('src/main.js');
    const values = [...source.matchAll(/sharpenColor:\s*([\d.]+)/g)]
        .map((match) => Number(match[1]));

    assert.ok(values.length > 0);
    assert.ok(values.every((value) => value === 1));
});

test('ana WebGL motoru tarayıcıdan bağımsız kenar yumuşatma ister', async () => {
    const source = await readProjectFile('src/main.js');
    const engineCalls = [...source.matchAll(/new Engine\(canvas,\s*(true|false)/g)];
    assert.ok(engineCalls.length >= 2);
    assert.ok(engineCalls.every((match) => match[1] === 'true'));
});

test('yüksek DPI ekran çözünürlüğü Babylon ölçek bölenine doğru yönde çevrilir', () => {
    assert.equal(hardwareScalingForDpr({ devicePixelRatio: 1, maxDpr: 2 }), 1);
    assert.equal(hardwareScalingForDpr({ devicePixelRatio: 1.25, maxDpr: 2 }), 0.8);
    assert.equal(hardwareScalingForDpr({ devicePixelRatio: 2, maxDpr: 1.5 }), 2 / 3);
    assert.ok(
        hardwareScalingForDpr({ devicePixelRatio: 1.5, maxDpr: 2 })
        < hardwareScalingForDpr({ devicePixelRatio: 1, maxDpr: 2 })
    );
});

test('harita ve ürün inceleyici cihaz piksel oranını ters yönde uygulamaz', async () => {
    const [selectionSource, viewerSource] = await Promise.all([
        readProjectFile('src/selection-world.js'),
        readProjectFile('src/high-quality-product-viewer.js')
    ]);
    assert.doesNotMatch(selectionSource, /setHardwareScalingLevel\([^\n]*devicePixelRatio/);
    assert.match(selectionSource, /applyDeviceResolution\(engine, \{ maxDpr: 1\.5 \}\)/);
    assert.match(viewerSource, /applyDeviceResolution\(engine, \{ maxDpr: 2 \}\)/);
});

test('uygulama ve service worker aynı sahne önbelleğini kullanır', async () => {
    const [mainSource, workerSource] = await Promise.all([
        readProjectFile('src/main.js'),
        readProjectFile('public/scene-cache-sw.js')
    ]);
    const appCache = mainSource.match(/SCENE_CACHE_NAME\s*=\s*'([^']+)'/)?.[1];
    const workerCache = workerSource.match(/CACHE_NAME\s*=\s*'([^']+)'/)?.[1];

    assert.ok(appCache);
    assert.equal(workerCache, appCache);
});

test('harita hazır olduğunda mağaza ve ürün modellerinin tamamı arka planda indirilir', async () => {
    const [mainSource, workerSource] = await Promise.all([
        readProjectFile('src/main.js'),
        readProjectFile('public/scene-cache-sw.js')
    ]);

    assert.match(mainSource, /productModelPreloadAssets/);
    assert.match(mainSource, /selectionWorld\.whenReady/);
    assert.match(mainSource, /scenePreloader\.preloadAll\(\)/);
    assert.match(mainSource, /concurrency:\s*4/);
    assert.match(workerSource, /glb\|gltf\|json/);
    assert.match(workerSource, /\\\.hdr/);
});
