const distanceXZ = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

const mixPoint = (a, b, amount) => ({
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
    z: a.z + (b.z - a.z) * amount
});

const appendDistinct = (points, point, minimumDistance = 0.08) => {
    if (!points.length || distanceXZ(points.at(-1), point) >= minimumDistance) points.push(point);
};

export const createGuidanceControlPoints = ({ origin, target, bounds, floorY }) => {
    if (!origin || !target || !bounds || !Number.isFinite(floorY)) return [];
    const y = floorY + 0.045;
    const start = { x: origin.x, y, z: origin.z };
    const end = { x: target.x, y, z: target.z };
    const inside = origin.x >= bounds.minX && origin.x <= bounds.maxX
        && origin.z >= bounds.minZ && origin.z <= bounds.maxZ;
    const aisleX = bounds.center.x;
    const points = [];
    appendDistinct(points, start);

    if (!inside) {
        const entranceZ = bounds.entrance.z;
        appendDistinct(points, { x: bounds.entrance.x, y, z: entranceZ + 0.9 });
        appendDistinct(points, { x: aisleX, y, z: entranceZ - 1.15 });
    } else if (Math.abs(start.x - aisleX) > 0.35) {
        appendDistinct(points, { x: aisleX, y, z: start.z });
    }

    const targetAisleZ = Math.max(bounds.minZ + 0.65, Math.min(bounds.maxZ - 0.65, end.z));
    appendDistinct(points, { x: aisleX, y, z: targetAisleZ });

    const sideDistance = Math.abs(end.x - aisleX);
    if (sideDistance > 0.45) {
        const stopRatio = Math.max(0, (sideDistance - 0.62) / sideDistance);
        appendDistinct(points, {
            x: aisleX + (end.x - aisleX) * stopRatio,
            y,
            z: targetAisleZ
        });
    } else {
        appendDistinct(points, end);
    }
    return points;
};

export const sampleRoundedGuidancePath = (controlPoints, {
    cornerRadius = 0.72,
    cornerSegments = 5,
    lineStep = 0.24
} = {}) => {
    if (!Array.isArray(controlPoints) || controlPoints.length < 2) return controlPoints || [];
    const points = [];
    const appendLine = (from, to, includeStart = false) => {
        const distance = distanceXZ(from, to);
        const steps = Math.max(1, Math.ceil(distance / lineStep));
        for (let index = includeStart ? 0 : 1; index <= steps; index += 1) {
            appendDistinct(points, mixPoint(from, to, index / steps), 0.02);
        }
    };

    let cursor = controlPoints[0];
    appendDistinct(points, cursor, 0);
    for (let index = 1; index < controlPoints.length - 1; index += 1) {
        const previous = controlPoints[index - 1];
        const corner = controlPoints[index];
        const next = controlPoints[index + 1];
        const incoming = distanceXZ(previous, corner);
        const outgoing = distanceXZ(corner, next);
        const radius = Math.min(cornerRadius, incoming * 0.35, outgoing * 0.35);
        const before = mixPoint(corner, previous, radius / Math.max(incoming, 0.001));
        const after = mixPoint(corner, next, radius / Math.max(outgoing, 0.001));
        appendLine(cursor, before);
        for (let segment = 1; segment <= cornerSegments; segment += 1) {
            const t = segment / cornerSegments;
            const first = mixPoint(before, corner, t);
            const second = mixPoint(corner, after, t);
            appendDistinct(points, mixPoint(first, second, t), 0.02);
        }
        cursor = after;
    }
    appendLine(cursor, controlPoints.at(-1));
    return points;
};

export const pathLength = (points) => (points || []).slice(1)
    .reduce((sum, point, index) => sum + distanceXZ(points[index], point), 0);

export const samplePathAtDistance = (points, distance) => {
    if (!points?.length) return null;
    if (points.length === 1 || distance <= 0) return { ...points[0], direction: { x: 0, z: 1 } };
    let remaining = distance;
    for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1];
        const to = points[index];
        const segmentLength = distanceXZ(from, to);
        if (remaining <= segmentLength || index === points.length - 1) {
            const amount = Math.max(0, Math.min(1, remaining / Math.max(segmentLength, 0.001)));
            return {
                ...mixPoint(from, to, amount),
                direction: {
                    x: (to.x - from.x) / Math.max(segmentLength, 0.001),
                    z: (to.z - from.z) / Math.max(segmentLength, 0.001)
                }
            };
        }
        remaining -= segmentLength;
    }
    return { ...points.at(-1), direction: { x: 0, z: 1 } };
};
