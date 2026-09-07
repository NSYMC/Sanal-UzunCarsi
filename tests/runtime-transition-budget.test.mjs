import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

test('mağaza görünürlüğü tek karede topluca değiştirilmez', () => {
    assert.match(mainSource, /setMeshesEnabledWithFrameBudget/);
    assert.match(mainSource, /frameBudgetMs = 3\.5/);
    assert.match(mainSource, /queueRuntimeActivation/);
    assert.doesNotMatch(
        mainSource,
        /runtime\.renderMeshes\.forEach\(\(mesh\) => mesh\.setEnabled\(rendered\)\)/
    );
});

test('etkileşim yüzeyleri görsel modelden sonra açılır', () => {
    const activation = mainSource.slice(
        mainSource.indexOf('const queueRuntimeActivation'),
        mainSource.indexOf('const disableStoreRuntimeImmediately')
    );
    const visuals = activation.indexOf('setMeshesEnabledWithFrameBudget(visualMeshes, true');
    const nextFrame = activation.indexOf('await nextAnimationFrame()', visuals);
    const interactions = activation.indexOf('setMeshesEnabledWithFrameBudget(interactionMeshes, true');
    assert.ok(visuals >= 0 && nextFrame > visuals && interactions > nextFrame);
});

test('seçilecek mağaza menü etkileşiminde görünmeden önce hazırlanmaya başlar', () => {
    assert.match(mainSource, /activeTourPrepare = \(storeId\) => streaming\.ensureRuntime\(storeId\)/);
    assert.match(mainSource, /item\.addEventListener\('pointerenter'/);
    assert.match(mainSource, /loadStore\(scene, quality, STORES\[storeId\], \{ background: true \}\)/);
    assert.match(mainSource, /if \(!background\) \{\s*await [\s\S]{0,80}?scene\.whenReadyAsync\(\)/);
    assert.match(mainSource, /if \(!background\) setLoadingProgress/);
    assert.doesNotMatch(mainSource, /streaming\.prewarmAll\(\)/);
});

test('komşu mağazalar açılış sırasında değil, sinematikten sonra boş zamanda hazırlanır', () => {
    assert.match(mainSource, /let proximityLoadingEnabled = false/);
    assert.match(mainSource, /scheduleProximityRuntimeLoad/);
    assert.match(mainSource, /window\.requestIdleCallback\(loadIfStillNearby, \{ timeout: 4000 \}\)/);
    assert.match(mainSource, /proximityLoadInFlightStoreId/);
    assert.match(mainSource, /streaming\.enableProximityLoading\(\)/);
});

test('bütün şehir için pahalı seçim octree yapısı kurulmaz', () => {
    assert.doesNotMatch(mainSource, /createOrUpdateSelectionOctree/);
});
