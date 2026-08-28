import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';

const filename = process.argv[2];
if (!filename) throw new Error('Kullanım: node scripts/inspect-glb-structure.mjs <dosya.glb> [aranacak-ifade]');

const buffer = await readFile(path.resolve(filename));
if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2) {
    throw new Error('Geçerli bir GLB 2.0 dosyası değil.');
}
const jsonLength = buffer.readUInt32LE(12);
const document = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trim());
const nodes = document.nodes || [];
const childIndices = new Set(nodes.flatMap((node) => node.children || []));
const parents = new Map();
nodes.forEach((node, parentIndex) => (node.children || []).forEach((childIndex) => parents.set(childIndex, parentIndex)));

const localMatrix = (node) => {
    if (Array.isArray(node.matrix) && node.matrix.length === 16) return Matrix.FromArray(node.matrix);
    return Matrix.Compose(
        Vector3.FromArray(node.scale || [1, 1, 1]),
        Quaternion.FromArray(node.rotation || [0, 0, 0, 1]),
        Vector3.FromArray(node.translation || [0, 0, 0])
    );
};
const worldMatrices = new Map();
const worldMatrix = (index) => {
    if (worldMatrices.has(index)) return worldMatrices.get(index);
    const local = localMatrix(nodes[index]);
    const parentIndex = parents.get(index);
    const world = parentIndex == null ? local : local.multiply(worldMatrix(parentIndex));
    worldMatrices.set(index, world);
    return world;
};
const spatialBounds = (node, index) => {
    if (node.mesh == null) return null;
    const accessors = (document.meshes?.[node.mesh]?.primitives || [])
        .map((primitive) => document.accessors?.[primitive.attributes?.POSITION])
        .filter((accessor) => Array.isArray(accessor?.min) && Array.isArray(accessor?.max));
    if (!accessors.length) return null;
    const minimum = accessors.reduce((result, accessor) => Vector3.Minimize(result, Vector3.FromArray(accessor.min)), new Vector3(Infinity, Infinity, Infinity));
    const maximum = accessors.reduce((result, accessor) => Vector3.Maximize(result, Vector3.FromArray(accessor.max)), new Vector3(-Infinity, -Infinity, -Infinity));
    const corners = [
        [minimum.x, minimum.y, minimum.z], [maximum.x, minimum.y, minimum.z],
        [minimum.x, maximum.y, minimum.z], [maximum.x, maximum.y, minimum.z],
        [minimum.x, minimum.y, maximum.z], [maximum.x, minimum.y, maximum.z],
        [minimum.x, maximum.y, maximum.z], [maximum.x, maximum.y, maximum.z]
    ].map((corner) => Vector3.TransformCoordinates(Vector3.FromArray(corner), worldMatrix(index)));
    const worldMin = corners.reduce((result, corner) => Vector3.Minimize(result, corner), new Vector3(Infinity, Infinity, Infinity));
    const worldMax = corners.reduce((result, corner) => Vector3.Maximize(result, corner), new Vector3(-Infinity, -Infinity, -Infinity));
    return {
        center: worldMin.add(worldMax).scale(0.5).asArray().map((value) => Number(value.toFixed(4))),
        size: worldMax.subtract(worldMin).asArray().map((value) => Number(value.toFixed(4)))
    };
};

const patternSource = process.argv[3];
const pattern = patternSource ? new RegExp(patternSource, 'i') : null;
const matches = nodes
    .map((node, index) => ({
        index,
        name: node.name || '',
        mesh: node.mesh == null ? '' : document.meshes?.[node.mesh]?.name || `mesh:${node.mesh}`,
        parent: parents.has(index) ? nodes[parents.get(index)]?.name || `node:${parents.get(index)}` : '',
        children: node.children?.length || 0,
        bounds: spatialBounds(node, index)
    }))
    .filter((entry) => !pattern || pattern.test(`${entry.name} ${entry.mesh} ${entry.parent}`));

console.log(JSON.stringify({
    file: path.basename(filename),
    sizeMB: Number((buffer.length / 1024 / 1024).toFixed(2)),
    nodes: nodes.length,
    meshes: document.meshes?.length || 0,
    materials: document.materials?.length || 0,
    textures: document.textures?.length || 0,
    roots: nodes.map((node, index) => ({ index, name: node.name || '', mesh: node.mesh })).filter((entry) => !childIndices.has(entry.index)),
    matches: matches.slice(0, 1000),
    truncated: matches.length > 1000,
    matchCount: matches.length
}, null, 2));
