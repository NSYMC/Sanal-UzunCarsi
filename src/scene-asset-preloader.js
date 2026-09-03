const DEFAULT_CONCURRENCY = 2;

const createDeferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

const waitForController = () => new Promise((resolve) => {
    if (navigator.serviceWorker.controller) {
        resolve();
        return;
    }
    const timeout = window.setTimeout(resolve, 1800);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.clearTimeout(timeout);
        resolve();
    }, { once: true });
});

export const createSceneAssetPreloader = ({
    assets,
    serviceWorkerUrl,
    serviceWorkerScope,
    cacheName,
    concurrency = DEFAULT_CONCURRENCY,
    onStateChange = () => {}
}) => {
    const records = new Map(assets.map((asset) => {
        const deferred = createDeferred();
        return [asset.id, {
            ...asset,
            state: 'idle',
            loaded: 0,
            total: 0,
            priority: Number(asset.priority) || 0,
            deferred
        }];
    }));
    let activeCount = 0;
    let stopped = false;

    const emit = (record) => onStateChange({
        id: record.id,
        storeId: record.storeId || null,
        state: record.state,
        loaded: record.loaded,
        total: record.total,
        progress: record.total > 0 ? record.loaded / record.total : 0
    });

    const serviceWorkerReady = (async () => {
        if (!('serviceWorker' in navigator)) return false;
        try {
            await navigator.serviceWorker.register(serviceWorkerUrl, { scope: serviceWorkerScope });
            await navigator.serviceWorker.ready;
            await waitForController();
            return Boolean(navigator.serviceWorker.controller);
        } catch (error) {
            console.warn('Sahne önbelleği başlatılamadı.', error);
            return false;
        }
    })();

    const readResponse = async (response, record) => {
        record.total = Number(response.headers.get('content-length')) || 0;
        const reader = response.body?.getReader();
        if (!reader) {
            const data = await response.arrayBuffer();
            record.loaded = data.byteLength;
            record.total ||= data.byteLength;
            emit(record);
            return;
        }
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            record.loaded += value.byteLength;
            emit(record);
        }
        record.total ||= record.loaded;
    };

    const download = async (record) => {
        record.state = 'loading';
        emit(record);
        try {
            await serviceWorkerReady;
            if ('caches' in window) {
                const cache = await caches.open(cacheName);
                const cached = await cache.match(record.url);
                if (cached) {
                    record.total = Number(cached.headers.get('content-length')) || 0;
                    record.loaded = record.total;
                    record.state = 'ready';
                    emit(record);
                    record.deferred.resolve(record);
                    return;
                }
            }
            const response = await fetch(record.url, {
                cache: 'no-cache',
                priority: record.priority >= 100 ? 'high' : 'low'
            });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            const cacheResponse = response.clone();
            const cacheWrite = 'caches' in window
                ? caches.open(cacheName)
                    .then((cache) => cache.put(record.url, cacheResponse))
                    .catch((error) => console.warn('Sahne kalıcı önbelleğe yazılamadı.', error))
                : Promise.resolve();
            await Promise.all([readResponse(response, record), cacheWrite]);
            record.state = 'ready';
            emit(record);
            record.deferred.resolve(record);
        } catch (error) {
            record.state = 'error';
            record.error = error;
            emit(record);
            record.deferred.reject(error);
        }
    };

    const pump = () => {
        if (stopped) return;
        const queued = [...records.values()]
            .filter((record) => record.state === 'queued')
            .sort((left, right) => right.priority - left.priority);
        while (activeCount < concurrency && queued.length) {
            const record = queued.shift();
            activeCount += 1;
            void download(record).finally(() => {
                activeCount -= 1;
                pump();
            });
        }
    };

    const prioritize = (id, priority = 100) => {
        const record = records.get(id);
        if (!record) return Promise.reject(new Error(`Bilinmeyen sahne varlığı: ${id}`));
        record.priority = Math.max(record.priority, priority);
        if (record.state === 'idle') {
            record.state = 'queued';
            emit(record);
        }
        pump();
        return record.deferred.promise;
    };

    const prepareEntry = (storeId) => prioritize(`store:${storeId}`, 160);

    const preloadAll = () => {
        const pending = [];
        for (const record of records.values()) {
            if (record.state === 'idle') {
                record.state = 'queued';
                emit(record);
            }
            if (record.state === 'queued' || record.state === 'loading') {
                pending.push(record.deferred.promise);
            }
        }
        pump();
        return Promise.allSettled(pending);
    };

    return {
        prioritize,
        prepareEntry,
        preloadAll,
        state(id) {
            const record = records.get(id);
            return record ? {
                state: record.state,
                loaded: record.loaded,
                total: record.total,
                progress: record.total > 0 ? record.loaded / record.total : 0
            } : null;
        },
        dispose() {
            stopped = true;
        }
    };
};
