/** Talep listesi, favoriler ve fiyat hesapları. DOM bağlantısı commerce-ui.js içindedir. */

const STORAGE_KEY = 'uzunCarsi:commerce:v1';
const MAX_LINE_QUANTITY = 20;
const MAX_CART_LINES = 60;

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Ürünün sayısal fiyatı; tanımsız/boş fiyatlar için null döner.
 * `Number(null)` sıfır ürettiği için doğrudan Number.isFinite kullanılamaz.
 */
export const priceOf = (product) => {
    const value = product?.price ?? product;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    return value;
};

const clampQuantity = (value) => Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(Number(value) || 0)));

/** Ürün kimliğinden kararlı bir sayı üretir; stok ve teslimat için kullanılır. */
const stableHash = (value) => {
    let hash = 2166136261;
    const text = String(value ?? '');
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
};

/**
 * Ürünün stok adedi. Gerçek bir stok servisi olmadığından kimlikten türetilir;
 * böylece aynı ürün her oturumda aynı stoğu gösterir.
 */
export const stockForProduct = (productId) => {
    const hash = stableHash(productId);
    const bucket = hash % 100;
    if (bucket < 4) return 0;
    if (bucket < 18) return 1 + (hash % 3);
    return 4 + (hash % 21);
};

export const deliveryDaysForProduct = (productId) => 1 + (stableHash(`${productId}:teslimat`) % 3);

/** 1.500 TL üzeri ürünlerde taksit seçenekleri. */
export const installmentPlans = (price) => {
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount < 1500) return [];
    return [3, 6, 12]
        .filter((count) => amount / count >= 250)
        .map((count) => ({ count, monthly: round2(amount / count) }));
};

export const formatPrice = (value, currency = 'TRY') => (
    typeof value === 'number' && Number.isFinite(value)
        ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value))
        : 'Fiyat bilgisi yok'
);

export const isPurchasable = (product) => Boolean(product)
    && (priceOf(product) || 0) > 0
    && stockForProduct(product.id) > 0;

/**
 * Sepet toplamını hesaplar. `lines` girdileri `{ product, quantity }` biçiminde
 * olmalı; fiyatı olmayan satırlar toplama katılmaz ama adet sayımına girer.
 */
export const summarizeCart = (lines = []) => {
    const priced = lines.filter(({ product }) => priceOf(product) !== null);
    return {
        itemCount: lines.reduce((total, line) => total + clampQuantity(line.quantity), 0),
        lineCount: lines.length,
        total: round2(priced.reduce(
            (total, line) => total + priceOf(line.product) * clampQuantity(line.quantity),
            0
        ))
    };
};

const emptyState = () => ({ cart: [], wishlist: [] });

const sanitizeState = (value) => {
    const state = emptyState();
    if (!value || typeof value !== 'object') return state;
    const cart = Array.isArray(value.cart) ? value.cart : [];
    const seen = new Set();
    for (const line of cart.slice(0, MAX_CART_LINES)) {
        const id = String(line?.id || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        state.cart.push({ id, quantity: clampQuantity(line.quantity) });
    }
    state.wishlist = [...new Set((Array.isArray(value.wishlist) ? value.wishlist : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean))].slice(0, 200);
    return state;
};

/** Tarayıcı yokken (testlerde) kullanılan bellek içi depolama. */
export const createMemoryStorage = (initial = null) => {
    let value = initial;
    return {
        getItem: () => value,
        setItem: (_key, next) => { value = next; },
        removeItem: () => { value = null; }
    };
};

const readStorage = (storage) => {
    try {
        return sanitizeState(JSON.parse(storage?.getItem(STORAGE_KEY) || 'null'));
    } catch {
        return emptyState();
    }
};

/**
 * Sepet ve favori durumunu tutar, değişiklikleri dinleyicilere bildirir.
 * `resolveProduct` ürün kaydını kimliğe göre döndürmelidir; fiyatlar çalışma
 * anında güncellendiği için satırlarda ürün kopyası saklanmaz.
 */
export const createCommerceStore = ({
    storage = typeof localStorage === 'undefined' ? createMemoryStorage() : localStorage,
    resolveProduct = () => null
} = {}) => {
    let state = readStorage(storage);
    const listeners = new Set();

    const persist = () => {
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
            // Kota dolu veya depolama kapalı: sepet oturum boyunca yaşamaya devam eder.
        }
    };

    const lines = () => state.cart
        .map(({ id, quantity }) => ({ id, quantity, product: resolveProduct(id) }))
        .filter(({ product }) => Boolean(product));

    const summary = () => summarizeCart(lines());

    const snapshot = () => ({
        lines: lines().map((line) => ({
            ...line,
            lineTotal: priceOf(line.product) === null
                ? null
                : round2(priceOf(line.product) * line.quantity),
            stock: stockForProduct(line.id)
        })),
        summary: summary(),
        wishlist: [...state.wishlist]
    });

    const emit = () => {
        persist();
        const current = snapshot();
        for (const listener of listeners) listener(current);
    };

    const findLine = (id) => state.cart.find((line) => line.id === id) || null;

    return {
        subscribe(listener) {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            listener(snapshot());
            return () => listeners.delete(listener);
        },
        getState: snapshot,
        getSummary: summary,
        getQuantity(productId) {
            return findLine(String(productId || ''))?.quantity || 0;
        },
        /**
         * Sepete ekler. Stok yetmiyorsa mevcut stoğa kırpar ve `clamped` döner.
         */
        addToCart(productOrId, quantity = 1) {
            const id = String(typeof productOrId === 'string' ? productOrId : productOrId?.id || '').trim();
            if (!id) return { added: false, reason: 'missing-product' };
            const product = resolveProduct(id);
            if (!product) return { added: false, reason: 'missing-product' };
            const stock = stockForProduct(id);
            if (stock <= 0) return { added: false, reason: 'out-of-stock' };
            if (!(priceOf(product) > 0)) return { added: false, reason: 'no-price' };
            const existing = findLine(id);
            if (!existing && state.cart.length >= MAX_CART_LINES) {
                return { added: false, reason: 'cart-full' };
            }
            const requested = (existing?.quantity || 0) + clampQuantity(quantity);
            const next = Math.min(requested, stock, MAX_LINE_QUANTITY);
            if (existing) existing.quantity = next;
            else state.cart.push({ id, quantity: next });
            emit();
            return { added: true, quantity: next, clamped: next < requested, stock };
        },
        setQuantity(productId, quantity) {
            const id = String(productId || '').trim();
            const existing = findLine(id);
            if (!existing) return { updated: false };
            const requested = Math.floor(Number(quantity) || 0);
            if (requested <= 0) return this.removeFromCart(id);
            const next = Math.min(clampQuantity(requested), stockForProduct(id), MAX_LINE_QUANTITY);
            existing.quantity = next;
            emit();
            return { updated: true, quantity: next, clamped: next < requested };
        },
        removeFromCart(productId) {
            const id = String(productId || '').trim();
            const before = state.cart.length;
            state.cart = state.cart.filter((line) => line.id !== id);
            if (state.cart.length === before) return { removed: false };
            emit();
            return { removed: true };
        },
        clearCart() {
            if (!state.cart.length) return;
            state.cart = [];
            emit();
        },
        isInWishlist(productId) {
            return state.wishlist.includes(String(productId || ''));
        },
        toggleWishlist(productOrId) {
            const id = String(typeof productOrId === 'string' ? productOrId : productOrId?.id || '').trim();
            if (!id) return { inWishlist: false };
            const index = state.wishlist.indexOf(id);
            if (index >= 0) state.wishlist.splice(index, 1);
            else state.wishlist.unshift(id);
            emit();
            return { inWishlist: index < 0 };
        }
    };
};
