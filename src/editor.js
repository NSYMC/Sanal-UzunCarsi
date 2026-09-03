import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { SubMesh } from '@babylonjs/core/Meshes/subMesh';
import { MultiMaterial } from '@babylonjs/core/Materials/multiMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { createGoldPricingPanel } from './gold-pricing.js';
import { isInspectableProductMeshForStore } from './product-interaction.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { GizmoManager } from '@babylonjs/core/Gizmos/gizmoManager';

import '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Rendering/edgesRenderer';
import '@babylonjs/core/Materials/colorCurves';
import '@babylonjs/core/Materials/imageProcessingConfiguration';

const EDITOR_STORAGE_KEY = 'uzunCarsi:productRows:v2';
const MAX_TRIGGERS = 30;
const MAX_PRODUCTS_PER_TRIGGER = 96;
const COLOR_PALETTE = [
    '#d95d54',
    '#df9d3f',
    '#e6c84f',
    '#5aa66f',
    '#3f8fa8',
    '#496fbd',
    '#7656a8',
    '#bd5c88',
    '#d9c7a5',
    '#4b5058'
];

const PRODUCT_TYPES = {
    bag: {
        label: 'Çanta',
        defaultName: 'Çanta dizisi',
        size: { width: 2.8, height: 0.62, depth: 0.52 },
        product: { width: 0.52, height: 0.5, depth: 0.3 },
        margin: 0.06,
        gap: 0.08
    },
    shirt: {
        label: 'Tişört',
        defaultName: 'Tişört dizisi',
        size: { width: 2.8, height: 0.68, depth: 0.26 },
        product: { width: 0.58, height: 0.58, depth: 0.1 },
        margin: 0.045,
        gap: 0.055
    },
    light: {
        label: 'Işık Kaynağı',
        defaultName: 'Özel Işık',
        size: { width: 0.5, height: 0.5, depth: 0.5 },
        product: { width: 0.5, height: 0.5, depth: 0.5 },
        margin: 0,
        gap: 0
    }
};

const LAYOUT_DIRECTIONS = {
    'x+': { axis: 'x', sign: 1, label: 'sağa doğru' },
    'x-': { axis: 'x', sign: -1, label: 'sola doğru' },
    'y+': { axis: 'y', sign: 1, label: 'yukarı doğru' },
    'y-': { axis: 'y', sign: -1, label: 'aşağı doğru' },
    'z+': { axis: 'z', sign: 1, label: 'öne doğru' },
    'z-': { axis: 'z', sign: -1, label: 'arkaya doğru' }
};

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = (value, digits = 2) => Number(Number(value).toFixed(digits));
const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const createId = (prefix) => `${prefix}_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;

const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const colorForProduct = (triggerId, index) => {
    const start = hashString(triggerId) % COLOR_PALETTE.length;
    return COLOR_PALETTE[(start + index * 3) % COLOR_PALETTE.length];
};

const createDefaultProduct = (trigger, index, existing = null) => {
    const id = `${trigger.id}_product_${index + 1}`;
    if (existing) return { ...existing, id };

    const isBag = trigger.productType === 'bag';
    const priceBase = isBag ? 749 : 329;
    const priceStep = (hashString(id) % 6) * (isBag ? 75 : 40);
    return {
        id,
        color: colorForProduct(trigger.id, index),
        brand: 'Uzun Çarşı',
        name: isBag ? `Renkli Çanta ${String(index + 1).padStart(2, '0')}` : `Tişört ${String(index + 1).padStart(2, '0')}`,
        price: `${priceBase + priceStep} TL`,
        description: isBag
            ? 'Çanta modeli.'
            : 'Yumuşak dokulu, rahat kalıplı günlük tişört.',
        properties: isBag
            ? 'Malzeme: Dokulu kumaş\nKullanım: Günlük\nGaranti: 2 yıl'
            : 'Kumaş: Pamuk\nKalıp: Rahat\nBeden: M'
    };
};

const sanitizeTrigger = (value) => {
    const productType = PRODUCT_TYPES[value?.productType] ? value.productType : 'bag';
    const defaults = PRODUCT_TYPES[productType];
    const id = typeof value?.id === 'string' ? value.id : createId('row');
    const savedProductCount = Array.isArray(value?.products) ? value.products.length : 0;
    const direction = LAYOUT_DIRECTIONS[value?.layout?.direction] ? value.layout.direction : 'x+';
    return {
        id,
        name: typeof value?.name === 'string' ? value.name.slice(0, 80) : defaults.defaultName,
        productType,
        position: {
            x: clamp(numberOr(value?.position?.x, 0), -100000, 100000),
            y: clamp(numberOr(value?.position?.y, -8), -100000, 100000),
            z: clamp(numberOr(value?.position?.z, 0), -100000, 100000)
        },
        rotationY: clamp(numberOr(value?.rotationY, 0), -Math.PI * 2, Math.PI * 2),
        size: {
            width: clamp(numberOr(value?.size?.width, defaults.product.width), 0.08, 8),
            height: clamp(numberOr(value?.size?.height, defaults.product.height), 0.08, 8),
            depth: clamp(numberOr(value?.size?.depth, defaults.product.depth), 0.03, 8)
        },
        lightSettings: {
            intensity: clamp(numberOr(value?.lightSettings?.intensity, 5), 0.1, 100),
            range: clamp(numberOr(value?.lightSettings?.range, 20), 1, 100),
            color: /^#[0-9a-f]{6}$/i.test(value?.lightSettings?.color) ? value.lightSettings.color : '#ffffff'
        },
        gap: clamp(numberOr(value?.gap, defaults.gap), 0.015, 0.6),
        layout: {
            count: productType === 'light' ? 0 : clamp(Math.round(numberOr(value?.layout?.count, savedProductCount || 5)), 1, MAX_PRODUCTS_PER_TRIGGER),
            direction,
            spawned: productType === 'light' ? false : (typeof value?.layout?.spawned === 'boolean'
                ? value.layout.spawned
                : savedProductCount > 0)
        },
        products: productType === 'light' ? [] : (Array.isArray(value?.products)
            ? value.products.slice(0, MAX_PRODUCTS_PER_TRIGGER).map((product, index) => createDefaultProduct(
                { id, productType },
                index,
                {
                    id: typeof product?.id === 'string' ? product.id : `${id}_product_${index + 1}`,
                    color: /^#[0-9a-f]{6}$/i.test(product?.color) ? product.color : colorForProduct(id, index),
                    brand: String(product?.brand || 'Uzun Çarşı').slice(0, 80),
                    name: String(product?.name || `Ürün ${index + 1}`).slice(0, 100),
                    price: String(product?.price || '').slice(0, 40),
                    description: String(product?.description || '').slice(0, 600),
                    properties: String(product?.properties || '').slice(0, 600)
                }
            ))
            : [])
    };
};

const readSavedTriggers = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(EDITOR_STORAGE_KEY) || '{"triggers":[]}');
        return Array.isArray(parsed?.triggers)
            ? parsed.triggers.slice(0, MAX_TRIGGERS).map(sanitizeTrigger)
            : [];
    } catch {
        return [];
    }
};

const writeSavedTriggers = (triggers) => {
    try {
        localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify({ version: 2, rows: triggers, triggers }));
    } catch {
    }
};

const computeProductLayout = (trigger) => {
    if (!trigger.layout?.spawned) return [];
    const type = PRODUCT_TYPES[trigger.productType];
    const base = type.product;
    const direction = LAYOUT_DIRECTIONS[trigger.layout.direction] || LAYOUT_DIRECTIONS['x+'];
    const count = clamp(Math.round(trigger.layout.count), 1, MAX_PRODUCTS_PER_TRIGGER);
    const dimensionByAxis = {
        x: trigger.size.width,
        y: trigger.size.height,
        z: trigger.size.depth
    };
    const step = dimensionByAxis[direction.axis] + trigger.gap;
    const scaling = {
        x: trigger.size.width / base.width,
        y: trigger.size.height / base.height,
        z: trigger.size.depth / base.depth
    };
    const placements = [];

    for (let index = 0; index < count; index += 1) {
        const position = Vector3.Zero();
        position[direction.axis] = direction.sign * index * step;
        placements.push({ scaling, position });
    }
    return placements;
};

const createPbrMaterial = (scene, name, hex, roughness = 0.48, metallic = 0.04) => {
    const material = new PBRMaterial(name, scene);
    material.albedoColor = Color3.FromHexString(hex);
    material.roughness = roughness;
    material.metallic = metallic;
    material.environmentIntensity = 0.7;
    return material;
};

const buildProductGeometry = ({ scene, root, productType, color, interactive = false, metadata = null, materialCache = null }) => {
    const cache = materialCache || new Map();
    const colorKey = `color:${color}`;
    let colorMaterial = cache.get(colorKey);
    if (!colorMaterial) {
        colorMaterial = createPbrMaterial(scene, `product_${color.replace('#', '')}`, color, 0.54, 0.03);
        cache.set(colorKey, colorMaterial);
    }
    const base = PRODUCT_TYPES[productType]?.product || PRODUCT_TYPES.bag.product;
    const box = MeshBuilder.CreateBox(`${root.name}_box`, {
        width: base.width,
        height: base.height,
        depth: base.depth
    }, scene);
    box.parent = root;
    box.material = colorMaterial;
    box.isPickable = interactive;
    box.receiveShadows = false;
    box.metadata = metadata ? { ...metadata, colorSurface: true } : null;
    box.enableEdgesRendering(0.998);
    box.edgesWidth = 1.4;
    box.edgesColor = new Color4(0.03, 0.04, 0.05, 0.42);

    return { meshes: [box], primaryMeshes: [box], materialCache: cache };
};

const parseProperties = (value) => String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
        const separator = line.indexOf(':');
        return separator < 0
            ? { label: 'Özellik', value: line }
            : { label: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
    });

export const createTourEditor = ({
    scene,
    camera,
    canvas,
    tourMeshes,
    sceneProducts = null,
    loadModeledProduct = null,
    productRegistry = null,
    openHighQualityProduct = null,
    closeHighQualityProduct = null,
    onProductOpened = null,
    storeId = null
}) => {
    const dom = {
        toggle: document.getElementById('editorToggleBtn'),
        panel: document.getElementById('editorPanel'),
        close: document.getElementById('editorCloseBtn'),
        status: document.getElementById('editorStatus'),
        triggerList: document.getElementById('triggerList'),
        triggerCount: document.getElementById('triggerCount'),
        emptyState: document.getElementById('editorEmptyState'),
        triggerForm: document.getElementById('triggerForm'),
        triggerName: document.getElementById('triggerName'),
        triggerType: document.getElementById('triggerType'),
        triggerPosX: document.getElementById('triggerPosX'),
        triggerPosY: document.getElementById('triggerPosY'),
        triggerPosZ: document.getElementById('triggerPosZ'),
        triggerRotY: document.getElementById('triggerRotY'),
        triggerWidth: document.getElementById('triggerWidth'),
        triggerHeight: document.getElementById('triggerHeight'),
        triggerDepth: document.getElementById('triggerDepth'),
        triggerLightIntensity: document.getElementById('triggerLightIntensity'),
        triggerLightRange: document.getElementById('triggerLightRange'),
        triggerLightColor: document.getElementById('triggerLightColor'),
        dimensionsFieldset: document.getElementById('dimensionsFieldset'),
        lightSettingsFieldset: document.getElementById('lightSettingsFieldset'),
        dimensionsActions: document.getElementById('dimensionsActions'),
        productLayoutBuilder: document.getElementById('productLayoutBuilder'),
        triggerQuantity: document.getElementById('triggerQuantity'),
        triggerDirection: document.getElementById('triggerDirection'),
        productLayoutPreview: document.getElementById('productLayoutPreview'),
        triggerGap: document.getElementById('triggerGap'),
        triggerGapValue: document.getElementById('triggerGapValue'),
        selectedTriggerTitle: document.getElementById('selectedTriggerTitle'),
        triggerSizeSummary: document.getElementById('triggerSizeSummary'),
        triggerProductCount: document.getElementById('triggerProductCount'),
        triggerLayoutHint: document.getElementById('triggerLayoutHint'),
        transformHelp: document.getElementById('transformHelp'),
        applyTrigger: document.getElementById('applyTriggerBtn'),
        focusTrigger: document.getElementById('focusTriggerBtn'),
        repositionTrigger: document.getElementById('repositionTriggerBtn'),
        regenerate: document.getElementById('regenerateTriggerBtn'),
        clearProducts: document.getElementById('clearProductsBtn'),
        removeTrigger: document.getElementById('removeTriggerBtn'),
        sceneToolbar: document.getElementById('editorSceneToolbar'),
        sceneToolbarSize: document.getElementById('sceneToolbarSize'),
        quickFillProducts: document.getElementById('quickFillProductsBtn'),
        triggerHud: document.getElementById('triggerSelectionHud'),
        triggerHudName: document.getElementById('triggerHudName'),
        triggerHudSize: document.getElementById('triggerHudSize'),
        triggerHudProducts: document.getElementById('triggerHudProducts'),
        productForm: document.getElementById('productForm'),
        productFormEmpty: document.getElementById('productFormEmpty'),
        productBrand: document.getElementById('editProductBrand'),
        productName: document.getElementById('editProductName'),
        productPrice: document.getElementById('editProductPrice'),
        productDescription: document.getElementById('editProductDescription'),
        productProperties: document.getElementById('editProductProperties'),
        productColor: document.getElementById('editProductColor'),
        previewProduct: document.getElementById('previewProductBtn'),
        placementHint: document.getElementById('triggerPlacementHint'),
        placementTitle: document.getElementById('triggerPlacementTitle'),
        placementCopy: document.getElementById('triggerPlacementCopy'),
        placeInFront: document.getElementById('placeTriggerInFrontBtn'),
        cancelPlacement: document.getElementById('cancelTriggerPlacementBtn'),
        undoToast: document.getElementById('editorUndoToast'),
        undoText: document.getElementById('editorUndoText'),
        undoButton: document.getElementById('editorUndoBtn'),
        inspector: document.getElementById('productInspector'),
        inspectorClose: document.getElementById('productInspectorClose'),
        inspectorDone: document.getElementById('productInspectorDone'),
        inspectorCanvas: document.getElementById('productPreviewCanvas'),
        inspectorBrand: document.getElementById('inspectorBrand'),
        inspectorName: document.getElementById('inspectorName'),
        inspectorPrice: document.getElementById('inspectorPrice'),
        inspectorDescription: document.getElementById('inspectorDescription'),
        inspectorProperties: document.getElementById('inspectorProperties'),
        inspectorHotspots: document.getElementById('productStageHotspots'),
        hoverPrompt: document.getElementById('productHoverPrompt'),
        hoverPromptName: document.getElementById('hoverPromptName'),
        hoverPromptDesc: document.getElementById('hoverPromptDesc'),
        aimReticle: document.getElementById('aimReticle')
    };

    const goldPricing = createGoldPricingPanel(document.getElementById('goldPricingPanel'));

    if (Object.entries(dom).some(([key, element]) => key !== 'toggle' && !element)) {
        console.warn('Editör arayüzü eksik olduğu için başlatılamadı.');
        return { dispose() {} };
    }

    const tourMeshSet = new Set(tourMeshes.filter((mesh) => mesh?.geometry));
    const originalPickable = new Map([...tourMeshSet].map((mesh) => [mesh, mesh.isPickable]));
    const modeledProducts = sceneProducts?.products || new Map();
    const triggerRuntime = new Map();
    const productRuntime = new Map();
    const productMaterials = new Map();
    let triggers = readSavedTriggers();
    let isEditorMode = false;
    let placementType = null;
    let placementTargetTriggerId = null;
    let placementOriginalPosition = null;
    let lastPlacementPreviewAt = 0;
    let selectedTriggerId = null;
    let selectedProductId = null;
    let lastDeletedTrigger = null;
    let undoTimer = 0;
    let formUpdateTimer = 0;
    let transformMode = 'move';
    let cameraSuspendedForGizmo = false;
    let previewEngine = null;
    let previewScene = null;
    let previewRoot = null;
    let ignoreMouseLookUntil = 0;
    let pendingLookX = 0;
    let pendingLookY = 0;
    const isTourPointerLocked = () => document.pointerLockElement === canvas;
    const isTourControlActive = () => isTourPointerLocked();
    const isBindingEditorOpen = () => document.body.classList.contains('product-binding-editor-open');
    const requestTourPointerLock = () => {
        if (isTourPointerLocked()) return;
        if (!canvas.requestPointerLock) {
            document.body.dataset.pointerLockError = 'Unsupported: Pointer Lock desteklenmiyor';
            return;
        }
        try {
            ignoreMouseLookUntil = performance.now() + 180;
            pendingLookX = 0;
            pendingLookY = 0;
            canvas.focus({ preventScroll: true });
            delete document.body.dataset.pointerLockError;
            const request = canvas.requestPointerLock();
            request?.catch?.((error) => {
                document.body.dataset.pointerLockError = `${error?.name || 'Error'}: ${error?.message || 'Pointer lock reddedildi'}`;
                if (dom.hoverPromptName) dom.hoverPromptName.textContent = 'Fare kontrolü etkinleştirilemedi';
                if (dom.hoverPromptDesc) dom.hoverPromptDesc.textContent = 'Tarayıcı imleç kilidine izin vermedi';
                dom.hoverPrompt?.classList.remove('hidden');
            });
        } catch (error) {
            document.body.dataset.pointerLockError = `${error?.name || 'Error'}: ${error?.message || 'Pointer lock başlatılamadı'}`;
        }
    };
    const releaseTourPointerLock = () => {
        if (isTourPointerLocked()) document.exitPointerLock?.();
    };
    const highlightedProductMeshes = new Map();
    const clearProductHighlight = () => {
        for (const [mesh, previous] of highlightedProductMeshes) {
            if (mesh?.isDisposed?.()) continue;
            mesh.renderOverlay = previous.renderOverlay;
            mesh.overlayColor = previous.overlayColor;
            mesh.overlayAlpha = previous.overlayAlpha;
        }
        highlightedProductMeshes.clear();
    };
    const highlightProduct = (productId) => {
        clearProductHighlight();
        if (!productId) return;
        scene.meshes
            .filter((mesh) => (
                (mesh.metadata?.productId === productId || mesh.metadata?.modeledProductId === productId)
                && (mesh.getTotalVertices?.() || 0) > 0
                && mesh.isVisible !== false
            ))
            .forEach((mesh) => {
                highlightedProductMeshes.set(mesh, {
                    renderOverlay: mesh.renderOverlay,
                    overlayColor: mesh.overlayColor,
                    overlayAlpha: mesh.overlayAlpha
                });
                mesh.renderOverlay = true;
                mesh.overlayColor = new Color3(0.18, 0.82, 1);
                mesh.overlayAlpha = 0.16;
            });
    };
    const clearProductTarget = () => {
        clearProductHighlight();
        hoveredProductId = null;
        dom.aimReticle.classList.remove('is-targeting');
        if (dom.hoverPrompt) dom.hoverPrompt.classList.add('hidden');
    };

    const persist = () => writeSavedTriggers(triggers);
    const findTrigger = (id = selectedTriggerId) => triggers.find((trigger) => trigger.id === id) || null;
    const findProduct = (id = selectedProductId) => {
        for (const trigger of triggers) {
            const product = trigger.products.find((candidate) => candidate.id === id);
            if (product) return { trigger, product };
        }
        return null;
    };
    const findModeledProduct = (id) => modeledProducts.get(id) || null;
    const findRegisteredProduct = (id) => productRegistry?.getProduct?.(id)
        || productRegistry?.get?.(id)
        || null;
    const isInspectableProductMesh = (mesh) => isInspectableProductMeshForStore(mesh, storeId);

    const setStatus = (message, tone = '') => {
        dom.status.textContent = message;
        dom.status.dataset.tone = tone;
    };

    const formatTriggerSize = (trigger) => (
        `${round(trigger.size.width, 2).toFixed(2)} × ${round(trigger.size.height, 2).toFixed(2)} × ${round(trigger.size.depth, 2).toFixed(2)} m`
    );

    const createRuntimeMaterial = (factory) => {
        const wasBlocked = scene.blockMaterialDirtyMechanism;
        scene.blockMaterialDirtyMechanism = false;
        try {
            return factory();
        } finally {
            scene.blockMaterialDirtyMechanism = wasBlocked;
        }
    };

    const registerDynamicMesh = (mesh) => {
        const dynamicMeshes = scene.selectionOctree?.dynamicContent;
        if (dynamicMeshes && !dynamicMeshes.includes(mesh)) dynamicMeshes.push(mesh);
    };

    const triggerMaterial = createRuntimeMaterial(() => {
        const material = new StandardMaterial('productSizeGuideMaterial', scene);
        material.diffuseColor = new Color3(0.82, 0.56, 0.18);
        material.emissiveColor = new Color3(0.2, 0.1, 0.02);
        material.alpha = 0.035;
        material.backFaceCulling = false;
        material.disableDepthWrite = true;
        return material;
    });

    const selectedTriggerMaterial = createRuntimeMaterial(() => {
        const material = new StandardMaterial('selectedProductSizeGuideMaterial', scene);
        material.diffuseColor = new Color3(0.96, 0.66, 0.2);
        material.emissiveColor = new Color3(0.35, 0.18, 0.025);
        material.alpha = 0.075;
        material.backFaceCulling = false;
        material.disableDepthWrite = true;
        return material;
    });

    scene.setRenderingAutoClearDepthStencil(2, true, true, true);

    const createTriggerRuntime = (trigger) => {
        const mesh = MeshBuilder.CreateBox(`product_size_guide_${trigger.id}`, { size: 1 }, scene);
        mesh.material = triggerMaterial;
        mesh.position.copyFromFloats(trigger.position.x, trigger.position.y, trigger.position.z);
        mesh.rotation.y = trigger.rotationY;
        mesh.scaling.copyFromFloats(trigger.size.width, trigger.size.height, trigger.size.depth);
        mesh.isPickable = isEditorMode;
        mesh.isVisible = isEditorMode;
        mesh.renderingGroupId = 2;
        mesh.alwaysSelectAsActiveMesh = true;
        mesh.receiveShadows = false;
        mesh.metadata = { isProductRowHandle: true, triggerId: trigger.id };
        mesh.enableEdgesRendering(0.995);
        mesh.edgesWidth = 5;
        mesh.edgesColor = new Color4(1, 0.72, 0.28, 1);
        registerDynamicMesh(mesh);

        const contentRoot = new TransformNode(`trigger_content_${trigger.id}`, scene);
        contentRoot.position.copyFrom(mesh.position);
        contentRoot.rotation.y = trigger.rotationY;
        triggerRuntime.set(trigger.id, { mesh, contentRoot });
        return { mesh, contentRoot };
    };

    const disposeTriggerProducts = (triggerId) => {
        for (const [productId, runtime] of productRuntime) {
            if (runtime.triggerId !== triggerId) continue;
            try {
                if (runtime.root && !runtime.root.isDisposed?.()) {
                    runtime.root.dispose();
                }
            } catch (e) {  }
            productRuntime.delete(productId);
        }
        const runtime = triggerRuntime.get(triggerId);
        if (runtime?.contentRoot) {
            runtime.contentRoot.getChildren().forEach((child) => {
                try {
                    if (!child.isDisposed?.()) child.dispose();
                } catch (e) {  }
            });
        }
    };

    const applyProductWorldTransform = (trigger, productMesh, localPosition) => {
        const worldOffset = Vector3.TransformCoordinates(localPosition, Matrix.RotationY(trigger.rotationY));
        productMesh.position.copyFromFloats(
            trigger.position.x + worldOffset.x,
            trigger.position.y + worldOffset.y,
            trigger.position.z + worldOffset.z
        );
        productMesh.rotationQuaternion = null;
        productMesh.rotation.copyFromFloats(0, trigger.rotationY, 0);
    };

    const renderProducts = (trigger, preserveMetadata = true) => {
        const runtime = triggerRuntime.get(trigger.id) || createTriggerRuntime(trigger);
        disposeTriggerProducts(trigger.id);

        const previousProducts = new Map(trigger.products.map((product) => [product.id, product]));
        const layout = computeProductLayout(trigger);
        trigger.products = layout.map((placement, index) => {
            const id = `${trigger.id}_product_${index + 1}`;
            return createDefaultProduct(trigger, index, preserveMetadata ? previousProducts.get(id) : null);
        });

        layout.forEach((placement, index) => {
            const product = trigger.products[index];
            const metadata = {
                isGeneratedProduct: true,
                storeId,
                triggerId: trigger.id,
                productId: product.id
            };
            const materialKey = `rectangle:${product.color}`;
            let material = productMaterials.get(materialKey);
            if (!material) {
                material = createRuntimeMaterial(() => {
                    const runtimeMaterial = new StandardMaterial(`rectangle_${product.color.replace('#', '')}`, scene);
                    runtimeMaterial.diffuseColor = Color3.FromHexString(product.color);
                    runtimeMaterial.emissiveColor = Color3.FromHexString(product.color).scale(0.55);
                    runtimeMaterial.specularColor = new Color3(0.14, 0.14, 0.14);
                    return runtimeMaterial;
                });
                productMaterials.set(materialKey, material);
            }

            const box = MeshBuilder.CreateBox(`product_rectangle_${product.id}`, {
                width: trigger.size.width,
                height: trigger.size.height,
                depth: trigger.size.depth
            }, scene);
            applyProductWorldTransform(trigger, box, placement.position);
            box.material = material;
            box.isPickable = true;
            box.receiveShadows = false;
            box.metadata = metadata;
            box.renderingGroupId = isEditorMode ? 2 : 0;
            box.alwaysSelectAsActiveMesh = true;
            box.enableEdgesRendering(0.998);
            box.edgesWidth = 1.8;
            box.edgesColor = new Color4(0.03, 0.04, 0.05, 0.55);
            registerDynamicMesh(box);

            productRuntime.set(product.id, {
                triggerId: trigger.id,
                root: box,
                meshes: [box],
                localPosition: placement.position.clone()
            });

        });

    };

    const updateTriggerTransform = (trigger) => {
        const runtime = triggerRuntime.get(trigger.id);
        if (!runtime) return;
        runtime.mesh.position.copyFromFloats(trigger.position.x, trigger.position.y, trigger.position.z);
        runtime.mesh.rotationQuaternion = null;
        runtime.mesh.rotation.copyFromFloats(0, trigger.rotationY, 0);
        runtime.mesh.scaling.copyFromFloats(trigger.size.width, trigger.size.height, trigger.size.depth);
        runtime.contentRoot.position.copyFrom(runtime.mesh.position);
        runtime.contentRoot.rotationQuaternion = null;
        runtime.contentRoot.rotation.copyFromFloats(0, trigger.rotationY, 0);
        for (const product of productRuntime.values()) {
            if (product.triggerId !== trigger.id) continue;
            if (trigger.productType === 'light') continue;
            applyProductWorldTransform(trigger, product.root, product.localPosition);
        }
    };

    const removeTriggerRuntime = (triggerId) => {
        disposeTriggerProducts(triggerId);
        const runtime = triggerRuntime.get(triggerId);
        if (!runtime) return;
        runtime.contentRoot.dispose(false, false);
        runtime.mesh.dispose(false, false);
        triggerRuntime.delete(triggerId);
    };

    triggers.forEach((trigger) => {
        createTriggerRuntime(trigger);
        renderProducts(trigger, true);
    });

    const gizmoManager = new GizmoManager(scene, 1.25);
    gizmoManager.usePointerToAttachGizmos = false;
    gizmoManager.enableAutoPicking = false;
    gizmoManager.clearGizmoOnEmptyPointerEvent = false;
    gizmoManager.scaleRatio = 0.72;
    gizmoManager.positionGizmoEnabled = true;
    gizmoManager.rotationGizmoEnabled = false;
    gizmoManager.boundingBoxGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;
    const configureRotationGizmo = () => {
        const rotationGizmo = gizmoManager.gizmos.rotationGizmo;
        if (!rotationGizmo) return;
        rotationGizmo.xGizmo._rootMesh.setEnabled(false);
        rotationGizmo.zGizmo._rootMesh.setEnabled(false);
        rotationGizmo.snapDistance = Math.PI / 36;
    };
    configureRotationGizmo();
    if (gizmoManager.gizmos.positionGizmo) {
        gizmoManager.gizmos.positionGizmo.snapDistance = 0.02;
    }

    const syncTriggerFromGizmo = (regenerate = false, commit = true) => {
        const trigger = findTrigger();
        const runtime = trigger && triggerRuntime.get(trigger.id);
        if (!trigger || !runtime) return;
        const euler = runtime.mesh.rotationQuaternion?.toEulerAngles() || runtime.mesh.rotation;
        trigger.position = {
            x: round(runtime.mesh.position.x, 3),
            y: round(runtime.mesh.position.y, 3),
            z: round(runtime.mesh.position.z, 3)
        };
        trigger.rotationY = round(euler.y, 4);
        if (regenerate) {
            trigger.size = {
                width: clamp(Math.abs(runtime.mesh.scaling.x), 0.08, 8),
                height: clamp(Math.abs(runtime.mesh.scaling.y), 0.08, 8),
                depth: clamp(Math.abs(runtime.mesh.scaling.z), 0.03, 8)
            };
        }
        runtime.contentRoot.position.copyFrom(runtime.mesh.position);
        runtime.contentRoot.rotationQuaternion = null;
        runtime.contentRoot.rotation.copyFromFloats(0, trigger.rotationY, 0);

        if (commit) {
            updateTriggerTransform(trigger);
            if (regenerate) renderProducts(trigger, true);
            persist();
            renderEditor();
        } else {
            dom.triggerPosX.value = trigger.position.x;
            dom.triggerPosY.value = trigger.position.y;
            dom.triggerPosZ.value = trigger.position.z;
            dom.triggerRotY.value = round(trigger.rotationY * 180 / Math.PI, 1);
            if (regenerate) {
                dom.triggerWidth.value = round(trigger.size.width, 3);
                dom.triggerHeight.value = round(trigger.size.height, 3);
                dom.triggerDepth.value = round(trigger.size.depth, 3);
                const sizeText = formatTriggerSize(trigger);
                dom.triggerSizeSummary.textContent = sizeText;
                dom.sceneToolbarSize.textContent = sizeText;
                dom.triggerHudSize.textContent = `Tek ürün: ${sizeText}`;
            }
        }
    };

    gizmoManager.gizmos.positionGizmo?.onDragObservable.add(() => syncTriggerFromGizmo(false, false));
    gizmoManager.gizmos.positionGizmo?.onDragEndObservable.add(() => syncTriggerFromGizmo(false, true));

    let rotationGizmoObserversBound = false;
    let boundingBoxGizmoObserversBound = false;

    const setTransformMode = (mode) => {
        transformMode = ['move', 'rotate', 'resize'].includes(mode) ? mode : 'move';
        gizmoManager.positionGizmoEnabled = transformMode === 'move';
        gizmoManager.rotationGizmoEnabled = transformMode === 'rotate';
        gizmoManager.boundingBoxGizmoEnabled = transformMode === 'resize';
        configureRotationGizmo();
        if (transformMode === 'rotate' && !rotationGizmoObserversBound && gizmoManager.gizmos.rotationGizmo) {
            gizmoManager.gizmos.rotationGizmo.onDragObservable.add(() => syncTriggerFromGizmo(false, false));
            gizmoManager.gizmos.rotationGizmo.onDragEndObservable.add(() => syncTriggerFromGizmo(false, true));
            rotationGizmoObserversBound = true;
        }
        if (transformMode === 'resize' && !boundingBoxGizmoObserversBound && gizmoManager.gizmos.boundingBoxGizmo) {
            gizmoManager.gizmos.boundingBoxGizmo.onScaleBoxDragObservable.add(() => syncTriggerFromGizmo(true, false));
            gizmoManager.gizmos.boundingBoxGizmo.onScaleBoxDragEndObservable.add(() => syncTriggerFromGizmo(true));
            boundingBoxGizmoObserversBound = true;
        }

        document.querySelectorAll('[data-transform-mode]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.transformMode === transformMode);
        });
        const transformHelp = {
            move: 'Kırmızı, yeşil ve mavi oklarla ilk ürünü raftaki yerine taşıyın.',
            rotate: 'Sarı halkayı sürükleyerek bütün ürün dizisinin yönünü döndürün.',
            resize: 'Köşe ve kenar tutamaçlarıyla tek ürünün en, boy ve derinliğini değiştirin.'
        };
        dom.transformHelp.textContent = transformHelp[transformMode];
        const trigger = findTrigger();
        gizmoManager.attachToMesh(isEditorMode && trigger ? triggerRuntime.get(trigger.id)?.mesh || null : null);
    };

    const renderTriggerList = () => {
        dom.triggerList.replaceChildren();
        dom.triggerCount.textContent = `${triggers.length} dizi`;
        triggers.forEach((trigger) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'trigger-list-item';
            button.classList.toggle('is-selected', trigger.id === selectedTriggerId);

            const copy = document.createElement('span');
            const title = document.createElement('strong');
            const detail = document.createElement('small');
            title.textContent = trigger.name;
            const direction = LAYOUT_DIRECTIONS[trigger.layout.direction].label;
            detail.textContent = `${PRODUCT_TYPES[trigger.productType].label} · ${trigger.products.length} ürün · ${direction}`;
            copy.append(title, detail);

            const badge = document.createElement('span');
            badge.className = 'trigger-list-badge';
            badge.textContent = String(trigger.products.length);
            button.append(copy, badge);
            button.addEventListener('click', () => selectTrigger(trigger.id));
            dom.triggerList.append(button);
        });
    };

    const renderProductForm = () => {
        const match = findProduct();
        dom.productForm.classList.toggle('hidden', !match);
        dom.productFormEmpty.classList.toggle('hidden', Boolean(match));
        if (!match) return;
        dom.productBrand.value = match.product.brand;
        dom.productName.value = match.product.name;
        dom.productPrice.value = match.product.price;
        dom.productDescription.value = match.product.description;
        dom.productProperties.value = match.product.properties;
        dom.productColor.value = match.product.color;
    };

    const renderEditor = () => {
        const trigger = findTrigger();
        dom.emptyState.classList.toggle('hidden', triggers.length > 0);
        dom.triggerForm.classList.toggle('hidden', !trigger);
        const isPlacingSelectedRow = Boolean(placementType && trigger?.id === placementTargetTriggerId);
        dom.sceneToolbar.classList.toggle('hidden', !isEditorMode || !trigger || isPlacingSelectedRow);
        dom.triggerHud.classList.toggle('hidden', !isEditorMode || !trigger || isPlacingSelectedRow);
        renderTriggerList();

        for (const [triggerId, runtime] of triggerRuntime) {
            const isSelected = isEditorMode && triggerId === selectedTriggerId;
            const isPlacementTarget = placementType && triggerId === placementTargetTriggerId;
            runtime.mesh.isVisible = isEditorMode && !isPlacementTarget;
            runtime.mesh.isPickable = isEditorMode && !isPlacementTarget;
            runtime.mesh.material = isSelected ? selectedTriggerMaterial : triggerMaterial;
            runtime.mesh.renderOutline = isSelected;
            runtime.mesh.outlineColor = new Color3(1, 0.69, 0.24);
            runtime.mesh.outlineWidth = 0.09;
            runtime.mesh.edgesWidth = isSelected ? 7 : 3;
            runtime.mesh.edgesColor = isSelected
                ? new Color4(1, 0.72, 0.28, 1)
                : new Color4(0.78, 0.51, 0.18, 0.76);
        }
        for (const runtime of productRuntime.values()) {
            runtime.meshes.forEach((mesh) => {
                mesh.renderingGroupId = isEditorMode ? 2 : 0;
            });
        }

        if (!trigger) {
            gizmoManager.attachToMesh(null);
            renderProductForm();
            return;
        }

        dom.triggerName.value = trigger.name;
        dom.triggerType.value = trigger.productType;
        dom.triggerPosX.value = round(trigger.position.x, 3);
        dom.triggerPosY.value = round(trigger.position.y, 3);
        dom.triggerPosZ.value = round(trigger.position.z, 3);
        dom.triggerRotY.value = round(trigger.rotationY * 180 / Math.PI, 1);

        const isLight = trigger.productType === 'light';
        dom.dimensionsFieldset.classList.toggle('hidden', isLight);
        dom.dimensionsActions.classList.toggle('hidden', isLight);
        dom.productLayoutBuilder.classList.toggle('hidden', isLight);
        dom.lightSettingsFieldset.classList.toggle('hidden', !isLight);

        if (isLight) {
            dom.triggerLightIntensity.value = trigger.lightSettings.intensity;
            dom.triggerLightRange.value = trigger.lightSettings.range;
            dom.triggerLightColor.value = trigger.lightSettings.color;
        } else {
            dom.triggerWidth.value = round(trigger.size.width, 3);
            dom.triggerHeight.value = round(trigger.size.height, 3);
            dom.triggerDepth.value = round(trigger.size.depth, 3);
            dom.triggerQuantity.value = trigger.layout.count;
            dom.triggerDirection.value = trigger.layout.direction;
            dom.triggerGap.value = trigger.gap;
            dom.triggerGapValue.textContent = `${Math.round(trigger.gap * 100)} cm`;
        }

        const sizeText = formatTriggerSize(trigger);
        const directionText = LAYOUT_DIRECTIONS[trigger.layout.direction].label;
        dom.selectedTriggerTitle.textContent = trigger.name;
        dom.triggerSizeSummary.textContent = sizeText;
        dom.triggerProductCount.textContent = String(trigger.products.length);
        dom.productLayoutPreview.textContent = `${trigger.layout.count} adet · ${directionText}`;
        dom.triggerLayoutHint.textContent = trigger.layout.spawned
            ? `${trigger.layout.count} ürünü ${directionText} yeniden oluşturur`
            : `${trigger.layout.count} ürünü ${directionText} farklı renklerde oluşturur`;
        dom.sceneToolbarSize.textContent = sizeText;
        dom.triggerHudName.textContent = trigger.name;
        dom.triggerHudSize.textContent = `Tek ürün: ${sizeText}`;
        dom.triggerHudProducts.textContent = trigger.layout.spawned
            ? `${trigger.products.length} ürün · ${directionText}`
            : 'Başlangıç noktası · ürünler henüz oluşturulmadı';
        gizmoManager.attachToMesh(isEditorMode && !isPlacingSelectedRow
            ? triggerRuntime.get(trigger.id)?.mesh || null
            : null);
        renderProductForm();
    };

    const hudWorldMatrix = Matrix.Identity();
    const updateTriggerHudPosition = () => {
        const trigger = findTrigger();
        const runtime = trigger && triggerRuntime.get(trigger.id);
        if (!isEditorMode || placementType || !trigger || !runtime || runtime.mesh.isDisposed()) {
            dom.triggerHud.classList.add('hidden');
            return;
        }

        const engine = scene.getEngine();
        const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
        const anchor = runtime.mesh.position.add(new Vector3(0, trigger.size.height * 0.58 + 0.18, 0));
        const projected = Vector3.Project(anchor, hudWorldMatrix, scene.getTransformMatrix(), viewport);
        const rect = canvas.getBoundingClientRect();
        const x = rect.left + projected.x * (rect.width / engine.getRenderWidth());
        const y = rect.top + projected.y * (rect.height / engine.getRenderHeight());
        const isOnScreen = projected.z > 0 && projected.z < 1
            && x > rect.left - 120
            && x < rect.right + 120
            && y > rect.top - 80
            && y < rect.bottom + 80;

        dom.triggerHud.classList.toggle('hidden', !isOnScreen);
        if (!isOnScreen) return;
        dom.triggerHud.style.left = `${round(x, 1)}px`;
        dom.triggerHud.style.top = `${round(y - 12, 1)}px`;
    };
    const triggerHudObserver = scene.onBeforeRenderObservable.add(updateTriggerHudPosition);

    const selectTrigger = (triggerId, productId = null) => {
        selectedTriggerId = triggers.some((trigger) => trigger.id === triggerId) ? triggerId : null;
        selectedProductId = productId;
        renderEditor();
        if (selectedTriggerId) {
            setStatus('Ürün dizisi seçildi. Turuncu kılavuz yalnızca ilk ürünün gerçek ölçüsünü gösterir.', 'active');
            requestAnimationFrame(() => dom.triggerForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
        }
    };

    const selectProduct = (productId) => {
        const match = findProduct(productId);
        if (!match) return;
        selectedTriggerId = match.trigger.id;
        selectedProductId = productId;
        renderEditor();
        dom.productForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setStatus(`${match.product.name} seçildi. Bilgileri aşağıdan düzenleyebilirsiniz.`, 'success');
    };

    const cancelPlacement = (restorePreview = true) => {
        const previewTarget = placementTargetTriggerId ? findTrigger(placementTargetTriggerId) : null;
        if (restorePreview && previewTarget && placementOriginalPosition) {
            previewTarget.position = { ...placementOriginalPosition };
            updateTriggerTransform(previewTarget);
        }
        placementType = null;
        placementTargetTriggerId = null;
        placementOriginalPosition = null;
        dom.placementHint.classList.add('hidden');
        canvas.classList.remove('is-placing-trigger');
        originalPickable.forEach((value, mesh) => {
            if (!mesh.isDisposed()) mesh.isPickable = value;
        });
        renderEditor();
        if (isEditorMode) setStatus('Yeni bir ürün dizisi oluşturabilir veya mevcut dizilerden birini seçebilirsiniz.');
    };

    const beginPlacement = (productType, targetTriggerId = null) => {
        if (!isEditorMode || !PRODUCT_TYPES[productType]) return;
        placementType = productType;
        placementTargetTriggerId = targetTriggerId;
        const target = targetTriggerId ? findTrigger(targetTriggerId) : null;
        placementOriginalPosition = target ? { ...target.position } : null;
        if (target) {
            const ray = camera.getForwardRay(4.2);
            const previewPosition = camera.position.add(ray.direction.scale(4.2));
            previewPosition.addInPlace(camera.getDirection(Vector3.Right()).scale(-1.25));
            previewPosition.y -= 0.35;
            target.position = {
                x: round(previewPosition.x, 3),
                y: round(previewPosition.y, 3),
                z: round(previewPosition.z, 3)
            };
            updateTriggerTransform(target);
        }
        tourMeshSet.forEach((mesh) => {
            if (!mesh.isDisposed()) mesh.isPickable = true;
        });
        dom.placementTitle.textContent = targetTriggerId
            ? 'Dizinin başlangıç ürününü yeni yerine taşıyın'
            : `${PRODUCT_TYPES[productType].label} dizisinin başlangıç noktasını seçin`;
        dom.placementCopy.textContent = 'İlk ürünün duracağı raf noktasına tıklayın. Diğer ürünler buradan seçtiğiniz yöne doğru sıralanacak.';
        dom.placementHint.classList.remove('hidden');
        canvas.classList.add('is-placing-trigger');
        renderEditor();
        setStatus('Sahnede raf yüzeyine tıklayın veya “Kameranın önüne koy” seçeneğini kullanın.', 'active');
    };

    const createTriggerAt = (productType, position, liftFromSurface = true) => {
        if (triggers.length >= MAX_TRIGGERS) {
            setStatus(`En fazla ${MAX_TRIGGERS} ürün dizisi oluşturabilirsiniz.`, 'error');
            return null;
        }
        const type = PRODUCT_TYPES[productType];
        const trigger = sanitizeTrigger({
            id: createId('row'),
            name: `${type.defaultName} ${triggers.length + 1}`,
            productType,
            position: {
                x: position.x,
                y: position.y + (liftFromSurface ? type.product.height * 0.5 : 0),
                z: position.z
            },
            rotationY: camera.rotation?.y || 0,
            size: type.product,
            gap: type.gap,
            layout: { count: 5, direction: 'x+', spawned: true },
            products: []
        });
        try {
            triggers.push(trigger);
            createTriggerRuntime(trigger);
            renderProducts(trigger, false);
            persist();
            cancelPlacement();
            selectTrigger(trigger.id);
            setStatus(`${trigger.name} için 5 renkli dikdörtgen hazır. Raf üzerinde başlangıç noktasını seçin.`, 'success');
            return trigger;
        } catch (error) {
            removeTriggerRuntime(trigger.id);
            triggers = triggers.filter((candidate) => candidate.id !== trigger.id);
            const message = error instanceof Error ? error.message : String(error);
            console.error('Ürün dizisi oluşturulamadı:', error);
            setStatus(`Ürün dizisi oluşturulamadı: ${message}`, 'error');
            renderEditor();
            return null;
        }
    };

    const moveTriggerTo = (trigger, position, liftFromSurface) => {
        trigger.position = {
            x: round(position.x, 3),
            y: round(position.y + (liftFromSurface ? trigger.size.height * 0.5 : 0), 3),
            z: round(position.z, 3)
        };
        updateTriggerTransform(trigger);
        persist();
        const triggerId = trigger.id;
        placementOriginalPosition = null;
        cancelPlacement(false);
        selectTrigger(triggerId);
        setStatus(`${trigger.name} başlangıç noktası rafa taşındı. Ürünler bu noktadan seçilen yöne sıralanacak.`, 'success');
    };

    const focusSelectedTrigger = () => {
        const trigger = findTrigger();
        const runtime = trigger && triggerRuntime.get(trigger.id);
        if (!trigger || !runtime) return;
        camera.setTarget(runtime.mesh.position.clone());
        setStatus(`${trigger.name} başlangıç ürünü ortalandı. Taşı, Döndür veya Ölçü araçlarıyla düzenleyebilirsiniz.`, 'active');
    };

    const fillSelectedTrigger = () => {
        const trigger = findTrigger();
        if (!trigger) return;
        trigger.layout.count = clamp(Math.round(numberOr(dom.triggerQuantity.value, trigger.layout.count)), 1, MAX_PRODUCTS_PER_TRIGGER);
        trigger.layout.direction = LAYOUT_DIRECTIONS[dom.triggerDirection.value]
            ? dom.triggerDirection.value
            : 'x+';
        trigger.layout.spawned = true;
        renderProducts(trigger, true);
        persist();
        renderEditor();
        const direction = LAYOUT_DIRECTIONS[trigger.layout.direction].label;
        setStatus(`${trigger.products.length} ürün, başlangıç noktasından ${direction} farklı renklerde yerleştirildi.`, 'success');
    };

    const clearSelectedProducts = () => {
        const trigger = findTrigger();
        if (!trigger) return;
        trigger.layout.spawned = false;
        renderProducts(trigger, false);
        selectedProductId = null;
        persist();
        renderEditor();
        setStatus('Ürünler temizlendi; başlangıç noktası ve dizi ayarları korundu.', 'success');
    };

    const placeTriggerInFront = () => {
        if (!placementType) return;
        const ray = camera.getForwardRay(4.2);
        const position = camera.position.add(ray.direction.scale(4.2));
        position.y -= 0.35;
        const target = placementTargetTriggerId ? findTrigger(placementTargetTriggerId) : null;
        if (target) moveTriggerTo(target, position, false);
        else createTriggerAt(placementType, position, false);
    };

    const createTriggerInFront = (productType) => {
        if (!isEditorMode || !PRODUCT_TYPES[productType]) return;
        try {
            const ray = camera.getForwardRay(4.2);
            const position = camera.position.add(ray.direction.scale(4.2));
            position.y -= 0.35;
            const trigger = createTriggerAt(productType, position, false);
            if (trigger) {
                beginPlacement(productType, trigger.id);
                requestAnimationFrame(() => dom.triggerForm.scrollIntoView({ behavior: 'smooth', block: 'start' }));
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Ürün dizisi konumu hazırlanamadı:', error);
            setStatus(`Ürün dizisi hazırlanamadı: ${message}`, 'error');
        }
    };

    const updateSelectedTriggerFromForm = (regenerate, rerender = true) => {
        window.clearTimeout(formUpdateTimer);
        const trigger = findTrigger();
        if (!trigger) return;
        const previousType = trigger.productType;
        trigger.name = dom.triggerName.value.trim().slice(0, 80) || PRODUCT_TYPES[trigger.productType].defaultName;
        trigger.productType = PRODUCT_TYPES[dom.triggerType.value] ? dom.triggerType.value : trigger.productType;
        trigger.position = {
            x: clamp(numberOr(dom.triggerPosX.value, trigger.position.x), -100000, 100000),
            y: clamp(numberOr(dom.triggerPosY.value, trigger.position.y), -100000, 100000),
            z: clamp(numberOr(dom.triggerPosZ.value, trigger.position.z), -100000, 100000)
        };
        trigger.rotationY = clamp(numberOr(dom.triggerRotY.value, trigger.rotationY * 180 / Math.PI), -360, 360) * Math.PI / 180;
        trigger.size = {
            width: clamp(numberOr(dom.triggerWidth.value, trigger.size.width), 0.08, 8),
            height: clamp(numberOr(dom.triggerHeight.value, trigger.size.height), 0.08, 8),
            depth: clamp(numberOr(dom.triggerDepth.value, trigger.size.depth), 0.03, 8)
        };
        trigger.lightSettings = {
            intensity: clamp(numberOr(dom.triggerLightIntensity.value, trigger.lightSettings.intensity), 0.1, 100),
            range: clamp(numberOr(dom.triggerLightRange.value, trigger.lightSettings.range), 1, 100),
            color: /^#[0-9a-f]{6}$/i.test(dom.triggerLightColor.value) ? dom.triggerLightColor.value : trigger.lightSettings.color
        };
        trigger.layout.count = clamp(Math.round(numberOr(dom.triggerQuantity.value, trigger.layout.count)), 1, MAX_PRODUCTS_PER_TRIGGER);
        trigger.layout.direction = LAYOUT_DIRECTIONS[dom.triggerDirection.value]
            ? dom.triggerDirection.value
            : trigger.layout.direction;
        trigger.gap = clamp(numberOr(dom.triggerGap.value, trigger.gap), 0.015, 0.6);
        updateTriggerTransform(trigger);
        if (regenerate || previousType !== trigger.productType) renderProducts(trigger, previousType === trigger.productType);
        persist();
        if (rerender) renderEditor();
        else {
            const sizeText = formatTriggerSize(trigger);
            const directionText = LAYOUT_DIRECTIONS[trigger.layout.direction].label;
            dom.triggerSizeSummary.textContent = sizeText;
            dom.triggerProductCount.textContent = String(trigger.products.length);
            dom.productLayoutPreview.textContent = `${trigger.layout.count} adet · ${directionText}`;
            dom.triggerLayoutHint.textContent = `${trigger.layout.count} ürünü ${directionText} oluşturur`;
            dom.sceneToolbarSize.textContent = sizeText;
            dom.triggerHudName.textContent = trigger.name;
            dom.triggerHudSize.textContent = `Tek ürün: ${sizeText}`;
            dom.triggerHudProducts.textContent = trigger.layout.spawned
                ? `${trigger.products.length} ürün · ${directionText}`
                : 'Başlangıç noktası · ürünler henüz oluşturulmadı';
        }
    };

    const scheduleTriggerFormUpdate = (regenerate) => {
        window.clearTimeout(formUpdateTimer);
        formUpdateTimer = window.setTimeout(() => {
            updateSelectedTriggerFromForm(regenerate, false);
        }, regenerate ? 180 : 80);
    };

    const removeSelectedTrigger = () => {
        const trigger = findTrigger();
        if (!trigger) return;
        const index = triggers.indexOf(trigger);
        lastDeletedTrigger = { trigger: structuredClone(trigger), index };
        triggers.splice(index, 1);
        removeTriggerRuntime(trigger.id);
        selectedTriggerId = null;
        selectedProductId = null;
        persist();
        renderEditor();
        dom.undoText.textContent = `${trigger.name} silindi.`;
        dom.undoToast.classList.remove('hidden');
        window.clearTimeout(undoTimer);
        undoTimer = window.setTimeout(() => dom.undoToast.classList.add('hidden'), 7000);
        setStatus('Ürün dizisi silindi. Alt bildirimden geri alabilirsiniz.');
    };

    const undoRemoveTrigger = () => {
        if (!lastDeletedTrigger) return;
        const { trigger, index } = lastDeletedTrigger;
        triggers.splice(Math.min(index, triggers.length), 0, sanitizeTrigger(trigger));
        const restored = triggers.find((candidate) => candidate.id === trigger.id);
        createTriggerRuntime(restored);
        renderProducts(restored, true);
        persist();
        lastDeletedTrigger = null;
        dom.undoToast.classList.add('hidden');
        selectTrigger(trigger.id);
        setStatus(`${trigger.name} geri getirildi.`, 'success');
    };

    const closeInspector = () => {
        dom.inspector.classList.add('hidden');
        clearProductTarget();
        canvas.style.cursor = 'default';
        document.body.classList.remove('product-inspector-open');
        closeHighQualityProduct?.();
        previewEngine?.stopRenderLoop();
        previewScene?.dispose();
        previewEngine?.dispose();
        previewEngine = null;
        previewScene = null;
        previewRoot = null;
        camera.attachControl(canvas, true);
        goldPricing.hide();
    };

    const fillProductHotspots = (product = {}) => {
        dom.inspectorHotspots.replaceChildren();
        // İşaretleri ürünün kendi hotspots listesi belirler; görünürlükleri
        // sahne araçlarındaki [data-parts-hidden] ile yönetilir.
        const explicitHotspots = Array.isArray(product.hotspots)
            ? product.hotspots.filter((hotspot) => hotspot?.label && hotspot?.nodeName).slice(0, 32)
            : [];
        explicitHotspots.forEach((hotspot, index) => {
            const label = hotspot.label;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'product-stage__hotspot product-stage__hotspot--part';
            button.setAttribute('aria-label', hotspot.description ? `${label}: ${hotspot.description}` : label);
            const dot = document.createElement('i');
            dot.setAttribute('aria-hidden', 'true');
            const text = document.createElement('span');
            const title = document.createElement('strong');
            title.textContent = label;
            text.append(title);
            if (hotspot.description) {
                const description = document.createElement('small');
                description.textContent = hotspot.description;
                text.append(description);
            }
            button.append(dot, text);
            button.addEventListener('click', () => {
                const willOpen = !button.classList.contains('is-open');
                dom.inspectorHotspots.querySelectorAll('.is-open').forEach((item) => item.classList.remove('is-open'));
                button.classList.toggle('is-open', willOpen);
            });
            button.style.setProperty('--hotspot-index', String(index));
            button.dataset.hotspotIndex = String(index);
            button.dataset.partNumber = String(index + 1).padStart(2, '0');
            button.dataset.nodeName = hotspot.nodeName;
            dom.inspectorHotspots.append(button);
        });
    };

    const createPreviewHotspotTracker = (targetScene, targetCamera, targetEngine, meshes = []) => {
        const buttons = [...dom.inspectorHotspots.querySelectorAll('.product-stage__hotspot')];
        const targets = [...meshes]
            .filter((mesh) => mesh?.getBoundingInfo)
            .sort((left, right) => {
                left.computeWorldMatrix(true);
                right.computeWorldMatrix(true);
                return left.getBoundingInfo().boundingBox.centerWorld.x - right.getBoundingInfo().boundingBox.centerWorld.x;
            });
        const tracked = buttons.map((element, index) => {
            const nodeName = element.dataset.nodeName || '';
            const exactTarget = targets.find((mesh) => mesh.name === nodeName || mesh.name?.endsWith(`_${nodeName}`));
            return {
                element,
                target: nodeName
                    ? exactTarget
                    : targets[Math.round(index * (targets.length - 1) / Math.max(buttons.length - 1, 1))] || targets[0]
            };
        }).filter(({ target }) => target);

        return () => {
            const renderWidth = targetEngine.getRenderWidth();
            const renderHeight = targetEngine.getRenderHeight();
            const scaleX = dom.inspectorCanvas.clientWidth / Math.max(renderWidth, 1);
            const scaleY = dom.inspectorCanvas.clientHeight / Math.max(renderHeight, 1);
            const viewport = targetCamera.viewport.toGlobal(renderWidth, renderHeight);
            const transform = targetScene.getTransformMatrix();
            tracked.forEach(({ element, target }) => {
                target.computeWorldMatrix(true);
                const point = target.getBoundingInfo().boundingBox.centerWorld;
                const projected = Vector3.Project(point, Matrix.Identity(), transform, viewport);
                const x = projected.x * scaleX;
                const y = projected.y * scaleY;
                const visible = projected.z > 0 && projected.z < 1
                    && x >= -24 && x <= dom.inspectorCanvas.clientWidth + 24
                    && y >= -24 && y <= dom.inspectorCanvas.clientHeight + 24;
                element.style.visibility = visible ? 'visible' : 'hidden';
                if (!visible) return;
                element.style.left = `${x.toFixed(1)}px`;
                element.style.top = `${y.toFixed(1)}px`;
                element.dataset.tracking = target.name;
                element.dataset.labelSide = x > dom.inspectorCanvas.clientWidth * 0.64 ? 'left' : 'right';
            });
        };
    };

    const fillRegisteredProductDetails = (product) => {
        const price = Number.isFinite(Number(product.price))
            ? new Intl.NumberFormat('tr-TR', {
                style: 'currency',
                currency: product.currency || 'TRY',
                maximumFractionDigits: 0
            }).format(Number(product.price))
            : product.priceLabel || 'Fiyat bilgisi yok';
        dom.inspectorBrand.textContent = product.brand || product.storeName || 'Uzun Çarşı';
        dom.inspectorName.textContent = product.name || product.id || 'Ürün';
        dom.inspectorPrice.textContent = price;
        dom.inspectorDescription.textContent = product.description || 'Bu ürün için açıklama eklenmemiş.';
        fillProductHotspots(product);
        dom.inspectorProperties.replaceChildren();
        const properties = [
            product.category ? ['Kategori', product.category] : null,
            product.storeName ? ['Mağaza', product.storeName] : null,
            product.priceNote ? ['Fiyatlandırma', product.priceNote] : null
        ].filter(Boolean);
        properties.forEach(([label, value]) => {
            const row = document.createElement('div');
            const term = document.createElement('dt');
            const description = document.createElement('dd');
            term.textContent = label;
            description.textContent = value;
            row.append(term, description);
            dom.inspectorProperties.append(row);
        });
        void goldPricing.show(product, product.storeId || storeId);
    };

    const openGeneratedProductInspector = (productId) => {
        const match = findProduct(productId);
        if (!match) return;
        closeHighQualityProduct?.({ dispose: true });
        releaseTourPointerLock();
        const { trigger, product } = match;
        dom.inspectorBrand.textContent = product.brand || 'Uzun Çarşı';
        dom.inspectorName.textContent = product.name || 'Ürün';
        dom.inspectorPrice.textContent = product.price || 'Fiyat bilgisi yok';
        dom.inspectorDescription.textContent = product.description || 'Bu ürün için açıklama eklenmemiş.';
        fillProductHotspots({ ...product, tags: parseProperties(product.properties).map(({ value }) => value) });
        dom.inspectorProperties.replaceChildren();
        goldPricing.hide();
        const properties = parseProperties(product.properties);
        if (properties.length === 0) properties.push({ label: 'Bilgi', value: 'Ek özellik girilmedi' });
        properties.forEach((property) => {
            const row = document.createElement('div');
            const term = document.createElement('dt');
            const definition = document.createElement('dd');
            term.textContent = property.label;
            definition.textContent = property.value;
            row.append(term, definition);
            dom.inspectorProperties.append(row);
        });

        camera.detachControl();
        dom.inspector.classList.remove('hidden');
        document.body.classList.add('product-inspector-open');

        previewEngine = new Engine(dom.inspectorCanvas, true, {
            alpha: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            stencil: false,
            audioEngine: false
        }, true);
        previewScene = new Scene(previewEngine);
        previewScene.clearColor = new Color4(0, 0, 0, 0);
        const previewCamera = new ArcRotateCamera(
            'productPreviewCamera',
            -Math.PI * 0.5,
            Math.PI * 0.47,
            trigger.productType === 'shirt' ? 2.05 : 1.9,
            new Vector3(0, 0, 0),
            previewScene
        );
        previewCamera.lowerRadiusLimit = 1.25;
        previewCamera.upperRadiusLimit = 3.1;
        previewCamera.wheelPrecision = 65;
        previewCamera.panningSensibility = 0;
        previewCamera.inertia = 0.82;
        previewCamera.attachControl(dom.inspectorCanvas, true);

        const ambient = new HemisphericLight('productAmbient', new Vector3(0.2, 1, -0.25), previewScene);
        ambient.intensity = 1.35;
        ambient.diffuse = new Color3(0.92, 0.95, 1);
        ambient.groundColor = new Color3(0.18, 0.2, 0.24);
        const key = new DirectionalLight('productKey', new Vector3(-0.6, -0.85, 0.45), previewScene);
        key.intensity = 1.8;
        key.diffuse = new Color3(1, 0.85, 0.68);

        previewRoot = new TransformNode('productPreviewRoot', previewScene);
        previewRoot.scaling.copyFromFloats(2.1, 2.1, 2.1);
        buildProductGeometry({
            scene: previewScene,
            root: previewRoot,
            productType: trigger.productType,
            color: product.color,
            interactive: false
        });
        const updatePreviewHotspots = createPreviewHotspotTracker(
            previewScene,
            previewCamera,
            previewEngine,
            previewRoot.getChildMeshes(false)
        );

        previewScene.onBeforeRenderObservable.add(() => {
            updatePreviewHotspots();
        });
        previewEngine.runRenderLoop(() => previewScene?.render());
        requestAnimationFrame(() => previewEngine?.resize());
        dom.inspectorClose.focus({ preventScroll: true });
    };

    const fillModeledProductDetails = (product) => {
        const details = product.details || product;
        dom.inspectorBrand.textContent = details.brand || 'Uzun Çarşı';
        dom.inspectorName.textContent = details.name || 'Ürün';
        dom.inspectorPrice.textContent = details.price || 'Mağazada bilgi alın';
        dom.inspectorDescription.textContent = details.description || 'Bu ürün için açıklama eklenmemiş.';
        fillProductHotspots(details);
        dom.inspectorProperties.replaceChildren();
        const properties = parseProperties(details.properties);
        if (properties.length === 0) properties.push({ label: 'Bilgi', value: 'Ek bilgi bulunmuyor' });
        properties.forEach((property) => {
            const row = document.createElement('div');
            const term = document.createElement('dt');
            const definition = document.createElement('dd');
            term.textContent = property.label;
            definition.textContent = property.value;
            row.append(term, definition);
            dom.inspectorProperties.append(row);
        });
        void goldPricing.show({ ...details, id: product.id || details.id || product.productId }, storeId);
    };

    const previewMaterialFor = (source, cache) => {
        if (!source) return null;
        if (cache.has(source)) return cache.get(source);
        if (source.subMaterials) {
            const multi = new MultiMaterial(`preview_${source.name}`, previewScene);
            multi.subMaterials = source.subMaterials.map((material) => previewMaterialFor(material, cache));
            cache.set(source, multi);
            return multi;
        }

        let cloned = null;
        if (source instanceof PBRMaterial) {
            const pbr = new PBRMaterial(`preview_${source.name}`, previewScene);
            if (source.albedoColor) pbr.albedoColor = source.albedoColor.clone();
            if (source.albedoTexture) pbr.albedoTexture = source.albedoTexture;
            if (source.bumpTexture) pbr.bumpTexture = source.bumpTexture;
            if (source.metallicTexture) pbr.metallicTexture = source.metallicTexture;
            if (source.microSurfaceTexture) pbr.microSurfaceTexture = source.microSurfaceTexture;
            if (source.reflectionTexture) pbr.reflectionTexture = source.reflectionTexture;
            pbr.metallic = source.metallic ?? 0.12;
            pbr.roughness = source.roughness ?? 0.32;
            pbr.twoSidedLighting = true;
            pbr.backFaceCulling = false;
            pbr.environmentIntensity = 1.0;
            cloned = pbr;
        } else if (source instanceof StandardMaterial) {
            const std = new StandardMaterial(`preview_${source.name}`, previewScene);
            if (source.diffuseColor) std.diffuseColor = source.diffuseColor.clone();
            if (source.diffuseTexture) std.diffuseTexture = source.diffuseTexture;
            if (source.bumpTexture) std.bumpTexture = source.bumpTexture;
            if (source.specularColor) std.specularColor = source.specularColor.clone();
            std.backFaceCulling = false;
            cloned = std;
        } else {
            cloned = createPbrMaterial(previewScene, `preview_fallback_${source.name}`, '#777777', 0.55, 0.02);
            if (cloned) cloned.backFaceCulling = false;
        }

        cache.set(source, cloned);
        return cloned;
    };

    const copyPreviewSubMeshes = (source, target) => {
        const actualSource = source.sourceMesh || source;
        if (!actualSource.subMeshes?.length) return;
        target.releaseSubMeshes(true);
        actualSource.subMeshes.forEach((subMesh) => {
            new SubMesh(
                subMesh.materialIndex,
                subMesh.verticesStart,
                subMesh.verticesCount,
                subMesh.indexStart,
                subMesh.indexCount,
                target
            );
        });
    };

    const openModeledProductInspector = (productId, targetMesh = null) => {
        const product = findModeledProduct(productId);
        if (!product) return;
        closeHighQualityProduct?.({ dispose: true });
        releaseTourPointerLock();
        fillModeledProductDetails(product);
        camera.detachControl();
        dom.inspector.classList.remove('hidden');
        document.body.classList.add('product-inspector-open');

        previewEngine = new Engine(dom.inspectorCanvas, true, {
            alpha: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            stencil: false,
            audioEngine: false
        }, true);
        previewScene = new Scene(previewEngine);
        previewScene.clearColor = new Color4(0, 0, 0, 0);
        previewScene.shadowsEnabled = false;
        if (scene.environmentTexture) previewScene.environmentTexture = scene.environmentTexture;
        const previewCamera = new ArcRotateCamera(
            'modeledProductPreviewCamera',
            -Math.PI * 0.5,
            Math.PI * 0.47,
            0.5,
            Vector3.Zero(),
            previewScene
        );
        previewCamera.wheelPrecision = 65;
        previewCamera.panningSensibility = 0;
        previewCamera.inertia = 0.82;
        previewCamera.attachControl(dom.inspectorCanvas, true);

        const ambient = new HemisphericLight('modeledProductAmbient', new Vector3(0.2, 1, -0.25), previewScene);
        ambient.intensity = 1.6;
        ambient.diffuse = new Color3(0.95, 0.98, 1);
        ambient.groundColor = new Color3(0.3, 0.32, 0.36);
        const key = new DirectionalLight('modeledProductKey', new Vector3(-0.6, -0.85, 0.45), previewScene);
        key.intensity = 1.8;
        key.diffuse = new Color3(1, 0.92, 0.82);
        const rim = new PointLight('modeledProductRim', new Vector3(0, 0.8, -0.8), previewScene);
        rim.intensity = 1.2;

        previewRoot = new TransformNode('modeledProductPreviewRoot', previewScene);
        const materialCache = new Map();
        const previewMeshes = [];

        // Birleşik raf geometrisinden seçilen ürüne en yakın parçayı ayırır.
        const allCandidateSources = product.highQualityMeshes || product.inspectMeshes || product.meshes;
        let sources = allCandidateSources;
        const focusMesh = allCandidateSources.includes(targetMesh) ? targetMesh : allCandidateSources[0];
        if (focusMesh && allCandidateSources.length > 1) {
            focusMesh.computeWorldMatrix(true);
            const focusPos = focusMesh.getAbsolutePosition();
            sources = allCandidateSources.filter((mesh) => {
                mesh.computeWorldMatrix(true);
                const pos = mesh.getAbsolutePosition();
                return Vector3.Distance(focusPos, pos) <= 0.45;
            });
            if (sources.length === 0) sources = [focusMesh];
        }

        let minimum = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
        let maximum = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

        const extractedList = [];
        sources.forEach((source, index) => {
            const geometrySource = source.sourceMesh || source;
            const vertexData = VertexData.ExtractFromMesh(geometrySource, true, true);
            if (!vertexData?.positions?.length) return;
            vertexData.transform(source.computeWorldMatrix(true));
            const positions = vertexData.positions;
            for (let i = 0; i < positions.length; i += 3) {
                minimum.x = Math.min(minimum.x, positions[i]);
                minimum.y = Math.min(minimum.y, positions[i + 1]);
                minimum.z = Math.min(minimum.z, positions[i + 2]);
                maximum.x = Math.max(maximum.x, positions[i]);
                maximum.y = Math.max(maximum.y, positions[i + 1]);
                maximum.z = Math.max(maximum.z, positions[i + 2]);
            }
            extractedList.push({ source, geometrySource, vertexData, index });
        });

        let center = minimum.add(maximum).scale(0.5);
        let size = maximum.subtract(minimum);

        // Tek mesh içindeki ürün sırasından tıklanan parçaya en yakın kümeyi seçer.
        if (size.y > 0.32 || size.x > 0.55 || size.z > 0.55) {
            let refX = center.x, refY = minimum.y + 0.12, refZ = center.z;
            if (focusMesh) {
                const fp = focusMesh.getAbsolutePosition();
                refX = fp.x;
                refY = fp.y;
                refZ = fp.z;
            }

            let closestDist = Infinity;
            let targetX = refX, targetY = refY, targetZ = refZ;
            for (let e = 0; e < extractedList.length; e++) {
                const pos = extractedList[e].vertexData.positions;
                for (let j = 0; j < pos.length; j += 3) {
                    const d = Math.hypot(pos[j] - refX, pos[j + 1] - refY, pos[j + 2] - refZ);
                    if (d < closestDist) {
                        closestDist = d;
                        targetX = pos[j];
                        targetY = pos[j + 1];
                        targetZ = pos[j + 2];
                    }
                }
            }

            extractedList.forEach((item) => {
                const vd = item.vertexData;
                const pos = vd.positions;
                const norm = vd.normals;
                const uvs = vd.uvs;
                const ind = vd.indices;
                if (!ind || !pos) return;

                const newPos = [];
                const newNorm = [];
                const newUvs = [];
                const newInd = [];
                const vertMap = new Map();

                for (let t = 0; t < ind.length; t += 3) {
                    const i0 = ind[t], i1 = ind[t + 1], i2 = ind[t + 2];
                    const p0x = pos[i0 * 3], p0y = pos[i0 * 3 + 1], p0z = pos[i0 * 3 + 2];
                    const d = Math.hypot(p0x - targetX, p0y - targetY, p0z - targetZ);
                    if (d <= 0.22) {
                        [i0, i1, i2].forEach((oldI) => {
                            if (!vertMap.has(oldI)) {
                                const newI = newPos.length / 3;
                                vertMap.set(oldI, newI);
                                newPos.push(pos[oldI * 3], pos[oldI * 3 + 1], pos[oldI * 3 + 2]);
                                if (norm?.length) newNorm.push(norm[oldI * 3], norm[oldI * 3 + 1], norm[oldI * 3 + 2]);
                                if (uvs?.length) newUvs.push(uvs[oldI * 2], uvs[oldI * 2 + 1]);
                            }
                            newInd.push(vertMap.get(oldI));
                        });
                    }
                }

                if (newPos.length > 0) {
                    vd.positions = new Float32Array(newPos);
                    if (newNorm.length) vd.normals = new Float32Array(newNorm);
                    if (newUvs.length) vd.uvs = new Float32Array(newUvs);
                    vd.indices = new Uint32Array(newInd);
                }
            });

            minimum = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
            maximum = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
            extractedList.forEach(({ vertexData }) => {
                const positions = vertexData.positions;
                for (let i = 0; i < positions.length; i += 3) {
                    minimum.x = Math.min(minimum.x, positions[i]);
                    minimum.y = Math.min(minimum.y, positions[i + 1]);
                    minimum.z = Math.min(minimum.z, positions[i + 2]);
                    maximum.x = Math.max(maximum.x, positions[i]);
                    maximum.y = Math.max(maximum.y, positions[i + 1]);
                    maximum.z = Math.max(maximum.z, positions[i + 2]);
                }
            });
            center = minimum.add(maximum).scale(0.5);
            size = maximum.subtract(minimum);
        }

        extractedList.forEach(({ source, geometrySource, vertexData, index }) => {
            const positions = vertexData.positions;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] -= center.x;
                positions[i + 1] -= center.y;
                positions[i + 2] -= center.z;
            }
            const mesh = new Mesh(`modeledPreview_${index}_${source.name}`, previewScene);
            vertexData.applyToMesh(mesh, false);
            mesh.material = previewMaterialFor(source.material || geometrySource.material, materialCache);
            copyPreviewSubMeshes(source, mesh);
            mesh.parent = previewRoot;
            mesh.isPickable = false;
            mesh.receiveShadows = false;
            previewMeshes.push(mesh);
        });

        const radius = Math.max(size.x, size.y, size.z, 0.12);
        previewCamera.target = Vector3.Zero();
        previewCamera.radius = Math.max(radius * 1.85, 0.4);
        previewCamera.lowerRadiusLimit = radius * 0.4;
        previewCamera.upperRadiusLimit = radius * 6.0;
        previewCamera.minZ = 0.01;
        previewCamera.maxZ = 100;
        const updatePreviewHotspots = createPreviewHotspotTracker(
            previewScene,
            previewCamera,
            previewEngine,
            previewMeshes
        );

        previewScene.onBeforeRenderObservable.add(() => {
            updatePreviewHotspots();
        });
        previewEngine.runRenderLoop(() => previewScene?.render());
        requestAnimationFrame(() => previewEngine?.resize());
        dom.inspectorClose.focus({ preventScroll: true });
    };

    const openInspector = async (productId, targetMesh = null) => {
        const modeledProduct = findModeledProduct(productId);
        const registeredProduct = findRegisteredProduct(productId);
        const inspectedProduct = registeredProduct || modeledProduct;
        if (inspectedProduct) onProductOpened?.(inspectedProduct);
        if (registeredProduct && (!modeledProduct || registeredProduct.highQualityModel)) {
            releaseTourPointerLock();
            clearProductTarget();
            fillRegisteredProductDetails(registeredProduct);
            dom.inspector.classList.remove('hidden');
            document.body.classList.add('product-inspector-open');
            canvas.style.cursor = 'progress';
            try {
                await openHighQualityProduct?.(registeredProduct, targetMesh);
                canvas.style.cursor = 'default';
            } catch (error) {
                console.error('Kayıtlı yüksek kaliteli ürün açılamadı:', error);
                dom.inspectorDescription.textContent = 'Ürün görünümü açılamadı. Lütfen biraz sonra yeniden deneyin.';
                canvas.style.cursor = 'default';
            }
            dom.inspectorClose.focus({ preventScroll: true });
            return;
        }
        if (!modeledProduct) {
            openGeneratedProductInspector(productId);
            return;
        }

        releaseTourPointerLock();
        clearProductTarget();

        if (!modeledProduct.highQualityMeshes && loadModeledProduct) {
            canvas.style.cursor = 'progress';
            if (dom.hoverPromptName) dom.hoverPromptName.textContent = 'Ürün yükleniyor…';
            if (dom.hoverPromptDesc) dom.hoverPromptDesc.textContent = 'İlk açılış birkaç saniye sürebilir.';
            if (dom.hoverPrompt) dom.hoverPrompt.classList.remove('hidden');
            try {
                await loadModeledProduct(productId);
            } catch (error) {
                console.error('Yüksek kaliteli ürün yüklenemedi:', error);
                if (dom.hoverPromptName) dom.hoverPromptName.textContent = 'Ürün yüklenemedi';
                if (dom.hoverPromptDesc) dom.hoverPromptDesc.textContent = 'Bağlantıyı kontrol edip yeniden deneyin.';
                canvas.style.cursor = 'pointer';
                return;
            }
        }

        if (dom.hoverPrompt) dom.hoverPrompt.classList.add('hidden');
        canvas.style.cursor = 'default';
        openModeledProductInspector(productId, targetMesh);
    };

    const setEditorMode = (enabled) => {
        isEditorMode = Boolean(enabled);
        document.body.classList.toggle('tour-editor-active', isEditorMode);
        if (isEditorMode) {
            releaseTourPointerLock();
            clearProductTarget();
        }
        dom.panel.classList.toggle('hidden', !isEditorMode);
        dom.toggle?.classList.toggle('is-active', isEditorMode);
        dom.toggle?.setAttribute('aria-expanded', String(isEditorMode));
        const toggleLabel = dom.toggle?.querySelector('span:last-child');
        if (toggleLabel) toggleLabel.textContent = isEditorMode ? 'Editörü kapat' : 'Editör modu';
        if (!isEditorMode) {
            cancelPlacement();
            gizmoManager.attachToMesh(null);
            selectedProductId = null;
        } else {
            if (!selectedTriggerId && triggers.length > 0) selectedTriggerId = triggers[0].id;
            setStatus('Yeni bir ürün dizisi başlatın veya listedeki dizilerden birini seçin.');
        }
        renderEditor();
    };

    const updateLayoutDraft = () => {
        const trigger = findTrigger();
        if (!trigger) return;
        trigger.layout.count = clamp(Math.round(numberOr(dom.triggerQuantity.value, trigger.layout.count)), 1, MAX_PRODUCTS_PER_TRIGGER);
        trigger.layout.direction = LAYOUT_DIRECTIONS[dom.triggerDirection.value]
            ? dom.triggerDirection.value
            : trigger.layout.direction;
        trigger.layout.spawned = true;
        renderProducts(trigger, true);
        const directionText = LAYOUT_DIRECTIONS[trigger.layout.direction].label;
        dom.productLayoutPreview.textContent = `${trigger.layout.count} adet · ${directionText}`;
        dom.triggerLayoutHint.textContent = `${trigger.layout.count} ürün ${directionText} yerleştirildi`;
        dom.triggerProductCount.textContent = String(trigger.products.length);
        dom.triggerHudProducts.textContent = `${trigger.products.length} ürün · ${directionText}`;
        renderTriggerList();
        persist();
    };

    document.querySelectorAll('[data-add-trigger]').forEach((button) => {
        button.addEventListener('click', () => {
            const productType = button.dataset.addTrigger;
            setStatus(`${PRODUCT_TYPES[productType]?.label || 'Ürün'} dizisi yükleniyor…`, 'active');
            createTriggerInFront(productType);
        });
    });
    document.querySelectorAll('[data-transform-mode]').forEach((button) => {
        button.addEventListener('click', () => setTransformMode(button.dataset.transformMode));
    });

    dom.close.addEventListener('click', () => setEditorMode(false));
    dom.cancelPlacement.addEventListener('click', cancelPlacement);
    dom.placeInFront.addEventListener('click', placeTriggerInFront);
    dom.undoButton.addEventListener('click', undoRemoveTrigger);
    dom.removeTrigger.addEventListener('click', removeSelectedTrigger);
    dom.clearProducts.addEventListener('click', clearSelectedProducts);
    dom.focusTrigger.addEventListener('click', focusSelectedTrigger);
    dom.quickFillProducts.addEventListener('click', fillSelectedTrigger);
    dom.applyTrigger.addEventListener('click', () => {
        const trigger = findTrigger();
        if (!trigger) return;
        updateSelectedTriggerFromForm(true);
        setStatus(`Tek ürün ölçüsü uygulandı; dizideki ${trigger.products.length} ürün aynı ölçüye güncellendi.`, 'success');
    });
    dom.repositionTrigger.addEventListener('click', () => {
        const trigger = findTrigger();
        if (trigger) beginPlacement(trigger.productType, trigger.id);
    });
    dom.regenerate.addEventListener('click', fillSelectedTrigger);
    dom.triggerQuantity.addEventListener('input', updateLayoutDraft);
    dom.triggerDirection.addEventListener('change', updateLayoutDraft);

    dom.triggerName.addEventListener('change', () => updateSelectedTriggerFromForm(false));
    [dom.triggerPosX, dom.triggerPosY, dom.triggerPosZ, dom.triggerRotY].forEach((input) => {
        input.addEventListener('input', () => scheduleTriggerFormUpdate(false));
        input.addEventListener('change', () => updateSelectedTriggerFromForm(false));
    });
    dom.triggerType.addEventListener('change', () => updateSelectedTriggerFromForm(true));
    [dom.triggerWidth, dom.triggerHeight, dom.triggerDepth].forEach((input) => {
        input.addEventListener('input', () => scheduleTriggerFormUpdate(true));
        input.addEventListener('change', () => updateSelectedTriggerFromForm(true));
    });
    [dom.triggerLightIntensity, dom.triggerLightRange, dom.triggerLightColor].forEach((input) => {
        input.addEventListener('input', () => scheduleTriggerFormUpdate(true));
        input.addEventListener('change', () => updateSelectedTriggerFromForm(true));
    });
    dom.triggerGap.addEventListener('input', () => {
        dom.triggerGapValue.textContent = `${Math.round(Number(dom.triggerGap.value) * 100)} cm`;
        scheduleTriggerFormUpdate(true);
    });
    dom.triggerGap.addEventListener('change', () => updateSelectedTriggerFromForm(true));

    dom.productForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const match = findProduct();
        if (!match) return;
        match.product.brand = dom.productBrand.value.trim().slice(0, 80);
        match.product.name = dom.productName.value.trim().slice(0, 100) || 'Ürün';
        match.product.price = dom.productPrice.value.trim().slice(0, 40);
        match.product.description = dom.productDescription.value.trim().slice(0, 600);
        match.product.properties = dom.productProperties.value.trim().slice(0, 600);
        match.product.color = dom.productColor.value;
        renderProducts(match.trigger, true);
        selectedProductId = match.product.id;
        persist();
        renderEditor();
        setStatus('Ürün bilgileri kaydedildi.', 'success');
    });
    dom.previewProduct.addEventListener('click', () => {
        if (selectedProductId) openInspector(selectedProductId);
    });
    dom.inspectorClose.addEventListener('click', closeInspector);
    dom.inspectorDone.addEventListener('click', closeInspector);

    const pickInspectableProduct = (screenX, screenY, fastOnly = false) => {
        let pick = scene.pick(screenX, screenY, isInspectableProductMesh, fastOnly, camera);
        if (pick?.hit && pick.pickedMesh) return pick.pickedMesh;

        const offsets = fastOnly
            ? [[0, -10], [0, 10], [-10, 0], [10, 0]]
            : [
                [0, -12], [0, 12], [-12, 0], [12, 0],
                [-20, -20], [20, -20], [-20, 20], [20, 20],
                [0, -28], [0, 28], [-28, 0], [28, 0]
            ];
        for (const [ox, oy] of offsets) {
            pick = scene.pick(screenX + ox, screenY + oy, isInspectableProductMesh, fastOnly, camera);
            if (pick?.hit && pick.pickedMesh) return pick.pickedMesh;
        }

        return null;
    };

    let hoveredProductId = null;
    let lastCenteredCheckAt = 0;

    const updateProductTarget = (pickedMesh) => {
        const productId = pickedMesh?.metadata?.productId
            || pickedMesh?.metadata?.modeledProductId
            || null;
        if (!productId) {
            clearProductTarget();
            return;
        }

        if (hoveredProductId !== productId) highlightProduct(productId);
        hoveredProductId = productId;
        dom.aimReticle.classList.add('is-targeting');
        const product = findRegisteredProduct(productId) || findModeledProduct(productId) || findProduct(productId)?.product;
        if (product && dom.hoverPrompt) {
            const name = product.details?.name || product.name || 'Optik Gözlük';
            const rawPrice = product.details?.price ?? product.price ?? '';
            const price = Number.isFinite(Number(rawPrice))
                ? `${Number(rawPrice).toLocaleString('tr-TR')} ${product.currency || 'TRY'}`
                : rawPrice;
            if (dom.hoverPromptName) dom.hoverPromptName.textContent = price ? `${name} · ${price}` : name;
            if (dom.hoverPromptDesc) dom.hoverPromptDesc.textContent = 'Sol tıkla ürünü incele';
            dom.hoverPrompt.classList.remove('hidden');
        }
    };

    const updateCenteredProductTarget = () => {
        if (isBindingEditorOpen() || isEditorMode || !isTourControlActive() || !dom.inspector.classList.contains('hidden')) {
            clearProductTarget();
            return;
        }
        const now = performance.now();
        if (now - lastCenteredCheckAt < 90) return;
        lastCenteredCheckAt = now;
        const rect = canvas.getBoundingClientRect();
        updateProductTarget(pickInspectableProduct(rect.width * 0.5, rect.height * 0.5, true));
    };
    const centeredProductObserver = scene.onBeforeRenderObservable.add(updateCenteredProductTarget);
    const mouseLookObserver = scene.onBeforeRenderObservable.add(() => {
        if (isEditorMode || !isTourControlActive() || !dom.inspector.classList.contains('hidden')) return;
        if (!pendingLookX && !pendingLookY) return;

        const blend = Math.min(1, scene.getEngine().getDeltaTime() * 0.022);
        const stepX = pendingLookX * blend;
        const stepY = pendingLookY * blend;
        pendingLookX -= stepX;
        pendingLookY -= stepY;

        const sensitivity = Number.isFinite(camera.angularSensibility) && camera.angularSensibility > 0
            ? camera.angularSensibility
            : 1500;
        const currentYaw = Number.isFinite(camera.rotation.y) ? camera.rotation.y : 0;
        const currentPitch = Number.isFinite(camera.rotation.x) ? camera.rotation.x : 0;
        camera.rotation.y = currentYaw - stepX / sensitivity;
        camera.rotation.x = Math.max(-1.35, Math.min(1.35, currentPitch - stepY / sensitivity));
        camera.cameraRotation.setAll(0);
    });

    const handlePointerLockChange = () => {
        const locked = isTourPointerLocked();
        document.body.classList.toggle('pointer-locked', locked);
        if (locked) {
            delete document.body.dataset.pointerLockError;
            dom.hoverPrompt?.classList.add('hidden');
            ignoreMouseLookUntil = performance.now() + 140;
        }
        else {
            pendingLookX = 0;
            pendingLookY = 0;
            clearProductTarget();
        }
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    const handleTourPointerLeave = () => {
        if (!isTourPointerLocked()) {
            clearProductTarget();
        }
    };
    canvas.addEventListener('pointerleave', handleTourPointerLeave);

    canvas.addEventListener('pointermove', (event) => {
        if (isBindingEditorOpen()) return;
        if (!isEditorMode) {
            if (isTourControlActive() && dom.inspector.classList.contains('hidden')) {
                if (performance.now() < ignoreMouseLookUntil) return;
                // Odak geri döndüğünde gelen büyük tekil imleç sıçramalarını yumuşatır.
                const movementX = Math.max(-80, Math.min(80, event.movementX || 0));
                const movementY = Math.max(-80, Math.min(80, event.movementY || 0));
                if (!movementX && !movementY) return;
                pendingLookX = Math.max(-120, Math.min(120, pendingLookX + movementX));
                pendingLookY = Math.max(-120, Math.min(120, pendingLookY + movementY));
            }
            return;
        }
        if (!placementType || !placementTargetTriggerId) return;
        const now = performance.now();
        if (now - lastPlacementPreviewAt < 40) return;
        lastPlacementPreviewAt = now;

        const target = findTrigger(placementTargetTriggerId);
        if (!target) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const pick = scene.pick(x, y, (mesh) => tourMeshSet.has(mesh), false, camera);
        if (!pick?.hit || !pick.pickedPoint) return;
        const normal = pick.getNormal?.(true, true) || Vector3.Up();
        target.position = {
            x: round(pick.pickedPoint.x, 3),
            y: round(pick.pickedPoint.y + (normal.y > 0.35 ? target.size.height * 0.5 : 0), 3),
            z: round(pick.pickedPoint.z, 3)
        };
        updateTriggerTransform(target);
    }, true);

    canvas.addEventListener('pointerdown', (event) => {
        if (isBindingEditorOpen()) return;
        if (event.button !== 0 || dom.inspector.classList.contains('hidden') === false) return;
        if (!isEditorMode) {
            event.preventDefault();
            if (!isTourControlActive()) {
                clearProductTarget();
                requestTourPointerLock();
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const pickedMesh = pickInspectableProduct(rect.width * 0.5, rect.height * 0.5);
            if (pickedMesh) {
                const productId = pickedMesh.metadata?.productId
                    || pickedMesh.metadata?.modeledProductId;
                if (productId) void openInspector(productId, pickedMesh);
            } else if (!isTourPointerLocked()) {
                requestTourPointerLock();
            }
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (gizmoManager.isHovered) {
            camera.detachControl();
            cameraSuspendedForGizmo = true;
            return;
        }

        if (placementType) {
            const pick = scene.pick(x, y, (mesh) => tourMeshSet.has(mesh), false, camera);
            if (pick?.hit && pick.pickedPoint) {
                const normal = pick.getNormal?.(true, true) || Vector3.Up();
                const target = placementTargetTriggerId ? findTrigger(placementTargetTriggerId) : null;
                if (target) moveTriggerTo(target, pick.pickedPoint, normal.y > 0.35);
                else createTriggerAt(placementType, pick.pickedPoint, normal.y > 0.35);
            } else {
                setStatus('Bir yüzey seçilemedi. Rafa biraz daha yaklaşın veya kameranın önüne yerleştirin.', 'error');
            }
            return;
        }

        if (gizmoManager.isHovered || gizmoManager.isDragging) return;

        const pickedMesh = pickInspectableProduct(x, y);
        if (pickedMesh) {
            const productId = pickedMesh.metadata.productId
                || pickedMesh.metadata.modeledProductId;
            if (pickedMesh.metadata.modeledProductId) openInspector(productId, pickedMesh);
            else selectProduct(productId);
            return;
        }

        const triggerPick = scene.pick(x, y, (mesh) => Boolean(mesh.metadata?.isProductRowHandle), false, camera);
        if (triggerPick?.hit) selectTrigger(triggerPick.pickedMesh.metadata.triggerId);
    }, true);

    const restoreCameraAfterGizmo = () => {
        if (!cameraSuspendedForGizmo) return;
        cameraSuspendedForGizmo = false;
        if (dom.inspector.classList.contains('hidden')) camera.attachControl(canvas, true);
    };
    window.addEventListener('pointerup', restoreCameraAfterGizmo, true);
    window.addEventListener('pointercancel', restoreCameraAfterGizmo, true);

    window.addEventListener('keydown', (event) => {
        if (isBindingEditorOpen()) return;
        if (event.key === 'Escape') {
            if (!dom.inspector.classList.contains('hidden')) closeInspector();
            else if (placementType) cancelPlacement();
            else if (isEditorMode) setEditorMode(false);
            return;
        }

        if ((event.key === 'e' || event.key === 'E') && !isEditorMode && dom.inspector.classList.contains('hidden')) {
            const rect = canvas.getBoundingClientRect();
            const pickedMesh = pickInspectableProduct(rect.width / 2, rect.height / 2);
            if (pickedMesh) {
                const productId = pickedMesh.metadata?.productId
                    || pickedMesh.metadata?.modeledProductId;
                if (productId) {
                    openInspector(productId, pickedMesh);
                    if (dom.hoverPrompt) dom.hoverPrompt.classList.add('hidden');
                    return;
                }
            }
        }
    });
    window.addEventListener('resize', () => previewEngine?.resize(), { passive: true });

    setTransformMode('move');
    renderEditor();

    return {
        openProduct(productOrId) {
            const productId = typeof productOrId === 'string' ? productOrId : productOrId?.id;
            if (productId) void openInspector(productId);
        },
        dispose({ preserveSceneProducts = false } = {}) {
            closeInspector();
            releaseTourPointerLock();
            window.clearTimeout(formUpdateTimer);
            window.clearTimeout(undoTimer);
            window.removeEventListener('pointerup', restoreCameraAfterGizmo, true);
            window.removeEventListener('pointercancel', restoreCameraAfterGizmo, true);
            scene.onBeforeRenderObservable.remove(triggerHudObserver);
            scene.onBeforeRenderObservable.remove(centeredProductObserver);
            scene.onBeforeRenderObservable.remove(mouseLookObserver);
            document.removeEventListener('pointerlockchange', handlePointerLockChange);
            canvas.removeEventListener('pointerleave', handleTourPointerLeave);
            document.body.classList.remove('pointer-locked', 'tour-editor-active');
            gizmoManager.dispose();
            triggerRuntime.forEach((runtime, triggerId) => {
                removeTriggerRuntime(triggerId);
                runtime.mesh.dispose(false, false);
            });
            triggerMaterial.dispose();
            selectedTriggerMaterial.dispose();
            productMaterials.forEach((material) => material.dispose());
            if (!preserveSceneProducts) sceneProducts?.dispose?.();
        }
    };
};
