import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductRegistry, normalizeTurkishText } from '../src/product-registry.js';

const product = (value) => ({
    currency: 'TRY',
    tags: ['test'],
    highQualityModel: '/models/test.glb',
    previewTransform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
    },
    ...value
});

const registry = createProductRegistry({
    products: [
        product({ id: 'gram', storeId: 'mawus', name: 'Gram Altın', category: 'Altın', price: 7174, active: true }),
        product({ id: 'kilogram', storeId: 'mawus', name: '12,5 Kilogram Altın', category: 'Altın', price: 89675000, active: true }),
        product({ id: 'gozluk', storeId: 'guzel-optik', name: 'Çerçevesiz Güneş Gözlüğü', category: 'Güneş Gözlüğü', price: 1590, active: true }),
        product({ id: 'fiyatsiz', storeId: 'sude-home', name: 'Yeni Ürün', category: 'Ev', price: null, active: true })
    ],
    bindings: []
}, { autoPersist: false });

test('Türkçe metni aksanlardan bağımsız aramaya hazırlar', () => {
    assert.equal(normalizeTurkishText('Çerçevesiz Gözlük'), 'cercevesiz gozluk');
});

test('arama sözcükleri tam sözcük olarak eşleşir', () => {
    assert.deepEqual(registry.search('gram altın').map(({ id }) => id), ['gram']);
    assert.deepEqual(registry.search('cercevesiz gozluk').map(({ id }) => id), ['gozluk']);
});

test('mağaza, kategori ve fiyat aralığı birlikte uygulanır', () => {
    const result = registry.filterProducts({
        storeId: 'guzel-optik',
        category: 'Güneş Gözlüğü',
        minPrice: 1500,
        maxPrice: 1600
    });
    assert.deepEqual(result.map(({ id }) => id), ['gozluk']);
});

test('fiyat filtresi uygulandığında fiyatı bilinmeyen ürün sonuçtan çıkar', () => {
    assert.equal(registry.filterProducts({ minPrice: 1 }).some(({ id }) => id === 'fiyatsiz'), false);
});
