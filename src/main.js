import './style.css';
import './store-entry-cinematic.css';

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene, ScenePerformancePriority } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Material } from '@babylonjs/core/Materials/material';
import { BackgroundMaterial } from '@babylonjs/core/Materials/Background/backgroundMaterial';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression';
import { ReflectionProbe } from '@babylonjs/core/Probes/reflectionProbe';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import meshoptDecoderUrl from '@babylonjs/core/assets/meshopt/meshopt_decoder.js?url';
import { GLTFLoaderDefaultOptions } from '@babylonjs/loaders/glTF/glTFFileLoader';
import { createTourEditor } from './editor.js';
import { createModeledProductCatalog } from './product-catalog.js';
import { createHighQualityProductViewer } from './high-quality-product-viewer.js';
import { hardwareScalingForDpr } from './render-resolution.js';
import { createProductSearchHighlight } from './product-search-highlight.js';
import { createEnvironmentExperience } from './environment-experience.js';
import { createSceneAssetPreloader } from './scene-asset-preloader.js';
import { createStoreEntryCinematic } from './store-entry-cinematic.js';
import { createSelectionWorld } from './selection-world.js';
import {
    combineProductData,
    createProductRegistry
} from './product-registry.js';
import { applyProductBindings, registerRuntimeProducts } from './product-runtime-bindings.js';
import productData from './data/products.json';
import bindingData from './data/scene-product-bindings.json';
import nisantasiProductMatches from './data/mawus-product-matches.js';
import telefonProductMatches from './data/telefon-product-matches.js';
import { resolveSudeProduct, sudeProducts } from './data/sude-product-matches.js';
import { loadMawusProductPrices } from './gold-pricing.js';
import storeAnchors from './store-anchors.json';
import {
    containsXZ,
    createStoreSpatialLimits
} from './store-streaming-policy.js';
import { createNavigationColliderSpecs } from './navigation-colliders.js';

import '@babylonjs/core/Collisions/collisionCoordinator';
import '@babylonjs/core/Culling/Octrees/octreeSceneComponent';
import '@babylonjs/core/Engines/Extensions/engine.query';
import '@babylonjs/core/Engines/AbstractEngine/abstractEngine.timeQuery';
import '@babylonjs/core/Materials/Textures/Loaders/ktxTextureLoader';
import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2';
import * as KTX2DecoderModule from '@babylonjs/ktx2decoder';
import mscTranscoderScriptUrl from '@babylonjs/ktx2decoder/wasm/msc_basis_transcoder.js?url';
import mscTranscoderWasmUrl from '@babylonjs/ktx2decoder/wasm/msc_basis_transcoder.wasm?url';
import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/loaders/glTF';

const PUBLIC_ROOT = import.meta.env.BASE_URL;
const SCENE_ASSET_VARIANT = import.meta.env.MODE === 'etc1s' ? 'etc1s' : 'original';
KTX2DecoderModule.MSCTranscoder.JSModuleURL = mscTranscoderScriptUrl;
KTX2DecoderModule.MSCTranscoder.WasmModuleURL = mscTranscoderWasmUrl;
KhronosTextureContainer2.DefaultNumWorkers = 0;
KhronosTextureContainer2._KTX2DecoderModule = KTX2DecoderModule;
const MODEL_ROOT = `${PUBLIC_ROOT}models/guzel-optik/`;
const SUDE_MODEL_ROOT = `${PUBLIC_ROOT}models/sude-home/`;
const NISANTASI_MODEL_ROOT = `${PUBLIC_ROOT}models/nisantasi/`;
const TELEFON_MODEL_ROOT = `${PUBLIC_ROOT}models/telefon/`;
const ALWAYS_WORLD_ROOT = `${PUBLIC_ROOT}models/world/`;
const OUTSIDE_WORLD_ROOT = SCENE_ASSET_VARIANT === 'etc1s'
    ? `${PUBLIC_ROOT}models/etc1s/world/`
    : `${PUBLIC_ROOT}models/world/`;
const GUZEL_SCENE_ROOT = SCENE_ASSET_VARIANT === 'etc1s'
    ? `${PUBLIC_ROOT}models/materials-optimized/etc1s/guzel-optik/`
    : MODEL_ROOT;
const SUDE_SCENE_ROOT = SUDE_MODEL_ROOT;
const NISANTASI_SCENE_ROOT = NISANTASI_MODEL_ROOT;
const TELEFON_SCENE_ROOT = TELEFON_MODEL_ROOT;
const SCENE_CACHE_NAME = 'uzuncarsi-scenes-v16';
const versionedAsset = (filename, revision) => `${filename}?asset=${revision}`;
const ENVIRONMENT_FILE = versionedAsset('store-environment.glb', '17759e7e');
const PRODUCT_PROXY_FILE = 'product-proxies.glb';
const PRODUCT_LIBRARY_FILE = 'product-library.glb';
const PRODUCT_MANIFEST_FILE = 'products.json';
const WORLD_ENVIRONMENT_FILE = `${PUBLIC_ROOT}environments/store-ocean-sky.hdr`;
const SUDE_RAW_FILE = versionedAsset('store-raw.glb', '64aea422');
const NISANTASI_RAW_FILE = versionedAsset('store-raw.glb', '8993ca9d');
const TELEFON_RAW_FILE = versionedAsset('store-raw.glb', 'f33d73f5');
const ALWAYS_WORLD_FILE = versionedAsset('always.glb', 'dcf64790');
const OUTSIDE_WORLD_FILE = versionedAsset('outside.glb', 'b1f71887');
const SELECTION_WORLD_FILE = versionedAsset('selection-world.glb', 'd68008ad');
const QUALITY_STORAGE_KEY = 'uzunCarsi:storeQuality:v3';
const SHADOWS_DISABLED = new URLSearchParams(window.location.search).get('shadows') === 'off';
const OUTSIDE_ONLY_TEST = new URLSearchParams(window.location.search).get('outsideOnly') === '1';
const STORE_RENDER_ENTER_PADDING = 42;
const STORE_RENDER_EXIT_PADDING = 48;
const STORE_INSIDE_ENTER_DEPTH = 1.25;
const STORE_INSIDE_EXIT_DEPTH = 0.35;
const PLAYER_EYE_HEIGHT = 1.92;
// Web tabanlı birinci şahıs gezintisi için yürüme ve hızlanma arasındaki farkı küçük tutar.
const PLAYER_WALK_SPEED = 0.21;
const PLAYER_SPRINT_SPEED = 0.31;
const PLAYER_COLLISION_RADIUS = 0.15;
const PLAYER_MAX_STEP_HEIGHT = 0.52;
const PLAYER_STEP_LOOKAHEAD = 0.46;

const worldBoundsForStore = (storeId) => {
    const anchor = storeAnchors.stores[storeId];
    if (!anchor) throw new Error(`Dünya koordinatı bulunamadı: ${storeId}`);
    return {
        center: Vector3.FromArray(anchor.center),
        floorY: anchor.floorY,
        ...anchor.bounds,
        entrance: Vector3.FromArray(anchor.entrance),
        entranceTarget: Vector3.FromArray(anchor.entranceTarget)
    };
};

const STORES = Object.freeze({
    'guzel-optik': {
        id: 'guzel-optik',
        name: 'Güzel Optik Lens',
        shortName: 'Güzel Optik',
        type: 'packaged',
        modelRoot: MODEL_ROOT,
        sceneRoot: GUZEL_SCENE_ROOT,
        sceneFile: ENVIRONMENT_FILE,
        proxyFile: null,
        libraryFile: PRODUCT_LIBRARY_FILE,
        manifestFile: PRODUCT_MANIFEST_FILE,
        itemCount: '91 Gözlük Modeli',
        category: 'Optik & Gözlük',
        description: 'Optik çerçeve ve güneş gözlüğü kataloğu.',
        image: `${PUBLIC_ROOT}assets/guzel_optik_cover.png`,
        icon: '👓',
        bounds: worldBoundsForStore('guzel-optik')
    },
    'sude-home': {
        id: 'sude-home',
        name: 'Sude Home',
        shortName: 'Sude Home',
        type: 'raw',
        modelRoot: SUDE_MODEL_ROOT,
        sceneRoot: SUDE_SCENE_ROOT,
        sceneFile: SUDE_RAW_FILE,
        itemCount: '28 Ürün',
        category: 'Züccaciye & Ev Yaşam',
        description: 'Mutfak, sofra ve ev ürünleri kataloğu.',
        image: `${PUBLIC_ROOT}assets/sude_store.svg`,
        icon: '🍽️',
        bounds: worldBoundsForStore('sude-home')
    },
    'nisantasi': {
        id: 'nisantasi',
        name: 'Nişantaşı Kuyumculuk',
        shortName: 'Nişantaşı',
        type: 'raw-jewelry',
        modelRoot: NISANTASI_MODEL_ROOT,
        sceneRoot: NISANTASI_SCENE_ROOT,
        sceneFile: NISANTASI_RAW_FILE,
        itemCount: '17 Ürün',
        category: 'Kuyumculuk & Mücevher',
        description: 'Altın ve mücevher ürünleri kataloğu.',
        image: `${PUBLIC_ROOT}assets/mawus_store.svg`,
        icon: '💍',
        bounds: worldBoundsForStore('nisantasi')
    },
    'telefon': {
        id: 'telefon',
        name: 'Zeka Teknoloji',
        shortName: 'Zeka Teknoloji',
        type: 'raw-telefon',
        modelRoot: TELEFON_MODEL_ROOT,
        sceneRoot: TELEFON_SCENE_ROOT,
        sceneFile: TELEFON_RAW_FILE,
        itemCount: '52 Ürün',
        category: 'Telefon & Aksesuar',
        description: 'Cep telefonu, kılıf ve aksesuar kataloğu.',
        image: `${PUBLIC_ROOT}assets/optik_store.svg`,
        icon: '📱',
        bounds: worldBoundsForStore('telefon')
    }
});

const QUALITY_LEVELS = {
    performance: {
        label: 'Performans', targetFps: 45, maxDpr: 1.15, initialScale: 1.12, maxScale: 2.1,
        fxaa: true, ssao: false, bloom: false, sharpen: true, sharpenColor: 1, pipelineSamples: 1, shadowSize: 512,
        reflectionSize: 64, textureAnisotropy: 4, glassPrepass: false
    },
    balanced: {
        label: 'Dengeli', targetFps: 48, maxDpr: 1.45, initialScale: 1.0, maxScale: 1.85,
        fxaa: true, ssao: true, bloom: true, sharpen: true, sharpenColor: 1, pipelineSamples: 2, shadowSize: 1024,
        reflectionSize: 128, textureAnisotropy: 8, glassPrepass: false
    },
    quality: {
        label: 'Yüksek', targetFps: 50, maxDpr: 1.8, initialScale: 1.0, maxScale: 1.55,
        fxaa: true, ssao: true, bloom: true, sharpen: true, sharpenColor: 1, pipelineSamples: 4, shadowSize: 1536,
        reflectionSize: 256, textureAnisotropy: 16, glassPrepass: true
    }
};

const canvas = document.getElementById('renderCanvas');
const loadingScreen = document.getElementById('loadingScreen');
const loadingStoreName = document.getElementById('loadingStoreName');
const loadingStoreCategory = document.getElementById('loadingStoreCategory');
const loadingStoreIcon = document.getElementById('loadingStoreIcon');
const loadingStatus = document.getElementById('loadingStatus');
const loadingProgress = document.getElementById('loadingProgress');
const loadingPercent = document.getElementById('loadingPercent');
const loadingDetail = document.getElementById('loadingDetail');
const errorScreen = document.getElementById('errorScreen');
const errorMessage = document.getElementById('errorMessage');
const retryButton = document.getElementById('retryButton');
const tourHud = document.getElementById('tourHud');
const qualitySelect = document.getElementById('qualitySelect');
const qualityStatus = document.getElementById('qualityStatus');
const storeSelectPortal = document.getElementById('storeSelectPortal');
const selectionMapScreen = document.getElementById('selectionMapScreen');
const selectionMarkerLayer = document.getElementById('selectionMarkerLayer');
const selectionMapStatus = document.getElementById('selectionMapStatus');
const openCatalogBtn = document.getElementById('openCatalogBtn');
const selectionSearchForm = document.getElementById('selectionSearchForm');
const selectionProductQuery = document.getElementById('selectionProductQuery');
const selectionStoreFilter = document.getElementById('selectionStoreFilter');
const selectionCategoryFilter = document.getElementById('selectionCategoryFilter');
const selectionMinPrice = document.getElementById('selectionMinPrice');
const selectionMaxPrice = document.getElementById('selectionMaxPrice');
const selectionFilterClear = document.getElementById('selectionFilterClear');
const selectionStoreCount = document.getElementById('selectionStoreCount');
const selectionResultSummary = document.getElementById('selectionResultSummary');
const selectionActiveFilterText = document.getElementById('selectionActiveFilterText');
const selectionEmptyState = document.getElementById('selectionEmptyState');
const portalExploreAllBtn = document.getElementById('portalExploreAllBtn');
const activeStoreName = document.getElementById('activeStoreName');
const storeSwitcherBtn = document.getElementById('storeSwitcherBtn');
const worldMapReturnBtn = document.getElementById('worldMapReturnBtn');
const storeSwitcherMenu = document.getElementById('storeSwitcherMenu');
const storeSwitcherList = document.getElementById('storeSwitcherList');
const recentProductBtn = document.getElementById('recentProductBtn');
const recentProductName = document.getElementById('recentProductName');
let storeSwitcherOpenGuard = false;
const storeCards = [...document.querySelectorAll('[data-store-id]')];
const portalProductQuery = document.getElementById('portalProductQuery');
const portalSearchBtn = document.getElementById('portalSearchBtn');
const portalStoreFilter = document.getElementById('portalStoreFilter');
const portalCategoryFilter = document.getElementById('portalCategoryFilter');
const portalMinPrice = document.getElementById('portalMinPrice');
const portalMaxPrice = document.getElementById('portalMaxPrice');
const portalFilterApply = document.getElementById('portalFilterApply');
const portalFilterClear = document.getElementById('portalFilterClear');
const portalResultSummary = document.getElementById('portalResultSummary');
const portalActiveFilterText = document.getElementById('portalActiveFilterText');
const portalEmptyState = document.getElementById('portalEmptyState');
const portalPriceStatus = document.getElementById('portalPriceStatus');
const portalPreloadStatus = document.getElementById('portalPreloadStatus');
const productPreviewStatus = document.getElementById('productPreviewStatus');
const ambientToggle = document.getElementById('ambientToggle');

const productDataset = combineProductData(
    {
        schemaVersion: productData.schemaVersion,
        products: [
            ...productData.products,
            ...nisantasiProductMatches.products,
            ...telefonProductMatches.products
        ]
    },
    {
        schemaVersion: bindingData.schemaVersion,
        bindings: [
            ...bindingData.bindings,
            ...nisantasiProductMatches.bindings,
            ...telefonProductMatches.bindings
        ]
    }
);
const productRegistry = createProductRegistry(productDataset, { autoPersist: false });

MeshoptCompression.Configuration = { decoder: { url: meshoptDecoderUrl } };
GLTFLoaderDefaultOptions.dontUseTransmissionHelper = true;

const setLoadingProgress = (percent, status, detail) => {
    const value = Math.max(4, Math.min(100, Math.round(percent)));
    loadingProgress.style.width = `${value}%`;
    loadingPercent.textContent = `${value}%`;
    if (status) loadingStatus.textContent = status;
    if (detail !== undefined) loadingDetail.textContent = detail;
};

const readQualityPreference = () => {
    try {
        const value = localStorage.getItem(QUALITY_STORAGE_KEY) || 'auto';
        return value === 'auto' || QUALITY_LEVELS[value] ? value : 'auto';
    } catch {
        return 'auto';
    }
};

const detectQuality = (engine) => {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    const renderer = engine.getGlInfo()?.renderer?.toLowerCase() || '';
    const software = /swiftshader|llvmpipe|software/.test(renderer);
    const entryGpu = /intel.*(hd graphics|uhd 6)|vega 3|radeon r[235]\b|geforce (gt [567]|mx1)/.test(renderer);
    const discrete = /(nvidia|geforce|radeon rx|arc\(tm\)|apple m[2-9])/.test(renderer) && !entryGpu;

    if (software || memory <= 4 || cores <= 4 || entryGpu) return 'performance';
    if (memory >= 12 && cores >= 10 && discrete) return 'quality';
    return 'balanced';
};

const createEngine = () => {
    const options = {
        antialias: true,
        powerPreference: 'high-performance',
        audioEngine: false,
        preserveDrawingBuffer: false,
        stencil: true,
        failIfMajorPerformanceCaveat: false,
        doNotHandleContextLost: false,
        useHighPrecisionFloats: false
    };

    try {
        const engine = new Engine(canvas, true, options, true);
        engine.enableOfflineSupport = false;
        engine.useReverseDepthBuffer = true;
        return engine;
    } catch (webgl2Error) {
        console.warn('WebGL2 başlatılamadı; WebGL1 deneniyor.', webgl2Error);
        const engine = new Engine(canvas, true, { ...options, disableWebGL2Support: true }, true);
        engine.enableOfflineSupport = false;
        return engine;
    }
};

const createCamera = (scene, store) => {
    const camera = new UniversalCamera('storeCamera', store.bounds.entrance.clone(), scene);
    camera.setTarget(store.bounds.entranceTarget);
    camera.minZ = 0.055;
    camera.maxZ = 10000;
    // Dar görüş açısı yürüyüşü ağır ve kapalı hissettirir; bu değer masaüstü web gezintisi için dengeli kalır.
    camera.fov = 1.12;
    camera.speed = PLAYER_WALK_SPEED;
    camera.inertia = 0.34;
    camera.angularSensibility = 1850;
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid.copyFromFloats(PLAYER_COLLISION_RADIUS, 0.86, PLAYER_COLLISION_RADIUS);
    camera.ellipsoidOffset.copyFromFloats(0, -0.76, 0);
    camera.keysUp.push(87);
    camera.keysDown.push(83);
    camera.keysLeft.push(65);
    camera.keysRight.push(68);
    camera.attachControl(canvas, true);
    // Fare dönüşü pointer lock sırasında editor.js tarafından uygulanır.
    const mouseInput = camera.inputs.attached.mouse;
    if (mouseInput) camera.inputs.remove(mouseInput);
    return camera;
};

const createCollisionVolume = (scene, store) => {
    const bounds = store.bounds;
    const colliders = [];
    const makeCollider = (name, size, position) => {
        const mesh = MeshBuilder.CreateBox(`${store.id}_${name}`, size, scene);
        mesh.position.copyFrom(position);
        mesh.isVisible = false;
        mesh.isPickable = false;
        mesh.checkCollisions = true;
        mesh.freezeWorldMatrix();
        colliders.push(mesh);
        return mesh;
    };

    makeCollider('storeCollisionFloor', {
        width: bounds.maxX - bounds.minX,
        height: 0.12,
        depth: bounds.maxZ - bounds.minZ
    }, new Vector3(bounds.center.x, bounds.floorY, (bounds.minZ + bounds.maxZ) * 0.5));
    return colliders;
};

const isCollisionExcludedMesh = (mesh) => {
    const label = `${mesh?.name || ''} ${mesh?.material?.name || ''}`.toLowerCase();
    return isProductMesh(mesh)
        || /glass|cam\b|window|lens|ayna|mirror|curtain|perde|light|lamp|led|sign|label|logo|text|price|tag|diamond|gem|jewel|ring|neck|gold|altin|yuzuk|kolye|product/.test(label);
};

const createStoreObstacleColliders = (scene, store, meshes) => {
    const candidates = meshes.flatMap((mesh, index) => {
        if (!mesh?.geometry || mesh.isDisposed?.() || isCollisionExcludedMesh(mesh)) return [];
        try {
            mesh.computeWorldMatrix(true);
            mesh.refreshBoundingInfo(true);
            const box = mesh.getBoundingInfo().boundingBox;
            return [{
                id: `${store.id}:${index}`,
                label: `${mesh.name || ''} ${mesh.material?.name || ''}`,
                productId: mesh.metadata?.productId || mesh.metadata?.modeledProductId || null,
                isProduct: isProductMesh(mesh),
                minimum: box.minimumWorld,
                maximum: box.maximumWorld
            }];
        } catch {
            return [];
        }
    });
    const specs = createNavigationColliderSpecs(candidates, store.bounds, {
        eyeHeight: PLAYER_EYE_HEIGHT,
        maxStepHeight: PLAYER_MAX_STEP_HEIGHT,
        limit: 40
    });
    return specs.map((spec, index) => {
        const collider = MeshBuilder.CreateBox(`${store.id}_navigationCollider_${index}`, {
            width: spec.width,
            height: spec.height,
            depth: spec.depth
        }, scene);
        collider.position.copyFromFloats(spec.position.x, spec.position.y, spec.position.z);
        collider.isVisible = false;
        collider.isPickable = false;
        collider.checkCollisions = true;
        collider.metadata = {
            isNavigationCollider: true,
            storeId: store.id,
            sourceName: spec.sourceName,
            stepHeight: spec.stepHeight
        };
        collider.freezeWorldMatrix();
        return collider;
    });
};

const createComfortMovement = (scene, camera) => {
    let sprinting = false;
    let smoothedSpeed = PLAYER_WALK_SPEED;
    let stepHoldFrames = 0;
    let cachedSceneMeshCount = -1;
    let navigationColliders = [];
    const movementKeys = new Set();
    const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
    const handleKey = (event) => {
        if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') sprinting = event.type === 'keydown';
        if (movementCodes.has(event.code)) {
            if (event.type === 'keydown') movementKeys.add(event.code);
            else movementKeys.delete(event.code);
        }
    };
    const handleBlur = () => {
        sprinting = false;
        movementKeys.clear();
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    window.addEventListener('blur', handleBlur);

    const observer = scene.onBeforeRenderObservable.add(() => {
        const frameRatio = Math.min(2, scene.getEngine().getDeltaTime() / 16.6667);
        if (camera.metadata?.cinematicInputLocked) {
            camera.cameraDirection.setAll(0);
            camera.cameraRotation.setAll(0);
            return;
        }
        const targetSpeed = sprinting ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
        smoothedSpeed += (targetSpeed - smoothedSpeed) * Math.min(1, 0.16 * frameRatio);
        camera.speed = smoothedSpeed;

        const store = Object.values(STORES).find((candidate) => (
            camera.position.x >= candidate.bounds.minX
            && camera.position.x <= candidate.bounds.maxX
            && camera.position.z >= candidate.bounds.minZ
            && camera.position.z <= candidate.bounds.maxZ
        ));
        if (!Number.isFinite(camera.rotation.x) || !Number.isFinite(camera.rotation.y)) {
            const recoveryTarget = store?.bounds.entranceTarget
                || camera.position.add(new Vector3(0, 0, -6));
            camera.rotation.copyFromFloats(0, 0, 0);
            camera.cameraRotation.setAll(0);
            camera.setTarget(recoveryTarget);
        }
        const floorY = store?.bounds.floorY ?? -8.88;
        const standingY = floorY + PLAYER_EYE_HEIGHT;

        let requestedStepHeight = 0;
        if (store && movementKeys.size) {
            if (cachedSceneMeshCount !== scene.meshes.length) {
                cachedSceneMeshCount = scene.meshes.length;
                navigationColliders = scene.meshes.filter((mesh) => mesh.metadata?.isNavigationCollider);
            }
            const forward = camera.getForwardRay(1).direction;
            forward.y = 0;
            if (forward.lengthSquared() > 0.0001) forward.normalize();
            const right = Vector3.Cross(forward, Vector3.Up()).normalize();
            const moveDirection = Vector3.Zero();
            if (movementKeys.has('KeyW')) moveDirection.addInPlace(forward);
            if (movementKeys.has('KeyS')) moveDirection.subtractInPlace(forward);
            if (movementKeys.has('KeyD')) moveDirection.addInPlace(right);
            if (movementKeys.has('KeyA')) moveDirection.subtractInPlace(right);

            if (moveDirection.lengthSquared() > 0.0001) {
                moveDirection.normalize();
                const probeDistance = PLAYER_COLLISION_RADIUS + PLAYER_STEP_LOOKAHEAD;
                const probeX = camera.position.x + moveDirection.x * probeDistance;
                const probeZ = camera.position.z + moveDirection.z * probeDistance;
                const probePadding = PLAYER_COLLISION_RADIUS * 0.72;

                for (const collider of navigationColliders) {
                    const metadata = collider.metadata;
                    if (!metadata?.isNavigationCollider
                        || metadata.storeId !== store.id
                        || !collider.isEnabled()) continue;
                    const stepHeight = Number(metadata.stepHeight) || 0;
                    if (stepHeight <= 0.06 || stepHeight > PLAYER_MAX_STEP_HEIGHT) continue;
                    const box = collider.getBoundingInfo().boundingBox;
                    const min = box.minimumWorld;
                    const max = box.maximumWorld;
                    if (probeX < min.x - probePadding || probeX > max.x + probePadding
                        || probeZ < min.z - probePadding || probeZ > max.z + probePadding) continue;
                    requestedStepHeight = Math.max(requestedStepHeight, stepHeight + 0.025);
                }
            }
        }

        if (requestedStepHeight > 0) {
            // Alçak eşiklerde kamera yüksekliğini korur.
            camera.position.y = Math.max(camera.position.y, standingY + requestedStepHeight);
            camera.cameraDirection.y = 0;
            stepHoldFrames = 5;
        } else if (stepHoldFrames > 0) {
            stepHoldFrames -= 1;
            camera.cameraDirection.y = 0;
        } else {
            const heightError = standingY - camera.position.y;
            if (Math.abs(heightError) <= PLAYER_MAX_STEP_HEIGHT + 0.1) {
                camera.position.y += heightError * Math.min(1, 0.28 * frameRatio);
                if (Math.abs(heightError) < 0.004) camera.position.y = standingY;
                camera.cameraDirection.y = 0;
            } else if (camera.position.y < standingY - 0.08) {
                camera.position.y = standingY;
                camera.cameraDirection.y = Math.max(0, camera.cameraDirection.y);
            }
        }
    });

    return () => {
        scene.onBeforeRenderObservable.remove(observer);
        window.removeEventListener('keydown', handleKey);
        window.removeEventListener('keyup', handleKey);
        window.removeEventListener('blur', handleBlur);
    };
};

const createWorldNavigationFloor = (scene) => {
    const floor = MeshBuilder.CreateBox('worldNavigationFloor', {
        width: 420,
        height: 0.03,
        depth: 260
    }, scene);
    floor.position.copyFromFloats(-40, -8.9, 20);
    floor.isVisible = false;
    floor.isPickable = false;
    floor.checkCollisions = true;
    floor.freezeWorldMatrix();
    return floor;
};

const createStoreStreamingVolumes = (scene) => {
    const volumes = new Map();
    for (const store of Object.values(STORES)) {
        const bounds = store.bounds;
        const limits = createStoreSpatialLimits(bounds, {
            insideEnterDepth: STORE_INSIDE_ENTER_DEPTH,
            insideExitDepth: STORE_INSIDE_EXIT_DEPTH,
            renderEnterPadding: STORE_RENDER_ENTER_PADDING,
            renderExitPadding: STORE_RENDER_EXIT_PADDING
        });
        const createVolume = (kind, limits) => {
            const { minX, maxX, minZ, maxZ } = limits;
            const mesh = MeshBuilder.CreateBox(`${store.id}_${kind}Volume`, {
                width: maxX - minX,
                height: 8,
                depth: maxZ - minZ
            }, scene);
            mesh.position.copyFromFloats((minX + maxX) * 0.5, bounds.floorY + 4, (minZ + maxZ) * 0.5);
            mesh.isVisible = false;
            mesh.isPickable = false;
            mesh.checkCollisions = false;
            mesh.metadata = { storeId: store.id, streamingVolume: kind, minX, maxX, minZ, maxZ };
            mesh.freezeWorldMatrix();
            return {
                mesh,
                contains: (position) => containsXZ(limits, position)
            };
        };
        volumes.set(store.id, {
            store,
            insideEnter: createVolume('insideEnter', limits.insideEnter),
            insideExit: createVolume('insideExit', limits.insideExit),
            proximityEnter: createVolume('proximityEnter', limits.proximityEnter),
            proximityExit: createVolume('proximityExit', limits.proximityExit)
        });
    }
    return volumes;
};

const createWorldEnvironment = (scene) => {
    const environmentTexture = new HDRCubeTexture(
        WORLD_ENVIRONMENT_FILE,
        scene,
        512,
        false,
        true,
        false,
        true
    );
    environmentTexture.name = 'uzuncarsiNaturalEnvironment';
    environmentTexture.rotationY = 1.18;
    scene.environmentTexture = environmentTexture;
    scene.environmentIntensity = 1.35;

    const skyReflection = environmentTexture.clone();
    skyReflection.name = 'uzuncarsiMorningCloudReflection';
    skyReflection.coordinatesMode = Texture.SKYBOX_MODE;
    skyReflection.level = 1.12;

    const skyMaterial = new BackgroundMaterial('uzuncarsiMorningCloudMaterial', scene);
    skyMaterial.reflectionTexture = skyReflection;
    skyMaterial.reflectionBlur = 0;
    skyMaterial.primaryColor = new Color3(0.72, 0.86, 1.0);
    skyMaterial.primaryColorShadowLevel = 0.18;
    skyMaterial.primaryColorHighlightLevel = 0.92;
    skyMaterial.enableNoise = true;
    skyMaterial.backFaceCulling = false;
    skyMaterial.disableDepthWrite = true;

    const skybox = MeshBuilder.CreateBox('uzuncarsiMorningCloudSkybox', { size: 9000 }, scene);
    skybox.material = skyMaterial;
    skybox.isPickable = false;
    skybox.checkCollisions = false;
    skybox.infiniteDistance = true;
    skybox.alwaysSelectAsActiveMesh = true;
    skybox.metadata = { isSkybox: true, excludeFromProductBinding: true };

    return { environmentTexture, skyReflection, skybox, skyMaterial };
};

const configureScene = (engine, quality, store) => {
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    scene.performancePriority = ScenePerformancePriority.Intermediate;
    scene.clearColor = new Color4(0.38, 0.58, 0.82, 1);
    scene.ambientColor = new Color3(0.2, 0.215, 0.24);
    scene.gravity.copyFromFloats(0, -0.32, 0);
    scene.collisionsEnabled = true;
    scene.skipPointerMovePicking = true;

    const camera = createCamera(scene, store);
    const worldEnvironment = createWorldEnvironment(scene);
    const exteriorAmbient = new HemisphericLight('worldExteriorAmbient', new Vector3(0.18, 1, 0.1), scene);
    exteriorAmbient.diffuse = new Color3(0.86, 0.93, 1.0);
    exteriorAmbient.groundColor = new Color3(0.5, 0.47, 0.43);
    exteriorAmbient.intensity = 0.82;
    exteriorAmbient.setEnabled(false);
    const exteriorSun = new DirectionalLight('worldNaturalSun', new Vector3(-0.46, -0.78, 0.42), scene);
    exteriorSun.position.copyFromFloats(-220, 480, -160);
    exteriorSun.diffuse = new Color3(1.0, 0.97, 0.9);
    exteriorSun.specular = new Color3(1.0, 0.98, 0.93);
    exteriorSun.intensity = 1.45;
    exteriorSun.setEnabled(false);
    createWorldNavigationFloor(scene);
    const streamingVolumes = createStoreStreamingVolumes(scene);

    const image = scene.imageProcessingConfiguration;
    image.toneMappingEnabled = true;
    image.toneMappingType = 1;
    image.exposure = 0.56;
    image.contrast = 1.01;
    image.vignetteEnabled = true;
    image.vignetteWeight = 0.16;
    image.vignetteStretch = 0.2;
    image.vignetteColor = new Color4(0.018, 0.02, 0.026, 0);

    const pipeline = new DefaultRenderingPipeline('storePipeline', false, scene, [camera]);
    pipeline.samples = quality.pipelineSamples;
    pipeline.fxaaEnabled = quality.fxaa;
    pipeline.bloomEnabled = quality.bloom;
    pipeline.bloomThreshold = 0.88;
    pipeline.bloomWeight = 0.12;
    pipeline.bloomKernel = 48;
    pipeline.bloomScale = 0.5;
    pipeline.sharpenEnabled = quality.sharpen;
    pipeline.sharpen.edgeAmount = 0.08;
    pipeline.sharpen.colorAmount = quality.sharpenColor;

    let ssao2 = null;
    if (quality.ssao && SSAO2RenderingPipeline.IsSupported) {
        ssao2 = new SSAO2RenderingPipeline(
            'storeSSAO',
            scene,
            { ssaoRatio: 0.5, blurRatio: 0.5 },
            [camera]
        );
        ssao2.radius = 1.15;
        ssao2.totalStrength = 0.72;
        ssao2.maxZ = 32;
        ssao2.minZAspect = 0.18;
        ssao2.samples = 8;
        ssao2.expensiveBlur = false;
    }

    return {
        scene,
        camera,
        pipeline,
        ssao2,
        streamingVolumes,
        worldEnvironment,
        exteriorAmbient,
        exteriorSun
    };
};

const isProductMesh = (mesh) => /^OPTIK_PRODUCT_\d{3}/i.test(mesh.name || '');
const materialName = (material) => String(material?.name || '').toLowerCase();
const isGemMaterial = (material) => /diamond|diamod|gem|crystal|ruby|emerald|sapphire|zümrüt|yakut|drinking glass texture/.test(materialName(material));
const isGlassMaterial = (material) => {
    const name = materialName(material);
    if (isGemMaterial(material)) {
        return false;
    }
    return /(?:^|[_\s.-])(?:glass|cam|lens)(?:$|[_\s.-])/.test(name);
};

const configureMaterials = (container, quality) => {
    const materials = new Set();
    for (const mesh of container.meshes) {
        const candidates = mesh.material?.subMaterials || [mesh.material];
        candidates.filter(Boolean).forEach((material) => materials.add(material));
    }

    for (const material of materials) {
        if (!(material instanceof PBRMaterial)) continue;
        if (material.isFrozen) material.unfreeze();

        const name = materialName(material);
        const importedTransparentGlass = material.transparencyMode === PBRMaterial.PBRMATERIAL_ALPHABLEND
            && material.alpha > 0
            && material.alpha < 0.35;
        const importedTransmission = Boolean(material?.subSurface?.isRefractionEnabled);
        const glass = isGlassMaterial(material)
            || importedTransparentGlass
            || (importedTransmission && !isGemMaterial(material));
        const refractiveGem = importedTransmission && isGemMaterial(material);
        const twoSided = glass || /leaf|plant|foliage|cloth|fabric|flag|paper|label|sign|tabela/.test(name);
        material.backFaceCulling = !twoSided;
        material.twoSidedLighting = twoSided;
        material.maxSimultaneousLights = 5;

        if (glass) {
            if (material.subSurface) {
                material.subSurface.isRefractionEnabled = false;
                material.subSurface.isTranslucencyEnabled = false;
                material.subSurface.refractionTexture = null;
            }
            material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
            const authoredAlpha = material.alpha > 0 && material.alpha < 0.35
                ? material.alpha
                : 0.08;
            material.alpha = /frost|buzlu/.test(name) ? 0.3 : authoredAlpha;
            material.albedoColor = Color3.White();
            material.metallic = 0;
            material.roughness = /frost|buzlu/.test(name) ? 0.48 : 0.06;
            material.environmentIntensity = /frost|buzlu/.test(name) ? 0.16 : 0.08;
            material.directIntensity = /frost|buzlu/.test(name) ? 0.7 : 0.25;
            material.specularIntensity = 0.1;
            material.needDepthPrePass = false;
            material.useRadianceOverAlpha = false;
            material.useSpecularOverAlpha = false;
            material.separateCullingPass = false;
            material.reflectionTexture = null;
        } else if (refractiveGem) {
            material.subSurface.isRefractionEnabled = false;
            material.subSurface.isTranslucencyEnabled = false;
            material.subSurface.refractionTexture = null;
            material.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
            material.alpha = 1;
            material.metallic = 0;
            material.roughness = Math.min(0.2, Math.max(0.06, material.roughness || 0));
            material.environmentIntensity = 1.05;
            material.specularIntensity = 1;
            material.needDepthPrePass = false;
        } else if (
            material.transparencyMode === PBRMaterial.PBRMATERIAL_ALPHABLEND
            && material.albedoTexture?.hasAlpha
            && material.useAlphaFromAlbedoTexture
        ) {
            material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
            material.alphaCutOff = 0.38;
            material.needDepthPrePass = false;
            material.separateCullingPass = false;
        }
    }

    for (const texture of container.textures) texture.anisotropicFilteringLevel = quality.textureAnisotropy;
    return materials;
};

const createLightingRig = (scene, meshes, quality, store) => {
    const bounds = store.bounds;
    const storeLightScale = store.id === 'guzel-optik' ? 0.58 : 1;
    const litMeshes = meshes.filter((mesh) => mesh?.geometry && !mesh.isDisposed?.());
    const ambient = new HemisphericLight(`${store.id}_storeAmbient`, new Vector3(0.12, 1, 0.08), scene);
    ambient.diffuse = new Color3(0.96, 0.97, 1.0);
    ambient.groundColor = new Color3(0.58, 0.54, 0.5);
    ambient.intensity = 1.48 * storeLightScale;
    ambient.includedOnlyMeshes = litMeshes;

    const doorway = new DirectionalLight(`${store.id}_storeDoorwayFill`, new Vector3(0.05, -0.5, -0.86), scene);
    doorway.position.copyFromFloats(bounds.center.x, bounds.floorY + 5.22, bounds.maxZ + 1);
    doorway.diffuse = new Color3(0.94, 0.97, 1.0);
    doorway.specular = new Color3(0.82, 0.87, 0.94);
    doorway.intensity = 1.4 * storeLightScale;
    doorway.autoCalcShadowZBounds = true;
    doorway.shadowOrthoScale = 0.55;
    doorway.includedOnlyMeshes = litMeshes;

    let shadowGenerator = null;
    if (!SHADOWS_DISABLED) {
        shadowGenerator = new ShadowGenerator(quality.shadowSize, doorway, true);
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_LOW;
        shadowGenerator.bias = 0.0018;
        shadowGenerator.normalBias = 0.035;
        shadowGenerator.darkness = 0.34;

        const shadowCasters = meshes
            .filter((mesh) => mesh?.geometry && !mesh.isAnInstance && !isProductMesh(mesh)
                && !/glass|cam|lens|leaf|plant|label|sign|tabela/i.test(`${mesh.name} ${mesh.material?.name || ''}`)
                && mesh.getTotalVertices() > 80)
            .sort((a, b) => b.getTotalVertices() - a.getTotalVertices())
            .slice(0, 36);
        shadowCasters.forEach((mesh) => shadowGenerator.addShadowCaster(mesh, false));
        shadowGenerator.getShadowMap().refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    }

    const fillZ = [bounds.maxZ - 5.5, bounds.center.z, bounds.minZ + 5.5];
    const fillColors = [
        new Color3(1.0, 0.97, 0.91),
        new Color3(1.0, 0.94, 0.86),
        new Color3(0.98, 0.92, 0.84)
    ];
    const interiorFills = fillZ.map((z, index) => {
        const fill = new PointLight(
            `${store.id}_storeInteriorFill_${index + 1}`,
            new Vector3(bounds.center.x, bounds.floorY + 4.85, z),
            scene
        );
        fill.diffuse = fillColors[index];
        fill.specular = new Color3(0.34, 0.32, 0.3);
        fill.intensity = 3.2 * storeLightScale;
        fill.range = 20;
        fill.includedOnlyMeshes = litMeshes;
        return fill;
    });

    return { ambient, doorway, interiorFills, shadowGenerator };
};

const prepareMeshes = (
    meshes,
    cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY
) => {
    for (const mesh of meshes) {
        if (!mesh?.geometry || mesh.isDisposed?.()) continue;
        mesh.checkCollisions = false;
        if (mesh.getClassName?.() !== 'InstancedMesh') {
            mesh.receiveShadows = !isGlassMaterial(mesh.material);
        }
        mesh.cullingStrategy = cullingStrategy;
        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        mesh.freezeWorldMatrix();
    }
};

const createLocalReflection = (scene, meshes, quality, store) => {
    const bounds = store.bounds;
    const probe = new ReflectionProbe('storeLocalReflection', quality.reflectionSize, scene, true, false, true);
    probe.position.copyFromFloats(bounds.center.x, bounds.floorY + 2.42, bounds.center.z + 1.52);
    probe.renderList = meshes.filter((mesh) => mesh?.geometry && !isProductMesh(mesh));
    probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    probe.cubeTexture.level = 0.72;
    return probe;
};

const applyLocalReflections = (materials, reflectionProbe) => {
    for (const material of materials) {
        if (!(material instanceof PBRMaterial)) continue;
        if (isGlassMaterial(material)) {
            material.reflectionTexture = null;
            continue;
        }
        if (!isGlassMaterial(material) && (material.metallic || 0) <= 0.35) continue;
        material.reflectionTexture = reflectionProbe.cubeTexture;
    }
};

const loadProductManifest = async (store) => {
    const response = await fetch(`${store.modelRoot}${store.manifestFile}`);
    if (!response.ok) throw new Error(`Ürün seçim verisi indirilemedi (${response.status}).`);
    const manifest = await response.json();
    if (!Array.isArray(manifest.products) || manifest.products.length === 0) {
        throw new Error('Ürün seçim verisi eksik veya geçersiz.');
    }
    return manifest;
};

const createProductSelectionBoxes = (scene, manifest, displayPlacements = []) => {
    const boxes = [];
    let source = null;
    const productsById = new Map(manifest.products.map((product) => [product.id, product]));
    const records = displayPlacements.length
        ? displayPlacements.map((placement) => ({
            ...productsById.get(placement.productId),
            id: placement.key,
            productId: placement.productId,
            displayPosition: placement.position
        }))
        : manifest.products.map((product) => ({ ...product, productId: product.id }));
    for (const [index, product] of records.entries()) {
        const box = index === 0
            ? MeshBuilder.CreateBox(product.id, { size: 1 }, scene)
            : source.createInstance(product.id);
        if (!source) source = box;
        const displayPosition = product.displayPosition;
        const [x, y, z] = displayPosition?.asArray?.() || product.center;
        const [width, height, depth] = product.size;
        box.position.copyFromFloats(x, y, z);
        box.scaling.copyFromFloats(
            displayPosition ? 0.26 : Math.max(width * 1.18, 0.18),
            displayPosition ? 0.16 : Math.max(height * 1.8, 0.12),
            displayPosition ? 0.26 : Math.max(depth * 1.18, 0.18)
        );
        box.visibility = 0;
        box.isVisible = true;
        box.isPickable = true;
        box.checkCollisions = false;
        box.metadata = {
            modeledProductId: product.productId,
            productId: product.productId,
            sourceName: product.sourceName,
            productVariant: product.variant,
            isProductSelectionBox: true
        };
        box.freezeWorldMatrix();
        boxes.push(box);
    }
    return boxes;
};

const createLazyProductLibrary = (scene, sceneProducts, store) => {
    let libraryContainer = null;
    const bindLibrary = (container) => {
        const libraryCatalog = createModeledProductCatalog(container.meshes);
        for (const [id, highQualityProduct] of libraryCatalog.products) {
            const interactiveProduct = sceneProducts.get(id);
            if (!interactiveProduct) continue;
            interactiveProduct.highQualityMeshes = highQualityProduct.inspectMeshes;
            interactiveProduct.highQualityNames = highQualityProduct.names;
            interactiveProduct.details = highQualityProduct.details;
        }
        return libraryCatalog;
    };
    let libraryPromise = null;
    const load = async (productId) => {
        if (!libraryPromise) {
            libraryPromise = SceneLoader.LoadAssetContainerAsync(store.modelRoot, store.libraryFile, scene)
                .then((container) => {
                    libraryContainer = container;
                    return bindLibrary(container);
                })
                .catch((error) => {
                    libraryPromise = null;
                    throw error;
                });
        }
        await libraryPromise;
        return sceneProducts.get(productId);
    };
    return {
        load,
        get loaded() { return Boolean(libraryContainer); },
        dispose() { libraryContainer?.dispose(); }
    };
};

const rawProductSize = (name) => {
    if (/PAN/i.test(name)) return { width: 0.52, height: 0.34, depth: 0.52 };
    if (/PLATE/i.test(name)) return { width: 0.42, height: 0.42, depth: 0.22 };
    if (/CUT|TOOLS|KNIFE|HOLDER/i.test(name)) return { width: 0.34, height: 0.48, depth: 0.34 };
    if (/COOKSET|_SET_/i.test(name)) return { width: 0.5, height: 0.46, depth: 0.5 };
    if (/POT|KETTLE|TEAPOT|_TEA_/i.test(name)) return { width: 0.38, height: 0.4, depth: 0.38 };
    return { width: 0.36, height: 0.4, depth: 0.36 };
};

const rawProductDetails = (id, sourceName) => {
    const label = sourceName
        .replace(/^SUDE_BK_(?:THEME_M\d+_L\d+_)?/i, '')
        .replace(/^[A-Z]+_\d+_/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return {
        id,
        brand: 'Sude Home',
        name: label || 'Züccaciye Ürünü',
        price: 'Mağazada bilgi alın',
        description: 'Sude Home ürün modeli.',
        properties: 'Mağaza: Sude Home'
    };
};

const createRawSudeProductCatalog = (scene, container, renderMeshes) => {
    const markerPattern = /^SUDE_BK_/i;
    const markers = [...container.transformNodes, ...container.meshes]
        .filter((node, index, list) => markerPattern.test(node?.name || '') && list.indexOf(node) === index);
    const catalogNodes = [...container.transformNodes, ...container.meshes];
    const excludedGroups = /SUDE_HOME_|SUDE_LED_|SPOTCEIL|shelf|wall|floor|ceiling|door|glass|entrance|display.table|niche|store|building/i;
    const geometryMeshes = renderMeshes.filter((mesh) => mesh?.geometry && !mesh.isDisposed?.());

    const rootFor = (mesh) => {
        let current = mesh;
        while (current.parent && current.parent.name !== '__root__') current = current.parent;
        return current;
    };
    const groups = new Map();
    for (const mesh of geometryMeshes) {
        const root = rootFor(mesh);
        if (excludedGroups.test(root.name || '')) continue;
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(mesh);
    }

    const allGroupBounds = [...groups].map(([root, meshes]) => {
        const minimum = new Vector3(Infinity, Infinity, Infinity);
        const maximum = new Vector3(-Infinity, -Infinity, -Infinity);
        for (const mesh of meshes) {
            mesh.computeWorldMatrix(true);
            mesh.refreshBoundingInfo();
            const box = mesh.getBoundingInfo().boundingBox;
            minimum.minimizeInPlace(box.minimumWorld);
            maximum.maximizeInPlace(box.maximumWorld);
        }
        const size = maximum.subtract(minimum);
        return { root, meshes, minimum, maximum, size, center: minimum.add(maximum).scale(0.5) };
    });
    const groupBounds = allGroupBounds
        .filter((group) => Math.max(group.size.x, group.size.y, group.size.z) <= 1.8);

    const distanceToBounds = (point, group) => {
        const dx = Math.max(group.minimum.x - point.x, 0, point.x - group.maximum.x);
        const dy = Math.max(group.minimum.y - point.y, 0, point.y - group.maximum.y);
        const dz = Math.max(group.minimum.z - point.z, 0, point.z - group.maximum.z);
        return Math.hypot(dx, dy, dz);
    };

    const selectionBoxes = [];
    let sourceBox = null;
    const matches = new Map();
    const assignments = markers.flatMap((marker, index) => {
        marker.computeWorldMatrix(true);
        const position = marker.getAbsolutePosition().clone();
        const sourceName = marker.name;
        const nearest = groupBounds
            .map((group) => ({ group, distance: distanceToBounds(position, group), centerDistance: Vector3.Distance(position, group.center) }))
            .sort((a, b) => a.distance - b.distance || a.centerDistance - b.centerDistance)[0];
        if (!nearest) return [];
        const markerProduct = resolveSudeProduct({ rootName: '', sourceName });
        const rootProduct = resolveSudeProduct({ rootName: nearest.group.root.name, sourceName: '' });
        const matchedProduct = markerProduct || rootProduct || resolveSudeProduct({
            rootName: nearest.group.root.name,
            sourceName
        });
        if (!matchedProduct) return [];
        return [{
            matchedProduct,
            position,
            sourceName,
            group: nearest.group,
            size: rawProductSize(sourceName),
            attachMeshes: rootProduct?.id === matchedProduct.id,
            boxName: `sudeProductPick_${String(index + 1).padStart(3, '0')}`
        }];
    });

    const coveredIds = new Set(assignments.map(({ matchedProduct }) => matchedProduct.id));
    for (const candidate of sudeProducts) {
        if (coveredIds.has(candidate.id)) continue;
        const exactGroup = allGroupBounds.find((group) => (
            resolveSudeProduct({ rootName: group.root.name, sourceName: '' })?.id === candidate.id
        ));
        if (!exactGroup) continue;
        assignments.push({
            matchedProduct: candidate,
            position: exactGroup.center.clone(),
            sourceName: exactGroup.root.name,
            group: exactGroup,
            size: {
                width: Math.max(Math.min(exactGroup.size.x + 0.04, 1.8), 0.12),
                height: Math.max(Math.min(exactGroup.size.y + 0.04, 1.8), 0.12),
                depth: Math.max(Math.min(exactGroup.size.z + 0.04, 1.8), 0.12)
            },
            attachMeshes: true,
            boxName: `sudeProductExact_${candidate.id}`
        });
        coveredIds.add(candidate.id);
    }

    const assignedIds = new Set(assignments.map(({ matchedProduct }) => matchedProduct.id));
    for (const candidate of sudeProducts) {
        if (assignedIds.has(candidate.id)) continue;
        const anchor = catalogNodes.find((node) => (
            resolveSudeProduct({ rootName: node.name, sourceName: '' })?.id === candidate.id
        ));
        if (!anchor) continue;
        anchor.computeWorldMatrix(true);
        assignments.push({
            matchedProduct: candidate,
            position: anchor.getAbsolutePosition().clone(),
            sourceName: anchor.name,
            group: { root: anchor, meshes: [] },
            size: rawProductSize(anchor.name),
            attachMeshes: false,
            boxName: `sudeProductAnchor_${candidate.id}`
        });
        assignedIds.add(candidate.id);
    }

    assignments.forEach(({ matchedProduct, position, sourceName, group, size, attachMeshes, boxName }) => {
        const id = matchedProduct.id;
        const box = sourceBox
            ? sourceBox.createInstance(boxName)
            : MeshBuilder.CreateBox(boxName, { size: 1 }, scene);
        if (!sourceBox) sourceBox = box;
        box.position.copyFrom(position);
        box.scaling.copyFromFloats(size.width, size.height, size.depth);
        box.visibility = 0;
        box.isVisible = true;
        box.isPickable = true;
        box.checkCollisions = false;
        box.metadata = {
            modeledProductId: id,
            productId: id,
            sourceName,
            matchedRootName: group.root.name,
            isProductSelectionBox: true
        };
        box.freezeWorldMatrix();
        selectionBoxes.push(box);
        const productMeshes = matches.get(id) || [];
        if (attachMeshes) group.meshes.forEach((mesh) => {
            if (!productMeshes.includes(mesh)) productMeshes.push(mesh);
            mesh.metadata = {
                ...(mesh.metadata || {}),
                productId: id,
                isProductBindingTarget: true
            };
            mesh.isPickable = true;
        });
        matches.set(id, productMeshes);
    });

    const catalog = createModeledProductCatalog(selectionBoxes);
    for (const [id, product] of catalog.products) {
        const sourceName = product.names[0] || id;
        const originalMeshes = matches.get(id) || [];
        product.inspectMeshes = originalMeshes;
        product.highQualityMeshes = originalMeshes;
        product.details = rawProductDetails(
            id,
            selectionBoxes.find((box) => box.metadata?.modeledProductId === id)?.metadata?.sourceName || sourceName
        );
    }
    const unmatchedProductIds = sudeProducts
        .filter(({ id }) => !matches.has(id))
        .map(({ id }) => id);
    return {
        catalog,
        selectionBoxes,
        matchedProducts: matches.size,
        markerCount: markers.length,
        unmatchedProductIds
    };
};

const NISANTASI_ROW_PRODUCTS = Object.freeze([
    'MAWUS_HQ_ALTIN_YUZUK',
    'MAWUS_HQ_ALTIN_YUZUK_TASLI',
    'MAWUS_HQ_ALTIN_KIRMIZI_KALPLI',
    'MAWUS_HQ_ALTIN_KIRMIZI_TAS',
    'MAWUS_HQ_CICEK_KIRMIZI_YUZUK',
    'MAWUS_HQ_CICEK_YUZUK',
    'MAWUS_HQ_ELMAS_YUZUK',
    'MAWUS_HQ_GRI_YUZUK',
    'MAWUS_HQ_YAKUT_YUZUK',
    'MAWUS_HQ_ZUMRUT_YUZUK'
]);

const nisantasiProductIdForName = (name) => {
    const normalized = String(name || '').trim();
    const row = normalized.match(/^MAWUS_ORIGINAL_M0[34]_ROW(\d{2})_SIX_RINGS$/i);
    if (row) return NISANTASI_ROW_PRODUCTS[Number(row[1]) - 1] || null;
    if (/^MAWUS_(?:RING|NECK)_R\d+_C\d+_\d+$/i.test(normalized)) return normalized.toUpperCase();
    if (/^MAWUS_NECKLACE_SET_[A-Z0-9_]+$/i.test(normalized)) return normalized.toUpperCase();
    return null;
};

const nisantasiProductDetails = (id, sourceName) => {
    const ring = sourceName.match(/^MAWUS_RING_R(\d+)_C(\d+)_(\d+)$/i);
    const necklace = sourceName.match(/^MAWUS_NECK_R(\d+)_C(\d+)_(\d+)$/i);
    const row = sourceName.match(/^MAWUS_ORIGINAL_M(\d+)_ROW(\d+)_SIX_RINGS$/i);
    let name = sourceName.replace(/^MAWUS_/, '').replace(/_/g, ' ');
    let description = 'Nişantaşı Kuyumculuk ürün modeli.';
    let properties = 'Mağaza: Nişantaşı Kuyumculuk';
    if (ring) {
        name = `Nişantaşı Yüzük · Sıra ${ring[1]} / Bölüm ${Number(ring[2])} / Model ${ring[3]}`;
        description = 'Yüzük modeli.';
        properties += '\nKategori: Yüzük';
    } else if (necklace) {
        name = `Nişantaşı Kolye · Sıra ${necklace[1]} / Bölüm ${Number(necklace[2])} / Model ${necklace[3]}`;
        description = 'Kolye modeli.';
        properties += '\nKategori: Kolye';
    } else if (row) {
        name = `Altılı Yüzük Serisi · Modül ${Number(row[1])} / Sıra ${Number(row[2])}`;
        description = 'Altı parçalı yüzük seti.';
        properties += '\nKategori: Yüzük Seti';
    } else if (/NECKLACE_SET/i.test(sourceName)) {
        name = 'Kar Tanesi Kolye Seti';
        description = 'Kolye seti.';
        properties += '\nKategori: Kolye Seti';
    }
    return {
        id,
        brand: 'Nişantaşı Kuyumculuk',
        name,
        price: 'Mağazada bilgi alın',
        description,
        properties
    };
};

const createRawNisantasiProductCatalog = (scene, renderMeshes) => {
    const candidates = renderMeshes
        .filter((mesh) => mesh?.geometry && !mesh.isDisposed?.())
        .map((mesh) => {
            let current = mesh;
            let depth = 0;
            while (current && depth < 12) {
                const id = nisantasiProductIdForName(current.name);
                if (id) return { mesh, id, sourceName: current.name };
                current = current.parent;
                depth += 1;
            }
            return { mesh, id: null, sourceName: mesh.name };
        })
        .filter((entry) => entry.id);
    const products = new Map();
    for (const entry of candidates) {
        if (!products.has(entry.id)) products.set(entry.id, { sourceName: entry.sourceName, meshes: [] });
        const product = products.get(entry.id);
        if (!product.meshes.includes(entry.mesh)) product.meshes.push(entry.mesh);
        if (/^MAWUS_NECKLACE_SET_/i.test(entry.sourceName)) {
            entry.mesh.getChildMeshes?.(false).forEach((child) => {
                if (child?.geometry && !product.meshes.includes(child)) product.meshes.push(child);
            });
        }
    }

    const selectionBoxes = [];
    let sourceBox = null;
    for (const [id, product] of products) {
        const minimum = new Vector3(Infinity, Infinity, Infinity);
        const maximum = new Vector3(-Infinity, -Infinity, -Infinity);
        for (const mesh of product.meshes) {
            const bounds = mesh.getBoundingInfo().boundingBox;
            minimum.minimizeInPlace(bounds.minimumWorld);
            maximum.maximizeInPlace(bounds.maximumWorld);
        }
        const rawSize = maximum.subtract(minimum);
        const center = minimum.add(maximum).scale(0.5);
        const isSingleJewelry = /^MAWUS_(?:RING|NECK)_/i.test(product.sourceName);
        const minWidth = isSingleJewelry ? 0.065 : 0.16;
        const minHeight = isSingleJewelry ? 0.07 : 0.12;
        const minDepth = isSingleJewelry ? 0.07 : 0.12;
        const box = sourceBox
            ? sourceBox.createInstance(id)
            : MeshBuilder.CreateBox(id, { size: 1 }, scene);
        if (!sourceBox) sourceBox = box;
        box.position.copyFrom(center);
        box.scaling.copyFromFloats(
            Math.max(rawSize.x + 0.018, minWidth),
            Math.max(rawSize.y + 0.022, minHeight),
            Math.max(rawSize.z + 0.018, minDepth)
        );
        box.visibility = 0;
        box.isVisible = true;
        box.isPickable = true;
        box.checkCollisions = false;
        box.metadata = {
            modeledProductId: id,
            sourceName: product.sourceName,
            isProductSelectionBox: true
        };
        box.freezeWorldMatrix();
        selectionBoxes.push(box);
    }

    const catalog = createModeledProductCatalog(selectionBoxes);
    for (const [id, product] of catalog.products) {
        const source = products.get(id);
        if (!source) continue;
        product.inspectMeshes = source.meshes;
        product.highQualityMeshes = source.meshes;
        product.details = nisantasiProductDetails(id, source.sourceName);
    }
    return {
        catalog,
        selectionBoxes,
        sourceCount: products.size,
        matchedProducts: catalog.productCount
    };
};

const disableLoadedStoreForBackgroundPreparation = ({
    renderMeshes,
    collisionMeshes,
    selectionBoxes,
    lighting
}) => {
    [...(selectionBoxes || []), ...(collisionMeshes || []), ...(renderMeshes || [])]
        .filter((mesh) => mesh?.geometry && !mesh.isDisposed?.())
        .forEach((mesh) => mesh.setEnabled(false));
    [lighting?.ambient, lighting?.doorway, ...(lighting?.interiorFills || [])]
        .filter(Boolean)
        .forEach((light) => light.setEnabled(false));
};

const refreshSceneMaterialsForLighting = (scene) => {
    for (const material of scene?.materials || []) {
        if (material.isFrozen) material.unfreeze();
        material.markAsDirty?.(Material.AllDirtyFlag);
    }
};

const completeStoreRenderingSetup = async ({
    scene,
    materials,
    reflectionProbe,
    background,
    progressDetail = ''
}) => {
    if (!background) {
        await scene.whenReadyAsync();
        setLoadingProgress(92, 'Son ayarlar yapılıyor…', progressDetail);
        scene.render();
    }
    applyLocalReflections(materials, reflectionProbe);
    refreshSceneMaterialsForLighting(scene);
    scene.cleanCachedTextureBuffer();
};

const loadPackagedStore = async (scene, quality, store, { background = false } = {}) => {
    if (!background) setLoadingProgress(10, `${store.shortName} yükleniyor…`, 'Mağaza dosyaları yükleniyor.');
    const transfer = { environment: 0, proxies: 0 };
    const updateTransfer = (key, event) => {
        if (!event.lengthComputable || !event.total) return;
        transfer[key] = event.loaded / event.total;
        const ratio = transfer.environment * 0.9 + transfer.proxies * 0.1;
        if (!background) setLoadingProgress(10 + ratio * 66, 'Mağaza yükleniyor…', `%${Math.round(ratio * 100)}`);
    };
    const [environmentContainer, proxyContainer, manifest] = await Promise.all([
        SceneLoader.LoadAssetContainerAsync(store.sceneRoot, store.sceneFile, scene, (event) => updateTransfer('environment', event)),
        store.proxyFile
            ? SceneLoader.LoadAssetContainerAsync(store.modelRoot, store.proxyFile, scene, (event) => updateTransfer('proxies', event))
            : Promise.resolve(null),
        loadProductManifest(store)
    ]);

    if (!background) setLoadingProgress(79, 'Mağaza açılıyor…', 'Sahne ve etkileşimler hazırlanıyor.');
    environmentContainer.addAllToScene();
    proxyContainer?.addAllToScene();
    const environmentMeshes = [...environmentContainer.meshes];
    const renderMeshes = [
        ...environmentMeshes,
        ...(proxyContainer?.meshes || [])
    ];
    const selectionBoxes = createProductSelectionBoxes(scene, manifest);
    const sceneProducts = createModeledProductCatalog(selectionBoxes);
    const productLibrary = createLazyProductLibrary(scene, sceneProducts, store);
    const materials = configureMaterials({
        meshes: renderMeshes,
        textures: [
            ...environmentContainer.textures,
            ...(proxyContainer?.textures || [])
        ]
    }, quality);
    prepareMeshes(renderMeshes);
    const collisionMeshes = createStoreObstacleColliders(scene, store, renderMeshes);
    const lighting = createLightingRig(scene, renderMeshes, quality, store);
    const reflectionProbe = createLocalReflection(scene, renderMeshes, quality, store);
    if (background) {
        disableLoadedStoreForBackgroundPreparation({
            renderMeshes,
            collisionMeshes,
            selectionBoxes,
            lighting
        });
    }
    await completeStoreRenderingSetup({ scene, materials, reflectionProbe, background });

    return {
        containers: [environmentContainer, proxyContainer].filter(Boolean),
        materials,
        renderMeshes,
        collisionMeshes,
        selectionBoxes,
        sceneProducts,
        productLibrary,
        productMatchStats: {
            sources: 0,
            placed: 0
        },
        lighting,
        reflectionProbe
    };
};

const loadRawSudeStore = async (scene, quality, store, { background = false } = {}) => {
    if (!background) setLoadingProgress(8, 'Sude Home yükleniyor…', 'Mağaza dosyaları yükleniyor.');
    const container = await SceneLoader.LoadAssetContainerAsync(
        store.sceneRoot,
        store.sceneFile,
        scene,
        (event) => {
            if (!event.lengthComputable || !event.total) return;
            const ratio = event.loaded / event.total;
            if (!background) setLoadingProgress(8 + ratio * 68, 'Sude Home yükleniyor…', `%${Math.round(ratio * 100)}`);
        }
    );

    if (!background) setLoadingProgress(79, 'Sude Home açılıyor…', 'Sahne ve etkileşimler hazırlanıyor.');
    container.addAllToScene();
    const renderMeshes = [...container.meshes];
    const productRuntime = createRawSudeProductCatalog(scene, container, renderMeshes);
    qualityStatus.dataset.productMarkers = String(productRuntime.markerCount);
    qualityStatus.dataset.productMatches = String(productRuntime.matchedProducts);
    qualityStatus.dataset.productCatalogCount = String(productRuntime.catalog.productCount);
    qualityStatus.dataset.unmatchedProductIds = productRuntime.unmatchedProductIds.join(',');
    const materials = configureMaterials(
        { meshes: renderMeshes, textures: container.textures },
        { ...quality, textureAnisotropy: Math.max(8, quality.textureAnisotropy) }
    );
    prepareMeshes(renderMeshes);
    const collisionMeshes = createStoreObstacleColliders(scene, store, renderMeshes);
    const lighting = createLightingRig(scene, renderMeshes, quality, store);
    const reflectionProbe = createLocalReflection(scene, renderMeshes, quality, store);
    if (background) {
        disableLoadedStoreForBackgroundPreparation({
            renderMeshes,
            collisionMeshes,
            selectionBoxes: productRuntime.selectionBoxes,
            lighting
        });
    }
    await completeStoreRenderingSetup({
        scene,
        materials,
        reflectionProbe,
        background,
        progressDetail: `${productRuntime.matchedProducts} ürün bulundu.`
    });

    return {
        containers: [container],
        materials,
        renderMeshes,
        collisionMeshes,
        selectionBoxes: productRuntime.selectionBoxes,
        sceneProducts: productRuntime.catalog,
        productLibrary: { load: null, loaded: true, dispose() {} },
        productMatchStats: {
            markers: productRuntime.markerCount,
            matched: productRuntime.matchedProducts
        },
        lighting,
        reflectionProbe
    };
};

const loadRawNisantasiStore = async (scene, quality, store, { background = false } = {}) => {
    if (!background) setLoadingProgress(8, 'Nişantaşı Kuyumculuk yükleniyor…', 'Mağaza dosyaları yükleniyor.');
    const container = await SceneLoader.LoadAssetContainerAsync(
        store.sceneRoot,
        store.sceneFile,
        scene,
        (event) => {
            if (!event.lengthComputable || !event.total) return;
            const ratio = event.loaded / event.total;
            if (!background) setLoadingProgress(8 + ratio * 68, 'Nişantaşı Kuyumculuk yükleniyor…', `%${Math.round(ratio * 100)}`);
        }
    );

    if (!background) setLoadingProgress(79, 'Nişantaşı açılıyor…', 'Sahne ve etkileşimler hazırlanıyor.');
    container.addAllToScene();
    const renderMeshes = [...container.meshes];
    const productRuntime = createRawNisantasiProductCatalog(scene, renderMeshes);
    qualityStatus.dataset.productMarkers = String(productRuntime.sourceCount);
    qualityStatus.dataset.productMatches = String(productRuntime.matchedProducts);
    qualityStatus.dataset.productCatalogCount = String(productRuntime.catalog.productCount);
    const materials = new Set();
    renderMeshes.forEach((mesh) => {
        const candidates = mesh.material?.subMaterials || [mesh.material];
        candidates.filter(Boolean).forEach((material) => materials.add(material));
    });
    container.textures.forEach((texture) => {
        texture.anisotropicFilteringLevel = quality.textureAnisotropy;
    });
    const collisionMeshes = createStoreObstacleColliders(scene, store, renderMeshes);
    const lighting = createLightingRig(scene, renderMeshes, quality, store);
    const reflectionProbe = createLocalReflection(scene, renderMeshes, quality, store);
    if (background) {
        disableLoadedStoreForBackgroundPreparation({
            renderMeshes,
            collisionMeshes,
            selectionBoxes: productRuntime.selectionBoxes,
            lighting
        });
    }
    await completeStoreRenderingSetup({
        scene,
        materials,
        reflectionProbe,
        background,
        progressDetail: `${productRuntime.matchedProducts} ürün bulundu.`
    });

    return {
        containers: [container],
        materials,
        renderMeshes,
        collisionMeshes,
        selectionBoxes: productRuntime.selectionBoxes,
        sceneProducts: productRuntime.catalog,
        productLibrary: { load: null, loaded: true, dispose() {} },
        productMatchStats: {
            markers: productRuntime.sourceCount,
            matched: productRuntime.matchedProducts
        },
        lighting,
        reflectionProbe
    };
};

// Zeka Teknoloji sahnesinde kaydı bulunamayan bir mesh için yedek ad üretir;
// scripts/build-telefon-products.mjs içindeki adlarla aynı kalmalıdır.
const TELEFON_MODEL_ADI = {
    COMPACT: 'Z5 Mini', PROMAX: 'Z9 Pro Max', BAR: 'Z7 Plus',
    BUDGET: 'A3 Lite', RUGGED: 'X6 Active'
};
const TELEFON_FINIS_ADI = {
    DUZ: ['Mat Silikon', 'Siyah'], SERIT: ['Çizgi Dokulu', 'Bej'],
    NOKTA: ['Nokta Dokulu', 'Mercan'], ALTIGEN: ['Petek Dokulu', 'Turkuaz'],
    DOKUMA: ['Örgü Dokulu', 'Haki']
};
const TELEFON_AKSESUAR_ADI = {
    KULAKLIK: ['Air 20 TWS Kablosuz Kulaklık', 'Air 40 ANC Kablosuz Kulaklık'],
    SARJ: ['PD 35W GaN Şarj Adaptörü', 'PD 65W Çift Portlu Şarj Adaptörü'],
    POWERBANK: ['PB10 10.000 mAh Powerbank', 'PB20 20.000 mAh Powerbank'],
    KABLO: ['USB-C Örgü Kablo 1 m', 'USB-C Örgü Kablo 2 m'],
    EKRAN: ['9H Temperli Ekran Koruyucu', 'Hayalet Temperli Ekran Koruyucu']
};

// Sahnede aynı model onlarca kez tekrarlandığından kimlik örnek değil model
// bazında üretilir; böylece 1237 mesh 52 ürüne bağlanır.
const telefonProductIdForName = (name) => {
    const normalized = String(name || '').trim();
    const telefon = normalized.match(/^TEL_(compact|promax|bar|budget|rugged)_Cube_\d+_\d+/i);
    if (telefon) return `TEL_PHONE_${telefon[1].toUpperCase()}`;
    const kilif = normalized.match(/^PK_kilif_([a-z]+)_([a-z]+)_/i);
    if (kilif) return `TEL_BOX_KILIF_${kilif[1].toUpperCase()}_${kilif[2].toUpperCase()}`;
    const aksesuar = normalized.match(/^PK_aks_([a-z]+)_(\d+)_/i);
    if (aksesuar) return `TEL_BOX_${aksesuar[1].toUpperCase()}_${Number(aksesuar[2]) + 1}`;
    return null;
};

const telefonProductDetails = (id) => {
    const telefon = id.match(/^TEL_PHONE_([A-Z]+)$/);
    const kilif = id.match(/^TEL_BOX_KILIF_([A-Z]+)_([A-Z]+)$/);
    const aksesuar = id.match(/^TEL_BOX_([A-Z]+)_(\d+)$/);
    if (telefon) {
        return {
            id,
            brand: 'ZEKA',
            name: `ZEKA ${TELEFON_MODEL_ADI[telefon[1]] || telefon[1]}`,
            price: 'Mağazada bilgi alın',
            description: 'Parçalarına ayırarak iç donanımı inceleyebilirsiniz.',
            properties: 'Mağaza: Zeka Teknoloji\nKategori: Telefon'
        };
    }
    if (kilif) {
        const model = TELEFON_MODEL_ADI[kilif[1]] || kilif[1];
        const [doku, renk] = TELEFON_FINIS_ADI[kilif[2]] || [kilif[2], ''];
        return {
            id,
            brand: 'ARKA',
            name: `ARKA ${model} ${doku} Kılıf${renk ? ` · ${renk}` : ''} (Askılı Paket)`,
            price: 'Mağazada bilgi alın',
            description: 'Raf askılığına takılı perakende ambalajında koruyucu arka kapak.',
            properties: 'Mağaza: Zeka Teknoloji\nKategori: Kılıf'
        };
    }
    if (aksesuar) {
        const modeller = TELEFON_AKSESUAR_ADI[aksesuar[1]];
        const ad = modeller?.[Number(aksesuar[2]) - 1] || `${aksesuar[1]} ${aksesuar[2]}`;
        return {
            id,
            brand: 'VOLT',
            name: `VOLT ${ad}`,
            price: 'Mağazada bilgi alın',
            description: 'Askılık ambalajında telefon aksesuarı.',
            properties: 'Mağaza: Zeka Teknoloji\nKategori: Aksesuar'
        };
    }
    return {
        id,
        brand: 'Zeka Teknoloji',
        name: id,
        price: 'Mağazada bilgi alın',
        description: 'Ürün modeli.',
        properties: 'Mağaza: Zeka Teknoloji'
    };
};

const createRawTelefonProductCatalog = (scene, renderMeshes) => {
    // Kutular ve telefonlar elle tutulur boyutta olduğundan ayrı seçim kutusu
    // üretilmez; mesh'in kendisi tıklanabilir.
    const eslesenler = [];
    for (const mesh of renderMeshes) {
        if (mesh?.isDisposed?.()) continue;
        if (!(mesh?.geometry || mesh?.sourceMesh?.geometry)) continue;
        let current = mesh;
        let depth = 0;
        let id = null;
        let sourceName = mesh.name;
        while (current && depth < 8) {
            id = telefonProductIdForName(current.name);
            if (id) {
                sourceName = current.name;
                break;
            }
            current = current.parent;
            depth += 1;
        }
        if (!id) continue;
        mesh.metadata = { ...(mesh.metadata || {}), modeledProductId: id, sourceName };
        mesh.isPickable = true;
        eslesenler.push(mesh);
    }

    const catalog = createModeledProductCatalog(eslesenler);
    for (const [id, product] of catalog.products) {
        product.inspectMeshes = product.meshes;
        product.highQualityMeshes = product.meshes;
        product.details = telefonProductDetails(id);
    }
    return {
        catalog,
        selectionBoxes: [],
        markerCount: eslesenler.length,
        matchedProducts: catalog.productCount
    };
};

const loadRawTelefonStore = async (scene, quality, store, { background = false } = {}) => {
    if (!background) setLoadingProgress(8, 'Zeka Teknoloji yükleniyor…', 'Mağaza dosyaları yükleniyor.');
    const container = await SceneLoader.LoadAssetContainerAsync(
        store.sceneRoot,
        store.sceneFile,
        scene,
        (event) => {
            if (!event.lengthComputable || !event.total) return;
            const ratio = event.loaded / event.total;
            if (!background) setLoadingProgress(8 + ratio * 68, 'Zeka Teknoloji yükleniyor…', `%${Math.round(ratio * 100)}`);
        }
    );

    if (!background) setLoadingProgress(79, 'Zeka Teknoloji açılıyor…', 'Sahne ve etkileşimler hazırlanıyor.');
    container.addAllToScene();
    const renderMeshes = [...container.meshes];
    const productRuntime = createRawTelefonProductCatalog(scene, renderMeshes);
    qualityStatus.dataset.productMarkers = String(productRuntime.markerCount);
    qualityStatus.dataset.productMatches = String(productRuntime.matchedProducts);
    qualityStatus.dataset.productCatalogCount = String(productRuntime.catalog.productCount);
    const materials = configureMaterials(
        { meshes: renderMeshes, textures: container.textures },
        { ...quality, textureAnisotropy: Math.max(8, quality.textureAnisotropy) }
    );
    prepareMeshes(renderMeshes);
    const collisionMeshes = createStoreObstacleColliders(scene, store, renderMeshes);
    const lighting = createLightingRig(scene, renderMeshes, quality, store);
    const reflectionProbe = createLocalReflection(scene, renderMeshes, quality, store);
    if (background) {
        disableLoadedStoreForBackgroundPreparation({
            renderMeshes,
            collisionMeshes,
            selectionBoxes: productRuntime.selectionBoxes,
            lighting
        });
    }
    await completeStoreRenderingSetup({
        scene,
        materials,
        reflectionProbe,
        background,
        progressDetail: `${productRuntime.matchedProducts} ürün bulundu.`
    });

    return {
        containers: [container],
        materials,
        renderMeshes,
        collisionMeshes,
        selectionBoxes: productRuntime.selectionBoxes,
        sceneProducts: productRuntime.catalog,
        productLibrary: { load: null, loaded: true, dispose() {} },
        productMatchStats: {
            markers: productRuntime.markerCount,
            matched: productRuntime.matchedProducts
        },
        lighting,
        reflectionProbe
    };
};

const loadStore = (scene, quality, store, options) => (
    store.type === 'raw'
        ? loadRawSudeStore(scene, quality, store, options)
        : store.type === 'raw-jewelry'
            ? loadRawNisantasiStore(scene, quality, store, options)
            : store.type === 'raw-telefon'
                ? loadRawTelefonStore(scene, quality, store, options)
                : loadPackagedStore(scene, quality, store, options)
);

const loadAlwaysWorld = async (scene, quality, { reportProgress = true } = {}) => {
    if (reportProgress) {
        setLoadingProgress(6, 'Uzun Çarşı yükleniyor…', 'Ortak çevre dosyası yükleniyor.');
    }
    const container = await SceneLoader.LoadAssetContainerAsync(
        ALWAYS_WORLD_ROOT,
        ALWAYS_WORLD_FILE,
        scene
    );
    container.addAllToScene();
    const renderMeshes = [...container.meshes];
    renderMeshes.forEach((mesh) => {
        mesh.metadata = { ...(mesh.metadata || {}), isAlwaysWorld: true };
    });
    const materials = configureMaterials({ meshes: renderMeshes, textures: container.textures }, quality);
    prepareMeshes(renderMeshes, AbstractMesh.CULLINGSTRATEGY_STANDARD);
    return { container, renderMeshes, materials, rendered: true, desiredRendered: true };
};

const loadOutsideWorld = async (scene, quality, { reportProgress = true } = {}) => {
    if (reportProgress) {
        setLoadingProgress(7, 'Dış alan yükleniyor…', 'Dış mekân dosyası yükleniyor.');
    }
    const container = await SceneLoader.LoadAssetContainerAsync(
        OUTSIDE_WORLD_ROOT,
        OUTSIDE_WORLD_FILE,
        scene
    );
    container.addAllToScene();
    const renderMeshes = [...container.meshes];
    renderMeshes.forEach((mesh) => {
        mesh.metadata = { ...(mesh.metadata || {}), isOutsideWorld: true };
    });
    const materials = configureMaterials(
        { meshes: renderMeshes, textures: container.textures },
        { ...quality, textureAnisotropy: Math.max(8, quality.textureAnisotropy) }
    );
    prepareMeshes(renderMeshes, AbstractMesh.CULLINGSTRATEGY_STANDARD);
    return { container, renderMeshes, materials, rendered: true };
};

const setContainerRendered = (runtime, rendered) => {
    if (!runtime) return Promise.resolve();
    return queueRuntimeActivation(runtime, rendered, {
        visualMeshes: runtime.renderMeshes || [],
        interactionMeshes: []
    });
};

const setStoreRuntimeRendered = (runtime, rendered) => {
    if (!runtime) return Promise.resolve();
    return queueRuntimeActivation(runtime, rendered, {
        visualMeshes: runtime.renderMeshes || [],
        interactionMeshes: [
            ...(runtime.collisionMeshes || []),
            ...(runtime.selectionBoxes || [])
        ]
    });
};

const nextAnimationFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const setRuntimeLightsEnabled = (runtime, enabled) => {
    const lighting = runtime?.lighting;
    if (!lighting) return;
    [lighting.ambient, lighting.doorway, ...(lighting.interiorFills || [])]
        .filter(Boolean)
        .forEach((light) => light.setEnabled(enabled));
    refreshSceneMaterialsForLighting(lighting.ambient?.getScene?.());
};

const setMeshesEnabledWithFrameBudget = async (
    meshes,
    enabled,
    shouldContinue,
    frameBudgetMs = 3.5
) => {
    const candidates = meshes.filter((mesh) => (
        mesh?.geometry
        && !mesh.isDisposed?.()
        && mesh.isEnabled() !== enabled
    ));
    let index = 0;
    while (index < candidates.length && shouldContinue()) {
        const startedAt = performance.now();
        do {
            candidates[index]?.setEnabled(enabled);
            index += 1;
        } while (
            index < candidates.length
            && performance.now() - startedAt < frameBudgetMs
        );
        if (index < candidates.length) await nextAnimationFrame();
    }
};

// Aynı runtime için gelen aç/kapat isteklerini tek kuyruğa alır; yüzlerce mesh tek karede değiştirilmez.
const queueRuntimeActivation = (runtime, rendered, {
    visualMeshes,
    interactionMeshes
}) => {
    runtime.desiredRendered = rendered;
    if (runtime.activationPromise) return runtime.activationPromise;

    runtime.activationPromise = (async () => {
        while (runtime.rendered !== runtime.desiredRendered) {
            const target = runtime.desiredRendered;
            const completeBatch = () => true;
            if (target) {
                setRuntimeLightsEnabled(runtime, true);
                await setMeshesEnabledWithFrameBudget(visualMeshes, true, completeBatch);
                await nextAnimationFrame();
                await setMeshesEnabledWithFrameBudget(interactionMeshes, true, completeBatch, 2.5);
            } else {
                await setMeshesEnabledWithFrameBudget(interactionMeshes, false, completeBatch, 2.5);
                await setMeshesEnabledWithFrameBudget(visualMeshes, false, completeBatch);
                setRuntimeLightsEnabled(runtime, false);
            }
            runtime.rendered = target;
        }
    })().finally(() => {
        runtime.activationPromise = null;
        if (runtime.rendered !== runtime.desiredRendered) {
            void queueRuntimeActivation(runtime, runtime.desiredRendered, { visualMeshes, interactionMeshes });
        }
    });
    return runtime.activationPromise;
};

const disableStoreRuntimeImmediately = (runtime) => {
    [...(runtime.selectionBoxes || []), ...(runtime.collisionMeshes || []), ...(runtime.renderMeshes || [])]
        .filter((mesh) => mesh?.geometry && !mesh.isDisposed?.())
        .forEach((mesh) => mesh.setEnabled(false));
    setRuntimeLightsEnabled(runtime, false);
    runtime.rendered = false;
    runtime.desiredRendered = false;
};

const createStoreStreamingManager = ({
    scene,
    camera,
    quality,
    volumes,
    initialStore,
    initialRuntime,
    outsideRuntime,
    prepareRuntime,
    onStoreContextChanged,
    onEnvironmentChanged
}) => {
    const runtimes = new Map([[initialStore.id, initialRuntime]]);
    const loading = new Map();
    let currentInsideStoreId = null;
    let currentStoreContextId = initialStore.id;
    let updateRunning = false;
    let updateQueued = false;
    let stopped = false;

    initialRuntime.rendered = true;
    initialRuntime.desiredRendered = true;
    outsideRuntime.rendered = true;
    outsideRuntime.desiredRendered = true;

    const ensureRuntime = async (storeId) => {
        if (runtimes.has(storeId)) return runtimes.get(storeId);
        if (loading.has(storeId)) return loading.get(storeId);
        const promise = (async () => {
            const runtime = await loadStore(scene, quality, STORES[storeId], { background: true });
            await prepareRuntime?.(STORES[storeId], runtime);
            disableStoreRuntimeImmediately(runtime);
            runtimes.set(storeId, runtime);
            return runtime;
        })().finally(() => loading.delete(storeId));
        loading.set(storeId, promise);
        return promise;
    };

    const update = async () => {
        if (stopped) return;
        const position = camera.position;
        const retainedInsideStoreId = currentInsideStoreId
            && volumes.get(currentInsideStoreId)?.insideExit.contains(position)
            ? currentInsideStoreId
            : null;
        const enteredInside = retainedInsideStoreId
            ? null
            : [...volumes.entries()].find(([, volume]) => volume.insideEnter.contains(position));
        const insideStoreId = retainedInsideStoreId || enteredInside?.[0] || null;
        if (insideStoreId) await ensureRuntime(insideStoreId);
        if (stopped) return;
        const isOutside = !insideStoreId;
        await setContainerRendered(outsideRuntime, isOutside);

        const wanted = new Set();
        if (insideStoreId) {
            wanted.add(insideStoreId);
        } else {
            for (const [storeId, volume] of volumes) {
                const runtime = runtimes.get(storeId);
            const proximity = (runtime?.desiredRendered ?? runtime?.rendered)
                ? volume.proximityExit
                : volume.proximityEnter;
                if (proximity.contains(position)) wanted.add(storeId);
            }
        }

        for (const [storeId, runtime] of runtimes) {
            await setStoreRuntimeRendered(runtime, wanted.has(storeId));
        }

        for (const storeId of wanted) {
            const runtime = await ensureRuntime(storeId);
            if (stopped) return;
            const volume = volumes.get(storeId);
            const stillWanted = storeId === insideStoreId
                || (!insideStoreId && volume.proximityExit.contains(camera.position));
            await setStoreRuntimeRendered(runtime, stillWanted);
        }

        if (insideStoreId !== currentInsideStoreId) {
            currentInsideStoreId = insideStoreId;
            onEnvironmentChanged?.({ insideStoreId, isInside: Boolean(insideStoreId) });
        }

        qualityStatus.dataset.insideStore = insideStoreId || '';
        qualityStatus.dataset.outsideRendered = String(isOutside);
        qualityStatus.dataset.nearbyStores = [...wanted].join(',');
        qualityStatus.dataset.loadedStores = [...runtimes.keys()].join(',');
        qualityStatus.dataset.renderedStores = [...runtimes]
            .filter(([, runtime]) => runtime.rendered)
            .map(([storeId]) => storeId)
            .join(',');
        const nearbyStoreId = wanted.size === 1 ? [...wanted][0] : null;
        const nextStoreContextId = insideStoreId || nearbyStoreId || currentStoreContextId;
        if (nextStoreContextId !== currentStoreContextId) {
            currentStoreContextId = nextStoreContextId;
            const contextRuntime = await ensureRuntime(nextStoreContextId);
            if (!stopped) onStoreContextChanged?.(nextStoreContextId, contextRuntime);
        }
        activeStoreName.textContent = insideStoreId
            ? STORES[insideStoreId].shortName
            : nearbyStoreId
                ? STORES[nearbyStoreId].shortName
                : 'Uzun Çarşı';
    };

    const requestUpdate = async () => {
        if (updateRunning) {
            updateQueued = true;
            return;
        }
        updateRunning = true;
        try {
            do {
                updateQueued = false;
                await update();
            } while (updateQueued && !stopped);
        } finally {
            updateRunning = false;
        }
    };

    void requestUpdate();
    const timer = window.setInterval(() => { void requestUpdate(); }, 120);
    return {
        runtimes,
        ensureRuntime,
        requestUpdate,
        dispose() {
            stopped = true;
            window.clearInterval(timer);
        }
    };
};

const startAdaptiveQuality = (
    engine,
    quality,
    label,
    rendering,
    instrumentation,
    { lockNativeResolution = false } = {}
) => {
    let lastDpr = window.devicePixelRatio || 1;
    const resolveBaseScale = (dpr = window.devicePixelRatio || 1) => hardwareScalingForDpr({
        devicePixelRatio: dpr,
        maxDpr: lockNativeResolution ? 2 : quality.maxDpr,
        resolutionScale: lockNativeResolution ? 1 : quality.initialScale
    });
    let baseScale = resolveBaseScale(lastDpr);
    let scale = baseScale;
    let lowSamples = 0;
    let highSamples = 0;
    const disabled = SHADOWS_DISABLED ? ['Gölge'] : [];
    engine.setHardwareScalingLevel(scale);

    const shedGpuCost = () => {
        if (rendering.ssao2) {
            rendering.ssao2.dispose();
            rendering.ssao2 = null;
            disabled.push('SSAO');
            return true;
        }
        if (rendering.pipeline.bloomEnabled) {
            rendering.pipeline.bloomEnabled = false;
            disabled.push('Bloom');
            return true;
        }
        return false;
    };

    const timer = window.setInterval(() => {
        if (document.hidden) return;
        const currentDpr = window.devicePixelRatio || 1;
        if (Math.abs(currentDpr - lastDpr) > 0.001) {
            const adaptiveMultiplier = scale / baseScale;
            lastDpr = currentDpr;
            baseScale = resolveBaseScale(currentDpr);
            scale = lockNativeResolution
                ? baseScale
                : Math.min(quality.maxScale, Math.max(baseScale, baseScale * adaptiveMultiplier));
            engine.setHardwareScalingLevel(scale);
            engine.resize();
        }
        const fps = engine.getFps();
        lowSamples = fps < quality.targetFps * 0.86 ? lowSamples + 1 : 0;
        highSamples = fps > quality.targetFps * 1.16 ? highSamples + 1 : 0;

        if (lowSamples >= 2) {
            if (!shedGpuCost() && !lockNativeResolution && scale < quality.maxScale) {
                scale = Math.min(quality.maxScale, scale * 1.12);
                engine.setHardwareScalingLevel(scale);
            }
            lowSamples = 0;
        } else if (highSamples >= 5 && scale > baseScale) {
            scale = Math.max(baseScale, scale / 1.05);
            engine.setHardwareScalingLevel(scale);
            highSamples = 0;
        }

        const fallback = disabled.length ? ` · ${disabled.join(', ')} kapalı` : '';
        const resolution = lockNativeResolution ? ' · Tam çözünürlük' : '';
        qualityStatus.textContent = `${label} · ${Math.round(fps)} FPS${fallback}${resolution}`;
        const activeScene = engine.scenes?.[0];
        qualityStatus.dataset.drawCalls = String(Math.round(instrumentation.drawCallsCounter.current || 0));
        qualityStatus.dataset.activeMeshes = String(activeScene?.getActiveMeshes?.().length ?? '');
        qualityStatus.dataset.hardwareScale = engine.getHardwareScalingLevel().toFixed(2);
        qualityStatus.dataset.renderer = engine.getGlInfo()?.renderer || 'Bilinmiyor';
        if (activeScene?.activeCamera) {
            qualityStatus.dataset.cameraX = activeScene.activeCamera.position.x.toFixed(3);
            qualityStatus.dataset.cameraY = activeScene.activeCamera.position.y.toFixed(3);
            qualityStatus.dataset.cameraZ = activeScene.activeCamera.position.z.toFixed(3);
            qualityStatus.dataset.cameraPitch = activeScene.activeCamera.rotation.x.toFixed(4);
            qualityStatus.dataset.cameraYaw = activeScene.activeCamera.rotation.y.toFixed(4);
        }
    }, 1400);

    return () => window.clearInterval(timer);
};

const showError = (error) => {
    console.error('Güzel Optik sahnesi başlatılamadı:', error);
    loadingScreen.hidden = true;
    loadingScreen.classList.add('hidden');
    tourHud.hidden = true;
    tourHud.classList.add('hidden');
    document.body.classList.remove('tour-active', 'pointer-locked');
    errorMessage.textContent = error instanceof Error
        ? `Sahne yüklenirken hata oluştu: ${error.message}`
        : 'Tarayıcınızın donanım hızlandırmasını kontrol edip sayfayı yenileyin.';
    errorScreen.hidden = false;
    errorScreen.classList.remove('hidden');
};

let tourStarted = false;
let activeTourTravel = null;
let activeTourPrepare = null;
const startTour = async (storeId) => {
    if (tourStarted) return;
    const store = STORES[storeId] || STORES['guzel-optik'];
    tourStarted = true;
    let engine = null;
    loadingStoreName.textContent = store.name;
    loadingStoreCategory.textContent = store.category;
    loadingStoreIcon.textContent = store.icon;
    loadingScreen.hidden = false;
    loadingScreen.classList.remove('hidden', 'is-complete');

    try {
        setLoadingProgress(4, 'Dosyalar kontrol ediliyor…', 'Önbellek kontrol ediliyor.');
        await scenePreloader.prepareEntry(store.id).catch((error) => {
            console.warn('Ön indirme tamamlanamadı; doğrudan sahne yüklemesine geçiliyor.', error);
        });
        setLoadingProgress(5, 'Görüntü açılıyor…', 'Tarayıcı ayarları kontrol ediliyor.');
        engine = createEngine();
        const preference = readQualityPreference();
        const detected = detectQuality(engine);
        const level = preference === 'auto' ? detected : preference;
        const quality = QUALITY_LEVELS[level];
        const qualityLabel = preference === 'auto' ? `Otomatik: ${quality.label}` : `${quality.label} etkin`;
        qualitySelect.value = preference;
        qualityStatus.textContent = qualityLabel;
        qualityStatus.dataset.assetVariant = SCENE_ASSET_VARIANT;
        qualityStatus.dataset.shadows = SHADOWS_DISABLED ? 'off' : 'on';

        const rendering = configureScene(engine, quality, store);
        const { scene, camera } = rendering;
        const environmentExperience = createEnvironmentExperience({ scene, toggleButton: ambientToggle });
        const stopComfortMovement = createComfortMovement(scene, camera);
        if (OUTSIDE_ONLY_TEST) camera.position.z = store.bounds.maxZ + 1;
        if (import.meta.env.DEV) {
            const streamTest = new URLSearchParams(window.location.search).get('streamTest');
            if (streamTest === 'outside') camera.position.z = store.bounds.maxZ + 1;
            if (streamTest === 'far') camera.position.z = store.bounds.maxZ + STORE_RENDER_EXIT_PADDING + 1;
            if (streamTest === 'inside-edge') camera.position.z = store.bounds.entrance.z - 0.3;
            if (streamTest === 'inside-deep') camera.position.z = store.bounds.entrance.z - 1.5;
            if (streamTest === 'render-distance') camera.position.z = store.bounds.maxZ + STORE_RENDER_ENTER_PADDING - 1;
            if (streamTest === 'near-sude') {
                camera.position.x = STORES['sude-home'].bounds.center.x;
                camera.position.z = STORES['sude-home'].bounds.maxZ + 1;
            }
        }
        const instrumentation = new SceneInstrumentation(scene);
        const prepareStoreRuntime = (targetStore, targetRuntime) => {
            registerRuntimeProducts(productRegistry, targetStore, targetRuntime);
            targetRuntime.productBindingStats = applyProductBindings({
                scene,
                registry: productRegistry,
                store: targetStore,
                runtime: targetRuntime
            });
            return targetRuntime;
        };
        let worldRuntime;
        let outsideRuntime;
        let runtime;
        if (OUTSIDE_ONLY_TEST) {
            worldRuntime = { container: null, renderMeshes: [], materials: [] };
            outsideRuntime = await loadOutsideWorld(scene, quality);
            runtime = {
                containers: [],
                renderMeshes: outsideRuntime.renderMeshes,
                selectionBoxes: [],
                sceneProducts: createModeledProductCatalog([]),
                productLibrary: { load: null, loaded: true, dispose() {} },
                productMatchStats: null,
                lighting: null,
                reflectionProbe: { dispose() {} },
                rendered: false
            };
        } else {
            qualityStatus.dataset.initialDownloadGroup = [
                ALWAYS_WORLD_FILE,
                OUTSIDE_WORLD_FILE,
                store.sceneFile
            ].join(',');
            [worldRuntime, runtime, outsideRuntime] = await Promise.all([
                loadAlwaysWorld(scene, quality),
                loadStore(scene, quality, store),
                loadOutsideWorld(scene, quality, { reportProgress: false })
            ]);
            prepareStoreRuntime(store, runtime);
        }
        qualityStatus.dataset.worldFile = OUTSIDE_ONLY_TEST ? '' : ALWAYS_WORLD_FILE;
        qualityStatus.dataset.worldMeshes = String(
            worldRuntime.renderMeshes.filter((mesh) => mesh?.geometry && !mesh.isDisposed?.()).length
        );
        // GLB'ler farklı kök/instance meshleri kullandığı için liste tabanlı
        // aydınlatma bazı yüzeyleri sessizce dışarıda bırakabiliyor. Gündüz
        // ışıkları tüm sahneye uygulanır; mağaza ışıkları yerel kalır.
        rendering.exteriorAmbient.includedOnlyMeshes = [];
        rendering.exteriorSun.includedOnlyMeshes = [];
        rendering.exteriorAmbient.setEnabled(true);
        rendering.exteriorSun.setEnabled(true);
        refreshSceneMaterialsForLighting(scene);
        qualityStatus.dataset.outsideFile = OUTSIDE_WORLD_FILE;
        qualityStatus.dataset.outsideMeshes = String(
            outsideRuntime.renderMeshes.filter((mesh) => mesh?.geometry && !mesh.isDisposed?.()).length
        );
        qualityStatus.dataset.navigationColliders = String(
            scene.meshes.filter((mesh) => mesh.metadata?.isNavigationCollider).length
        );
        qualityStatus.dataset.enabledColliders = String(
            scene.meshes.filter((mesh) => mesh.checkCollisions && mesh.isEnabled()).length
        );
        if (OUTSIDE_ONLY_TEST) {
            qualityStatus.dataset.insideStore = '';
            qualityStatus.dataset.outsideRendered = 'true';
            qualityStatus.dataset.nearbyStores = '';
            qualityStatus.dataset.loadedStores = '';
            qualityStatus.dataset.renderedStores = '';
        }
        let highQualityViewer = null;
        // İnceleme sahnesi araçları: parçalarına ayırma ve kılıf deneme.
        const stageTools = document.getElementById('productStageTools');
        const explodeButton = document.getElementById('productExplodeBtn');
        const caseTray = document.getElementById('productCaseTray');
        const caseOptionsHost = document.getElementById('productCaseOptions');
        const stageHotspots = document.getElementById('productStageHotspots');
        const CASE_SWATCH = {
            DUZ: '#2b2d33', SERIT: '#b9a482', NOKTA: '#e08a6e',
            ALTIGEN: '#4e94a8', DOKUMA: '#6a9c74'
        };
        const EXPLODE_LABEL = {
            kapali: 'Parçalarına ayır',
            aciliyor: 'Ayrılıyor…',
            acik: 'Yeniden birleştir',
            kapaniyor: 'Birleşiyor…'
        };

        const caseProductsFor = (productId) => {
            const match = /^TEL_PHONE_([A-Z]+)$/.exec(String(productId || ''));
            if (!match) return [];
            const onek = `TEL_CASE_${match[1]}_`;
            return productRegistry.filterProducts({ activeOnly: false })
                .filter((entry) => entry.id.startsWith(onek) && entry.highQualityModel)
                .sort((a, b) => String(a.name).localeCompare(String(b.name), 'tr'));
        };

        const setActiveCaseButton = (modelUrl) => {
            if (!caseOptionsHost) return;
            caseOptionsHost.querySelectorAll('.stage-case').forEach((button) => {
                button.setAttribute('aria-pressed',
                    String((button.dataset.modelUrl || '') === (modelUrl || '')));
            });
        };

        const renderExplodeState = (durum) => {
            if (!explodeButton) return;
            const bekliyor = durum.asama === 'aciliyor' || durum.asama === 'kapaniyor';
            explodeButton.querySelector('.stage-tool__label').textContent =
                EXPLODE_LABEL[durum.asama] || EXPLODE_LABEL.kapali;
            explodeButton.setAttribute('aria-pressed', String(durum.acik));
            explodeButton.disabled = bekliyor;
            // Parçalanabilen üründe işaretler ancak parçalar ayrılınca okunur
            // olur; parçalanmayan ürünün işaretleri her zaman görünür kalır.
            if (stageHotspots) {
                stageHotspots.dataset.partsHidden = String(durum.destekli && !durum.acik);
            }
        };

        const buildCaseTray = (product) => {
            if (!caseTray || !caseOptionsHost) return false;
            const cases = caseProductsFor(product?.id);
            caseOptionsHost.replaceChildren();
            if (!cases.length) {
                caseTray.classList.add('hidden');
                return false;
            }
            const ekle = (etiket, modelUrl, renk, ekSinif = '') => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `stage-case ${ekSinif}`.trim();
                button.dataset.modelUrl = modelUrl || '';
                button.setAttribute('aria-pressed', String(!modelUrl));
                const swatch = document.createElement('span');
                swatch.className = 'stage-case__swatch';
                if (renk) swatch.style.setProperty('--case-color', renk);
                const text = document.createElement('span');
                text.textContent = etiket;
                button.append(swatch, text);
                button.addEventListener('click', async () => {
                    try {
                        await highQualityViewer?.setCase(modelUrl || null);
                        setActiveCaseButton(modelUrl || '');
                        if (modelUrl) renderExplodeState(highQualityViewer.explodeState());
                    } catch (error) {
                        console.error('Kılıf yüklenemedi:', error);
                    }
                });
                caseOptionsHost.append(button);
            };
            ekle('Kılıfsız', '', null, 'stage-case--none');
            for (const entry of cases) {
                const finish = entry.id.split('_').pop();
                const etiket = String(entry.name).split('·').pop().trim() || entry.name;
                ekle(etiket, entry.highQualityModel, CASE_SWATCH[finish] || '#888');
            }
            caseTray.classList.remove('hidden');
            return true;
        };

        const setupStageTools = (product) => {
            if (!stageTools) return;
            const durum = highQualityViewer?.explodeState?.() || { destekli: false, asama: 'kapali', acik: false };
            const kilifVar = buildCaseTray(product);
            if (explodeButton) explodeButton.classList.toggle('hidden', !durum.destekli);
            const gorunur = durum.destekli || kilifVar;
            stageTools.classList.toggle('hidden', !gorunur);
            renderExplodeState(durum);
            // Araç çubuğu modelin önünde durduğundan yüksekliği inceleyiciye
            // bildirilir; ayrılan parçalar bu şeridin üzerine taşmaz.
            highQualityViewer?.setBottomInset?.(
                gorunur ? stageTools.offsetHeight + 20 : 0
            );
        };

        const hideStageTools = () => {
            stageTools?.classList.add('hidden');
            explodeButton?.classList.add('hidden');
            caseTray?.classList.add('hidden');
            caseOptionsHost?.replaceChildren();
            if (stageHotspots) stageHotspots.dataset.partsHidden = 'false';
        };

        explodeButton?.addEventListener('click', () => {
            renderExplodeState(highQualityViewer?.toggleExplode?.()
                || { destekli: false, asama: 'kapali', acik: false });
            // Parçalanırken kılıf çıkarıldığı için tepsi de bunu yansıtır.
            setActiveCaseButton(highQualityViewer?.getCase?.() || '');
        });

        const openHighQualityProduct = async (product) => {
            if (!highQualityViewer) {
                highQualityViewer = createHighQualityProductViewer({
                    canvas: document.getElementById('productPreviewCanvas'),
                    statusElement: productPreviewStatus,
                    hotspotContainer: document.getElementById('productStageHotspots'),
                    // Telefon ve kılıf aynı anda sahnede; önbellek ikisini de tutar.
                    cacheSize: 4
                });
                highQualityViewer.setExplodeListener(renderExplodeState);
            }
            requestAnimationFrame(() => highQualityViewer?.resize());
            hideStageTools();
            const durum = await highQualityViewer.open(product);
            setupStageTools(product);
            return durum;
        };
        const closeHighQualityProduct = ({ dispose = false } = {}) => {
            hideStageTools();
            if (dispose) {
                highQualityViewer?.dispose();
                highQualityViewer = null;
                return;
            }
            highQualityViewer?.clear();
        };
        let lastViewedProduct = null;
        const createEditorForRuntime = (targetRuntime, targetStoreId) => createTourEditor({
            scene,
            camera,
            canvas,
            tourMeshes: targetRuntime.renderMeshes,
            sceneProducts: targetRuntime.sceneProducts,
            loadModeledProduct: targetRuntime.productLibrary.load || null,
            productRegistry,
            openHighQualityProduct,
            closeHighQualityProduct,
            onProductOpened: (product) => {
                lastViewedProduct = productRegistry.getProduct(product.id) || product;
                if (recentProductName) recentProductName.textContent = product.name || product.details?.name || 'Ürün';
                if (recentProductBtn) {
                    recentProductBtn.hidden = false;
                    recentProductBtn.classList.remove('hidden');
                }
                try { localStorage.setItem('uzunCarsi:lastViewedProduct:v1', product.id); } catch {}
            },
            storeId: targetStoreId
        });

        let editorStoreId = store.id;
        let editor = createEditorForRuntime(runtime, store.id);
        try {
            const savedProductId = localStorage.getItem('uzunCarsi:lastViewedProduct:v1');
            lastViewedProduct = savedProductId ? productRegistry.getProduct(savedProductId) : null;
        } catch {}
        if (lastViewedProduct && recentProductBtn) {
            recentProductName.textContent = lastViewedProduct.name || 'Son ürün';
            recentProductBtn.hidden = false;
            recentProductBtn.classList.remove('hidden');
        }
        recentProductBtn?.addEventListener('click', () => {
            if (lastViewedProduct) editor.openProduct(lastViewedProduct);
        });
        // ?product=<ID> doğrudan ürün inceleme ekranını açar. Ürün seçimi imleç
        // kilidine ve nişangâha bağlı olduğundan tıklama gerektirmeyen bu yol
        // otomatik denetimlerde kullanılır.
        const derinBaglantiUrun = new URLSearchParams(window.location.search).get('product');
        if (derinBaglantiUrun) {
            requestAnimationFrame(() => editor.openProduct(derinBaglantiUrun));
        }
        const productSearch = createProductSearchHighlight({
            scene,
            registry: productRegistry
        });
        productSearch.setStoreContext(store.id, runtime, {
            floorY: store.bounds.floorY,
            bounds: store.bounds
        });
        productSearch.setSuspended(!OUTSIDE_ONLY_TEST);
        productSearch.applyFilters({ ...activePortalFilters, storeId: store.id });
        const entranceCinematic = createStoreEntryCinematic({ scene, camera, canvas });
        let streaming = null;
        streaming = OUTSIDE_ONLY_TEST
            ? {
                runtimes: new Map(),
                dispose() {}
            }
            : createStoreStreamingManager({
                scene,
                camera,
                quality,
                volumes: rendering.streamingVolumes,
                initialStore: store,
                initialRuntime: runtime,
                outsideRuntime,
                prepareRuntime: prepareStoreRuntime,
                onStoreContextChanged: (storeId, nextRuntime) => {
                    if (editorStoreId === storeId) return;
                    editor.dispose({ preserveSceneProducts: true });
                    editor = createEditorForRuntime(nextRuntime, storeId);
                    editorStoreId = storeId;
                    productSearch.setStoreContext(storeId, nextRuntime, {
                        floorY: STORES[storeId].bounds.floorY,
                        bounds: STORES[storeId].bounds
                    });
                    productSearch.applyFilters({ ...activePortalFilters, storeId });
                    activeStoreName.textContent = STORES[storeId].shortName;
                },
                onEnvironmentChanged: ({ isInside }) => environmentExperience.setInside(isInside)
            });
        let storeTravelRunning = false;
        const travelToStore = async (storeId) => {
            if (OUTSIDE_ONLY_TEST) return;
            const destination = STORES[storeId];
            if (!destination || entranceCinematic.active || storeTravelRunning) return;
            storeTravelRunning = true;
            productSearch.setSuspended(true);
            try {
                const destinationRuntime = await streaming.ensureRuntime(storeId);
                activeStoreName.textContent = destination.shortName;
                await entranceCinematic.play({
                    store: destination,
                    lighting: destinationRuntime.lighting,
                    duration: 3900
                });
                await streaming.requestUpdate();
                productSearch.setStoreContext(storeId, destinationRuntime, {
                    floorY: destination.bounds.floorY,
                    bounds: destination.bounds
                });
                productSearch.applyFilters({ ...activePortalFilters, storeId });
            } catch (error) {
                console.warn(`${destination.shortName} mağaza geçişi tamamlanamadı.`, error);
            } finally {
                productSearch.setSuspended(false);
                storeTravelRunning = false;
            }
        };
        activeTourTravel = travelToStore;
        activeTourPrepare = (storeId) => streaming.ensureRuntime(storeId);
        const stopBackgroundStoreDownloads = () => {};

        const stopAdaptiveQuality = startAdaptiveQuality(
            engine,
            quality,
            qualityLabel,
            rendering,
            instrumentation,
            { lockNativeResolution: true }
        );
        engine.runRenderLoop(() => scene.render());
        scene.render();

        window.activeCamera = camera;
        window.scene = scene;
        window.BABYLON = { Vector3 };
        if (import.meta.env.DEV) {
            window.__UZUNCARSI_DEBUG__ = {
                storeId: store.id,
                sceneFile: store.sceneFile,
                alwaysWorldFile: ALWAYS_WORLD_FILE,
                outsideWorldFile: OUTSIDE_WORLD_FILE,
                worldMeshes: worldRuntime.renderMeshes.length,
                outsideMeshes: outsideRuntime.renderMeshes.length,
                engine,
                scene,
                products: runtime.sceneProducts.productCount,
                productMatchStats: runtime.productMatchStats || null,
                getStats: () => ({
                    fps: Math.round(engine.getFps()),
                    activeMeshes: scene.getActiveMeshes().length,
                    totalMeshes: scene.meshes.length,
                    drawCalls: Math.round(instrumentation.drawCallsCounter.current || 0),
                    materials: scene.materials.length,
                    textures: scene.textures.length,
                    hardwareScale: engine.getHardwareScalingLevel(),
                    productLibraryLoaded: runtime.productLibrary.loaded
                })
            };
        }

        setLoadingProgress(100, 'Mağaza açıldı', '');
        activeStoreName.textContent = OUTSIDE_ONLY_TEST ? 'Outside Test' : store.shortName;
        storeSwitcherBtn.hidden = OUTSIDE_ONLY_TEST;
        tourHud.hidden = false;
        tourHud.classList.remove('hidden');
        document.body.classList.add('tour-active');
        requestAnimationFrame(() => loadingScreen.classList.add('is-complete'));
        window.setTimeout(() => { loadingScreen.hidden = true; }, 650);
        if (!OUTSIDE_ONLY_TEST) {
            window.setTimeout(() => {
                void entranceCinematic.play({ store, lighting: runtime.lighting }).finally(() => {
                    productSearch.setSuspended(false);
                    productSearch.applyFilters({ ...activePortalFilters, storeId: editorStoreId });
                    void streaming.requestUpdate();
                });
            }, 520);
        }

        const resize = () => {
            engine.resize();
            highQualityViewer?.resize();
        };
        window.addEventListener('resize', resize, { passive: true });
        window.addEventListener('beforeunload', () => {
            stopAdaptiveQuality();
            stopComfortMovement();
            stopBackgroundStoreDownloads();
            scenePreloader.dispose();
            environmentExperience.dispose();
            activeTourTravel = null;
            activeTourPrepare = null;
            streaming.dispose();
            instrumentation.dispose();
            editor.dispose();
            productSearch.dispose();
            entranceCinematic.dispose();
            highQualityViewer?.dispose();
            for (const storeRuntime of streaming.runtimes.values()) {
                storeRuntime.reflectionProbe.dispose();
                storeRuntime.productLibrary.dispose();
                storeRuntime.selectionBoxes.forEach((mesh) => mesh.dispose(false, false));
                storeRuntime.collisionMeshes?.forEach((mesh) => mesh.dispose(false, false));
                storeRuntime.containers.forEach((container) => container.dispose());
            }
            outsideRuntime.container?.dispose();
            worldRuntime.container?.dispose();
            window.removeEventListener('resize', resize);
        }, { once: true });
        canvas.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            showError(new Error('Ekran kartı bağlantısı kesildi. Sayfayı yenileyin.'));
        });
    } catch (error) {
        engine?.dispose();
        tourStarted = false;
        showError(error);
    }
};

let selectedStoreId = 'guzel-optik';
let activePortalFilters = {
    active: false,
    query: '',
    storeId: null,
    category: null,
    minPrice: null,
    maxPrice: null
};

const absoluteSceneUrl = (root, filename) => new URL(`${root}${filename}`, window.location.href).href;
const productModelPreloadAssets = [...new Set(productRegistry
    .filterProducts({ activeOnly: false })
    .map((product) => product.highQualityModel)
    .filter(Boolean)
    .map((modelPath) => new URL(modelPath, window.location.href).href))]
    .map((url, index) => ({ id: `product:model:${index}`, url, priority: 100 }));
const backgroundPreloadAssets = [
    { id: 'world:always', url: absoluteSceneUrl(ALWAYS_WORLD_ROOT, ALWAYS_WORLD_FILE), priority: 500 },
    { id: 'world:outside', url: absoluteSceneUrl(OUTSIDE_WORLD_ROOT, OUTSIDE_WORLD_FILE), priority: 360 },
    { id: 'world:environment', url: new URL(WORLD_ENVIRONMENT_FILE, window.location.href).href, priority: 340 },
    ...Object.values(STORES).map((store) => ({
        id: `store:${store.id}`,
        storeId: store.id,
        url: absoluteSceneUrl(store.sceneRoot, store.sceneFile),
        priority: store.id === 'guzel-optik' ? 490 : 480
    })),
    { id: 'store:guzel-optik:library', url: absoluteSceneUrl(MODEL_ROOT, PRODUCT_LIBRARY_FILE), priority: 280 },
    { id: 'store:guzel-optik:proxies', url: absoluteSceneUrl(MODEL_ROOT, PRODUCT_PROXY_FILE), priority: 270 },
    { id: 'store:guzel-optik:manifest', url: absoluteSceneUrl(MODEL_ROOT, PRODUCT_MANIFEST_FILE), priority: 260 },
    ...productModelPreloadAssets
];
const scenePreloader = createSceneAssetPreloader({
    cacheName: SCENE_CACHE_NAME,
    serviceWorkerUrl: new URL(`${PUBLIC_ROOT}scene-cache-sw.js`, window.location.href).href,
    serviceWorkerScope: new URL(PUBLIC_ROOT, window.location.href).pathname,
    concurrency: 4,
    assets: backgroundPreloadAssets,
    onStateChange: ({ storeId, state, progress }) => {
        if (storeId) {
            const card = storeCards.find((candidate) => candidate.dataset.storeId === storeId);
            const status = card?.querySelector('[data-store-load]');
            if (status) {
                status.classList.toggle('is-ready', state === 'ready');
                status.classList.toggle('is-error', state === 'error');
                status.textContent = state === 'ready'
                    ? 'Hazır'
                    : state === 'error'
                        ? 'Bağlantı bekleniyor'
                        : state === 'loading' && progress > 0
                            ? `Yükleniyor %${Math.round(progress * 100)}`
                            : 'Yükleniyor';
            }
        }
        queueMicrotask(() => {
            refreshPortalPreloadSummary();
            refreshBackgroundDownloadStatus();
        });
    }
});

const refreshBackgroundDownloadStatus = () => {
    if (!selectionMapStatus || selectionMapScreen.hidden) return;
    const states = backgroundPreloadAssets.map((asset) => scenePreloader.state(asset.id));
    const ready = states.filter((state) => state?.state === 'ready').length;
    const errors = states.filter((state) => state?.state === 'error').length;
    const started = states.some((state) => state?.state !== 'idle');
    if (!started) return;
    selectionMapStatus.textContent = errors > 0
        ? `${errors} dosya yüklenemedi`
        : ready === states.length
            ? 'Tüm dosyalar indirildi'
            : `Arka planda yükleniyor · ${ready}/${states.length}`;
};

const refreshPortalPreloadSummary = () => {
    const states = [
        scenePreloader.state(`store:${selectedStoreId}`),
        scenePreloader.state('world:always'),
        scenePreloader.state('world:outside')
    ].filter(Boolean);
    const ready = states.length === 3 && states.every((item) => item.state === 'ready');
    const total = states.reduce((sum, item) => sum + item.total, 0);
    const loaded = states.reduce((sum, item) => sum + item.loaded, 0);
    portalPreloadStatus.classList.toggle('is-ready', ready);
    portalPreloadStatus.textContent = ready
        ? 'Hazır'
        : total > 0
            ? `Yükleniyor · %${Math.min(99, Math.round((loaded / total) * 100))}`
            : 'Yükleniyor';
};

const numberOrNull = (input) => input.value === '' || !Number.isFinite(Number(input.value))
    ? null
    : Math.max(0, Number(input.value));

const readPortalFilters = () => ({
    query: portalProductQuery.value.trim(),
    storeId: portalStoreFilter.value || null,
    category: portalCategoryFilter.value || null,
    minPrice: numberOrNull(portalMinPrice),
    maxPrice: numberOrNull(portalMaxPrice)
});

const readSelectionFilters = () => ({
    query: selectionProductQuery.value.trim(),
    storeId: selectionStoreFilter.value || null,
    category: selectionCategoryFilter.value || null,
    minPrice: numberOrNull(selectionMinPrice),
    maxPrice: numberOrNull(selectionMaxPrice)
});

const describePortalFilters = (filters) => {
    const parts = [];
    if (filters.query) parts.push(`“${filters.query}”`);
    if (filters.category) parts.push(filters.category);
    if (filters.minPrice != null || filters.maxPrice != null) {
        const minimum = filters.minPrice == null ? '0' : filters.minPrice.toLocaleString('tr-TR');
        const maximum = filters.maxPrice == null ? 'üzeri' : `${filters.maxPrice.toLocaleString('tr-TR')} TL`;
        parts.push(`${minimum} – ${maximum}`);
    }
    return parts.length ? parts.join(' · ') : 'Tüm ürünler';
};

const syncSelectionInputs = (filters) => {
    selectionProductQuery.value = filters.query || '';
    selectionStoreFilter.value = filters.storeId || '';
    selectionCategoryFilter.value = filters.category || '';
    selectionMinPrice.value = filters.minPrice ?? '';
    selectionMaxPrice.value = filters.maxPrice ?? '';
};

const updateSelectionMapFilters = ({ hasProductFilter, visibleStores, totalMatches }) => {
    for (const store of Object.values(STORES)) {
        const matches = productRegistry.filterProducts({ ...activePortalFilters, storeId: store.id });
        const visible = (!activePortalFilters.storeId || activePortalFilters.storeId === store.id)
            && (!hasProductFilter || matches.length > 0);
        const marker = document.querySelector(`[data-selection-store="${store.id}"]`);
        const listButton = document.querySelector(`[data-selection-list="${store.id}"]`);
        if (marker) marker.dataset.filterHidden = String(!visible);
        if (listButton) {
            listButton.hidden = !visible;
            const matchLabel = listButton.querySelector('[data-selection-match]');
            if (matchLabel) matchLabel.textContent = hasProductFilter
                ? `${matches.length} eşleşen ürün`
                : store.category;
        }
    }
    selectionStoreCount.textContent = String(visibleStores);
    selectionResultSummary.textContent = hasProductFilter
        ? `${totalMatches} ürün · ${visibleStores} mağaza`
        : `${visibleStores} mağaza`;
    selectionActiveFilterText.textContent = describePortalFilters(activePortalFilters);
    selectionEmptyState.hidden = visibleStores > 0;
};

const applyPortalFilters = () => {
    activePortalFilters = readPortalFilters();
    const hasProductFilter = Boolean(
        activePortalFilters.query
        || activePortalFilters.category
        || activePortalFilters.minPrice != null
        || activePortalFilters.maxPrice != null
    );
    activePortalFilters.active = hasProductFilter;
    let visibleStores = 0;
    let totalMatches = 0;
    for (const card of storeCards) {
        const storeId = card.dataset.storeId;
        const matches = productRegistry.filterProducts({ ...activePortalFilters, storeId });
        const visible = (!activePortalFilters.storeId || activePortalFilters.storeId === storeId)
            && (!hasProductFilter || matches.length > 0);
        card.hidden = !visible;
        card.querySelector('[data-store-match]').textContent = hasProductFilter
            ? `${matches.length} eşleşme`
            : `${matches.length} kayıtlı ürün`;
        card.classList.toggle('has-filter-match', hasProductFilter && matches.length > 0);
        if (visible) {
            visibleStores += 1;
            totalMatches += matches.length;
        }
    }

    const visibleCards = storeCards.filter((card) => !card.hidden);
    if (!visibleCards.some((card) => card.dataset.storeId === selectedStoreId) && visibleCards[0]) {
        selectStore(visibleCards[0].dataset.storeId, { preload: false });
    }
    portalEmptyState.hidden = visibleStores > 0;
    portalEmptyState.classList.toggle('hidden', visibleStores > 0);
    portalResultSummary.textContent = hasProductFilter
        ? `${totalMatches} ürün · ${visibleStores} mağaza`
        : `${visibleStores} mağaza listeleniyor`;
    portalActiveFilterText.textContent = describePortalFilters(activePortalFilters);
    portalExploreAllBtn.disabled = visibleStores === 0;
    syncSelectionInputs(activePortalFilters);
    updateSelectionMapFilters({ hasProductFilter, visibleStores, totalMatches });
};

const applySelectionFilters = () => {
    const filters = readSelectionFilters();
    portalProductQuery.value = filters.query;
    portalStoreFilter.value = filters.storeId || '';
    portalCategoryFilter.value = filters.category || '';
    portalMinPrice.value = filters.minPrice ?? '';
    portalMaxPrice.value = filters.maxPrice ?? '';
    applyPortalFilters();
};

const clearPortalFilters = () => {
    portalProductQuery.value = '';
    portalStoreFilter.value = '';
    portalCategoryFilter.value = '';
    portalMinPrice.value = '';
    portalMaxPrice.value = '';
    applyPortalFilters();
};

const hydrateNisantasiPrices = async () => {
    portalPriceStatus.textContent = 'Optik katalog fiyatları hazır. Altın ürünlerinin canlı fiyatı alınıyor…';
    try {
        const market = await loadMawusProductPrices();
        const updates = productRegistry.productsForStore('nisantasi').map((product) => {
            const pricing = market.prices[product.id];
            return pricing ? {
                ...product,
                price: pricing.price,
                priceType: 'live-gold',
                priceNote: pricing.kind === 'gemstone'
                    ? 'Canlı 24 ayar gram altın referansı, tahmini ağırlık, ayar, işçilik ve tanımlı mağaza tarifesiyle hesaplanır; taşın gerçek değeri dahil değildir.'
                    : pricing.estimatedWeight
                        ? 'Canlı 24 ayar gram altın referansı, tahmini ağırlık, ayar, işçilik ve tanımlı mağaza tarifesiyle hesaplanır.'
                        : 'Canlı 24 ayar gram altın referansı, ürün ağırlığı, ayarı ve tanımlı mağaza tarifesiyle hesaplanır.',
                pricingUpdatedAt: pricing.updatedAt
            } : product;
        });
        productRegistry.importData({ schemaVersion: 1, products: updates, bindings: [] }, { merge: true });
        portalPriceStatus.textContent = market.stale
            ? 'Optik katalog fiyatları ve son bilinen altın piyasa hesabı kullanılıyor.'
            : 'Optik katalog fiyatları ve canlı altın piyasa hesabı kullanılıyor.';
        applyPortalFilters();
    } catch {
        portalPriceStatus.textContent = 'Optik katalog fiyatları hazır. Altın fiyatı bağlantı geldiğinde hesaplanır.';
    }
};

const selectStore = (storeId, { preload = true } = {}) => {
    const store = STORES[storeId];
    if (!store) return;
    selectedStoreId = storeId;
    for (const card of storeCards) {
        const selected = card.dataset.storeId === storeId;
        card.classList.toggle('is-active', selected);
        card.setAttribute('aria-selected', String(selected));
    }
    portalExploreAllBtn.textContent = `${store.shortName}'a gir`;
    if (preload) void scenePreloader.prioritize(`store:${storeId}`, 170).catch(() => {});
    refreshPortalPreloadSummary();
};

let selectionWorld = null;
let selectionEntryRunning = false;
const enterStore = async (storeId = selectedStoreId) => {
    if (selectionEntryRunning) return;
    const targetStoreId = STORES[storeId] ? storeId : selectedStoreId;
    storeSelectPortal.hidden = true;
    storeSelectPortal.classList.add('hidden');
    if (tourStarted) {
        activeTourTravel?.(targetStoreId);
        return;
    }
    selectionEntryRunning = true;
    void Promise.all([
        scenePreloader.prioritize(`store:${targetStoreId}`, 200),
        scenePreloader.prioritize('world:always', 190),
        scenePreloader.prioritize('world:outside', 180)
    ]).catch(() => {});
    try {
        await selectionWorld?.flyToStore(targetStoreId);
        await new Promise((resolve) => window.setTimeout(resolve, 220));
    } finally {
        selectionWorld?.dispose();
        selectionWorld = null;
        selectionMapScreen.hidden = true;
        selectionMapScreen.classList.add('hidden');
        selectionEntryRunning = false;
    }
    void startTour(targetStoreId);
};

const setStoreSwitcherOpen = (open) => {
    storeSwitcherMenu.hidden = !open;
    storeSwitcherMenu.classList.toggle('hidden', !open);
    storeSwitcherBtn.setAttribute('aria-expanded', String(open));
};

const populateStoreSwitcher = () => {
    const fragment = document.createDocumentFragment();
    for (const store of Object.values(STORES)) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'store-switcher-item';
        item.setAttribute('role', 'menuitem');
        item.dataset.storeId = store.id;
        item.innerHTML = `<span class="store-switcher-item__left"><span class="store-switcher-item__icon" aria-hidden="true">${store.icon}</span><span class="store-switcher-item__name">${store.shortName}</span></span><span class="store-switcher-item__tag">Git</span>`;
        const selectStoreFromMenu = () => {
            setStoreSwitcherOpen(false);
            activeTourTravel?.(store.id);
        };
        item.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            selectStoreFromMenu();
        });
        item.addEventListener('pointerenter', () => {
            void activeTourPrepare?.(store.id).catch(() => {});
        }, { passive: true });
        item.addEventListener('focus', () => {
            void activeTourPrepare?.(store.id).catch(() => {});
        });
        item.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            selectStoreFromMenu();
        });
        fragment.append(item);
    }
    storeSwitcherList.replaceChildren(fragment);
};

for (const card of storeCards) {
    const choose = () => selectStore(card.dataset.storeId);
    const prepare = () => {
        void scenePreloader.prioritize(`store:${card.dataset.storeId}`, 190).catch(() => {});
    };
    card.addEventListener('click', choose);
    card.addEventListener('pointerenter', prepare, { passive: true });
    card.addEventListener('focusin', prepare);
    card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        choose();
    });
}

selectStore(selectedStoreId, { preload: false });
const portalCategories = [...new Set(productRegistry.filterProducts({ activeOnly: false })
    .map((product) => product.category)
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'tr'));
for (const category of portalCategories) {
    portalCategoryFilter.append(new Option(category, category));
    selectionCategoryFilter.append(new Option(category, category));
}
applyPortalFilters();
void hydrateNisantasiPrices();
populateStoreSwitcher();
selectionWorld = createSelectionWorld({
    canvas,
    screen: selectionMapScreen,
    markerLayer: selectionMarkerLayer,
    statusElement: selectionMapStatus,
    stores: STORES,
    assetUrl: `${PUBLIC_ROOT}models/selection/${SELECTION_WORLD_FILE}`
});
void selectionWorld.whenReady
    .then(() => {
        qualityStatus.dataset.backgroundDownloadState = 'downloading-all';
        return scenePreloader.preloadAll();
    })
    .then((results) => {
        const failed = results.filter((result) => result.status === 'rejected').length;
        qualityStatus.dataset.backgroundDownloadState = failed ? `complete-with-${failed}-errors` : 'complete';
    });
const chooseFromSelectionMap = (storeId) => {
    if (!STORES[storeId]) return;
    selectStore(storeId);
    void enterStore(storeId);
};
for (const button of document.querySelectorAll('[data-selection-store], [data-selection-list]')) {
    const storeId = button.dataset.selectionStore || button.dataset.selectionList;
    button.addEventListener('click', () => chooseFromSelectionMap(storeId));
    button.addEventListener('pointerenter', () => selectStore(storeId, { preload: false }), { passive: true });
    button.addEventListener('focus', () => selectStore(storeId, { preload: false }));
}
openCatalogBtn.addEventListener('click', () => {
    storeSelectPortal.hidden = false;
    storeSelectPortal.classList.remove('hidden');
});
selectionSearchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    applySelectionFilters();
});
for (const input of [selectionStoreFilter, selectionCategoryFilter, selectionMinPrice, selectionMaxPrice]) {
    input.addEventListener('change', applySelectionFilters);
}
selectionFilterClear.addEventListener('click', clearPortalFilters);
storeSwitcherBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    storeSwitcherOpenGuard = true;
    setStoreSwitcherOpen(storeSwitcherMenu.hidden);
    queueMicrotask(() => { storeSwitcherOpenGuard = false; });
});
worldMapReturnBtn.addEventListener('click', () => {
    worldMapReturnBtn.disabled = true;
    worldMapReturnBtn.querySelector('span:last-child').textContent = 'Harita açılıyor';
    setStoreSwitcherOpen(false);
    if (document.pointerLockElement) document.exitPointerLock?.();
    // Tam sahne yaşam döngüsünü temiz bir şekilde sıfırlarken indirilen dosyalar kalıcı önbellekte kalır.
    window.setTimeout(() => {
        window.location.assign(`${window.location.origin}${window.location.pathname}`);
    }, 80);
});
storeSwitcherBtn.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setStoreSwitcherOpen(storeSwitcherMenu.hidden);
});
document.addEventListener('pointerdown', (event) => {
    if (storeSwitcherOpenGuard) return;
    if (!storeSwitcherBtn.contains(event.target) && !storeSwitcherMenu.contains(event.target)) {
        setStoreSwitcherOpen(false);
    }
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setStoreSwitcherOpen(false);
});
portalExploreAllBtn.addEventListener('click', enterStore);
portalSearchBtn.addEventListener('click', applyPortalFilters);
portalFilterApply.addEventListener('click', applyPortalFilters);
portalFilterClear.addEventListener('click', clearPortalFilters);
portalStoreFilter.addEventListener('change', applyPortalFilters);
portalCategoryFilter.addEventListener('change', applyPortalFilters);
portalProductQuery.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyPortalFilters();
});
retryButton.addEventListener('click', () => window.location.reload());
qualitySelect.addEventListener('change', () => {
    try {
        localStorage.setItem(QUALITY_STORAGE_KEY, qualitySelect.value);
    } catch {}
    window.location.reload();
});
