const finite = (value) => Number.isFinite(Number(value));

const excludedLabelPattern = /(?:^|[\s_.-])(?:glass|cam|window|lens|ayna|mirror|curtain|perde|light|lamp|led|sign|label|logo|text|image|picture|poster|price|tag|diamond|gem|jewel|ring|neck|gold|altin|altın|yuzuk|yüzük|kolye|product|urun|ürün)(?:$|[\s_.-])/i;

export const isNavigationColliderExcluded = (candidate = {}) => Boolean(
    candidate.isProduct
    || candidate.productId
    || excludedLabelPattern.test(String(candidate.label || ''))
);

const normalizeCandidate = (candidate, storeBounds) => {
    const minimum = candidate?.minimum;
    const maximum = candidate?.maximum;
    if (!minimum || !maximum || !['x', 'y', 'z'].every((axis) => finite(minimum[axis]) && finite(maximum[axis]))) {
        return null;
    }
    const minX = Math.max(Number(minimum.x), storeBounds.minX);
    const maxX = Math.min(Number(maximum.x), storeBounds.maxX);
    const minZ = Math.max(Number(minimum.z), storeBounds.minZ);
    const maxZ = Math.min(Number(maximum.z), storeBounds.maxZ);
    if (maxX <= minX || maxZ <= minZ) return null;
    return {
        ...candidate,
        minimum: { x: minX, y: Number(minimum.y), z: minZ },
        maximum: { x: maxX, y: Number(maximum.y), z: maxZ }
    };
};

const blocksEntrance = (candidate, storeBounds, clearance = 0.62) => {
    const entrance = storeBounds.entrance;
    if (!entrance) return false;
    return entrance.x >= candidate.minimum.x - clearance
        && entrance.x <= candidate.maximum.x + clearance
        && entrance.z >= candidate.minimum.z - clearance
        && entrance.z <= candidate.maximum.z + clearance;
};

export const createNavigationColliderSpec = (candidate, storeBounds, {
    eyeHeight = 1.92,
    maxStepHeight = 0.52
} = {}) => {
    if (!storeBounds || isNavigationColliderExcluded(candidate)) return null;
    const normalized = normalizeCandidate(candidate, storeBounds);
    if (!normalized || blocksEntrance(normalized, storeBounds)) return null;

    const floorY = Number(storeBounds.floorY);
    const width = normalized.maximum.x - normalized.minimum.x;
    const depth = normalized.maximum.z - normalized.minimum.z;
    const sourceHeight = normalized.maximum.y - normalized.minimum.y;
    const area = width * depth;
    const storeWidth = storeBounds.maxX - storeBounds.minX;
    const storeDepth = storeBounds.maxZ - storeBounds.minZ;

    if (normalized.maximum.y <= floorY + 0.12 || normalized.minimum.y >= floorY + eyeHeight * 0.9) return null;
    if (width >= storeWidth * 0.9 && depth >= storeDepth * 0.9) return null;
    if (area > 14 || (width >= storeWidth * 0.78 && depth > 1.5)) return null;
    if (sourceHeight < 0.16 && area > 1.4) return null;

    const wallLike = sourceHeight >= 0.85 && (width >= 0.42 || depth >= 0.42);
    const fixtureLike = sourceHeight >= 0.28
        && width >= 0.22
        && depth >= 0.22
        && area <= 14;
    if (!wallLike && !fixtureLike) return null;

    const obstacleHeight = Math.min(2.6, Math.max(0.18, normalized.maximum.y - floorY));
    const stepHeight = obstacleHeight <= maxStepHeight ? Number(obstacleHeight.toFixed(4)) : 0;
    return {
        id: candidate.id || candidate.label || 'obstacle',
        sourceName: String(candidate.label || candidate.id || ''),
        width: Math.max(0.08, width),
        height: obstacleHeight,
        depth: Math.max(0.08, depth),
        position: {
            x: (normalized.minimum.x + normalized.maximum.x) * 0.5,
            y: floorY + obstacleHeight * 0.5,
            z: (normalized.minimum.z + normalized.maximum.z) * 0.5
        },
        stepHeight,
        priority: (wallLike ? 100 : 0) + Math.min(area, 20) + Math.min(sourceHeight, 4)
    };
};

const nearlySame = (left, right) => (
    Math.abs(left.position.x - right.position.x) < 0.035
    && Math.abs(left.position.z - right.position.z) < 0.035
    && Math.abs(left.width - right.width) < 0.05
    && Math.abs(left.depth - right.depth) < 0.05
);

export const createNavigationColliderSpecs = (candidates, storeBounds, options = {}) => {
    const limit = Math.max(1, Math.min(64, Number(options.limit) || 40));
    const specs = (candidates || [])
        .map((candidate) => createNavigationColliderSpec(candidate, storeBounds, options))
        .filter(Boolean)
        .sort((left, right) => right.priority - left.priority);
    const distinct = [];
    for (const spec of specs) {
        if (distinct.some((existing) => nearlySame(existing, spec))) continue;
        distinct.push(spec);
        if (distinct.length >= limit) break;
    }
    return distinct;
};
