const finitePositive = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
};

// Babylon hardwareScalingLevel bir bölen olarak çalışır: 0.8, CSS boyutunun %125'i kadar piksel üretir.
export const hardwareScalingForDpr = ({
    devicePixelRatio = 1,
    maxDpr = 2,
    resolutionScale = 1
} = {}) => {
    const dpr = Math.max(0.5, Math.min(4, finitePositive(devicePixelRatio, 1)));
    const dprLimit = Math.max(0.5, Math.min(4, finitePositive(maxDpr, 2)));
    const targetPixelRatio = Math.min(dpr, dprLimit);
    return Math.max(0.25, Math.min(4, finitePositive(resolutionScale, 1) / targetPixelRatio));
};

export const applyDeviceResolution = (engine, options = {}) => {
    const scalingLevel = hardwareScalingForDpr({
        ...options,
        devicePixelRatio: options.devicePixelRatio ?? window.devicePixelRatio ?? 1
    });
    engine.setHardwareScalingLevel(scalingLevel);
    return scalingLevel;
};
