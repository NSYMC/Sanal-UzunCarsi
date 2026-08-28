const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const easeInOutCubic = (value) => {
    const t = clamp01(value);
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const mix = (a, b, amount) => a + (b - a) * amount;

const mixPoint = (a, b, amount) => ({
    x: mix(a.x, b.x, amount),
    y: mix(a.y, b.y, amount),
    z: mix(a.z, b.z, amount)
});

const normalizedXZ = (from, to) => {
    const x = to.x - from.x;
    const z = to.z - from.z;
    const length = Math.hypot(x, z) || 1;
    return { x: x / length, z: z / length };
};

export const createStoreEntranceShot = (bounds, {
    approachDistance = 8.4,
    settleDistance = 5.2
} = {}) => {
    const inward = normalizedXZ(bounds.entrance, bounds.entranceTarget);
    const eyeY = bounds.entrance.y;
    const start = {
        x: bounds.entrance.x - inward.x * approachDistance,
        y: eyeY + 0.18,
        z: bounds.entrance.z - inward.z * approachDistance
    };
    const approach = {
        x: bounds.entrance.x - inward.x * 2.5,
        y: eyeY + 0.08,
        z: bounds.entrance.z - inward.z * 2.5
    };
    const threshold = {
        x: bounds.entrance.x + inward.x * 0.8,
        y: eyeY,
        z: bounds.entrance.z + inward.z * 0.8
    };
    const settle = {
        x: bounds.entrance.x + inward.x * settleDistance,
        y: eyeY,
        z: bounds.entrance.z + inward.z * settleDistance
    };
    const lookAt = {
        x: bounds.entranceTarget.x + inward.x * 3.2,
        y: eyeY + 0.05,
        z: bounds.entranceTarget.z + inward.z * 3.2
    };
    return { start, approach, threshold, settle, lookAt, inward };
};

export const sampleStoreEntranceShot = (shot, progress) => {
    const t = easeInOutCubic(progress);
    if (t < 0.34) return mixPoint(shot.start, shot.approach, easeInOutCubic(t / 0.34));
    if (t < 0.68) return mixPoint(shot.approach, shot.threshold, easeInOutCubic((t - 0.34) / 0.34));
    return mixPoint(shot.threshold, shot.settle, easeInOutCubic((t - 0.68) / 0.32));
};

const createOverlay = () => {
    const root = document.createElement('div');
    root.className = 'store-entry-cinematic';
    root.hidden = true;
    root.innerHTML = `
        <div class="store-entry-cinematic__veil" aria-hidden="true"></div>
        <div class="store-entry-cinematic__copy" aria-live="polite">
            <span data-entry-kicker>SANAL UZUN ÇARŞI</span>
            <strong data-entry-store></strong>
            <small data-entry-category></small>
            <i aria-hidden="true"><b data-entry-progress></b></i>
        </div>
        <button type="button" data-entry-skip>Sinematiği geç</button>
    `;
    document.body.append(root);
    return root;
};

const setLightReveal = (lighting, progress, baseIntensities) => {
    if (!lighting || !baseIntensities) return;
    const reveal = 0.12 + easeInOutCubic(clamp01((progress - 0.36) / 0.64)) * 0.88;
    baseIntensities.forEach(([light, intensity]) => {
        if (light && !light.isDisposed?.()) light.intensity = intensity * reveal;
    });
};

export const createStoreEntryCinematic = ({ scene, camera, canvas } = {}) => {
    if (!scene || !camera || !canvas) {
        return { play: async () => {}, cancel() {}, dispose() {}, get active() { return false; } };
    }

    const root = createOverlay();
    const storeName = root.querySelector('[data-entry-store]');
    const category = root.querySelector('[data-entry-category]');
    const progressBar = root.querySelector('[data-entry-progress]');
    const skipButton = root.querySelector('[data-entry-skip]');
    let activeRun = null;
    let disposed = false;

    const finishActiveRun = () => activeRun?.finish?.();
    const onKeyDown = (event) => {
        if (event.key === 'Escape' && activeRun) {
            event.preventDefault();
            finishActiveRun();
        }
    };
    skipButton.addEventListener('click', finishActiveRun);
    window.addEventListener('keydown', onKeyDown, true);

    const play = async ({ store, lighting = null, duration = 4300, reducedMotion = false } = {}) => {
        if (disposed || !store?.bounds) return;
        // Aynı kamera üzerinde iki sekansın yarışıp kontrolleri yanlış sırada açmasını engeller.
        if (activeRun) return;

        const shot = createStoreEntranceShot(store.bounds);
        const lights = [lighting?.ambient, lighting?.doorway, ...(lighting?.interiorFills || [])].filter(Boolean);
        const baseIntensities = lights.map((light) => [light, light.intensity]);
        const previous = {
            collisions: camera.checkCollisions,
            gravity: camera.applyGravity
        };
        const prefersReducedMotion = reducedMotion
            || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

        document.exitPointerLock?.();
        camera.detachControl();
        camera.checkCollisions = false;
        camera.applyGravity = false;
        camera.cameraDirection?.setAll?.(0);
        camera.cameraRotation?.setAll?.(0);
        camera.metadata = { ...(camera.metadata || {}), cinematicInputLocked: true };

        storeName.textContent = store.shortName || store.name || '';
        category.textContent = store.category || '';
        root.hidden = false;
        root.classList.remove('is-visible', 'is-leaving');
        requestAnimationFrame(() => root.classList.add('is-visible'));

        const placeCamera = (progress) => {
            const position = sampleStoreEntranceShot(shot, progress);
            camera.position.copyFromFloats(position.x, position.y, position.z);
            const lookAmount = easeInOutCubic(clamp01(progress * 1.35));
            const lookTarget = mixPoint(shot.threshold, shot.lookAt, lookAmount);
            camera.setTarget(new camera.position.constructor(lookTarget.x, lookTarget.y, lookTarget.z));
            camera.cameraDirection?.setAll?.(0);
            camera.cameraRotation?.setAll?.(0);
            progressBar.style.transform = `scaleX(${clamp01(progress)})`;
            setLightReveal(lighting, progress, baseIntensities);
        };

        if (prefersReducedMotion) {
            placeCamera(1);
            root.hidden = true;
            camera.checkCollisions = previous.collisions;
            camera.applyGravity = previous.gravity;
            camera.metadata.cinematicInputLocked = false;
            camera.attachControl(canvas, true);
            return;
        }

        placeCamera(0);
        await new Promise((resolve) => {
            const startedAt = performance.now();
            let observer = null;
            let completed = false;
            const finish = () => {
                if (completed) return;
                completed = true;
                if (observer) scene.onBeforeRenderObservable.remove(observer);
                placeCamera(1);
                activeRun = null;
                resolve();
            };
            activeRun = { finish };
            observer = scene.onBeforeRenderObservable.add(() => {
                const elapsed = performance.now() - startedAt;
                placeCamera(elapsed / Math.max(1, duration));
                if (elapsed >= duration) finish();
            });
        });

        root.classList.add('is-leaving');
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        root.hidden = true;
        root.classList.remove('is-visible', 'is-leaving');
        camera.checkCollisions = previous.collisions;
        camera.applyGravity = previous.gravity;
        camera.metadata.cinematicInputLocked = false;
        camera.attachControl(canvas, true);
    };

    return {
        play,
        cancel: finishActiveRun,
        dispose() {
            disposed = true;
            finishActiveRun();
            skipButton.removeEventListener('click', finishActiveRun);
            window.removeEventListener('keydown', onKeyDown, true);
            root.remove();
        },
        get active() { return Boolean(activeRun); }
    };
};
