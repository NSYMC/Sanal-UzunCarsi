const OUTSIDE_EXPOSURE = 0.58;
const INSIDE_EXPOSURE = 0.54;
const OUTSIDE_GAIN = 0.018;
const INSIDE_GAIN = 0.01;

const audioContextClass = () => window.AudioContext || window.webkitAudioContext || null;

const makeNoiseBuffer = (context, seconds, smoothing) => {
    const frameCount = Math.ceil(context.sampleRate * seconds);
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < frameCount; index += 1) {
        const white = Math.random() * 2 - 1;
        previous = previous * smoothing + white * (1 - smoothing);
        samples[index] = previous;
    }
    return buffer;
};

const createNoiseBed = (context, destination, { smoothing, filterType, frequency }) => {
    const source = context.createBufferSource();
    source.buffer = makeNoiseBuffer(context, 2.5, smoothing);
    source.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = 0.45;

    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start();
    return { source, gain };
};

export const createEnvironmentExperience = ({ scene, toggleButton = null } = {}) => {
    if (!scene) return { setInside() {}, dispose() {} };

    let context = null;
    let master = null;
    let outsideBed = null;
    let insideBed = null;
    let inside = false;
    let enabled = true;
    let disposed = false;
    let targetExposure = OUTSIDE_EXPOSURE;

    const updateButton = () => {
        if (!toggleButton) return;
        toggleButton.setAttribute('aria-pressed', String(enabled));
        toggleButton.dataset.state = enabled ? 'on' : 'off';
        toggleButton.title = enabled ? 'Ortam sesini kapat' : 'Ortam sesini aç';
        toggleButton.querySelector('[data-ambient-label]').textContent = enabled ? 'Ortam sesi açık' : 'Ortam sesi kapalı';
    };

    const applyAudioMix = () => {
        if (!context || !outsideBed || !insideBed || !master) return;
        const now = context.currentTime;
        const outsideTarget = enabled && !inside ? OUTSIDE_GAIN : 0;
        const insideTarget = enabled && inside ? INSIDE_GAIN : 0;
        outsideBed.gain.gain.cancelScheduledValues(now);
        insideBed.gain.gain.cancelScheduledValues(now);
        master.gain.cancelScheduledValues(now);
        outsideBed.gain.gain.setTargetAtTime(outsideTarget, now, 0.16);
        insideBed.gain.gain.setTargetAtTime(insideTarget, now, 0.16);
        master.gain.setTargetAtTime(enabled ? 1 : 0, now, 0.12);
    };

    const ensureAudio = async () => {
        if (disposed || !enabled) return;
        if (!context) {
            const Context = audioContextClass();
            if (!Context) return;
            context = new Context();
            master = context.createGain();
            master.gain.value = 1;
            master.connect(context.destination);
            outsideBed = createNoiseBed(context, master, {
                smoothing: 0.965,
                filterType: 'lowpass',
                frequency: 720
            });
            insideBed = createNoiseBed(context, master, {
                smoothing: 0.992,
                filterType: 'bandpass',
                frequency: 145
            });
        }
        if (context.state === 'suspended') await context.resume();
        applyAudioMix();
    };

    const unlockAudio = () => { void ensureAudio(); };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    const exposureObserver = scene.onBeforeRenderObservable.add(() => {
        const image = scene.imageProcessingConfiguration;
        const frameScale = Math.min(1, (scene.getEngine().getDeltaTime() || 16.7) / 210);
        image.exposure += (targetExposure - image.exposure) * frameScale;
    });

    const setInside = (nextInside) => {
        inside = Boolean(nextInside);
        targetExposure = inside ? INSIDE_EXPOSURE : OUTSIDE_EXPOSURE;
        document.body.dataset.environment = inside ? 'inside' : 'outside';
        applyAudioMix();
    };

    const toggle = (event) => {
        event?.stopPropagation();
        enabled = !enabled;
        updateButton();
        if (enabled) void ensureAudio();
        else applyAudioMix();
    };
    toggleButton?.addEventListener('click', toggle);
    updateButton();
    setInside(false);

    return {
        setInside,
        dispose() {
            if (disposed) return;
            disposed = true;
            scene.onBeforeRenderObservable.remove(exposureObserver);
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            toggleButton?.removeEventListener('click', toggle);
            outsideBed?.source.stop();
            insideBed?.source.stop();
            void context?.close();
        }
    };
};
