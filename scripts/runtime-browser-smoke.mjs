const endpoint = process.argv[2] || 'http://127.0.0.1:9223';
const screenshotPath = process.argv[3];
const pages = await fetch(`${endpoint}/json`).then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page');
if (!page) throw new Error('Chrome test sekmesi bulunamadı.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const errors = [];
let sequence = 0;
socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
        errors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text || 'Bilinmeyen tarayıcı hatası');
    }
});
await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
};

await call('Runtime.enable');
await call('Page.enable');
await call('Page.reload', { ignoreCache: true });
for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await evaluate("document.readyState === 'complete' && Boolean(document.getElementById('portalExploreAllBtn'))");
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
}
await new Promise((resolve) => setTimeout(resolve, 1500));
await evaluate("document.getElementById('portalExploreAllBtn').click()");

const deadline = Date.now() + 150_000;
let state = null;
while (Date.now() < deadline) {
    state = await evaluate(`(() => {
        const debug = window.__UZUNCARSI_DEBUG__;
        const status = document.getElementById('qualityStatus');
        return {
            ready: Boolean(debug),
            loadingHidden: Boolean(
                document.getElementById('loadingScreen')?.hidden
                || document.getElementById('loadingScreen')?.classList.contains('is-complete')
            ),
            errorVisible: !document.getElementById('errorScreen')?.hidden,
            errorText: document.getElementById('errorMessage')?.textContent || '',
            productStats: debug?.productMatchStats || null,
            displayStats: debug ? (() => {
                const meshes = debug.scene.meshes.filter((mesh) => mesh.metadata?.isOptikDisplayProduct);
                const centers = meshes.slice(0, 6).map((mesh) => {
                    mesh.computeWorldMatrix(true);
                    const center = mesh.getBoundingInfo().boundingBox.centerWorld;
                    return [mesh.name, center.x, center.y, center.z, mesh.isEnabled(), mesh.isVisible, mesh.getTotalVertices()];
                });
                return {
                    meshes: meshes.length,
                    enabled: meshes.filter((mesh) => mesh.isEnabled()).length,
                    visible: meshes.filter((mesh) => mesh.isVisible).length,
                    centers
                };
            })() : null,
            hardwareScale: status?.dataset.hardwareScale || '',
            cameraY: status?.dataset.cameraY || '',
            fps: debug?.getStats?.().fps || 0
        };
    })()`);
    if (state.errorVisible || (state.ready && state.loadingHidden)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (errors.length) throw new Error(`Tarayıcı çalışma zamanı hataları:\n${errors.join('\n')}`);
if (!state?.ready || !state.loadingHidden || state.errorVisible) {
    throw new Error(`Sahne hazır olmadı: ${JSON.stringify(state)}`);
}
if (state.productStats?.placed < 180 || state.productStats?.sources < 11) {
    throw new Error(`Gözlük yerleşimi eksik: ${JSON.stringify(state.productStats)}`);
}
if (state.displayStats?.meshes > 240) {
    throw new Error(`Raf ürünleri fazla sahne düğümü oluşturuyor: ${JSON.stringify(state.displayStats)}`);
}
if (state.hardwareScale && Number(state.hardwareScale) !== 1) {
    throw new Error(`Çözünürlük ölçeği beklenmedik: ${state.hardwareScale}`);
}
if (screenshotPath) {
    await evaluate(`(() => {
        window.activeCamera.position.copyFromFloats(27.15, -6.68, 11.1);
        window.activeCamera.setTarget(new window.BABYLON.Vector3(25.05, -6.68, 11.1));
        return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()`);
    const { data } = await call('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(screenshotPath, Buffer.from(data, 'base64'));
}
await evaluate(`(() => {
    window.activeCamera.position.copyFromFloats(27.15, -6.68, 11.1);
    window.activeCamera.setTarget(new window.BABYLON.Vector3(25.1352, -6.9563, 11.0509));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', bubbles: true }));
})()`);
let inspection = null;
for (let attempt = 0; attempt < 100; attempt += 1) {
    inspection = await evaluate(`(() => ({
        open: !document.getElementById('productInspector')?.classList.contains('hidden'),
        name: document.getElementById('inspectorName')?.textContent || '',
        preview: document.getElementById('productPreviewStatus')?.textContent || ''
    }))()`);
    if (inspection.open) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!inspection?.open || !inspection.name) {
    throw new Error(`Yerleştirilen gözlük tıklama testi başarısız: ${JSON.stringify(inspection)}`);
}
state.inspection = inspection;
socket.close();
console.log(JSON.stringify(state, null, 2));
