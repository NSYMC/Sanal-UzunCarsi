import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');
const manifestPath = path.join(projectRoot, 'public', 'models', 'selection', 'manifest.json');
const selectionPath = path.join(projectRoot, 'public', 'models', 'selection', 'selection-world.glb');

test('seçim dünyası tek parça ve geçerli bir GLB dosyasıdır', async () => {
    const [manifest, binary] = await Promise.all([
        readFile(manifestPath, 'utf8').then(JSON.parse),
        readFile(selectionPath)
    ]);

    assert.equal(binary.toString('ascii', 0, 4), 'glTF');
    assert.equal(binary.readUInt32LE(4), 2);
    assert.equal(binary.readUInt32LE(8), binary.length);
    assert.equal(manifest.outputBytes, binary.length);
    assert.equal(manifest.version, 4);
});

test('seçim dünyası bütün kaynak üçgenlerini eksiksiz korur', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const sourceTriangles = manifest.sources.reduce((total, source) => total + source.triangles, 0);

    assert.equal(manifest.triangles, sourceTriangles);
    assert.equal(manifest.sources.length, 5);
    assert.ok(manifest.sources.every((source) => source.triangles > 0));
    assert.equal(manifest.sources.find((source) => source.id === 'outside')?.preservedWorldTextures, true);
    assert.equal(manifest.sources.find((source) => source.id === 'outside')?.texturesAfter, 2);
    assert.ok(manifest.sources.filter((source) => source.id !== 'outside').every((source) => source.texturesAfter === 0));
});

test('seçim ekranı ana mağaza dosyaları yerine ayrı runtime GLB kullanır', async () => {
    const [html, mainSource, selectionSource] = await Promise.all([
        readFile(path.join(projectRoot, 'index.html'), 'utf8'),
        readFile(path.join(projectRoot, 'src', 'main.js'), 'utf8'),
        readFile(path.join(projectRoot, 'src', 'selection-world.js'), 'utf8')
    ]);

    assert.match(html, /id="selectionProductQuery"/);
    assert.match(html, /id="selectionCategoryFilter"/);
    assert.match(html, /id="selectionMinPrice"/);
    assert.match(html, /id="selectionMaxPrice"/);
    assert.match(html, /id="worldMapReturnBtn"/);
    assert.match(html, />Haritaya dön</);
    assert.match(mainSource, /models\/selection\/\$\{SELECTION_WORLD_FILE\}/);
    assert.match(mainSource, /updateSelectionMapFilters/);
    assert.match(mainSource, /worldMapReturnBtn\.addEventListener\('click'/);
    assert.match(mainSource, /window\.location\.assign\(`\$\{window\.location\.origin\}\$\{window\.location\.pathname\}`\)/);
    assert.match(selectionSource, /SceneLoader\.LoadAssetContainerAsync/);
    assert.match(selectionSource, /mesh\.setEnabled\(false\)/);
    assert.match(selectionSource, /camera\.wheelPrecision = 0\.35/);
    assert.match(selectionSource, /camera\.wheelDeltaPercentage = 0\.35/);
    assert.match(selectionSource, /const destinationAlpha = Math\.PI \/ 2/);
    assert.doesNotMatch(selectionSource, /ETC1S/i);
});

test('harita ekranı temel kullanım bilgisini içerir', async () => {
    const html = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
    assert.match(html, /Bir mağaza seçin/);
    assert.match(html, /Ürün ara/);
    assert.match(html, /Haritayı sürükleyin/);
});
