import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene, ScenePerformancePriority } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';

import { applyDeviceResolution } from './render-resolution.js';

import '@babylonjs/loaders/glTF';

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeInOutCubic = (value) => value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
const mix = (from, to, amount) => from + (to - from) * amount;

const createEngine = (canvas) => {
    const engine = new Engine(canvas, true, {
        antialias: true,
        powerPreference: 'high-performance',
        audioEngine: false,
        preserveDrawingBuffer: false,
        stencil: false,
        useHighPrecisionFloats: false
    }, true);
    engine.enableOfflineSupport = false;
    applyDeviceResolution(engine, { maxDpr: 1.5 });
    return engine;
};

const shouldRenderInSelection = (mesh) => {
    if (!mesh.geometry) return true;
    if (mesh.name.startsWith('outside:') || mesh.name.startsWith('always:')) return true;
    const bounds = mesh.getBoundingInfo().boundingBox;
    const size = bounds.extendSizeWorld.scale(2);
    return Math.max(size.x, size.y, size.z) >= 1.25;
};

export const createSelectionWorld = ({
    canvas,
    screen,
    markerLayer,
    statusElement,
    stores,
    assetUrl
} = {}) => {
    if (!canvas || !screen || !markerLayer || !stores || !assetUrl) {
        throw new Error('Seçim dünyası için gerekli öğeler bulunamadı.');
    }

    const engine = createEngine(canvas);
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    scene.performancePriority = ScenePerformancePriority.Aggressive;
    scene.clearColor = new Color4(0.86, 0.82, 0.75, 1);
    scene.ambientColor = new Color3(0.92, 0.86, 0.78);
    scene.skipPointerMovePicking = true;
    scene.blockMaterialDirtyMechanism = true;

    const initialTarget = new Vector3(0, 0, 0);
    const camera = new ArcRotateCamera(
        'selectionMapCamera',
        -Math.PI / 2,
        0.42,
        5100,
        initialTarget,
        scene
    );
    camera.fov = 0.74;
    camera.minZ = 0.25;
    camera.maxZ = 12000;
    camera.lowerRadiusLimit = 82;
    camera.upperRadiusLimit = 6200;
    camera.lowerBetaLimit = 0.28;
    camera.upperBetaLimit = 1.05;
    camera.panningSensibility = 0;
    camera.wheelPrecision = 0.35;
    camera.wheelDeltaPercentage = 0.35;
    camera.inertia = 0.72;
    camera.attachControl(canvas, true);

    const light = new HemisphericLight('selectionSoftLight', new Vector3(-0.3, 1, 0.2), scene);
    light.diffuse = new Color3(1, 0.94, 0.86);
    light.groundColor = new Color3(0.46, 0.51, 0.55);
    light.intensity = 1.16;

    const markerButtons = [...markerLayer.querySelectorAll('[data-selection-store]')];
    let ready = false;
    let disposed = false;
    let travelling = false;
    let resolveReady;
    const readyPromise = new Promise((resolve) => {
        resolveReady = resolve;
    });

    const setStatus = (message, progress = null) => {
        if (!statusElement) return;
        statusElement.textContent = message;
        if (progress === null) delete statusElement.dataset.progress;
        else statusElement.dataset.progress = String(Math.round(progress));
    };

    const updateMarkers = () => {
        if (disposed) return;
        const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
        const canvasRect = canvas.getBoundingClientRect();
        for (const button of markerButtons) {
            const store = stores[button.dataset.selectionStore];
            if (!store) continue;
            const anchor = store.bounds.entrance.add(new Vector3(0, 3.6, 0));
            const projected = Vector3.Project(anchor, Matrix.IdentityReadOnly, scene.getTransformMatrix(), viewport);
            const visible = projected.z > 0 && projected.z < 1 && button.dataset.filterHidden !== 'true';
            button.hidden = !visible;
            if (!visible) continue;
            button.style.transform = `translate3d(${projected.x / engine.getRenderWidth() * canvasRect.width}px, ${projected.y / engine.getRenderHeight() * canvasRect.height}px, 0)`;
        }
    };

    const load = async () => {
        try {
            setStatus('Harita yükleniyor', 4);
            const url = new URL(assetUrl, window.location.href);
            const filename = `${url.pathname.split('/').pop()}${url.search}`;
            const rootUrl = url.href.slice(0, url.href.length - filename.length);
            const container = await SceneLoader.LoadAssetContainerAsync(rootUrl, filename, scene, (event) => {
                const progress = event.lengthComputable && event.total
                    ? clamp01(event.loaded / event.total) * 100
                    : null;
                setStatus(progress === null ? 'Harita yükleniyor' : `Harita yükleniyor · %${Math.round(progress)}`, progress);
            });
            if (disposed) {
                container.dispose();
                return;
            }
            container.addAllToScene();
            const terrainMesh = container.meshes.find((mesh) => mesh.name.includes('outside:GIS_Terrain_2km'));
            if (terrainMesh?.geometry) {
                const terrainBounds = terrainMesh.getBoundingInfo().boundingBox;
                const terrainSize = terrainBounds.extendSizeWorld.scale(2);
                const mapSpan = Math.max(terrainSize.x, terrainSize.z);
                camera.target.copyFrom(terrainBounds.centerWorld);
                camera.radius = Math.max(900, mapSpan * 1.28);
                camera.upperRadiusLimit = Math.max(camera.radius * 1.2, 6200);
            }
            let hiddenDetailMeshes = 0;
            for (const mesh of container.meshes) {
                mesh.isPickable = false;
                mesh.checkCollisions = false;
                mesh.alwaysSelectAsActiveMesh = false;
                mesh.freezeWorldMatrix();
                if (!shouldRenderInSelection(mesh)) {
                    mesh.setEnabled(false);
                    hiddenDetailMeshes += 1;
                }
            }
            for (const material of container.materials) material.freeze();
            ready = true;
            screen.classList.add('is-ready');
            screen.dataset.hiddenDetailMeshes = String(hiddenDetailMeshes);
            setStatus('Mağaza seçebilirsiniz', 100);
            window.setTimeout(() => {
                if (disposed) return;
                screen.dataset.fpsSample = String(Math.round(engine.getFps()));
                screen.dataset.activeMeshes = String(scene.getActiveMeshes().length);
                screen.dataset.totalMeshes = String(scene.meshes.length);
            }, 1600);
            if (import.meta.env.DEV) {
                window.__UZUNCARSI_SELECTION_DEBUG__ = {
                    engine,
                    scene,
                    getStats: () => ({
                        fps: Math.round(engine.getFps()),
                        activeMeshes: scene.getActiveMeshes().length,
                        totalMeshes: scene.meshes.length,
                        hiddenDetailMeshes,
                        hardwareScale: engine.getHardwareScalingLevel()
                    })
                };
            }
            resolveReady(container);
        } catch (error) {
            screen.classList.add('has-error');
            setStatus('Harita açılamadı · Aşağıdaki listeden seçim yapabilirsiniz');
            resolveReady(null);
            console.warn('Seçim dünyası yüklenemedi.', error);
        }
    };

    const flyToStore = async (storeId) => {
        if (travelling || disposed) return false;
        const store = stores[storeId];
        if (!store) return false;
        travelling = true;
        screen.classList.add('is-travelling');
        markerButtons.forEach((button) => { button.disabled = true; });
        try {
            await readyPromise.catch(() => null);
            if (!ready || disposed) return true;
            camera.detachControl();
            const start = {
                alpha: camera.alpha,
                beta: camera.beta,
                radius: camera.radius,
                target: camera.target.clone()
            };
            const destinationTarget = store.bounds.entranceTarget.add(new Vector3(0, 2.4, 0));
            const destinationAlpha = Math.PI / 2;
            const startedAt = performance.now();
            const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 1850;
            await new Promise((resolve) => {
                const frame = (now) => {
                    const linear = clamp01((now - startedAt) / duration);
                    const amount = easeInOutCubic(linear);
                    camera.alpha = mix(start.alpha, destinationAlpha, amount);
                    camera.beta = mix(start.beta, 1.17, amount);
                    camera.radius = mix(start.radius, 20, amount);
                    camera.target.copyFrom(Vector3.Lerp(start.target, destinationTarget, amount));
                    if (linear >= 1 || disposed) resolve();
                    else requestAnimationFrame(frame);
                };
                requestAnimationFrame(frame);
            });
            return true;
        } finally {
            screen.classList.add('is-departing');
        }
    };

    const resize = () => {
        applyDeviceResolution(engine, { maxDpr: 1.5 });
        engine.resize();
    };
    window.addEventListener('resize', resize, { passive: true });
    scene.onAfterRenderObservable.add(updateMarkers);
    engine.runRenderLoop(() => scene.render());
    void load();

    return {
        get ready() { return ready; },
        whenReady: readyPromise,
        flyToStore,
        dispose() {
            if (disposed) return;
            disposed = true;
            if (import.meta.env.DEV) delete window.__UZUNCARSI_SELECTION_DEBUG__;
            window.removeEventListener('resize', resize);
            engine.stopRenderLoop();
            scene.dispose();
            engine.dispose();
        }
    };
};
