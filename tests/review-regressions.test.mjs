import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGoldMarketLoader } from '../src/gold-market.js';
import { createEventScope } from '../src/event-scope.js';
import { createLatestRequest } from '../src/latest-request.js';
import { assetUrl } from '../src/asset-url.js';
import { assetRevision } from '../scripts/asset-revision.mjs';

const fixture = (options = {}) => {
    let saved = null;
    let clock = 1000;
    let offline = false;
    let calls = 0;
    const storage = {
        getItem: () => saved,
        setItem: (_key, value) => { saved = value; }
    };
    const load = createGoldMarketLoader({
        storage,
        now: () => clock,
        fetchSpot: async () => { calls++; if (offline) throw new Error('offline'); return { xau: { price: 6000 } }; },
        fetchHistory: async () => { if (offline) throw new Error('offline'); return { points: [] }; },
        ...options
    });
    return { load, storage, get calls() { return calls; }, expire() { clock += 301000; }, disconnect() { offline = true; } };
};

test('altın aynı anda ve TTL içinde tek piyasa isteğini paylaşır', async () => {
    const f = fixture();
    const [a, b] = await Promise.all([f.load(), f.load()]);
    assert.equal(a.spot.xau.price, b.spot.xau.price);
    assert.equal((await f.load()).cached, true);
    assert.equal(f.calls, 1);
});

test('süresi geçen fiyat bağlantı kesilince son bilinen fiyat olarak döner', async () => {
    const f = fixture();
    await f.load();
    f.expire(); f.disconnect();
    const result = await f.load();
    assert.equal(result.stale, true);
    assert.equal(result.spot.xau.price, 6000);
});

test('saklanan xau fiyatı yeni oturumda ağ olmadan okunur', async () => {
    const f = fixture(); await f.load();
    const reopened = fixture({ storage: f.storage, fetchSpot: async () => { throw new Error('unexpected fetch'); } });
    assert.equal((await reopened.load()).spot.xau.price, 6000);
});

test('depolama kotası ve grafik hatası geçerli spot fiyatını engellemez', async () => {
    const f = fixture({
        storage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } },
        fetchHistory: async () => { throw new Error('chart unavailable'); }
    });
    assert.equal((await f.load()).spot.xau.price, 6000);
    assert.equal((await f.load()).cached, true);
    assert.equal(f.calls, 1);
});

test('geçersiz piyasa fiyatı saklanmaz; sonraki çağrı yeniden denenir', async () => {
    let price = 0;
    const f = fixture({ fetchSpot: async () => ({ xau: { price } }) });
    await assert.rejects(f.load(), /Gram altın/);
    price = 6500;
    assert.equal((await f.load()).spot.xau.price, 6500);
});

test('mağaza editörü yeniden oluşturulunca yalnız yeni dinleyici çalışır', () => {
    const canvas = new EventTarget();
    const first = createEventScope();
    const second = createEventScope();
    let oldCalls = 0, newCalls = 0;
    first.listen(canvas, 'pointerdown', () => oldCalls++);
    canvas.dispatchEvent(new Event('pointerdown'));
    first.dispose();
    second.listen(canvas, 'pointerdown', () => newCalls++);
    canvas.dispatchEvent(new Event('pointerdown'));
    second.dispose();
    canvas.dispatchEvent(new Event('pointerdown'));
    assert.equal(oldCalls, 1);
    assert.equal(newCalls, 1);
});

test('kılıf yüklemeleri ters sırada bitse de son seçim kazanır; çıkarma isteği iptal eder', async () => {
    const requests = createLatestRequest();
    let resolveA, resolveB;
    let mounted = null;
    const select = async (name, pending) => {
        const current = requests.begin();
        await pending;
        if (current()) mounted = name;
    };
    const a = select('A', new Promise((resolve) => { resolveA = resolve; }));
    const b = select('B', new Promise((resolve) => { resolveB = resolve; }));
    resolveB(); await b;
    resolveA(); await a;
    assert.equal(mounted, 'B');
    const c = select('C', new Promise((resolve) => { resolveA = resolve; }));
    requests.invalidate(); mounted = null;
    resolveA(); await c;
    assert.equal(mounted, null);
});

test('aynı dosya adının içeriği değişince model URL sürümü değişir', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'uzuncarsi-asset-test-'));
    try {
        await mkdir(path.join(root, 'models'));
        const file = path.join(root, 'models', 'phone.glb');
        await writeFile(file, 'old-model');
        const first = assetRevision(root);
        assert.equal(first, assetRevision(root));
        await writeFile(file, 'new-model');
        const second = assetRevision(root);
        assert.notEqual(first, second);
        const url = assetUrl('/models/phone.glb?asset=legacy#part', second);
        assert.equal(url, `/models/phone.glb?asset=legacy&rev=${second}#part`);
        assert.equal(assetUrl(null, second), null);
    } finally {
        // Yalnız bu testin mkdtemp ile oluşturduğu mutlak dizin.
        await rm(root, { recursive: true, force: true });
    }
});
