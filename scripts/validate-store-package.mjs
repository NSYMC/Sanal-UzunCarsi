import { readFile } from 'node:fs/promises';
import path from 'node:path';

const packageDir = path.resolve(process.argv[2] || 'public/models/guzel-optik');
const profileName = (process.argv[3] || 'optik').toLowerCase();
const profiles = {
    optik: {
        productPattern: /^OPTIK_PRODUCT_\d{3}/i,
        drawBudget: 80,
        proxyDrawBudget: 3,
        proxyTriangleBudget: 250_000,
        requireInstancing: true
    },
    sude: {
        productPattern: /^SUDE_CATALOG_\d+/i,
        drawBudget: 340,
        proxyDrawBudget: 130,
        proxyTriangleBudget: 40_000,
        requireInstancing: false
    }
};
const profile = profiles[profileName];
if (!profile) throw new Error(`Bilinmeyen doğrulama profili: ${profileName}`);
const readGlbJson = async (name) => {
    const bytes = await readFile(path.join(packageDir, name));
    if (bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${name} geçerli bir GLB değil.`);
    const length = bytes.readUInt32LE(12);
    return { bytes, gltf: JSON.parse(bytes.subarray(20, 20 + length).toString('utf8').replace(/[\u0000 ]+$/, '')) };
};
const countProducts = (gltf) => new Set((gltf.nodes || [])
    .map((node) => (node.name || '').match(profile.productPattern)?.[0]?.toUpperCase())
    .filter(Boolean)).size;
const estimateDraws = (gltf) => (gltf.nodes || []).reduce((sum, node) => (
    sum + (node.mesh == null ? 0 : (gltf.meshes?.[node.mesh]?.primitives?.length || 0))
), 0);
const triangleCount = (gltf) => (gltf.meshes || []).reduce((meshTotal, mesh) => (
    meshTotal + (mesh.primitives || []).reduce((primitiveTotal, primitive) => {
        if ((primitive.mode ?? 4) !== 4) return primitiveTotal;
        const accessor = gltf.accessors?.[primitive.indices ?? primitive.attributes?.POSITION];
        return primitiveTotal + Math.floor((accessor?.count || 0) / 3);
    }, 0)
), 0);

const environment = await readGlbJson('store-environment.glb');
const proxies = await readGlbJson('product-proxies.glb');
const library = await readGlbJson('product-library.glb');
const manifest = JSON.parse(await readFile(path.join(packageDir, 'products.json'), 'utf8'));
const problems = [];
const manifestProducts = Array.isArray(manifest.products) ? manifest.products : [];
const manifestIds = new Set(manifestProducts.map((product) => product?.id).filter(Boolean));
const libraryProductCount = countProducts(library.gltf);
const environmentProductIds = new Set((environment.gltf.nodes || [])
    .map((node) => (node.name || '').match(profile.productPattern)?.[0]?.toUpperCase())
    .filter(Boolean));
const integratedRawStore = profileName === 'optik'
    && environmentProductIds.size > 0
    && environmentProductIds.size === manifestIds.size;

if (integratedRawStore) {
    const missingFromScene = [...manifestIds].filter((id) => !environmentProductIds.has(id));
    const missingFromManifest = [...environmentProductIds].filter((id) => !manifestIds.has(id));
    if (missingFromScene.length || missingFromManifest.length) {
        problems.push(`Ham çevre ile seçim manifesti uyuşmuyor (sahnede eksik: ${missingFromScene.length}, manifestte eksik: ${missingFromManifest.length}).`);
    }
} else {
    if (countProducts(environment.gltf) !== 0) problems.push('Çevre paketinde ürün düğümleri kaldı.');
    if (profile.requireInstancing && !(environment.gltf.extensionsUsed || []).includes('EXT_mesh_gpu_instancing')) problems.push('Çevrede GPU instancing bulunamadı.');
    if (estimateDraws(environment.gltf) > profile.drawBudget) problems.push(`Çevre tahmini draw-call bütçesini aşıyor: ${estimateDraws(environment.gltf)}.`);
    if ((proxies.gltf.meshes || []).length > profile.proxyDrawBudget || estimateDraws(proxies.gltf) > profile.proxyDrawBudget) {
        problems.push(`Ürün proxy paketi ${profile.proxyDrawBudget} draw-call sınırını aşıyor.`);
    }
    if (triangleCount(proxies.gltf) > profile.proxyTriangleBudget) problems.push(`Proxy üçgen bütçesi aşıldı: ${triangleCount(proxies.gltf)}.`);
}
if (manifestProducts.length === 0) problems.push('Seçim manifestinde ürün bulunamadı.');
if (manifestIds.size !== manifestProducts.length) problems.push('Seçim manifestinde eksik veya yinelenen ürün kimliği var.');
if (!integratedRawStore && libraryProductCount !== manifestProducts.length) {
    problems.push(`Yüksek kalite kütüphanesi (${libraryProductCount}) ile seçim manifesti (${manifestProducts.length}) ürün sayısı uyuşmuyor.`);
}
if (problems.length) throw new Error(`Dükkân paketi doğrulanamadı:\n${problems.join('\n')}`);

console.log(JSON.stringify({
    environment: {
        mode: integratedRawStore ? 'raw-integrated-products' : 'split-optimized',
        sizeMB: Number((environment.bytes.length / 1_000_000).toFixed(2)),
        nodes: environment.gltf.nodes?.length || 0,
        meshes: environment.gltf.meshes?.length || 0,
        materials: environment.gltf.materials?.length || 0,
        estimatedDraws: estimateDraws(environment.gltf)
    },
    proxies: {
        sizeMB: Number((proxies.bytes.length / 1_000_000).toFixed(2)),
        meshes: proxies.gltf.meshes?.length || 0,
        triangles: triangleCount(proxies.gltf),
        estimatedDraws: estimateDraws(proxies.gltf)
    },
    productLibrary: {
        sizeMB: Number((library.bytes.length / 1_000_000).toFixed(2)),
        products: libraryProductCount,
        initiallyRendered: false
    }
}, null, 2));
