const DEFAULT_SCHEMA_VERSION = 1;
const DEFAULT_STORAGE_KEY = 'uzuncarsi.product-registry.v1';

const clone = (value) => {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
};

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isVector3 = (value, { positive = false } = {}) => Array.isArray(value)
    && value.length === 3
    && value.every((entry) => isFiniteNumber(entry) && (!positive || entry > 0));

const normalizeArray = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === 'string' ? value.trim() : '';

export const normalizeTurkishText = (value) => String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeDataset = (value = {}) => ({
    schemaVersion: Number(value.schemaVersion) || DEFAULT_SCHEMA_VERSION,
    products: normalizeArray(value.products).map(clone),
    bindings: normalizeArray(value.bindings).map(clone)
});

export const combineProductData = (productsFile = {}, bindingsFile = {}) => ({
    schemaVersion: Number(productsFile.schemaVersion ?? bindingsFile.schemaVersion) || DEFAULT_SCHEMA_VERSION,
    products: normalizeArray(productsFile.products).map(clone),
    bindings: normalizeArray(bindingsFile.bindings).map(clone)
});

const productSearchText = (product) => normalizeTurkishText([
    product.id,
    product.storeId,
    product.name,
    product.category,
    product.brand,
    product.description,
    ...normalizeArray(product.tags)
].filter(Boolean).join(' '));

const issue = (severity, code, path, message) => ({ severity, code, path, message });

const validateTransform = (transform, path, issues) => {
    if (!isObject(transform)) {
        issues.push(issue('error', 'invalid_preview_transform', path, 'previewTransform bir nesne olmalı.'));
        return;
    }
    for (const key of ['position', 'rotation', 'scale']) {
        if (!isVector3(transform[key], { positive: key === 'scale' })) {
            issues.push(issue('error', 'invalid_preview_transform', `${path}.${key}`, `${key} üç sonlu sayıdan oluşmalı${key === 'scale' ? ' ve pozitif olmalı' : ''}.`));
        }
    }
};

const validateBounds = (bounds, path, issues) => {
    if (!isObject(bounds)) return false;
    const centerSize = isVector3(bounds.center) && isVector3(bounds.size, { positive: true });
    const minMax = isVector3(bounds.min) && isVector3(bounds.max)
        && bounds.min.every((entry, index) => entry <= bounds.max[index]);
    if (!centerSize && !minMax) {
        issues.push(issue('error', 'invalid_bounds', path, 'bounds, center+size veya min+max vektörleri içermeli.'));
    }
    return centerSize || minMax;
};

export const validateProductDataset = (input) => {
    const data = normalizeDataset(input);
    const issues = [];
    if (!isObject(input)) issues.push(issue('error', 'invalid_root', '$', 'Ürün verisi bir nesne olmalı.'));
    if (!Array.isArray(input?.products)) issues.push(issue('error', 'missing_products', '$.products', 'products dizisi zorunlu.'));
    if (!Array.isArray(input?.bindings)) issues.push(issue('error', 'missing_bindings', '$.bindings', 'bindings dizisi zorunlu.'));
    if (data.schemaVersion !== DEFAULT_SCHEMA_VERSION) {
        issues.push(issue('error', 'unsupported_schema_version', '$.schemaVersion', `Desteklenmeyen şema sürümü: ${data.schemaVersion}.`));
    }

    const products = new Map();
    data.products.forEach((product, index) => {
        const path = `$.products[${index}]`;
        if (!isObject(product)) {
            issues.push(issue('error', 'invalid_product', path, 'Ürün kaydı bir nesne olmalı.'));
            return;
        }
        const id = text(product.id);
        if (!id) issues.push(issue('error', 'missing_product_id', `${path}.id`, 'Kararlı ürün kimliği zorunlu.'));
        else if (products.has(id)) issues.push(issue('error', 'duplicate_product_id', `${path}.id`, `Tekrarlanan ürün kimliği: ${id}.`));
        else products.set(id, product);
        if (!text(product.storeId)) issues.push(issue('error', 'missing_store_id', `${path}.storeId`, 'storeId zorunlu.'));
        if (!text(product.name)) issues.push(issue('error', 'missing_product_name', `${path}.name`, 'Ürün adı zorunlu.'));
        if (!text(product.category)) issues.push(issue('error', 'missing_category', `${path}.category`, 'Kategori zorunlu.'));
        if (product.price !== null && (!isFiniteNumber(product.price) || product.price < 0)) {
            issues.push(issue('error', 'invalid_price', `${path}.price`, 'Fiyat null veya sıfırdan büyük/eşit sonlu bir sayı olmalı.'));
        }
        if (!/^[A-Z]{3}$/.test(text(product.currency))) {
            issues.push(issue('error', 'invalid_currency', `${path}.currency`, 'Para birimi üç harfli ISO kodu olmalı (örn. TRY).'));
        }
        if (!Array.isArray(product.tags) || product.tags.some((tag) => !text(tag))) {
            issues.push(issue('error', 'invalid_tags', `${path}.tags`, 'Etiketler boş olmayan metinlerden oluşan bir dizi olmalı.'));
        }
        if (product.highQualityModel === null || product.highQualityModel === '') {
            issues.push(issue('warning', 'missing_model_path', `${path}.highQualityModel`, `${id || 'Ürün'} için ürün modeli henüz atanmadı.`));
        } else if (typeof product.highQualityModel !== 'string' || !/\.(?:glb|gltf)(?:[?#].*)?$/i.test(product.highQualityModel)) {
            issues.push(issue('error', 'invalid_model_path', `${path}.highQualityModel`, 'Model yolu .glb veya .gltf ile bitmeli.'));
        }
        validateTransform(product.previewTransform, `${path}.previewTransform`, issues);
        if (product.animationPlayback != null) {
            const playback = product.animationPlayback;
            if (!isObject(playback) || typeof playback.autoPlay !== 'boolean') {
                issues.push(issue('error', 'invalid_animation_playback', `${path}.animationPlayback`, 'animationPlayback, autoPlay alanı içeren bir nesne olmalı.'));
            } else {
                if (playback.loop != null && typeof playback.loop !== 'boolean') {
                    issues.push(issue('error', 'invalid_animation_playback', `${path}.animationPlayback.loop`, 'loop doğru/yanlış olmalı.'));
                }
                if (playback.speedRatio != null && (!isFiniteNumber(playback.speedRatio) || playback.speedRatio <= 0)) {
                    issues.push(issue('error', 'invalid_animation_playback', `${path}.animationPlayback.speedRatio`, 'speedRatio sıfırdan büyük olmalı.'));
                }
                if (playback.clipName != null && !text(playback.clipName)) {
                    issues.push(issue('error', 'invalid_animation_playback', `${path}.animationPlayback.clipName`, 'clipName boş olamaz.'));
                }
                if (playback.cameraRadiusMultiplier != null && (!isFiniteNumber(playback.cameraRadiusMultiplier) || playback.cameraRadiusMultiplier < 1)) {
                    issues.push(issue('error', 'invalid_animation_playback', `${path}.animationPlayback.cameraRadiusMultiplier`, 'cameraRadiusMultiplier en az 1 olmalı.'));
                }
            }
        }
    });

    const bindingIds = new Set();
    const boundProductIds = new Set();
    data.bindings.forEach((binding, index) => {
        const path = `$.bindings[${index}]`;
        if (!isObject(binding)) {
            issues.push(issue('error', 'invalid_binding', path, 'Sahne bağlantısı bir nesne olmalı.'));
            return;
        }
        const id = text(binding.id);
        const productId = text(binding.productId);
        const storeId = text(binding.storeId);
        if (!id) issues.push(issue('error', 'missing_binding_id', `${path}.id`, 'Bağlantı kimliği zorunlu.'));
        else if (bindingIds.has(id)) issues.push(issue('error', 'duplicate_binding_id', `${path}.id`, `Tekrarlanan bağlantı kimliği: ${id}.`));
        else bindingIds.add(id);
        if (!storeId) issues.push(issue('error', 'missing_store_id', `${path}.storeId`, 'storeId zorunlu.'));
        if (!productId) issues.push(issue('error', 'missing_binding_product', `${path}.productId`, 'productId zorunlu.'));
        const product = products.get(productId);
        if (productId && !product) issues.push(issue('error', 'orphan_binding', `${path}.productId`, `Bağlantının ürünü bulunamadı: ${productId}.`));
        if (product && product.storeId !== storeId) {
            issues.push(issue('error', 'binding_store_mismatch', `${path}.storeId`, `Bağlantı mağazası (${storeId}) ürün mağazasıyla (${product.storeId}) uyuşmuyor.`));
        }
        if (product) boundProductIds.add(productId);

        const meshNames = normalizeArray(binding.meshNames);
        const patterns = normalizeArray(binding.meshNamePatterns);
        if (meshNames.some((name) => !text(name))) issues.push(issue('error', 'invalid_mesh_names', `${path}.meshNames`, 'meshNames boş olmayan metinlerden oluşmalı.'));
        patterns.forEach((pattern, patternIndex) => {
            if (!text(pattern)) {
                issues.push(issue('error', 'invalid_mesh_pattern', `${path}.meshNamePatterns[${patternIndex}]`, 'Mesh deseni boş olamaz.'));
                return;
            }
            try { new RegExp(pattern, 'i'); } catch {
                issues.push(issue('error', 'invalid_mesh_pattern', `${path}.meshNamePatterns[${patternIndex}]`, `Geçersiz düzenli ifade: ${pattern}.`));
            }
        });
        const hasBounds = binding.bounds ? validateBounds(binding.bounds, `${path}.bounds`, issues) : false;
        if (binding.pickProxy != null && typeof binding.pickProxy !== 'boolean') {
            issues.push(issue('error', 'invalid_pick_proxy', `${path}.pickProxy`, 'pickProxy doğru/yanlış olmalı.'));
        }
        if (!meshNames.length && !patterns.length && !text(binding.targetBoxName) && !hasBounds) {
            issues.push(issue('error', 'missing_binding_target', path, 'En az bir mesh adı, desen, hedef kutu adı veya bounds gerekli.'));
        }
    });

    for (const product of data.products) {
        if (product?.id && !boundProductIds.has(product.id) && !text(product.runtimeBinding)) {
            issues.push(issue('warning', 'unbound_product', `$.products.${product.id}`, `${product.id} henüz bir sahne hedefine bağlanmadı.`));
        }
    }

    return {
        valid: !issues.some((entry) => entry.severity === 'error'),
        issues,
        errors: issues.filter((entry) => entry.severity === 'error'),
        warnings: issues.filter((entry) => entry.severity === 'warning'),
        data
    };
};

const metadataProductId = (mesh) => {
    const metadata = mesh?.metadata;
    const extras = metadata?.gltf?.extras || metadata?.extras || metadata;
    return text(extras?.web_product_id ?? extras?.product_id ?? extras?.productId);
};

const hierarchy = (mesh) => {
    const nodes = [];
    let current = mesh;
    for (let depth = 0; current && depth < 16; depth += 1) {
        nodes.push(current);
        current = current.parent;
    }
    return nodes;
};

const pointForMesh = (mesh) => {
    try {
        const center = mesh?.getBoundingInfo?.()?.boundingBox?.centerWorld;
        if (center && [center.x, center.y, center.z].every(isFiniteNumber)) return [center.x, center.y, center.z];
    } catch {
        // Bounding info is optional for transform-only nodes.
    }
    const position = mesh?.absolutePosition || mesh?.position;
    return position && [position.x, position.y, position.z].every(isFiniteNumber)
        ? [position.x, position.y, position.z]
        : null;
};

const containsPoint = (bounds, point) => {
    if (!bounds || !point) return false;
    if (isVector3(bounds.center) && isVector3(bounds.size, { positive: true })) {
        return point.every((entry, index) => Math.abs(entry - bounds.center[index]) <= bounds.size[index] / 2);
    }
    if (isVector3(bounds.min) && isVector3(bounds.max)) {
        return point.every((entry, index) => entry >= bounds.min[index] && entry <= bounds.max[index]);
    }
    return false;
};

const compileBinding = (binding) => ({
    binding,
    names: new Set(normalizeArray(binding.meshNames)),
    patterns: normalizeArray(binding.meshNamePatterns).flatMap((pattern) => {
        try { return [new RegExp(pattern, 'i')]; } catch { return []; }
    })
});

export const createLocalStorageAdapter = (key = DEFAULT_STORAGE_KEY, storage = globalThis.localStorage) => ({
    load() {
        const raw = storage?.getItem?.(key);
        return raw ? JSON.parse(raw) : null;
    },
    save(data) {
        storage?.setItem?.(key, JSON.stringify(data));
    },
    clear() {
        storage?.removeItem?.(key);
    }
});

export const downloadProductData = (data, filename = 'uzuncarsi-products.json') => {
    if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
    const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
};

export class ProductRegistry {
    constructor(initialData = { schemaVersion: DEFAULT_SCHEMA_VERSION, products: [], bindings: [] }, options = {}) {
        this.storageAdapter = options.storageAdapter || null;
        this.autoPersist = options.autoPersist !== false;
        this.listeners = new Set();
        const stored = this.storageAdapter?.load?.();
        const candidate = stored || initialData;
        const validation = validateProductDataset(candidate);
        if (!validation.valid) {
            const message = validation.errors.map((entry) => `${entry.path}: ${entry.message}`).join('\n');
            throw new Error(`Geçersiz ürün verisi:\n${message}`);
        }
        this.data = validation.data;
        this.rebuildIndexes();
    }

    rebuildIndexes() {
        this.productById = new Map(this.data.products.map((product) => [product.id, product]));
        this.bindingById = new Map(this.data.bindings.map((binding) => [binding.id, binding]));
        this.compiledBindings = this.data.bindings.map(compileBinding);
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emit(type, payload = null) {
        if (this.autoPersist) this.storageAdapter?.save?.(this.toJSON());
        const event = { type, payload: clone(payload), data: this.toJSON() };
        this.listeners.forEach((listener) => listener(event));
    }

    toJSON() {
        return clone(this.data);
    }

    getProduct(id) {
        const product = this.productById.get(id);
        return product ? clone(product) : null;
    }

    productsForStore(storeId) {
        return this.data.products.filter((product) => product.storeId === storeId).map(clone);
    }

    bindingsForStore(storeId) {
        return this.data.bindings.filter((binding) => binding.storeId === storeId).map(clone);
    }

    filterProducts(filters = {}) {
        const query = normalizeTurkishText(filters.query);
        const queryTokens = query.split(' ').filter(Boolean);
        const category = normalizeTurkishText(filters.category);
        const minPrice = filters.minPrice === '' || filters.minPrice == null ? null : Number(filters.minPrice);
        const maxPrice = filters.maxPrice === '' || filters.maxPrice == null ? null : Number(filters.maxPrice);
        const hasPriceFilter = Number.isFinite(minPrice) || Number.isFinite(maxPrice);
        return this.data.products.filter((product) => {
            if (filters.storeId && product.storeId !== filters.storeId) return false;
            if (category && normalizeTurkishText(product.category) !== category) return false;
            if (filters.activeOnly !== false && product.active === false) return false;
            if (queryTokens.length) {
                const productTokens = new Set(productSearchText(product).split(' ').filter(Boolean));
                if (!queryTokens.every((token) => productTokens.has(token))) return false;
            }
            if (hasPriceFilter && !isFiniteNumber(product.price)) return false;
            if (Number.isFinite(minPrice) && product.price < minPrice) return false;
            if (Number.isFinite(maxPrice) && product.price > maxPrice) return false;
            return true;
        }).map(clone);
    }

    search(query, filters = {}) {
        return this.filterProducts({ ...filters, query });
    }

    resolvePick(mesh, storeId) {
        if (!mesh || !storeId) return null;
        const nodes = hierarchy(mesh);
        const names = nodes.map((node) => text(node.name)).filter(Boolean);
        const productIds = nodes.map(metadataProductId).filter(Boolean);
        const storeBindings = this.compiledBindings.filter(({ binding }) => binding.storeId === storeId);

        for (const productId of productIds) {
            const match = storeBindings.find(({ binding }) => binding.productId === productId);
            if (match) return this.resultFor(match.binding, mesh, 'metadata');
        }
        for (const compiled of storeBindings) {
            if (names.some((name) => compiled.names.has(name) || name === compiled.binding.targetBoxName)) {
                return this.resultFor(compiled.binding, mesh, 'meshName');
            }
        }
        for (const compiled of storeBindings) {
            if (names.some((name) => compiled.patterns.some((pattern) => pattern.test(name)))) {
                return this.resultFor(compiled.binding, mesh, 'meshNamePattern');
            }
        }
        const point = pointForMesh(mesh);
        const match = storeBindings.find(({ binding }) => containsPoint(binding.bounds, point));
        return match ? this.resultFor(match.binding, mesh, 'bounds') : null;
    }

    resultFor(binding, mesh, matchedBy) {
        const product = this.productById.get(binding.productId);
        return product ? { product: clone(product), binding: clone(binding), matchedBy, mesh } : null;
    }

    upsertProduct(product) {
        const previousData = this.toJSON();
        const index = this.data.products.findIndex((entry) => entry.id === product.id);
        if (index >= 0) this.data.products[index] = clone(product);
        else this.data.products.push(clone(product));
        try {
            this.assertValid();
        } catch (error) {
            this.data = previousData;
            this.rebuildIndexes();
            throw error;
        }
        this.rebuildIndexes();
        this.emit('product-upserted', product);
        return this.getProduct(product.id);
    }

    removeProduct(id, { cascade = true } = {}) {
        if (!this.productById.has(id)) return false;
        const attached = this.data.bindings.filter((binding) => binding.productId === id);
        if (attached.length && !cascade) throw new Error(`${id} ürününe bağlı ${attached.length} sahne bağlantısı var.`);
        this.data.products = this.data.products.filter((product) => product.id !== id);
        if (cascade) this.data.bindings = this.data.bindings.filter((binding) => binding.productId !== id);
        this.rebuildIndexes();
        this.emit('product-removed', { id, removedBindingIds: attached.map((binding) => binding.id) });
        return true;
    }

    upsertBinding(binding) {
        const previousData = this.toJSON();
        const index = this.data.bindings.findIndex((entry) => entry.id === binding.id);
        if (index >= 0) this.data.bindings[index] = clone(binding);
        else this.data.bindings.push(clone(binding));
        try {
            this.assertValid();
        } catch (error) {
            this.data = previousData;
            this.rebuildIndexes();
            throw error;
        }
        this.rebuildIndexes();
        this.emit('binding-upserted', binding);
        return clone(binding);
    }

    removeBinding(id) {
        if (!this.bindingById.has(id)) return false;
        this.data.bindings = this.data.bindings.filter((binding) => binding.id !== id);
        this.rebuildIndexes();
        this.emit('binding-removed', { id });
        return true;
    }

    assertValid() {
        const validation = validateProductDataset(this.data);
        if (!validation.valid) {
            const message = validation.errors.map((entry) => `${entry.path}: ${entry.message}`).join('\n');
            throw new Error(message);
        }
    }

    exportData({ pretty = true, download = false, filename } = {}) {
        const json = JSON.stringify(this.data, null, pretty ? 2 : 0);
        if (download) downloadProductData(json, filename);
        return json;
    }

    importData(payload, { merge = false } = {}) {
        const incoming = typeof payload === 'string' ? JSON.parse(payload) : clone(payload);
        const validation = validateProductDataset(incoming);
        if (!validation.valid) {
            const message = validation.errors.map((entry) => `${entry.path}: ${entry.message}`).join('\n');
            throw new Error(`İçe aktarma başarısız:\n${message}`);
        }
        if (!merge) {
            this.data = validation.data;
        } else {
            const previousData = this.toJSON();
            const products = new Map(this.data.products.map((entry) => [entry.id, entry]));
            const bindings = new Map(this.data.bindings.map((entry) => [entry.id, entry]));
            validation.data.products.forEach((entry) => products.set(entry.id, entry));
            validation.data.bindings.forEach((entry) => bindings.set(entry.id, entry));
            this.data = { schemaVersion: DEFAULT_SCHEMA_VERSION, products: [...products.values()], bindings: [...bindings.values()] };
            try {
                this.assertValid();
            } catch (error) {
                this.data = previousData;
                this.rebuildIndexes();
                throw error;
            }
        }
        this.rebuildIndexes();
        this.emit('data-imported', { merge });
        return this.toJSON();
    }
}

export const createProductRegistry = (initialData, options) => new ProductRegistry(initialData, options);
