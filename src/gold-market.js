const CACHE_KEY = 'uzunCarsi:goldMarket:v1';
const CACHE_TTL = 5 * 60 * 1000;
const validMarket = (value) => Number.isFinite(Number(value?.spot?.xau?.price))
    && Number(value.spot.xau.price) > 0 && Number.isFinite(value.savedAt);

export const createGoldMarketLoader = ({ fetchSpot, fetchHistory, storage, now = Date.now }) => {
    let memory = null;
    let pending = null;
    const readCache = () => {
        try {
            const saved = JSON.parse(storage.getItem(CACHE_KEY));
            if (validMarket(saved) && (!memory || saved.savedAt > memory.savedAt)) memory = saved;
        } catch { /* Depolama kapalıyken bellek önbelleğini kullan. */ }
        return memory;
    };
    return async () => {
        const cached = readCache();
        if (cached && now() - cached.savedAt >= 0 && now() - cached.savedAt < CACHE_TTL) {
            return { ...cached, cached: true };
        }
        if (pending) return pending;
        pending = (async () => {
            try {
                const [spot, history] = await Promise.all([
                    fetchSpot(),
                    fetchHistory().catch(() => cached?.history || { points: [] })
                ]);
                const value = { spot, history, savedAt: now() };
                if (!validMarket(value)) throw new Error('Gram altın fiyatı bulunamadı.');
                memory = value;
                try { storage.setItem(CACHE_KEY, JSON.stringify(value)); } catch { /* Bellekte geçerli. */ }
                return value;
            } catch (error) {
                if (cached) return { ...cached, cached: true, stale: true };
                throw error;
            }
        })().finally(() => { pending = null; });
        return pending;
    };
};
