import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';

import { applyDeviceResolution } from './render-resolution.js';

import '@babylonjs/loaders/glTF';

const DEFAULT_CACHE_SIZE = 2;
const GLASS_NAME_PATTERN = /glass|cam|lens|vitrin|window/i;
const EXPLODE_DURATION_MS = 900;

const finiteNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const vectorFrom = (value, fallback) => {
    if (Array.isArray(value)) {
        return new Vector3(
            finiteNumber(value[0], fallback.x),
            finiteNumber(value[1], fallback.y),
            finiteNumber(value[2], fallback.z)
        );
    }
    if (value && typeof value === 'object') {
        return new Vector3(
            finiteNumber(value.x, fallback.x),
            finiteNumber(value.y, fallback.y),
            finiteNumber(value.z, fallback.z)
        );
    }
    return fallback.clone();
};

const scaleFrom = (value) => {
    if (Number.isFinite(Number(value))) {
        const uniform = Number(value);
        return new Vector3(uniform, uniform, uniform);
    }
    return vectorFrom(value, Vector3.One());
};

export const normalizeAnimationPlayback = (value) => {
    if (value === true) return { autoPlay: true, loop: false, speedRatio: 1, clipName: '', cameraRadiusMultiplier: 1 };
    if (!value || typeof value !== 'object' || value.autoPlay !== true) return null;
    return {
        autoPlay: true,
        loop: value.loop === true,
        speedRatio: Math.max(0.05, Math.min(finiteNumber(value.speedRatio, 1), 8)),
        clipName: String(value.clipName || '').trim(),
        cameraRadiusMultiplier: Math.max(1, Math.min(finiteNumber(value.cameraRadiusMultiplier, 1), 4))
    };
};

export const animationGroupMatchesClip = (groupName, clipName) => {
    const group = String(groupName || '');
    const clip = String(clipName || '').trim();
    return !clip || group === clip || group.endsWith(`_${clip}`);
};

const modelUrlParts = (url) => {
    const normalized = String(url || '').trim().replace(/\\/g, '/');
    const slash = normalized.lastIndexOf('/');
    if (slash < 0) return { rootUrl: '', sceneFilename: normalized };
    return {
        rootUrl: normalized.slice(0, slash + 1),
        sceneFilename: normalized.slice(slash + 1)
    };
};

const materialList = (material) => {
    if (!material) return [];
    return material.subMaterials?.filter(Boolean) || [material];
};

const simplifyGlassMaterials = (container) => {
    const materials = new Set(container.materials || []);
    for (const mesh of container.meshes || []) {
        materialList(mesh.material).forEach((material) => materials.add(material));
    }

    for (const material of materials) {
        const subSurface = material?.subSurface;
        const isGlass = GLASS_NAME_PATTERN.test(material?.name || '')
            || Boolean(subSurface?.isRefractionEnabled)
            || Boolean(material?.refractionTexture);

        if (subSurface) {
            subSurface.isRefractionEnabled = false;
            subSurface.isTranslucencyEnabled = false;
            subSurface.refractionTexture = null;
        }
        if ('refractionTexture' in material) material.refractionTexture = null;
        if (!isGlass) continue;

        material.backFaceCulling = false;
        material.separateCullingPass = false;
        material.needDepthPrePass = false;
        material.alpha = Math.min(finiteNumber(material.alpha, 1), 0.28);

        if (material instanceof PBRMaterial) {
            material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
            material.metallic = 0;
            material.roughness = Math.max(finiteNumber(material.roughness, 0.2), 0.18);
            material.useRadianceOverAlpha = false;
            material.useSpecularOverAlpha = true;
        } else if (material instanceof StandardMaterial) {
            material.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
        }
    }
};

const applyPreviewTransform = (root, previewTransform = {}) => {
    root.position.copyFrom(vectorFrom(previewTransform.position, Vector3.Zero()));
    root.scaling.copyFrom(scaleFrom(previewTransform.scale));

    const rotationDegrees = previewTransform.rotationDegrees;
    if (rotationDegrees != null) {
        const degrees = vectorFrom(rotationDegrees, Vector3.Zero());
        root.rotation.copyFromFloats(
            degrees.x * Math.PI / 180,
            degrees.y * Math.PI / 180,
            degrees.z * Math.PI / 180
        );
    } else {
        root.rotation.copyFrom(vectorFrom(previewTransform.rotation, Vector3.Zero()));
    }
};

const collectRenderMeshes = (entries) => {
    const meshes = new Set();
    for (const root of entries?.rootNodes || []) {
        if (typeof root.getTotalVertices === 'function' && root.getTotalVertices() > 0) meshes.add(root);
        root.getChildMeshes?.(false).forEach((mesh) => {
            if (mesh.getTotalVertices() > 0) meshes.add(mesh);
        });
    }
    return [...meshes];
};

const collectStats = (meshes) => {
    const materials = new Set();
    let triangleCount = 0;
    let vertexCount = 0;

    for (const mesh of meshes) {
        vertexCount += mesh.getTotalVertices?.() || 0;
        triangleCount += Math.floor((mesh.getTotalIndices?.() || 0) / 3);
        materialList(mesh.material).forEach((material) => materials.add(material));
    }

    return {
        meshCount: meshes.length,
        triangleCount,
        vertexCount,
        materialCount: materials.size
    };
};

const meshWorldBounds = (meshes, { refresh = false } = {}) => {
    let minimum = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    let maximum = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

    for (const mesh of meshes) {
        mesh.computeWorldMatrix(true);
        if (refresh) mesh.refreshBoundingInfo(true);
        const bounds = mesh.getBoundingInfo().boundingBox;
        minimum = Vector3.Minimize(minimum, bounds.minimumWorld);
        maximum = Vector3.Maximize(maximum, bounds.maximumWorld);
    }

    return { minimum, maximum };
};

// Parçalarına ayrılmış model dikeyde uzadığı için yarıçap, en büyük kenardan
// değil kameranın görüş açısından hesaplanır.
export const radiusToFrame = (fov, aspectRatio, size, margin = 1.12) => {
    const tanHalfFov = Math.tan(Math.max(finiteNumber(fov, 0.8), 0.1) / 2);
    const halfHeight = Math.max(finiteNumber(size.y, 0), 0.001) / 2;
    // Model yörünge kamerasıyla döndüğünden yatayda en geniş kesit ölçü alınır.
    const halfWidth = Math.max(finiteNumber(size.x, 0), finiteNumber(size.z, 0), 0.001) / 2;
    return Math.max(
        halfHeight / tanHalfFov,
        halfWidth / (tanHalfFov * Math.max(finiteNumber(aspectRatio, 1), 0.2))
    ) * Math.max(margin, 1);
};

const fitCameraToMeshes = (camera, meshes) => {
    const { minimum, maximum } = meshWorldBounds(meshes, { refresh: true });

    if (!Number.isFinite(minimum.x) || !Number.isFinite(maximum.x)) {
        camera.setTarget(Vector3.Zero());
        camera.radius = 2;
        return { center: [0, 0, 0], size: [0, 0, 0], radius: 2 };
    }

    const center = minimum.add(maximum).scale(0.5);
    const size = maximum.subtract(minimum);
    const largestDimension = Math.max(size.x, size.y, size.z, 0.01);
    const radius = Math.max(largestDimension * 1.35, 0.15);

    camera.setTarget(center);
    camera.radius = radius;
    camera.lowerRadiusLimit = Math.max(largestDimension * 0.32, 0.025);
    camera.upperRadiusLimit = Math.max(largestDimension * 8, radius * 2);
    camera.minZ = Math.max(largestDimension / 1000, 0.001);
    camera.maxZ = Math.max(largestDimension * 100, 100);

    return {
        center: center.asArray(),
        size: size.asArray(),
        radius
    };
};

const friendlyLoadError = (error) => {
    const raw = String(error?.message || error || 'Bilinmeyen yükleme hatası');
    if (/404|not found|failed to fetch/i.test(raw)) {
        return 'Ürün modeli yüklenemedi.';
    }
    return 'Ürün görünümü açılamadı. Lütfen biraz sonra yeniden deneyin.';
};

// Ürün GLB'lerini ana mağaza sahnesinden bağımsız ve isteğe bağlı yükler.
export const createHighQualityProductViewer = ({
    canvas,
    statusElement = null,
    hotspotContainer = null,
    onLoaded = null,
    onError = null,
    cacheSize = DEFAULT_CACHE_SIZE
} = {}) => {
    if (!(canvas instanceof HTMLCanvasElement)) {
        throw new TypeError('createHighQualityProductViewer için geçerli bir canvas gerekli.');
    }

    const engine = new Engine(canvas, true, {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        stencil: false,
        audioEngine: false
    }, true);
    applyDeviceResolution(engine, { maxDpr: 2 });

    const scene = new Scene(engine);
    // Açık ürün sahnesi CSS arka planını gösterir; koyu ve ince parçalar siluetini kaybetmez.
    scene.clearColor = new Color4(0, 0, 0, 0);
    scene.environmentTexture = null;
    scene.shadowsEnabled = false;

    const camera = new ArcRotateCamera(
        'highQualityProductCamera',
        -Math.PI * 0.62,
        Math.PI * 0.42,
        2,
        Vector3.Zero(),
        scene
    );
    camera.wheelPrecision = 55;
    camera.pinchPrecision = 120;
    camera.panningSensibility = 0;
    camera.inertia = 0.76;
    camera.attachControl(canvas, true);

    const ambient = new HemisphericLight('highQualityProductAmbient', new Vector3(0.2, 1, -0.25), scene);
    ambient.intensity = 1.32;
    ambient.diffuse = new Color3(0.94, 0.97, 1);
    ambient.groundColor = new Color3(0.18, 0.2, 0.24);

    const key = new DirectionalLight('highQualityProductKey', new Vector3(-0.55, -0.8, 0.45), scene);
    key.intensity = 1.85;
    key.diffuse = new Color3(1, 0.9, 0.78);

    const rim = new PointLight('highQualityProductRim', new Vector3(1.4, 1.2, -1.8), scene);
    rim.intensity = 1.08;
    rim.diffuse = new Color3(0.58, 0.72, 1);

    const fill = new PointLight('highQualityProductFill', new Vector3(-1.3, 0.25, 1.55), scene);
    fill.intensity = 0.72;
    fill.diffuse = new Color3(0.78, 0.9, 1);

    const sourceCache = new Map();
    const maxCacheSize = Math.max(0, Math.floor(finiteNumber(cacheSize, DEFAULT_CACHE_SIZE)));
    let activeEntries = null;
    let activeRoot = null;
    let activeModelRoot = null;
    let activeTransientContainer = null;
    let activeAnimationGroups = [];
    let activeHotspots = [];
    // Parçalanma kullanıcının düğmesine bağlı: 'kapali' | 'aciliyor' | 'acik' | 'kapaniyor'
    let explodePhase = 'kapali';
    let explodeBaseRadius = null;
    // 0 = birleşik, 1 = tam ayrılmış. Geçiş yarıda çevrilebilsin diye tutulur.
    let explodeProgress = 0;
    let explodeOpenSize = null;
    let explodeDrive = null;
    // Alt araç çubuğunun modeli örtmemesi için ayrılan şerit (piksel).
    let bottomInsetPx = 0;
    let onExplodeChange = null;
    let caseEntries = null;
    let caseRoot = null;
    let caseTransientContainer = null;
    let activeCaseUrl = null;
    let heroMotion = null;
    let requestVersion = 0;
    let disposed = false;
    let state = {
        phase: 'idle',
        productId: null,
        modelUrl: null,
        message: 'Bir ürün seçin.',
        stats: null,
        error: null
    };

    const publishState = (next) => {
        state = { ...state, ...next };
        if (statusElement) {
            statusElement.textContent = state.message || '';
            statusElement.dataset.state = state.phase;
        }
        return { ...state, stats: state.stats ? { ...state.stats } : null };
    };

    const releasePresentation = () => {
        activeHotspots.forEach(({ element }) => {
            element.style.visibility = 'hidden';
            element.removeAttribute('data-tracking');
        });
        activeHotspots = [];
        if (explodeDrive) {
            scene.onBeforeRenderObservable.removeCallback(explodeDrive);
            explodeDrive = null;
        }
        activeAnimationGroups.forEach((group) => group.stop());
        activeAnimationGroups = [];
        activeEntries?.dispose();
        activeEntries = null;
        activeRoot?.dispose();
        activeRoot = null;
        activeModelRoot = null;
        heroMotion = null;
        activeTransientContainer?.dispose();
        activeTransientContainer = null;
        releaseCase();
        explodePhase = 'kapali';
        explodeBaseRadius = null;
        explodeProgress = 0;
        explodeOpenSize = null;
        camera.targetScreenOffset.y = 0;
    };

    /** Parçalanma animasyonunu 0..1 aralığında tarar. */
    const applyExplodeProgress = (oran) => {
        explodeProgress = Math.max(0, Math.min(1, finiteNumber(oran, 0)));
        for (const group of activeAnimationGroups) {
            group.goToFrame(group.from + (group.to - group.from) * explodeProgress);
        }
    };

    const releaseCase = () => {
        caseEntries?.dispose();
        caseEntries = null;
        caseRoot?.dispose();
        caseRoot = null;
        caseTransientContainer?.dispose();
        caseTransientContainer = null;
        activeCaseUrl = null;
    };

    const bindHotspots = (product, entries, meshes) => {
        if (!hotspotContainer) return;
        const elements = [...hotspotContainer.querySelectorAll('.product-stage__hotspot')];
        if (!elements.length || !meshes.length) return;
        const nodes = [...new Set((entries.rootNodes || []).flatMap((root) => [root, ...(root.getDescendants?.(false) || [])]))];
        const descriptors = Array.isArray(product?.hotspots) ? product.hotspots : [];
        const fallbackMeshes = [...meshes].sort((left, right) => {
            left.computeWorldMatrix(true);
            right.computeWorldMatrix(true);
            return left.getBoundingInfo().boundingBox.centerWorld.x - right.getBoundingInfo().boundingBox.centerWorld.x;
        });

        activeHotspots = elements.map((element, index) => {
            const descriptor = descriptors[index] || {};
            const nodeName = String(descriptor.nodeName || '').trim();
            // Adı verilen parçada yaklaşık hedefe düşme: yanlış parçayı işaretlemektense noktayı gizle.
            const exactTarget = nodes.find((node) => node.name === nodeName || node.name?.endsWith(`_${nodeName}`));
            const target = nodeName
                ? exactTarget
                : fallbackMeshes[Math.round(index * (fallbackMeshes.length - 1) / Math.max(elements.length - 1, 1))]
                    || fallbackMeshes[0];
            element.dataset.tracking = target?.name || '';
            element.style.visibility = target ? 'visible' : 'hidden';
            return {
                element,
                target,
                offset: Array.isArray(descriptor.position) ? Vector3.FromArray(descriptor.position) : null
            };
        }).filter(({ target }) => target);
    };

    const updateHotspots = () => {
        if (!activeHotspots.length || !hotspotContainer) return;
        const renderWidth = engine.getRenderWidth();
        const renderHeight = engine.getRenderHeight();
        const cssScaleX = canvas.clientWidth / Math.max(renderWidth, 1);
        const cssScaleY = canvas.clientHeight / Math.max(renderHeight, 1);
        const viewport = camera.viewport.toGlobal(renderWidth, renderHeight);
        const transform = scene.getTransformMatrix();

        activeHotspots.forEach(({ element, target, offset }) => {
            target.computeWorldMatrix(true);
            const worldPosition = offset
                ? Vector3.TransformCoordinates(offset, target.getWorldMatrix())
                : target.getBoundingInfo?.().boundingBox.centerWorld.clone()
                    || target.getAbsolutePosition?.().clone();
            if (!worldPosition) {
                element.style.visibility = 'hidden';
                return;
            }
            const projected = Vector3.Project(worldPosition, Matrix.Identity(), transform, viewport);
            const x = projected.x * cssScaleX;
            const y = projected.y * cssScaleY;
            const visible = projected.z > 0 && projected.z < 1
                && x >= -24 && x <= canvas.clientWidth + 24
                && y >= -24 && y <= canvas.clientHeight + 24;
            element.style.visibility = visible ? 'visible' : 'hidden';
            if (!visible) return;
            element.style.left = `${x.toFixed(1)}px`;
            element.style.top = `${y.toFixed(1)}px`;
            element.dataset.labelSide = x > canvas.clientWidth * 0.64 ? 'left' : 'right';
        });
    };

    const touchCache = (modelUrl, container) => {
        sourceCache.delete(modelUrl);
        sourceCache.set(modelUrl, container);
    };

    const trimCache = (protectedUrl = null) => {
        while (sourceCache.size > maxCacheSize) {
            const oldest = sourceCache.entries().next().value;
            if (!oldest) break;
            const [modelUrl, container] = oldest;
            if (modelUrl === protectedUrl && sourceCache.size > 1) {
                touchCache(modelUrl, container);
                continue;
            }
            sourceCache.delete(modelUrl);
            container.dispose();
        }
    };

    const getContainer = async (modelUrl) => {
        const cached = sourceCache.get(modelUrl);
        if (cached) {
            touchCache(modelUrl, cached);
            return { container: cached, cached: true };
        }

        const { rootUrl, sceneFilename } = modelUrlParts(modelUrl);
        const container = await LoadAssetContainerAsync(sceneFilename, scene, {
            rootUrl,
            pluginExtension: '.glb',
            pluginOptions: {
                gltf: {
                    dontUseTransmissionHelper: true
                }
            }
        });
        simplifyGlassMaterials(container);
        if (maxCacheSize > 0) {
            touchCache(modelUrl, container);
            trimCache(modelUrl);
        }
        return { container, cached: false };
    };

    const open = async (product) => {
        if (disposed) throw new Error('Ürün inceleyici kapatıldı.');
        const currentRequest = ++requestVersion;
        const productId = product?.id || product?.productId || null;
        const modelUrl = String(product?.highQualityModel || '').trim();

        releasePresentation();
        if (!modelUrl) {
            return publishState({
                phase: 'waiting-model',
                productId,
                modelUrl: null,
                message: 'Bu ürünün modeli henüz yüklenmedi.',
                stats: null,
                error: null
            });
        }

        publishState({
            phase: 'loading',
            productId,
            modelUrl,
            message: `${product?.name || 'Ürün'} yükleniyor…`,
            stats: null,
            error: null
        });

        try {
            const { container, cached } = await getContainer(modelUrl);
            if (disposed || currentRequest !== requestVersion) {
                if (!sourceCache.has(modelUrl)) container.dispose();
                return null;
            }

            if (!sourceCache.has(modelUrl)) activeTransientContainer = container;

            activeRoot = new TransformNode(`hqProductHero_${productId || currentRequest}`, scene);
            activeModelRoot = new TransformNode(`hqProductRoot_${productId || currentRequest}`, scene);
            activeModelRoot.parent = activeRoot;
            applyPreviewTransform(activeModelRoot, product?.previewTransform);
            activeEntries = container.instantiateModelsToScene(
                (sourceName) => `hqProduct_${productId || currentRequest}_${sourceName}`,
                false,
                { doNotInstantiate: true }
            );
            for (const rootNode of activeEntries.rootNodes) rootNode.parent = activeModelRoot;

            const animationPlayback = normalizeAnimationPlayback(product?.animationPlayback);
            activeAnimationGroups = (activeEntries.animationGroups || []).filter((group) => (
                animationGroupMatchesClip(group.name, animationPlayback?.clipName)
            ));

            const meshes = collectRenderMeshes(activeEntries);
            bindHotspots(product, activeEntries, meshes);
            const stats = {
                ...collectStats(meshes),
                ...fitCameraToMeshes(camera, meshes),
                cached,
                animationCount: activeAnimationGroups.length
            };
            explodeBaseRadius = camera.radius;
            explodeProgress = 0;
            explodeOpenSize = null;
            camera.targetScreenOffset.y = 0;
            if (animationPlayback) {
                // autoPlay tanımlı ürünler açılır açılmaz kendiliğinden oynar.
                camera.radius *= animationPlayback.cameraRadiusMultiplier;
                explodeBaseRadius = camera.radius;
                explodePhase = 'acik';
                explodeProgress = 1;
                activeAnimationGroups.forEach((group) => {
                    group.reset();
                    group.start(animationPlayback.loop, animationPlayback.speedRatio);
                });
            } else if (activeAnimationGroups.length) {
                // Düğmeyle açılır. Gruplar "başlatılmış ama duraklatılmış" kalır;
                // goToFrame yalnızca bu durumda kare atlayabilir.
                activeAnimationGroups.forEach((group) => {
                    group.reset();
                    group.start(false, 1.0);
                    group.pause();
                });
                // Ayrılmış halin ölçüsü bir kez alınır; kadraj yarıçapı düğmeye
                // basıldığında bu ölçüden hesaplanır.
                applyExplodeProgress(1);
                const acik = meshWorldBounds(meshes);
                const merkez = camera.getTarget();
                // Kamera hedefi yerinde kaldığından ölçü merkeze göre simetriktir.
                explodeOpenSize = new Vector3(
                    Math.max(acik.maximum.x - merkez.x, merkez.x - acik.minimum.x) * 2,
                    Math.max(acik.maximum.y - merkez.y, merkez.y - acik.minimum.y) * 2,
                    Math.max(acik.maximum.z - merkez.z, merkez.z - acik.minimum.z) * 2
                );
                applyExplodeProgress(0);
                explodePhase = 'kapali';
            } else {
                explodePhase = 'kapali';
            }
            onExplodeChange?.(explodeState());
            const lift = Math.max(stats.size[1] * 0.08, 0.025);
            activeRoot.scaling.copyFromFloats(0.82, 0.82, 0.82);
            activeRoot.position.y = -lift;
            heroMotion = { startedAt: performance.now(), lift };
            const nextState = publishState({
                phase: 'ready',
                productId,
                modelUrl,
                message: '',
                stats,
                error: null
            });
            onLoaded?.(nextState, product);
            return nextState;
        } catch (error) {
            if (disposed || currentRequest !== requestVersion) return null;
            releasePresentation();
            const message = friendlyLoadError(error);
            const nextState = publishState({
                phase: 'error',
                productId,
                modelUrl,
                message,
                stats: null,
                error: String(error?.message || error)
            });
            onError?.(error, nextState, product);
            return nextState;
        }
    };

    const explodeState = () => ({
        destekli: activeAnimationGroups.length > 0,
        asama: explodePhase,
        acik: explodePhase === 'acik'
    });

    /**
     * Parçalanmayı sürer. Babylon geri sarımda (speedRatio < 0)
     * onAnimationGroupEndObservable'ı tetiklemediğinden animasyon start/stop
     * yerine her karede goToFrame ile taranır; aşama geçişi gözlemciye değil
     * buradaki zamanlayıcıya bağlıdır.
     */
    const runExplode = (acilacak) => {
        if (!activeAnimationGroups.length) return;
        explodePhase = acilacak ? 'aciliyor' : 'kapaniyor';
        onExplodeChange?.(explodeState());
        if (explodeBaseRadius == null) explodeBaseRadius = camera.radius;

        // Araç çubuğunun kapladığı şerit kadar kadrajı daraltır ve modeli yukarı iter.
        const bandOrani = Math.min(0.34, bottomInsetPx / Math.max(canvas.clientHeight, 1));
        const hedefYaricap = acilacak && explodeOpenSize
            ? radiusToFrame(camera.fov, engine.getAspectRatio(camera), explodeOpenSize)
                / Math.max(1 - bandOrani, 0.5)
            : explodeBaseRadius;
        camera.upperRadiusLimit = Math.max(camera.upperRadiusLimit || 0, hedefYaricap * 1.3);
        const gorunurYukseklik = 2 * hedefYaricap * Math.tan(Math.max(camera.fov, 0.1) / 2);
        const hedefKaydirma = acilacak ? gorunurYukseklik * bandOrani * 0.5 : 0;

        const baslangicOran = explodeProgress;
        const hedefOran = acilacak ? 1 : 0;
        const baslangicYaricap = camera.radius;
        const baslangicKaydirma = camera.targetScreenOffset.y;
        // Yarıda çevrilirse kalan mesafe kadar sürer; hızlanma sıçraması olmaz.
        const sure = Math.max(180, EXPLODE_DURATION_MS * Math.abs(hedefOran - baslangicOran));
        const t0 = performance.now();

        if (explodeDrive) scene.onBeforeRenderObservable.removeCallback(explodeDrive);
        explodeDrive = () => {
            const k = Math.min(1, (performance.now() - t0) / sure);
            const e = 1 - Math.pow(1 - k, 3);
            applyExplodeProgress(baslangicOran + (hedefOran - baslangicOran) * e);
            camera.radius = baslangicYaricap + (hedefYaricap - baslangicYaricap) * e;
            camera.targetScreenOffset.y = baslangicKaydirma + (hedefKaydirma - baslangicKaydirma) * e;
            if (k < 1) return;
            scene.onBeforeRenderObservable.removeCallback(explodeDrive);
            explodeDrive = null;
            explodePhase = acilacak ? 'acik' : 'kapali';
            onExplodeChange?.(explodeState());
        };
        scene.onBeforeRenderObservable.add(explodeDrive);
    };

    /** Parçalanmayı ileri/geri oynatır. Kılıf takılıysa kılıf çıkarılır. */
    const toggleExplode = () => {
        if (disposed || !activeAnimationGroups.length) return explodeState();
        if (explodePhase === 'aciliyor' || explodePhase === 'kapaniyor') return explodeState();
        const acilacak = explodePhase !== 'acik';
        if (acilacak && activeCaseUrl) releaseCase();
        runExplode(acilacak);
        return explodeState();
    };

    /** Aynı sahnede telefonun üzerine kılıf giydirir; null ise çıkarır. */
    const setCase = async (modelUrl) => {
        if (disposed) return null;
        const url = String(modelUrl || '').trim();
        if (!url) {
            releaseCase();
            return null;
        }
        if (url === activeCaseUrl) return url;
        if (!activeModelRoot) return null;
        // Kılıf yalnızca birleşik telefona giydirilir; parçalar ayrıksa toplanır.
        if (explodePhase === 'acik' || explodePhase === 'aciliyor') runExplode(false);
        releaseCase();
        const { container } = await getContainer(url);
        if (disposed || !activeModelRoot) return null;
        if (!sourceCache.has(url)) caseTransientContainer = container;
        caseRoot = new TransformNode(`hqCaseRoot_${Date.now()}`, scene);
        // Kılıf ve telefon aynı orijinde üretildiği için ek dönüşüm gerekmez.
        caseRoot.parent = activeModelRoot;
        caseEntries = container.instantiateModelsToScene(
            (sourceName) => `hqCase_${sourceName}`,
            false,
            { doNotInstantiate: true }
        );
        for (const rootNode of caseEntries.rootNodes) rootNode.parent = caseRoot;
        activeCaseUrl = url;
        return url;
    };

    const getCase = () => activeCaseUrl;

    const setExplodeListener = (fn) => {
        onExplodeChange = typeof fn === 'function' ? fn : null;
    };

    /** Alt araç çubuğunun yüksekliği; parçalar bu şeridin üzerine taşmaz. */
    const setBottomInset = (pixels) => {
        bottomInsetPx = Math.max(0, finiteNumber(pixels, 0));
    };

    const clear = () => {
        if (disposed) return;
        requestVersion += 1;
        releasePresentation();
        publishState({
            phase: 'idle',
            productId: null,
            modelUrl: null,
            message: 'Bir ürün seçin.',
            stats: null,
            error: null
        });
    };

    const resize = () => {
        if (!disposed) {
            applyDeviceResolution(engine, { maxDpr: 2 });
            engine.resize();
        }
    };

    const getState = () => ({
        ...state,
        stats: state.stats ? { ...state.stats } : null,
        cacheEntries: sourceCache.size
    });

    const dispose = () => {
        if (disposed) return;
        disposed = true;
        requestVersion += 1;
        releasePresentation();
        for (const container of sourceCache.values()) container.dispose();
        sourceCache.clear();
        camera.detachControl();
        scene.dispose();
        engine.dispose();
    };

    engine.runRenderLoop(() => {
        if (!disposed) scene.render();
    });
    scene.onBeforeRenderObservable.add(() => {
        if (!activeRoot || !heroMotion) {
            updateHotspots();
            return;
        }
        const now = performance.now();
        const progress = Math.min(1, (now - heroMotion.startedAt) / 620);
        const eased = 1 - Math.pow(1 - progress, 3);
        const scale = 0.82 + eased * 0.18;
        activeRoot.scaling.copyFromFloats(scale, scale, scale);
        activeRoot.position.y = -heroMotion.lift * (1 - eased);
        updateHotspots();
    });
    publishState(state);

    return {
        open,
        clear,
        resize,
        dispose,
        getState,
        toggleExplode,
        explodeState,
        setExplodeListener,
        setBottomInset,
        setCase,
        getCase
    };
};
