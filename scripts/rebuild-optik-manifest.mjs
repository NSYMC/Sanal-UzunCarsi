import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve(process.argv[2] || 'public/models/guzel-optik/store-environment.glb');
const destination = path.resolve('public/models/guzel-optik/products.json');
const buffer = await readFile(source);
if (buffer.toString('ascii', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2) throw new Error('Geçersiz GLB.');
const jsonLength = buffer.readUInt32LE(12);
const document = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trim());

const trsMatrix = (node) => {
    if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix;
    const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
    const [sx, sy, sz] = node.scale || [1, 1, 1];
    const [tx, ty, tz] = node.translation || [0, 0, 0];
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;
    return [
        (1 - 2 * (yy + zz)) * sx, (2 * (xy + wz)) * sx, (2 * (xz - wy)) * sx, 0,
        (2 * (xy - wz)) * sy, (1 - 2 * (xx + zz)) * sy, (2 * (yz + wx)) * sy, 0,
        (2 * (xz + wy)) * sz, (2 * (yz - wx)) * sz, (1 - 2 * (xx + yy)) * sz, 0,
        tx, ty, tz, 1
    ];
};

const transform = (matrix, [x, y, z]) => [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
];

const boundsFor = (node) => {
    const mesh = document.meshes?.[node.mesh];
    const localMin = [Infinity, Infinity, Infinity];
    const localMax = [-Infinity, -Infinity, -Infinity];
    for (const primitive of mesh?.primitives || []) {
        const accessor = document.accessors?.[primitive.attributes?.POSITION];
        if (!accessor?.min || !accessor?.max) continue;
        for (let axis = 0; axis < 3; axis += 1) {
            localMin[axis] = Math.min(localMin[axis], accessor.min[axis]);
            localMax[axis] = Math.max(localMax[axis], accessor.max[axis]);
        }
    }
    if (!Number.isFinite(localMin[0])) throw new Error(`Konum sınırı bulunamadı: ${node.name}`);
    const matrix = trsMatrix(node);
    const worldMin = [Infinity, Infinity, Infinity];
    const worldMax = [-Infinity, -Infinity, -Infinity];
    for (const x of [localMin[0], localMax[0]]) for (const y of [localMin[1], localMax[1]]) for (const z of [localMin[2], localMax[2]]) {
        const point = transform(matrix, [x, y, z]);
        for (let axis = 0; axis < 3; axis += 1) {
            worldMin[axis] = Math.min(worldMin[axis], point[axis]);
            worldMax[axis] = Math.max(worldMax[axis], point[axis]);
        }
    }
    return {
        center: worldMin.map((value, axis) => Number(((value + worldMax[axis]) / 2).toFixed(6))),
        size: worldMin.map((value, axis) => Number((worldMax[axis] - value).toFixed(6)))
    };
};

const products = (document.nodes || []).flatMap((node) => {
    const match = node.name?.match(/^(OPTIK_PRODUCT_\d{3})_V(\d+)$/i);
    if (!match || node.mesh == null) return [];
    return [{
        id: match[1].toUpperCase(),
        sourceName: node.name,
        variant: Number(match[2]),
        ...boundsFor(node)
    }];
}).sort((a, b) => a.id.localeCompare(b.id));

if (products.length !== 90) throw new Error(`90 optik ürün bekleniyordu, ${products.length} bulundu.`);
await writeFile(destination, `${JSON.stringify({ version: 1, products }, null, 2)}\n`, 'utf8');
console.log(`${products.length} ürünlük Güzel Optik manifesti yenilendi.`);
