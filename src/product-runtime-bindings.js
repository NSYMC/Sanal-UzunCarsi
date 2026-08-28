import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';

const storeLabel = (store) => store?.name || store?.shortName || store?.id || 'Mağaza';

const categoryFromProduct = (id, details = {}) => {
    const text = `${id} ${details.name || ''} ${details.properties || ''}`;
    if (/neck|kolye/i.test(text)) return 'Kolye';
    if (/ring|yüzük/i.test(text)) return 'Yüzük';
    if (/altın|gold|cumhuriyet/i.test(text)) return 'Altın';
    if (/gözlük|optik|glasses|lens/i.test(text)) return 'Gözlük';
    if (/plate|tabak/i.test(text)) return 'Tabak';
    if (/pan|tava/i.test(text)) return 'Tava';
    if (/pot|tencere/i.test(text)) return 'Tencere';
    if (/tea|çay/i.test(text)) return 'Çay Takımı';
    return 'Diğer';
};

const numericPrice = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string' || !/^\s*[\d.,]+\s*(?:₺|TL|TRY)?\s*$/i.test(value)) return null;
    const normalized = value.replace(/[^\d.,]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    const result = Number(normalized);
    return Number.isFinite(result) ? result : null;
};

const registryGet = (registry, id) => registry?.getProduct?.(id) || registry?.get?.(id) || null;
const registryUpsert = (registry, product) => {
    if (typeof registry?.upsertProduct === 'function') return registry.upsertProduct(product);
    if (typeof registry?.upsert === 'function') return registry.upsert(product);
    if (registry?.products instanceof Map) {
        registry.products.set(product.id, { ...(registry.products.get(product.id) || {}), ...product });
        return registry.products.get(product.id);
    }
    return product;
};

const registryBindings = (registry, storeId) => {
    if (typeof registry?.getBindingsForStore === 'function') return registry.getBindingsForStore(storeId);
    if (typeof registry?.bindingsForStore === 'function') return registry.bindingsForStore(storeId);
    const bindings = registry?.bindings instanceof Map ? [...registry.bindings.values()] : registry?.bindings;
    return Array.isArray(bindings) ? bindings.filter((binding) => binding.storeId === storeId) : [];
};

const asArray = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const bindingNames = (binding) => asArray(binding.meshNames
    || binding.target?.meshNames
    || binding.selectors?.meshNames);
const bindingPatterns = (binding) => asArray(binding.meshNamePatterns
    || binding.target?.meshNamePatterns
    || binding.selectors?.meshNamePatterns);
const bindingBox = (binding) => binding.bounds || binding.box || binding.target?.bounds || binding.target?.box || null;

const vectorArray = (value, fallback) => Array.isArray(value) && value.length >= 3
    ? value.slice(0, 3).map(Number)
    : fallback;

const meshMatchesBinding = (mesh, binding) => {
    const names = bindingNames(binding);
    const patterns = bindingPatterns(binding);
    const hierarchyNames = [];
    let current = mesh;
    let depth = 0;
    while (current && depth < 16) {
        hierarchyNames.push(String(current.name || ''));
        current = current.parent;
        depth += 1;
    }
    if (names.some((name) => hierarchyNames.includes(String(name)))) return true;
    return patterns.some((source) => {
        try {
            const expression = new RegExp(source, 'i');
            return hierarchyNames.some((name) => expression.test(name));
        } catch {
            return false;
        }
    });
};

export const registerRuntimeProducts = (registry, store, runtime) => {
    const products = runtime?.sceneProducts?.products;
    if (!(products instanceof Map)) return [];
    const registered = [];
    const missing = [];
    for (const [id, sceneProduct] of products) {
        const details = sceneProduct.details || sceneProduct;
        const existing = registryGet(registry, id);
        if (existing) {
            registered.push(existing);
            continue;
        }
        const price = numericPrice(details.price);
        const product = {
            id,
            storeId: store.id,
            storeName: storeLabel(store),
            name: details.name || id,
            brand: details.brand || storeLabel(store),
            category: categoryFromProduct(id, details),
            price,
            priceLabel: price == null ? String(details.price || 'Fiyat bilgisi yok') : null,
            currency: 'TRY',
            description: details.description || '',
            tags: [store.shortName, details.brand, categoryFromProduct(id, details)].filter(Boolean),
            highQualityModel: null,
            previewTransform: {
                scale: [1, 1, 1],
                rotation: [0, 0, 0],
                position: [0, 0, 0]
            }
        };
        missing.push(product);
    }
    if (missing.length && typeof registry?.importData === 'function') {
        registry.importData({ schemaVersion: 1, products: missing, bindings: [] }, { merge: true });
        missing.forEach((product) => registered.push(registryGet(registry, product.id) || product));
    } else {
        missing.forEach((product) => registered.push(registryUpsert(registry, product)));
    }
    return registered;
};

export const applyProductBindings = ({ scene, registry, store, runtime }) => {
    if (!scene || !runtime || !store) return { bindings: [], proxyBoxes: [], matchedMeshes: 0 };
    const bindings = registryBindings(registry, store.id);
    const geometryMeshes = (runtime.renderMeshes || []).filter((mesh) => mesh?.geometry && !mesh.isDisposed?.());
    let matchedMeshes = 0;
    const proxyBoxes = [];

    for (const mesh of [...geometryMeshes, ...(runtime.selectionBoxes || [])]) {
        if (mesh.metadata?.modeledProductId && !mesh.metadata.productId) {
            mesh.metadata = { ...(mesh.metadata || {}), productId: mesh.metadata.modeledProductId };
        }
    }

    for (const binding of bindings) {
        if (!binding?.productId || binding.enabled === false) continue;
        let bindingMatchedMeshes = 0;
        for (const mesh of geometryMeshes) {
            if (!meshMatchesBinding(mesh, binding)) continue;
            mesh.metadata = {
                ...(mesh.metadata || {}),
                productId: binding.productId,
                productBindingId: binding.id,
                isProductBindingTarget: true
            };
            mesh.isPickable = true;
            matchedMeshes += 1;
            bindingMatchedMeshes += 1;
        }

        const box = bindingBox(binding);
        if (!box) continue;
        const existingProxy = (runtime.selectionBoxes || []).some((mesh) => (
            mesh?.metadata?.productId === binding.productId
            || mesh?.metadata?.modeledProductId === binding.productId
        ));
        if ((bindingMatchedMeshes > 0 && binding.pickProxy !== true) || existingProxy) continue;
        const center = vectorArray(box.center || box.position, [0, 0, 0]);
        const size = vectorArray(box.size || box.scaling, [0.25, 0.25, 0.25]);
        const proxy = MeshBuilder.CreateBox(`productBindingBox_${binding.id || binding.productId}`, { size: 1 }, scene);
        proxy.position.copyFrom(Vector3.FromArray(center));
        proxy.scaling.copyFrom(Vector3.FromArray(size.map((value) => Math.max(Math.abs(value), 0.03))));
        proxy.visibility = 0;
        proxy.isVisible = true;
        proxy.isPickable = true;
        proxy.checkCollisions = false;
        proxy.metadata = {
            productId: binding.productId,
            productBindingId: binding.id,
            isProductBindingTarget: true,
            isProductSelectionBox: true
        };
        proxy.freezeWorldMatrix();
        proxyBoxes.push(proxy);
    }

    runtime.selectionBoxes = [...(runtime.selectionBoxes || []), ...proxyBoxes];
    return { bindings, proxyBoxes, matchedMeshes };
};
