import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoldPricingPanel } from '../src/gold-pricing.js';
import { createCommerceStore, createMemoryStorage } from '../src/commerce.js';

test('detay yenilemesi görünür fiyatı yazmadan önce sepetin fiyat kaynağını günceller', async () => {
    const names = ['window', 'document', 'fetch', 'localStorage'];
    const previous = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
    const target = new EventTarget();
    target.setTimeout = setTimeout; target.clearTimeout = clearTimeout;
    const node = () => ({
        textContent: '', classList: { add() {}, remove() {} },
        replaceChildren() {}, append() {},
        getBoundingClientRect: () => ({ width: 100, height: 50 }),
        getContext: () => ({ setTransform() {}, clearRect() {} })
    });
    const elements = new Map();
    const root = node();
    root.querySelector = (selector) => {
        if (!elements.has(selector)) elements.set(selector, node());
        return elements.get(selector);
    };
    root.closest = () => root;
    let saved = null;
    for (const [name, value] of Object.entries({
        window: target, document: { createElement: node },
        localStorage: { getItem: () => saved, setItem: (_key, value) => { saved = value; } },
        fetch: async (url) => ({ ok: true, json: async () => url.includes('/spot') ? { xau: { price: 6000 } } : { points: [] } })
    })) Object.defineProperty(globalThis, name, { configurable: true, value });
    let panel;
    try {
        let product = { id: 'MAWUS_HQ_GRAM_ALTIN', price: 5000, storeId: 'nisantasi', currency: 'TRY' };
        const cart = createCommerceStore({ storage: createMemoryStorage(), resolveProduct: () => product });
        assert.equal(cart.addToCart(product).added, true);
        panel = createGoldPricingPanel(root, {
            onPricesLoaded(result) {
                product = { ...product, price: result.prices[product.id].price };
                assert.notEqual(elements.get('#inspectorPrice').textContent, '₺6.150');
            }
        });
        await panel.show(product, 'nisantasi');
        assert.equal(cart.getSummary().total, 6150);
        assert.equal(elements.get('#inspectorPrice').textContent, new Intl.NumberFormat('tr-TR', {
            style: 'currency', currency: 'TRY', maximumFractionDigits: 0
        }).format(cart.getSummary().total));
    } finally {
        panel?.dispose();
        names.forEach((name, index) => {
            if (previous[index]) Object.defineProperty(globalThis, name, previous[index]);
            else delete globalThis[name];
        });
    }
});
