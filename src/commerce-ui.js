/** Talep listesi ve favoriler için DOM arayüzü. Durum kaynağı commerce.js. */

import './commerce.css';

import { iconElement, iconMarkup } from './icons.js';
import { createFocusTrap } from './focus-trap.js';
import {
    deliveryDaysForProduct,
    formatPrice,
    installmentPlans,
    priceOf,
    stockForProduct
} from './commerce.js';

const TABS = [
    { id: 'cart', label: 'Talep listem' },
    { id: 'wishlist', label: 'Favoriler' }
];

const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
};

const button = (className, label, { type = 'button', title = '' } = {}) => {
    const node = el('button', className, label);
    node.type = type;
    if (title) node.title = title;
    return node;
};

const stockLabel = (stock) => {
    if (stock <= 0) return { text: 'Tükendi', tone: 'out' };
    if (stock <= 3) return { text: `Son ${stock} adet`, tone: 'low' };
    return { text: 'Stokta', tone: 'ok' };
};

const deliveryLabel = (productId) => {
    const days = deliveryDaysForProduct(productId);
    return days === 1 ? 'Yarın kargoda' : `${days} iş günü içinde kargoda`;
};

export const createCommerceUi = ({
    store,
    registry,
    stores = {},
    onOpenProduct = null,
    onGoToStore = null,
    onBeforeOpen = null
} = {}) => {
    if (!store || !registry) throw new Error('Ticaret arayüzü için mağaza ve ürün kaydı gerekli.');

    const productById = (id) => registry.getProduct?.(id) || null;
    let latest = store.getState();
    let activeTab = 'cart';
    let inspectedProduct = null;
    let inspectedQuantity = 1;
    let toastTimer = 0;

    // ---------------------------------------------------------------- bildirim
    const toast = el('div', 'commerce-toast hidden');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);

    const notify = (message, tone = 'ok') => {
        toast.textContent = message;
        toast.dataset.tone = tone;
        toast.classList.remove('hidden');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.add('hidden'), 2600);
    };

    // ------------------------------------------------------------- HUD düğmesi
    const hudHost = document.querySelector('.tour-hud__left');
    const hudIcon = (name) => {
        const slot = el('span', 'hud-btn-icon');
        slot.setAttribute('aria-hidden', 'true');
        slot.append(iconElement(name, { size: 16 }));
        return slot;
    };
    const cartButton = button('hud-pill-button commerce-hud-button', null, { title: 'Talep listesini aç' });
    cartButton.setAttribute('aria-label', 'Talep listesini aç');
    cartButton.append(hudIcon('cart'), el('span', null, 'Talep listem'), el('span', 'commerce-badge', '0'));
    const wishlistButton = button('hud-pill-button commerce-hud-button', null, { title: 'Favorileri aç' });
    wishlistButton.setAttribute('aria-label', 'Favorileri aç');
    wishlistButton.append(hudIcon('heart'), el('span', null, 'Favoriler'), el('span', 'commerce-badge', '0'));
    hudHost?.append(cartButton, wishlistButton);

    // Sepete tur dışında da ulaşılabilmeli: harita ve katalog ekranlarına da
    // birer giriş noktası eklenir.
    const entryButtons = [];
    const mountEntryButton = (host, label) => {
        if (!host) return;
        const node = button('commerce-entry-button', null, { title: 'Talep listesini aç' });
        node.append(el('span', null, label), el('span', 'commerce-badge', '0'));
        node.addEventListener('click', () => setOpen(panel.hidden, 'cart'));
        host.append(node);
        entryButtons.push(node);
    };
    mountEntryButton(document.querySelector('.portal-entry-actions'), 'Talep listem');
    mountEntryButton(document.querySelector('.store-map-search__footer'), 'Talep listem');

    // ------------------------------------------------------------------ panel
    const panel = el('aside', 'commerce-panel hidden');
    panel.id = 'commercePanel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Talep listesi ve favoriler');

    const header = el('header', 'commerce-panel__head');
    const tabBar = el('div', 'commerce-tabs');
    tabBar.setAttribute('role', 'tablist');
    const tabButtons = new Map();
    for (const tab of TABS) {
        const node = button('commerce-tab', null);
        node.setAttribute('role', 'tab');
        node.append(el('span', null, tab.label), el('b', 'commerce-tab__count', '0'));
        node.addEventListener('click', () => {
            activeTab = tab.id;
            render();
        });
        tabButtons.set(tab.id, node);
        tabBar.append(node);
    }
    const closeButton = button('commerce-panel__close', null, { title: 'Kapat' });
    closeButton.innerHTML = iconMarkup('close', { size: 16 });
    closeButton.setAttribute('aria-label', 'Paneli kapat');
    closeButton.addEventListener('click', () => setOpen(false));
    header.append(tabBar, closeButton);

    const body = el('div', 'commerce-panel__body');
    const footer = el('footer', 'commerce-panel__foot');
    panel.append(header, body, footer);
    document.body.append(panel);

    const backdrop = el('div', 'commerce-backdrop hidden');
    backdrop.addEventListener('click', () => setOpen(false));
    document.body.append(backdrop);
    const commerceFocusTrap = createFocusTrap(panel, { initialFocus: () => closeButton });

    // ------------------------------------------------------ ürün satın alma bloğu
    const buyBlock = el('section', 'product-buy hidden');
    const buyMeta = el('div', 'product-buy__meta');
    const buyStock = el('span', 'product-buy__stock');
    const buyDelivery = el('span', 'product-buy__delivery');
    buyMeta.append(buyStock, buyDelivery);
    const buyInstallments = el('p', 'product-buy__installments');
    const buyActions = el('div', 'product-buy__actions');
    const quantityBox = el('div', 'product-quantity');
    const quantityMinus = button('product-quantity__step', '−', { title: 'Azalt' });
    const quantityValue = el('output', 'product-quantity__value', '1');
    const quantityPlus = button('product-quantity__step', '+', { title: 'Artır' });
    quantityBox.append(quantityMinus, quantityValue, quantityPlus);
    const addToCartButton = button('product-buy__add', 'Listeye ekle');
    const wishlistToggle = button('product-buy__wish', null, { title: 'Favorilere ekle' });
    const wishlistIcon = el('span', 'product-buy__wish-icon');
    wishlistIcon.innerHTML = iconMarkup('heart', { size: 15 });
    wishlistToggle.append(wishlistIcon, el('span', null, 'Favori'));
    buyActions.append(quantityBox, addToCartButton, wishlistToggle);
    const buyNote = el('p', 'product-buy__note');
    buyBlock.append(buyMeta, buyInstallments, buyActions, buyNote);

    const detailHost = document.querySelector('.product-detail');
    const detailPrice = document.getElementById('inspectorPrice');
    if (detailHost && detailPrice) detailPrice.after(buyBlock);
    else detailHost?.append(buyBlock);

    const setQuantity = (value) => {
        const stock = inspectedProduct ? stockForProduct(inspectedProduct.id) : 0;
        inspectedQuantity = Math.max(1, Math.min(value, Math.max(stock, 1), 20));
        quantityValue.value = String(inspectedQuantity);
        quantityValue.textContent = String(inspectedQuantity);
    };

    quantityMinus.addEventListener('click', () => setQuantity(inspectedQuantity - 1));
    quantityPlus.addEventListener('click', () => setQuantity(inspectedQuantity + 1));
    addToCartButton.addEventListener('click', () => {
        if (!inspectedProduct) return;
        const result = store.addToCart(inspectedProduct, inspectedQuantity);
        if (result.added) {
            notify(result.clamped
                ? `Stok kadar eklendi: ${result.quantity} adet.`
                : `${inspectedProduct.name} talep listesine eklendi.`);
            return;
        }
        notify(result.reason === 'out-of-stock'
            ? 'Bu ürün tükendi.'
            : result.reason === 'no-price'
                ? 'Bu ürünün fiyatı için mağazaya danışın.'
            : 'Ürün talep listesine eklenemedi.', 'warn');
    });
    wishlistToggle.addEventListener('click', () => {
        if (!inspectedProduct) return;
        const { inWishlist } = store.toggleWishlist(inspectedProduct);
        notify(inWishlist ? 'Favorilere eklendi.' : 'Favorilerden çıkarıldı.');
    });

    const renderBuyBlock = () => {
        if (!inspectedProduct) {
            buyBlock.classList.add('hidden');
            return;
        }
        const product = productById(inspectedProduct.id) || inspectedProduct;
        inspectedProduct = product;
        const price = priceOf(product);
        const stock = stockForProduct(product.id);
        const status = stockLabel(stock);
        buyBlock.classList.remove('hidden');
        buyStock.textContent = status.text;
        buyStock.dataset.tone = status.tone;
        buyDelivery.textContent = stock > 0 ? `${deliveryLabel(product.id)} (tahmini)` : 'Şu anda stokta görünmüyor';

        const plans = price === null || stock <= 0 ? [] : installmentPlans(price);
        buyInstallments.textContent = plans.length
            ? `Taksitle: ${plans.map(({ count, monthly }) => `${count} × ${formatPrice(monthly, product.currency)}`).join(' · ')}`
            : '';
        buyInstallments.classList.toggle('hidden', plans.length === 0);

        const buyable = price !== null && price > 0 && stock > 0;
        addToCartButton.disabled = !buyable;
        quantityMinus.disabled = !buyable;
        quantityPlus.disabled = !buyable;
        addToCartButton.textContent = stock <= 0
            ? 'Tükendi'
            : price === null || price <= 0
                ? 'Fiyat için mağazaya danışın'
                : 'Listeye ekle';

        const inCart = store.getQuantity(product.id);
        buyNote.textContent = inCart > 0
            ? `Talep listenizde ${inCart} adet var. Fiyat, stok ve teslimat mağaza onayıyla kesinleşir.`
            : 'Fiyat, stok ve teslimat mağaza onayıyla kesinleşir. Bu listede ödeme alınmaz.';

        const favourite = store.isInWishlist(product.id);
        wishlistToggle.dataset.active = String(favourite);
        wishlistToggle.querySelector('.product-buy__wish-icon').innerHTML = iconMarkup('heart', { size: 15, filled: favourite });
        wishlistToggle.setAttribute('aria-pressed', String(favourite));
        setQuantity(inspectedQuantity);
    };

    // ------------------------------------------------------------ panel görünümleri
    const openProduct = (productId) => {
        setOpen(false);
        onOpenProduct?.(productId);
    };

    const productRow = (product, { quantity = null, showQuantity = false, showRemove = false } = {}) => {
        const row = el('article', 'commerce-line');
        const info = el('div', 'commerce-line__info');
        const title = button('commerce-line__name', product.name || product.id, { title: 'Ürünü incele' });
        title.addEventListener('click', () => openProduct(product.id));
        const meta = el('small', 'commerce-line__meta',
            [product.storeName || stores[product.storeId]?.shortName, product.category].filter(Boolean).join(' · '));
        info.append(title, meta);

        const priceBox = el('div', 'commerce-line__price');
        const unit = priceOf(product);
        priceBox.append(el('strong', null, formatPrice(
            unit === null ? null : unit * (quantity || 1),
            product.currency
        )));
        if (showQuantity && quantity > 1 && unit !== null) {
            priceBox.append(el('small', null, `${quantity} × ${formatPrice(unit, product.currency)}`));
        }

        const controls = el('div', 'commerce-line__controls');
        if (showQuantity) {
            const stepper = el('div', 'commerce-stepper');
            const minus = button('commerce-stepper__btn', '−', { title: 'Azalt' });
            const value = el('span', 'commerce-stepper__value', String(quantity));
            const plus = button('commerce-stepper__btn', '+', { title: 'Artır' });
            minus.addEventListener('click', () => store.setQuantity(product.id, quantity - 1));
            plus.addEventListener('click', () => {
                const result = store.setQuantity(product.id, quantity + 1);
                if (result.clamped) notify('Stok sınırına ulaşıldı.', 'warn');
            });
            plus.disabled = quantity >= stockForProduct(product.id);
            stepper.append(minus, value, plus);
            controls.append(stepper);
        }
        if (showRemove) {
            const remove = button('commerce-line__remove', 'Kaldır');
            remove.addEventListener('click', () => store.removeFromCart(product.id));
            controls.append(remove);
        }

        row.append(info, priceBox, controls);
        return row;
    };

    const emptyState = (title, description, actionLabel, action) => {
        const box = el('div', 'commerce-empty');
        box.append(el('strong', null, title), el('p', null, description));
        if (actionLabel && action) {
            const node = button('commerce-empty__action', actionLabel);
            node.addEventListener('click', action);
            box.append(node);
        }
        return box;
    };

    const renderCart = () => {
        body.replaceChildren();
        footer.replaceChildren();
        if (!latest.lines.length) {
            body.append(emptyState(
                'Talep listeniz boş',
                'Beğendiğiniz ürünleri listeye ekleyip tahmini toplamı birlikte görebilirsiniz.',
                'Alışverişe başla',
                () => setOpen(false)
            ));
            return;
        }
        const list = el('div', 'commerce-list');
        for (const line of latest.lines) {
            list.append(productRow(line.product, {
                quantity: line.quantity,
                showQuantity: true,
                showRemove: true
            }));
        }
        const total = el('div', 'commerce-total');
        total.append(
            el('span', null, `${latest.summary.itemCount} ürün · Tahmini toplam`),
            el('strong', null, formatPrice(latest.summary.total))
        );
        body.append(list, total);

        const clear = button('commerce-ghost-button', 'Listeyi boşalt');
        clear.addEventListener('click', () => {
            store.clearCart();
            notify('Talep listesi boşaltıldı.');
        });
        const keepShopping = button('commerce-primary-button', 'Alışverişe devam et');
        keepShopping.addEventListener('click', () => setOpen(false));
        footer.append(clear, keepShopping);
    };

    const renderWishlist = () => {
        body.replaceChildren();
        footer.replaceChildren();
        const products = latest.wishlist.map(productById).filter(Boolean);
        if (!products.length) {
            body.append(emptyState(
                'Favori listeniz boş',
                'Ürün incelerken kalp düğmesine basarak buraya ekleyebilirsiniz.',
                'Mağazalara dön',
                () => setOpen(false)
            ));
            return;
        }
        const list = el('div', 'commerce-list');
        for (const product of products) {
            const row = productRow(product);
            const controls = row.querySelector('.commerce-line__controls');
            const add = button('commerce-line__add', 'Listeye ekle');
            add.disabled = !(priceOf(product) > 0) || stockForProduct(product.id) <= 0;
            add.addEventListener('click', () => {
                const result = store.addToCart(product, 1);
                notify(result.added ? `${product.name} talep listesine eklendi.` : 'Ürün listeye eklenemedi.', result.added ? 'ok' : 'warn');
            });
            const drop = button('commerce-line__remove', 'Çıkar');
            drop.addEventListener('click', () => store.toggleWishlist(product.id));
            controls.append(add, drop);
            list.append(row);
        }
        body.append(list);
    };

    const render = () => {
        for (const [id, node] of tabButtons) {
            const count = id === 'cart' ? latest.summary.itemCount : latest.wishlist.length;
            node.querySelector('.commerce-tab__count').textContent = String(count);
            const selected = activeTab === id;
            node.classList.toggle('is-active', selected);
            node.setAttribute('aria-selected', String(selected));
        }
        panel.dataset.view = activeTab;
        if (activeTab === 'wishlist') renderWishlist();
        else renderCart();

        cartButton.querySelector('.commerce-badge').textContent = String(latest.summary.itemCount);
        cartButton.dataset.filled = String(latest.summary.itemCount > 0);
        wishlistButton.querySelector('.commerce-badge').textContent = String(latest.wishlist.length);
        wishlistButton.dataset.filled = String(latest.wishlist.length > 0);
        for (const node of entryButtons) {
            node.querySelector('.commerce-badge').textContent = String(latest.summary.itemCount);
            node.dataset.filled = String(latest.summary.itemCount > 0);
        }
        renderBuyBlock();
    };

    const setOpen = (open, tab = null) => {
        if (open) {
            onBeforeOpen?.();
            if (tab) activeTab = tab;
        }
        panel.hidden = !open;
        panel.classList.toggle('hidden', !open);
        backdrop.classList.toggle('hidden', !open);
        document.body.classList.toggle('commerce-panel-open', open);
        if (open) {
            render();
            commerceFocusTrap.activate();
        } else {
            commerceFocusTrap.deactivate();
        }
    };

    cartButton.addEventListener('click', () => setOpen(panel.hidden, 'cart'));
    wishlistButton.addEventListener('click', () => setOpen(panel.hidden, 'wishlist'));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !panel.hidden) {
            event.stopPropagation();
            setOpen(false);
        }
    }, true);

    // ------------------------------------------- katalogdaki ürün sonuç listesi
    const portalResults = document.querySelector('.portal-results');
    const storeGrid = document.getElementById('storeGrid');
    const portalHead = document.querySelector('.portal-results__head');
    let catalogProducts = [];
    let catalogVisible = 24;
    let portalView = 'stores';
    let catalogSort = 'featured';

    const viewSwitch = el('div', 'portal-view-switch');
    const storesViewButton = button(null, 'Mağazalar');
    const productsViewButton = button(null, 'Ürünler');
    viewSwitch.append(storesViewButton, productsViewButton);

    const resultTools = el('div', 'portal-results__tools');
    const sortLabel = el('label', 'portal-sort');
    sortLabel.append(el('span', null, 'Sırala'));
    const sortSelect = document.createElement('select');
    sortSelect.setAttribute('aria-label', 'Ürünleri sırala');
    for (const [value, label] of [
        ['featured', 'Önerilen'],
        ['price-asc', 'Fiyat: düşükten yükseğe'],
        ['price-desc', 'Fiyat: yüksekten düşüğe'],
        ['name', 'Ada göre'],
        ['stock', 'Önce stoktakiler']
    ]) sortSelect.append(new Option(label, value));
    sortLabel.append(sortSelect);
    resultTools.append(sortLabel, viewSwitch);

    const productResults = el('div', 'portal-product-results hidden');
    const productGrid = el('div', 'portal-product-grid');
    const moreButton = button('portal-product-more', 'Daha fazla göster');
    moreButton.addEventListener('click', () => {
        catalogVisible += 24;
        renderCatalogGrid();
    });
    productResults.append(productGrid, moreButton);
    portalHead?.append(resultTools);
    if (portalResults && storeGrid) storeGrid.after(productResults);

    const setPortalView = (view) => {
        portalView = view;
        const showProducts = view === 'products';
        productResults.classList.toggle('hidden', !showProducts);
        storeGrid?.classList.toggle('hidden', showProducts);
        if (storeGrid) storeGrid.hidden = showProducts;
        storesViewButton.classList.toggle('is-active', !showProducts);
        productsViewButton.classList.toggle('is-active', showProducts);
        if (showProducts) renderCatalogGrid();
    };
    storesViewButton.addEventListener('click', () => setPortalView('stores'));
    productsViewButton.addEventListener('click', () => setPortalView('products'));
    sortSelect.addEventListener('change', () => {
        catalogSort = sortSelect.value;
        catalogVisible = 24;
        renderCatalogGrid();
    });

    /**
     * Katalog satırı. Ürünler kutulanmış kart ızgarası yerine çarşı fiyat
     * listesi gibi dizilir: ad solda, fiyat sağda, aralarında ince bir çizgi.
     */
    const catalogRow = (product) => {
        const row = el('article', 'catalog-row');
        const price = priceOf(product);
        const stock = stockForProduct(product.id);
        const status = stockLabel(stock);

        const head = el('div', 'catalog-row__head');
        const preview = button('catalog-row__thumb', null, { title: `${product.name || 'Ürün'} ürününü 3B incele` });
        preview.setAttribute('aria-label', `${product.name || 'Ürün'} ürününü 3B incele`);
        preview.innerHTML = iconMarkup(stores[product.storeId]?.icon || 'search', { size: 32 });
        preview.addEventListener('click', () => openProduct(product.id));
        const title = el('div', 'catalog-row__title');
        const productName = button('catalog-row__name', product.name || product.id, { title: 'Ürünü 3B incele' });
        productName.addEventListener('click', () => openProduct(product.id));
        const heading = el('h3', 'catalog-row__heading');
        heading.append(productName);
        title.append(
            el('span', 'catalog-row__store', product.storeName || stores[product.storeId]?.shortName || product.storeId),
            heading
        );
        const priceBox = el('div', 'catalog-row__price');
        priceBox.append(el('strong', null, price === null
            ? (product.priceLabel || 'Mağazada')
            : formatPrice(price, product.currency)));
        priceBox.append(el('small', null, status.text));
        priceBox.dataset.stock = status.tone;
        head.append(preview, title, priceBox);

        const foot = el('div', 'catalog-row__foot');
        const meta = el('p', 'catalog-row__meta',
            [product.category || 'Ürün', stock > 0 ? deliveryLabel(product.id) : null].filter(Boolean).join(' · '));

        const actions = el('div', 'catalog-row__actions');
        const add = button('catalog-row__add', 'Listeye ekle');
        add.disabled = !(price > 0) || stock <= 0;
        add.addEventListener('click', () => {
            const result = store.addToCart(product, 1);
            notify(result.added ? `${product.name} talep listesine eklendi.` : 'Ürün listeye eklenemedi.', result.added ? 'ok' : 'warn');
        });
        const favourite = button('catalog-row__wish', null, { title: 'Favorilere ekle' });
        const paintFavourite = (active) => {
            favourite.dataset.active = String(active);
            favourite.innerHTML = iconMarkup('heart', { size: 15, filled: active });
        };
        paintFavourite(store.isInWishlist(product.id));
        favourite.addEventListener('click', () => paintFavourite(store.toggleWishlist(product.id).inWishlist));
        const visit = button('catalog-row__visit', '3B mağazada gör', { title: 'Ürünün bulunduğu mağazaya gir' });
        visit.addEventListener('click', () => onGoToStore?.(product.storeId));
        actions.append(add, favourite, visit);

        foot.append(meta, actions);
        row.append(head, foot);
        return row;
    };

    function renderCatalogGrid() {
        productGrid.replaceChildren();
        const ordered = [...catalogProducts].sort((left, right) => {
            if (catalogSort === 'name') return String(left.name || '').localeCompare(String(right.name || ''), 'tr');
            if (catalogSort === 'stock') return stockForProduct(right.id) - stockForProduct(left.id);
            const leftPrice = priceOf(left) ?? Number.POSITIVE_INFINITY;
            const rightPrice = priceOf(right) ?? Number.POSITIVE_INFINITY;
            if (catalogSort === 'price-asc') return leftPrice - rightPrice;
            if (catalogSort === 'price-desc') return rightPrice - leftPrice;
            return 0;
        });
        const shown = ordered.slice(0, catalogVisible);
        for (const product of shown) productGrid.append(catalogRow(product));
        moreButton.hidden = catalogProducts.length <= shown.length;
        moreButton.textContent = `Daha fazla göster (${catalogProducts.length - shown.length})`;
        if (!catalogProducts.length) {
            productGrid.append(emptyState('Eşleşen ürün yok', 'Arama kelimesini veya fiyat aralığını değiştirin.'));
        }
    }

    const unsubscribe = store.subscribe((state) => {
        latest = state;
        render();
    });

    setPortalView('stores');

    return {
        /**
         * Katalogdaki ürün sonuçlarını tazeler. Filtre uygulandığında görünüm
         * kendiliğinden ürün listesine geçer; filtre temizlenince mağazalara döner.
         */
        renderCatalog(products, { hasFilter = false } = {}) {
            catalogProducts = Array.isArray(products) ? products : [];
            catalogVisible = 24;
            productsViewButton.textContent = `Ürünler (${catalogProducts.length})`;
            if (hasFilter && portalView !== 'products') setPortalView('products');
            else if (!hasFilter && portalView === 'products') setPortalView('stores');
            else if (portalView === 'products') renderCatalogGrid();
        },
        /** Ürün inceleme ekranı açıldığında satın alma bloğunu o ürüne bağlar. */
        setInspectedProduct(product) {
            inspectedProduct = product && product.id ? product : null;
            inspectedQuantity = 1;
            renderBuyBlock();
        },
        openCart: () => setOpen(true, 'cart'),
        openWishlist: () => setOpen(true, 'wishlist'),
        close: () => setOpen(false),
        goToStore: (storeId) => onGoToStore?.(storeId),
        /**
         * Ürün kaydı dışarıdan değiştiğinde (örneğin canlı altın fiyatı gelince)
         * çağrılır. `render` önbellekteki anlık görüntüyü çizdiği için durum
         * mağazadan yeniden okunur.
         */
        refresh() {
            latest = store.getState();
            render();
        },
        dispose() {
            unsubscribe();
            commerceFocusTrap.dispose();
            window.clearTimeout(toastTimer);
            panel.remove();
            backdrop.remove();
            toast.remove();
            cartButton.remove();
            wishlistButton.remove();
            for (const node of entryButtons) node.remove();
            buyBlock.remove();
            viewSwitch.remove();
            productResults.remove();
            storeGrid?.classList.remove('hidden');
            if (storeGrid) storeGrid.hidden = false;
        }
    };
};
