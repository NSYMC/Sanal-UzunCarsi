import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneAssetPreloader } from '../src/scene-asset-preloader.js';

const saveGlobal = (name) => Object.getOwnPropertyDescriptor(globalThis, name);
const restoreGlobal = (name, descriptor) => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
};

test('sahne ön indiricisi ilk indirmeyi kalıcı önbelleğe yazar ve sonraki isteği ağdan çekmez', async () => {
    const previousWindow = saveGlobal('window');
    const previousNavigator = saveGlobal('navigator');
    const previousCaches = saveGlobal('caches');
    const previousFetch = saveGlobal('fetch');
    const stored = new Map();
    let requestCount = 0;
    const cache = {
        async match(url) {
            return stored.get(url)?.clone() || undefined;
        },
        async put(url, response) {
            stored.set(url, response.clone());
        }
    };
    const cacheStorage = { open: async () => cache };

    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { caches: cacheStorage, setTimeout, clearTimeout }
    });
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {}
    });
    Object.defineProperty(globalThis, 'caches', {
        configurable: true,
        value: cacheStorage
    });
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: async () => {
            requestCount += 1;
            return new Response('scene-data', { headers: { 'content-length': '10' } });
        }
    });

    try {
        const first = createSceneAssetPreloader({
            cacheName: 'test-scenes',
            serviceWorkerUrl: '/scene-cache-sw.js',
            serviceWorkerScope: '/',
            assets: [{ id: 'store:test', storeId: 'test', url: 'https://example.test/store.glb' }]
        });
        await first.prioritize('store:test');
        assert.equal(requestCount, 1);
        assert.equal(stored.size, 1);
        assert.deepEqual(first.state('store:test'), {
            state: 'ready',
            loaded: 10,
            total: 10,
            progress: 1
        });

        const second = createSceneAssetPreloader({
            cacheName: 'test-scenes',
            serviceWorkerUrl: '/scene-cache-sw.js',
            serviceWorkerScope: '/',
            assets: [{ id: 'store:test', storeId: 'test', url: 'https://example.test/store.glb' }]
        });
        await second.prioritize('store:test');
        assert.equal(requestCount, 1);
        assert.equal(second.state('store:test')?.state, 'ready');
    } finally {
        restoreGlobal('window', previousWindow);
        restoreGlobal('navigator', previousNavigator);
        restoreGlobal('caches', previousCaches);
        restoreGlobal('fetch', previousFetch);
    }
});

test('mağaza girişi dış mekân indirmesini beklemez', async () => {
    const previousWindow = saveGlobal('window');
    const previousNavigator = saveGlobal('navigator');
    const previousFetch = saveGlobal('fetch');
    const requested = [];
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { setTimeout, clearTimeout }
    });
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {}
    });
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: async (url) => {
            requested.push(url);
            return new Response('scene', { headers: { 'content-length': '5' } });
        }
    });

    try {
        const preloader = createSceneAssetPreloader({
            cacheName: 'test-scenes',
            serviceWorkerUrl: '/scene-cache-sw.js',
            serviceWorkerScope: '/',
            assets: [
                { id: 'store:test', storeId: 'test', url: 'https://example.test/store.glb' },
                { id: 'world:always', url: 'https://example.test/always.glb' },
                { id: 'world:outside', url: 'https://example.test/outside.glb' }
            ]
        });
        await preloader.prepareEntry('test');
        assert.deepEqual(requested, ['https://example.test/store.glb']);
        assert.equal(preloader.state('world:always')?.state, 'idle');
        assert.equal(preloader.state('world:outside')?.state, 'idle');
    } finally {
        restoreGlobal('window', previousWindow);
        restoreGlobal('navigator', previousNavigator);
        restoreGlobal('fetch', previousFetch);
    }
});

test('harita açıldıktan sonra bütün dosyalar arka plan kuyruğuna alınır', async () => {
    const previousWindow = saveGlobal('window');
    const previousNavigator = saveGlobal('navigator');
    const previousFetch = saveGlobal('fetch');
    const requested = [];
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { setTimeout, clearTimeout }
    });
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {}
    });
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        value: async (url) => {
            requested.push(url);
            return new Response('asset', { headers: { 'content-length': '5' } });
        }
    });

    try {
        const preloader = createSceneAssetPreloader({
            cacheName: 'test-scenes',
            serviceWorkerUrl: '/scene-cache-sw.js',
            serviceWorkerScope: '/',
            concurrency: 2,
            assets: [
                { id: 'world:always', url: 'https://example.test/always.glb', priority: 50 },
                { id: 'store:test', url: 'https://example.test/store.glb', priority: 40 },
                { id: 'product:model:0', url: 'https://example.test/product.glb', priority: 10 }
            ]
        });
        const results = await preloader.preloadAll();

        assert.equal(results.length, 3);
        assert.deepEqual(requested.sort(), [
            'https://example.test/always.glb',
            'https://example.test/product.glb',
            'https://example.test/store.glb'
        ]);
        assert.equal(preloader.state('product:model:0')?.state, 'ready');
    } finally {
        restoreGlobal('window', previousWindow);
        restoreGlobal('navigator', previousNavigator);
        restoreGlobal('fetch', previousFetch);
    }
});
