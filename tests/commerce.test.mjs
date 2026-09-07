import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createCommerceStore,
    createMemoryStorage,
    deliveryDaysForProduct,
    installmentPlans,
    isPurchasable,
    stockForProduct,
    summarizeCart
} from '../src/commerce.js';

const catalog = new Map([
    ['UCUZ', { id: 'UCUZ', name: 'Küçük Kase', price: 449, currency: 'TRY', storeId: 'sude-home', storeName: 'Sude Home' }],
    ['PAHALI', { id: 'PAHALI', name: 'Z9 Pro Max', price: 42900, currency: 'TRY', storeId: 'telefon', storeName: 'Zeka Teknoloji' }],
    ['FIYATSIZ', { id: 'FIYATSIZ', name: 'Vitrin Ürünü', price: null, currency: 'TRY', storeId: 'nisantasi' }]
]);

const createStore = () => createCommerceStore({
    storage: createMemoryStorage(),
    resolveProduct: (id) => catalog.get(id) || null
});

/** Stoğu tükenmiş kimlikleri deterministik üreticiden bulur. */
const findIdWithStock = (predicate) => {
    for (let index = 0; index < 5000; index += 1) {
        const id = `URUN_${index}`;
        if (predicate(stockForProduct(id))) return id;
    }
    throw new Error('Uygun kimlik bulunamadı.');
};

test('stok ve teslimat süresi aynı ürün için kararlı kalır', () => {
    const first = stockForProduct('TEL_PHONE_COMPACT');
    assert.equal(first, stockForProduct('TEL_PHONE_COMPACT'));
    assert.ok(first >= 0 && first <= 24);
    const days = deliveryDaysForProduct('TEL_PHONE_COMPACT');
    assert.equal(days, deliveryDaysForProduct('TEL_PHONE_COMPACT'));
    assert.ok(days >= 1 && days <= 3);
});

test('taksit yalnızca eşik üstünde ve anlamlı tutarlarda önerilir', () => {
    assert.deepEqual(installmentPlans(900), []);
    const plans = installmentPlans(18900);
    assert.deepEqual(plans.map(({ count }) => count), [3, 6, 12]);
    assert.equal(plans[0].monthly, 6300);
    // 12 taksitte aylık 250 TL'nin altına düşen ürünlerde o seçenek gösterilmez.
    assert.deepEqual(installmentPlans(2000).map(({ count }) => count), [3, 6]);
});

test('sepet toplamı satır fiyatı ile adedin çarpımıdır', () => {
    const özet = summarizeCart([
        { product: catalog.get('UCUZ'), quantity: 2 },
        { product: catalog.get('PAHALI'), quantity: 1 }
    ]);
    assert.equal(özet.itemCount, 3);
    assert.equal(özet.lineCount, 2);
    assert.equal(özet.total, 43798);
});

test('boş sepetin toplamı sıfırdır', () => {
    assert.deepEqual(summarizeCart(), { itemCount: 0, lineCount: 0, total: 0 });
});

test('fiyatı olmayan satır toplamı bozmaz ama adet sayımına girer', () => {
    const özet = summarizeCart([
        { product: catalog.get('UCUZ'), quantity: 1 },
        { product: catalog.get('FIYATSIZ'), quantity: 3 }
    ]);
    assert.equal(özet.total, 449);
    assert.equal(özet.itemCount, 4);
});

test('sepete ekleme stokla sınırlanır ve fiyatsız ürün eklenmez', () => {
    const store = createStore();
    assert.equal(store.addToCart('FIYATSIZ').added, false);
    assert.equal(store.addToCart('FIYATSIZ').reason, 'no-price');

    const sonuç = store.addToCart('UCUZ', 3);
    assert.equal(sonuç.added, true);
    assert.equal(store.getQuantity('UCUZ'), Math.min(3, stockForProduct('UCUZ')));

    const aşırı = store.setQuantity('UCUZ', 999);
    assert.equal(aşırı.clamped, true);
    assert.equal(store.getQuantity('UCUZ'), Math.min(20, stockForProduct('UCUZ')));
});

test('adet sıfıra düşürülürse satır sepetten çıkar', () => {
    const store = createStore();
    store.addToCart('UCUZ', 2);
    assert.equal(store.setQuantity('UCUZ', 0).removed, true);
    assert.equal(store.getState().lines.length, 0);
});

test('stoğu biten ürün ne sepete eklenir ne satın alınabilir sayılır', () => {
    const tükenmiş = findIdWithStock((stock) => stock === 0);
    const store = createCommerceStore({
        storage: createMemoryStorage(),
        resolveProduct: (id) => (id === tükenmiş ? { id, name: 'Tükendi', price: 100, currency: 'TRY' } : null)
    });
    assert.equal(store.addToCart(tükenmiş).reason, 'out-of-stock');
    assert.equal(isPurchasable({ id: tükenmiş, price: 100 }), false);
    assert.equal(isPurchasable(catalog.get('UCUZ')), stockForProduct('UCUZ') > 0);
});

test('sepet ve favoriler depolamaya yazılır ve geri okunur', () => {
    const storage = createMemoryStorage();
    const options = { storage, resolveProduct: (id) => catalog.get(id) || null };
    const ilk = createCommerceStore(options);
    ilk.addToCart('UCUZ', 2);
    ilk.toggleWishlist('PAHALI');

    const ikinci = createCommerceStore(options);
    assert.equal(ikinci.getQuantity('UCUZ'), 2);
    assert.equal(ikinci.isInWishlist('PAHALI'), true);
    assert.equal(ikinci.toggleWishlist('PAHALI').inWishlist, false);
    assert.equal(ikinci.isInWishlist('PAHALI'), false);
});

test('bozuk depolama içeriği sepeti çökertmez', () => {
    const storage = createMemoryStorage('{bozuk json');
    const store = createCommerceStore({ storage, resolveProduct: (id) => catalog.get(id) || null });
    assert.deepEqual(store.getState().lines, []);
    assert.equal(store.getSummary().total, 0);
});

test('sepeti boşaltmak bütün satırları siler', () => {
    const store = createStore();
    store.addToCart('UCUZ', 1);
    store.addToCart('PAHALI', 1);
    store.clearCart();
    assert.equal(store.getState().lines.length, 0);
    assert.equal(store.getSummary().total, 0);
});

test('abone sepet değiştikçe güncel özeti alır', () => {
    const store = createStore();
    const görülen = [];
    const unsubscribe = store.subscribe((state) => görülen.push(state.summary.itemCount));
    store.addToCart('UCUZ', 1);
    store.addToCart('UCUZ', 1);
    unsubscribe();
    store.addToCart('UCUZ', 1);
    assert.deepEqual(görülen, [0, 1, 2]);
});
