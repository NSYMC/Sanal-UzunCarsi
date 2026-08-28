import './product-search-highlight.css';

import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer';
import {
    createGuidanceControlPoints,
    pathLength,
    samplePathAtDistance,
    sampleRoundedGuidancePath
} from './product-guidance-path.js';

const productIdForMesh = (mesh) => mesh?.metadata?.productId || mesh?.metadata?.modeledProductId || null;

const buildStatus = () => {
    const root = document.createElement('div');
    root.className = 'scene-filter-status hidden';
    root.setAttribute('role', 'status');
    root.innerHTML = `
        <span class="scene-filter-status__mark" aria-hidden="true"></span>
        <div><strong data-filter-count></strong><small data-filter-detail></small><em data-filter-distance></em></div>
        <button type="button" data-filter-hide>Gizle</button>
    `;
    document.body.append(root);
    return root;
};

const meshCenter = (mesh) => {
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();
    const box = mesh.getBoundingInfo().boundingBox;
    return {
        center: box.minimumWorld.add(box.maximumWorld).scale(0.5),
        top: box.maximumWorld.y,
        size: box.maximumWorld.subtract(box.minimumWorld)
    };
};

export const createProductSearchHighlight = ({ scene, registry } = {}) => {
    if (!scene || !registry) return { setStoreContext() {}, setSuspended() {}, applyFilters() {}, clear() {}, dispose() {} };

    const status = buildStatus();
    const count = status.querySelector('[data-filter-count]');
    const detail = status.querySelector('[data-filter-detail]');
    const distanceLabel = status.querySelector('[data-filter-distance]');
    const hide = status.querySelector('[data-filter-hide]');
    const warmColor = Color3.FromHexString('#D99B32');
    const highlight = new HighlightLayer('filteredProductHighlight', scene, {
        blurHorizontalSize: 0.42,
        blurVerticalSize: 0.42
    });
    highlight.innerGlow = false;
    highlight.outerGlow = true;

    const markerMaterial = new StandardMaterial('filteredProductMarkerMaterial', scene);
    markerMaterial.disableLighting = true;
    markerMaterial.emissiveColor = warmColor.scale(0.8);
    markerMaterial.diffuseColor = warmColor;
    markerMaterial.alpha = 0.62;
    markerMaterial.backFaceCulling = false;
    const markerSource = MeshBuilder.CreateTorus('filteredProductMarkers', {
        diameter: 1,
        thickness: 0.028,
        tessellation: 32
    }, scene);
    markerSource.material = markerMaterial;
    markerSource.isPickable = false;
    markerSource.checkCollisions = false;
    markerSource.setEnabled(false);

    const routeMaterial = new StandardMaterial('filteredProductRouteMaterial', scene);
    routeMaterial.disableLighting = true;
    routeMaterial.emissiveColor = warmColor.scale(0.58);
    routeMaterial.diffuseColor = warmColor;
    routeMaterial.alpha = 0.2;
    routeMaterial.backFaceCulling = false;
    const flowMaterial = new StandardMaterial('filteredProductFlowMaterial', scene);
    flowMaterial.disableLighting = true;
    flowMaterial.emissiveColor = Color3.FromHexString('#FFD985');
    flowMaterial.diffuseColor = warmColor;
    flowMaterial.alpha = 0.82;
    const flowSource = MeshBuilder.CreateBox('filteredProductRouteFlow', {
        width: 0.105,
        height: 0.018,
        depth: 0.4
    }, scene);
    flowSource.material = flowMaterial;
    flowSource.isPickable = false;
    flowSource.checkCollisions = false;
    flowSource.alwaysSelectAsActiveMesh = true;
    flowSource.setEnabled(false);

    let storeId = '';
    let runtime = null;
    let floorY = null;
    let storeBounds = null;
    let filters = null;
    let suspended = false;
    let targetCenter = null;
    let lastTrailCameraPosition = null;
    let routePath = [];
    let routeLength = 0;
    let routeMesh = null;

    const clearVisuals = () => {
        highlight.removeAllMeshes();
        markerSource.thinInstanceSetBuffer('matrix', null);
        flowSource.thinInstanceSetBuffer('matrix', null);
        markerSource.setEnabled(false);
        flowSource.setEnabled(false);
        routeMesh?.dispose(false, false);
        routeMesh = null;
        routePath = [];
        routeLength = 0;
        targetCenter = null;
        lastTrailCameraPosition = null;
        status.classList.add('hidden');
    };

    const setThinInstances = (source, matrices, refreshBounds = true) => {
        if (!matrices.length) {
            source.thinInstanceSetBuffer('matrix', null);
            source.setEnabled(false);
            return;
        }
        const buffer = new Float32Array(matrices.length * 16);
        matrices.forEach((matrix, index) => matrix.copyToArray(buffer, index * 16));
        source.thinInstanceSetBuffer('matrix', buffer, 16, true);
        if (refreshBounds) source.thinInstanceRefreshBoundingInfo(true);
        source.setEnabled(true);
    };

    let lastFlowUpdateAt = 0;
    const rebuildFlowInstances = (phase = 0, refreshBounds = false) => {
        if (routeLength < 1.4 || routePath.length < 2) {
            setThinInstances(flowSource, []);
            return;
        }
        const spacing = 0.72;
        const firstDistance = 0.75 + phase * spacing;
        const matrices = [];
        for (let distance = firstDistance; distance < routeLength - 0.45 && matrices.length < 48; distance += spacing) {
            const sample = samplePathAtDistance(routePath, distance);
            if (!sample) continue;
            const angle = Math.atan2(sample.direction.x, sample.direction.z);
            matrices.push(Matrix.Compose(
                Vector3.One(),
                Quaternion.FromEulerAngles(0, angle, 0),
                new Vector3(sample.x, sample.y + 0.012, sample.z)
            ));
        }
        setThinInstances(flowSource, matrices, refreshBounds);
    };

    const rebuildTrail = () => {
        const camera = scene.activeCamera;
        if (!camera || !targetCenter || !Number.isFinite(floorY) || !storeBounds || suspended) return;
        const directDistance = Math.hypot(targetCenter.x - camera.position.x, targetCenter.z - camera.position.z);
        routeMesh?.dispose(false, false);
        routeMesh = null;
        if (directDistance < 1.55) {
            routePath = [];
            routeLength = 0;
            setThinInstances(flowSource, []);
            distanceLabel.textContent = 'Hedefe ulaştınız';
            return;
        }

        const controls = createGuidanceControlPoints({
            origin: camera.position,
            target: targetCenter,
            bounds: storeBounds,
            floorY
        });
        routePath = sampleRoundedGuidancePath(controls);
        routeLength = pathLength(routePath);
        if (routePath.length >= 2 && routeLength >= 1.4) {
            const left = [];
            const right = [];
            for (let index = 0; index < routePath.length; index += 1) {
                const previous = routePath[Math.max(0, index - 1)];
                const next = routePath[Math.min(routePath.length - 1, index + 1)];
                const dx = next.x - previous.x;
                const dz = next.z - previous.z;
                const length = Math.hypot(dx, dz) || 1;
                const offsetX = (-dz / length) * 0.085;
                const offsetZ = (dx / length) * 0.085;
                left.push(new Vector3(routePath[index].x + offsetX, routePath[index].y, routePath[index].z + offsetZ));
                right.push(new Vector3(routePath[index].x - offsetX, routePath[index].y, routePath[index].z - offsetZ));
            }
            routeMesh = MeshBuilder.CreateRibbon('filteredProductRouteRibbon', {
                pathArray: [left, right],
                closeArray: false,
                closePath: false,
                updatable: false,
                sideOrientation: 2
            }, scene);
            routeMesh.material = routeMaterial;
            routeMesh.isPickable = false;
            routeMesh.checkCollisions = false;
            routeMesh.alwaysSelectAsActiveMesh = true;
        }
        rebuildFlowInstances((performance.now() * 0.00038) % 1, true);
        distanceLabel.textContent = `Yaklaşık ${Math.max(1, Math.round(routeLength))} m`;
        lastTrailCameraPosition = camera.position.clone();
    };

    const markerRecords = (productIds) => {
        const seen = new Set();
        return (runtime?.selectionBoxes || []).flatMap((mesh) => {
            const productId = productIdForMesh(mesh);
            if (!productIds.has(productId) || seen.has(productId) || mesh?.isDisposed?.()) return [];
            seen.add(productId);
            const { center, top, size } = meshCenter(mesh);
            const diameter = Math.max(0.2, Math.min(Math.max(size.x, size.z) * 1.12, 1.15));
            const markerPosition = new Vector3(center.x, top + 0.035, center.z);
            const matrix = Matrix.Compose(
                new Vector3(diameter, diameter, diameter),
                Quaternion.Identity(),
                markerPosition
            );
            return [{ productId, center, matrix }];
        });
    };

    const render = () => {
        clearVisuals();
        if (!filters || !runtime || !storeId || suspended) return 0;
        const matches = registry.filterProducts({ ...filters, storeId });
        const productIds = new Set(matches.map((product) => product.id));
        if (!productIds.size) return 0;

        const highlightedProducts = new Set();
        for (const mesh of runtime.renderMeshes || []) {
            const productId = productIdForMesh(mesh);
            if (!productIds.has(productId) || !mesh?.geometry || mesh.isDisposed?.() || mesh.isEnabled?.() === false) continue;
            if (mesh.getClassName?.() === 'InstancedMesh') continue;
            highlight.addMesh(mesh, warmColor.scale(0.58));
            highlightedProducts.add(productId);
        }

        const markers = markerRecords(productIds);
        setThinInstances(markerSource, markers.map(({ matrix }) => matrix));
        const camera = scene.activeCamera;
        if (camera && markers.length) {
            markers.sort((a, b) => Vector3.DistanceSquared(a.center, camera.position) - Vector3.DistanceSquared(b.center, camera.position));
            targetCenter = markers[0].center.clone();
            rebuildTrail();
        }

        const markedCount = markers.length || highlightedProducts.size;
        if (markedCount) {
            count.textContent = `${markedCount} ürün bulundu`;
            detail.textContent = 'En yakın eşleşmeye giden ışıklı izi takip edin';
            status.classList.remove('hidden');
        }
        return markedCount;
    };

    const animationObserver = scene.onBeforeRenderObservable.add(() => {
        if (!filters || suspended) return;
        const pulse = 0.52 + Math.sin(performance.now() * 0.0032) * 0.1;
        markerMaterial.alpha = pulse;
        flowMaterial.alpha = 0.72 + pulse * 0.22;
        routeMaterial.alpha = 0.13 + pulse * 0.1;
        const now = performance.now();
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion || now - lastFlowUpdateAt >= 50) {
            rebuildFlowInstances(reducedMotion ? 0 : (now * 0.00038) % 1);
            lastFlowUpdateAt = now;
        }
        const camera = scene.activeCamera;
        if (camera && (!lastTrailCameraPosition || Vector3.DistanceSquared(camera.position, lastTrailCameraPosition) > 0.72)) {
            rebuildTrail();
        }
    });

    hide.addEventListener('click', clearVisuals);

    return {
        setStoreContext(nextStoreId, nextRuntime, options = {}) {
            storeId = nextStoreId || '';
            runtime = nextRuntime || null;
            floorY = Number.isFinite(options.floorY) ? options.floorY : null;
            storeBounds = options.bounds || null;
            if (filters) render();
        },
        setSuspended(nextSuspended) {
            suspended = Boolean(nextSuspended);
            if (suspended) clearVisuals();
            else if (filters) render();
        },
        applyFilters(nextFilters = {}) {
            if (!nextFilters.active) {
                filters = null;
                clearVisuals();
                return 0;
            }
            filters = {
                query: String(nextFilters.query || '').trim(),
                category: nextFilters.category || null,
                minPrice: nextFilters.minPrice ?? null,
                maxPrice: nextFilters.maxPrice ?? null
            };
            return render();
        },
        clear: clearVisuals,
        dispose() {
            clearVisuals();
            scene.onBeforeRenderObservable.remove(animationObserver);
            highlight.dispose();
            markerSource.dispose(false, false);
            markerMaterial.dispose();
            routeMesh?.dispose(false, false);
            routeMaterial.dispose();
            flowSource.dispose(false, false);
            flowMaterial.dispose();
            status.remove();
        }
    };
};
