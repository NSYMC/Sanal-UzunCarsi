import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import productData from '../src/data/products.json' with { type: 'json' };
import bindingData from '../src/data/scene-product-bindings.json' with { type: 'json' };
import { resolveSudeProduct, sudeProducts } from '../src/data/sude-product-matches.js';
import nisantasiProductMatches from '../src/data/mawus-product-matches.js';
import { createProductRegistry } from '../src/product-registry.js';
import { applyProductBindings } from '../src/product-runtime-bindings.js';

const readGlbJson = async (filename) => {
    const buffer = await readFile(filename);
    assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
    const jsonLength = buffer.readUInt32LE(12);
    return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trim());
};

test('yeni Güzel Optik sahnesi doğrudan kullanılır ve raflara kodla gözlük eklenmez', async () => {
    const [scene, manifest, applicationSource] = await Promise.all([
        readGlbJson('public/models/guzel-optik/store-environment.glb'),
        readFile('public/models/guzel-optik/products.json', 'utf8').then(JSON.parse),
        readFile('src/main.js', 'utf8')
    ]);
    const sceneNames = new Set((scene.nodes || []).map(({ name }) => name));
    assert.equal(manifest.products.length, 90);
    assert.ok(sceneNames.has('Glasses.002'), 'Yeni Güzel Optik exportu etkin değil.');
    assert.match(applicationSource, /store-environment\.glb', '17759e7e'/);
    assert.doesNotMatch(applicationSource, /loadOptikDisplayProducts|displaySourceFile|__shelf_/);
});

test('Güzel Optik kayıtlarının tamamı sahnede ve bağımsız GLB eşleşmeleri erişilebilir', async () => {
    const products = productData.products.filter(({ storeId }) => storeId === 'guzel-optik');
    assert.equal(products.length, 91);
    const withStandaloneModel = products.filter(({ highQualityModel }) => highQualityModel);
    assert.equal(withStandaloneModel.length, 91);
    await Promise.all(withStandaloneModel.map(({ highQualityModel }) => access(path.join('public', highQualityModel.replace(/^\/models\//, 'models/')))));
});

test('kaide üzerindeki özel gözlük parçalanma animasyonlu modele bağlıdır', async () => {
    const special = productData.products.find(({ id }) => id === 'OPTIK_SPECIAL_ANIMATION_GOZLUK');
    assert.equal(special?.highQualityModel, '/models/products/guzel-optik/animation-gozluk.glb');
    assert.equal(special?.name, 'Güzel Optik Aero');
    assert.equal(special?.price, 2490);
    assert.equal(special?.currency, 'TRY');
    assert.deepEqual(special?.animationPlayback, {
        autoPlay: true,
        loop: false,
        speedRatio: 1,
        clipName: 'Animation',
        cameraRadiusMultiplier: 1.45
    });
    const gltf = await readGlbJson('public/models/products/guzel-optik/animation-gozluk.glb');
    assert.ok(gltf.animations?.some(({ name }) => name === 'Animation'));
    const animatedPartNames = (gltf.nodes || [])
        .filter((node) => node.mesh != null)
        .map(({ name }) => name)
        .sort();
    const hotspotPartNames = (special.hotspots || []).map(({ nodeName }) => nodeName).sort();
    assert.equal(animatedPartNames.length, 28);
    assert.deepEqual(hotspotPartNames, [
        'Cube.005',
        'Cube.006',
        'Cube.010',
        'Cube.018',
        'Cube.021',
        'NurbsPath'
    ]);
    hotspotPartNames.forEach((nodeName) => assert.ok(animatedPartNames.includes(nodeName), `GLB parçası bulunamadı: ${nodeName}`));
    assert.ok(hotspotPartNames.every((nodeName) => !/^Bolt|^Circle$/.test(nodeName)), 'Aşırı küçük vida ve halka parçaları gösterilmemeli.');
    assert.ok(hotspotPartNames.includes('Cube.018') && hotspotPartNames.includes('Cube.021'), 'İki kulak sapı da işaretlenmeli.');
    special.hotspots.forEach((hotspot) => {
        assert.ok(hotspot.label?.trim(), `${hotspot.nodeName} için başlık eksik.`);
        assert.ok(hotspot.description?.trim(), `${hotspot.nodeName} için açıklama eksik.`);
        assert.doesNotMatch(hotspot.label, /vida|pim|metal gövde|parça/i);
    });
    const source = await readFile('src/high-quality-product-viewer.js', 'utf8');
    assert.match(source, /group\.start\(animationPlayback\.loop, animationPlayback\.speedRatio\)/);
    assert.match(source, /group\.endsWith\(`_\$\{clip\}`\)/);
    assert.doesNotMatch(source, /activeRoot\.rotation\.y/);
    assert.match(source, /target\.getBoundingInfo\?\.\(\)\.boundingBox\.centerWorld/);
    assert.match(source, /const target = nodeName\s*\? exactTarget/);
    // Babylon geri sarımda onAnimationGroupEndObservable'ı tetiklemediğinden
    // aşama geçişi gözlemciye bağlanamaz.
    assert.doesNotMatch(source, /onAnimationGroupEndObservable\.add\(/);
    assert.match(source, /group\.goToFrame\(group\.from \+ \(group\.to - group\.from\) \* explodeProgress\)/);
    // Kılıf yalnızca birleşik telefona giydirilir.
    assert.match(
        source,
        /explodePhase === 'acik' \|\| explodePhase === 'aciliyor'\) runExplode\(false\)/
    );

    const mainSource = await readFile('src/main.js', 'utf8');
    // Parçalanmayan ürünün işaretleri gizlenmez.
    assert.match(mainSource, /partsHidden = String\(durum\.destekli && !durum\.acik\)/);
    const editorSource = await readFile('src/editor.js', 'utf8');
    assert.doesNotMatch(editorSource, /previewRoot\.rotation\.y/);
    // Telefonlarda animationPlayback tanımlı değil; işaretler buna göre
    // elenirse hiçbiri görünmez.
    assert.doesNotMatch(editorSource, /animationPlayback\?\.autoPlay !== true/);
    assert.doesNotMatch(editorSource, /hotspots\.filter\(\(hotspot\).*slice\(0, 3\)/);
    assert.match(editorSource, /mesh\.overlayAlpha = 0\.16/);
    assert.match(editorSource, /const offsets = fastOnly/);

    const registry = createProductRegistry({
        schemaVersion: 1,
        products: [special],
        bindings: bindingData.bindings.filter(({ productId }) => productId === special.id)
    }, { autoPersist: false });
    const mesh = {
        name: 'Cube.220',
        parent: null,
        geometry: {},
        metadata: null,
        isDisposed: () => false
    };
    const scene = new Scene(new NullEngine());
    const runtime = { renderMeshes: [mesh], selectionBoxes: [] };
    const result = applyProductBindings({ scene, registry, store: { id: 'guzel-optik' }, runtime });
    assert.equal(result.matchedMeshes, 1);
    assert.equal(result.proxyBoxes.length, 1);
    assert.equal(mesh.metadata.productId, 'OPTIK_SPECIAL_ANIMATION_GOZLUK');
    assert.equal(registry.resolvePick(mesh, 'guzel-optik')?.product.highQualityModel, special.highQualityModel);
    scene.dispose();
});

test('Güzel Optik gözlük araması 100–1000 TL aralığında sonuç döndürür', () => {
    const matches = productData.products.filter((product) => (
        product.storeId === 'guzel-optik'
        && product.tags.includes('gözlük')
        && product.price >= 100
        && product.price <= 1000
    ));
    assert.ok(matches.length > 0);
});

test('28 Sude Home ürününün yüksek kaliteli GLB dosyaları erişilebilir', async () => {
    assert.equal(sudeProducts.length, 28);
    await Promise.all(sudeProducts.map(({ highQualityModel }) => access(path.join('public', highQualityModel.replace(/^\/models\//, 'models/')))));
});

test('Sude Home sahne kökleri doğru bağımsız ürünlere çözülür', () => {
    assert.equal(resolveSudeProduct({ rootName: 'Cooking pan.001', sourceName: 'SUDE_BK_PAN_001' })?.id, 'SUDE_HQ_TAVA');
    assert.equal(resolveSudeProduct({ rootName: 'Ceramic Bowl Big', sourceName: 'SUDE_BK_PLATES_001' })?.id, 'SUDE_HQ_BEYAZ_KASE');
    assert.equal(resolveSudeProduct({ rootName: 'Cooking Pot Medium with Lid', sourceName: 'SUDE_BK_POT_001' })?.id, 'SUDE_HQ_TENCERE');
    assert.equal(resolveSudeProduct({ rootName: '', sourceName: 'SUDE_BK_KETTLE_003_Fellow Clyde Stovetop Kettle' })?.id, 'SUDE_HQ_KETIL');
    assert.equal(resolveSudeProduct({ rootName: 'Jar', sourceName: '' })?.id, 'SUDE_HQ_BUYUK_PORSELEN_KAVANOZ');
    assert.equal(resolveSudeProduct({ rootName: 'bottom', sourceName: '' })?.id, 'SUDE_HQ_DESENLI_TERMOS');
    assert.equal(resolveSudeProduct({ rootName: 'BOTTLE', sourceName: '' })?.id, 'SUDE_HQ_SIYAH_TERMOS');
    assert.equal(resolveSudeProduct({ rootName: 'Unmatched Cutlery', sourceName: 'SUDE_BK_CUT_001' }), null);
});

test('Sude Home kataloğundaki her ürün güncel sahnede bir kök hedefe sahiptir', async () => {
    const scene = await readGlbJson('public/models/sude-home/store-raw.glb');
    const childNodes = new Set((scene.nodes || []).flatMap((node) => node.children || []));
    const rootNames = (scene.nodes || [])
        .filter((node, index) => !childNodes.has(index))
        .map((node) => node.name || '');
    const resolvedIds = new Set(rootNames
        .map((rootName) => resolveSudeProduct({ rootName, sourceName: '' })?.id)
        .filter(Boolean));
    assert.deepEqual(
        [...resolvedIds].sort(),
        sudeProducts.map(({ id }) => id).sort()
    );
});

test('Nişantaşı ürün inceleme modellerinin tamamı erişilebilir', async () => {
    await Promise.all(nisantasiProductMatches.products.map(({ highQualityModel }) => (
        access(path.join('public', highQualityModel.replace(/^\/models\//, 'models/')))
    )));
});

test('Nişantaşı yüzük modellerinin tamamı iki vitrindeki ayrı sıralara bağlıdır', async () => {
    const scene = await readGlbJson('public/models/nisantasi/store-raw.glb');
    const sceneNames = new Set(scene.nodes.map(({ name }) => name));
    const productIds = new Set([
        'MAWUS_HQ_ALTIN_YUZUK',
        'MAWUS_HQ_ALTIN_YUZUK_TASLI',
        'MAWUS_HQ_ALTIN_KIRMIZI_KALPLI',
        'MAWUS_HQ_ALTIN_KIRMIZI_TAS',
        'MAWUS_HQ_CICEK_KIRMIZI_YUZUK',
        'MAWUS_HQ_CICEK_YUZUK',
        'MAWUS_HQ_ELMAS_YUZUK',
        'MAWUS_HQ_GRI_YUZUK',
        'MAWUS_HQ_YAKUT_YUZUK',
        'MAWUS_HQ_ZUMRUT_YUZUK'
    ]);
    const bindings = nisantasiProductMatches.bindings.filter(({ productId }) => productIds.has(productId));
    assert.equal(bindings.length, productIds.size);
    const rows = bindings.flatMap(({ meshNames }) => meshNames);
    assert.equal(new Set(rows).size, productIds.size * 2);
    rows.forEach((row) => assert.ok(sceneNames.has(row), `Sahne hedefi bulunamadı: ${row}`));
});

test('Nişantaşı vitrin sırasına tıklamak bağlı ürün modelini çözer', () => {
    const registry = createProductRegistry({
        schemaVersion: 1,
        products: [...productData.products, ...nisantasiProductMatches.products],
        bindings: nisantasiProductMatches.bindings
    }, { autoPersist: false });
    const result = registry.resolvePick({ name: 'MAWUS_ORIGINAL_M03_ROW04_SIX_RINGS', parent: null }, 'nisantasi');
    assert.equal(result?.product.id, 'MAWUS_HQ_ALTIN_KIRMIZI_TAS');
    assert.equal(result?.product.highQualityModel, '/models/products/mawus/altin-kirmizi-tas.glb');
});

test('Nişantaşı yuvarlak altınları fiziksel boyut adına göre ayrı ürünlere çözer', () => {
    const registry = createProductRegistry({
        schemaVersion: 1,
        products: [...productData.products, ...nisantasiProductMatches.products],
        bindings: nisantasiProductMatches.bindings
    }, { autoPersist: false });
    const expected = new Map([
        ['ceyrek.004', 'MAWUS_HQ_CEYREK_ALTIN'],
        ['yarım.002', 'MAWUS_HQ_YARIM_ALTIN'],
        ['Tam.005', 'MAWUS_HQ_TAM_ALTIN'],
        ['Cumhuriyet altını.002', 'MAWUS_CUMHURIYET_ALTINI'],
        ['gram.005', 'MAWUS_HQ_GRAM_ALTIN']
    ]);
    for (const [meshName, productId] of expected) {
        assert.equal(registry.resolvePick({ name: meshName, parent: null }, 'nisantasi')?.product.id, productId);
    }
});

test('Nişantaşı vitrin yüzük sırası tıklanabilir ürün hedefi olur', () => {
    const registry = createProductRegistry({
        schemaVersion: 1,
        products: [...productData.products, ...nisantasiProductMatches.products],
        bindings: nisantasiProductMatches.bindings
    }, { autoPersist: false });
    const mesh = {
        name: 'MAWUS_ORIGINAL_M03_ROW05_SIX_RINGS',
        parent: null,
        geometry: {},
        metadata: null,
        isDisposed: () => false
    };
    const runtime = { renderMeshes: [mesh], selectionBoxes: [] };
    const result = applyProductBindings({ scene: {}, registry, store: { id: 'nisantasi' }, runtime });
    assert.equal(result.matchedMeshes, 1);
    assert.equal(mesh.isPickable, true);
    assert.equal(mesh.metadata.productId, 'MAWUS_HQ_CICEK_KIRMIZI_YUZUK');
});
