const clampPadding = (value) => Math.max(0, Number(value) || 0);

export const containsXZ = (limits, position) => Boolean(limits && position)
    && position.x >= limits.minX
    && position.x <= limits.maxX
    && position.z >= limits.minZ
    && position.z <= limits.maxZ;

export const createStoreSpatialLimits = (bounds, {
    insideEnterDepth = 1.25,
    insideExitDepth = 0.35,
    insideSideInset = 0.12,
    insideBackInset = 0.12,
    renderEnterPadding = 42,
    renderExitPadding = 48
} = {}) => {
    const entranceDirection = Math.sign(bounds.entranceTarget.z - bounds.entrance.z) || -1;
    const entranceLimit = (depth) => bounds.entrance.z + entranceDirection * clampPadding(depth);
    const inside = (depth) => ({
        minX: bounds.minX + insideSideInset,
        maxX: bounds.maxX - insideSideInset,
        minZ: entranceDirection < 0
            ? bounds.minZ + insideBackInset
            : entranceLimit(depth),
        maxZ: entranceDirection < 0
            ? entranceLimit(depth)
            : bounds.maxZ - insideBackInset
    });
    const proximity = (padding) => ({
        minX: bounds.minX - padding,
        maxX: bounds.maxX + padding,
        minZ: bounds.minZ - padding,
        maxZ: bounds.maxZ + padding
    });

    return {
        insideEnter: inside(insideEnterDepth),
        insideExit: inside(insideExitDepth),
        proximityEnter: proximity(renderEnterPadding),
        proximityExit: proximity(Math.max(renderEnterPadding, renderExitPadding))
    };
};

export const orderBackgroundStores = (selectedStore, stores) => Object.values(stores)
    .filter((store) => store.id !== selectedStore.id)
    .sort((a, b) => {
        const distanceA = Math.hypot(
            a.bounds.center.x - selectedStore.bounds.center.x,
            a.bounds.center.z - selectedStore.bounds.center.z
        );
        const distanceB = Math.hypot(
            b.bounds.center.x - selectedStore.bounds.center.x,
            b.bounds.center.z - selectedStore.bounds.center.z
        );
        return distanceA - distanceB;
    });
