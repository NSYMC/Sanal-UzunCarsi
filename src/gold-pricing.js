const SPOT_URL = 'https://xaus.com/api/v1/spot?currency=TRY&unit=gram&compact=1';
const HISTORY_URL = 'https://xaus.com/api/v1/history';
const CACHE_KEY = 'uzunCarsi:goldMarket:v1';
const CACHE_TTL = 5 * 60 * 1000;

export const MAWUS_TARIFF = Object.freeze({
    name: 'Sistemde tanımlı Nişantaşı fiyat tarifesi',
    bullionMarginRate: 0.025,
    jewelryMarginRate: 0.06,
    workmanshipPerGram: 425,
    gemstoneServiceFee: 1750
});

export const PRODUCT_PROFILES = Object.freeze({
    MAWUS_HQ_1000G_ALTIN: { weightGram: 1000, karat: 24, kind: 'bullion' },
    MAWUS_HQ_12_5KG_ALTIN: { weightGram: 12500, karat: 24, kind: 'bullion' },
    MAWUS_HQ_GRAM_ALTIN: { weightGram: 1, karat: 24, kind: 'bullion' },
    MAWUS_CUMHURIYET_ALTINI: { weightGram: 7.216, karat: 22, kind: 'bullion' },
    MAWUS_HQ_CEYREK_ALTIN: { weightGram: 1.754, karat: 22, kind: 'bullion', label: '1,754 gr · 22 ayar çeyrek altın' },
    MAWUS_HQ_YARIM_ALTIN: { weightGram: 3.508, karat: 22, kind: 'bullion', label: '3,508 gr · 22 ayar yarım altın' },
    MAWUS_HQ_TAM_ALTIN: { weightGram: 7.016, karat: 22, kind: 'bullion', label: '7,016 gr · 22 ayar tam altın' },
    MAWUS_HQ_ALTIN_YUZUK: { weightGram: 4.2, karat: 14, kind: 'jewelry' },
    MAWUS_HQ_ALTIN_YUZUK_TASLI: { weightGram: 4.8, karat: 14, kind: 'gemstone' },
    MAWUS_HQ_ALTIN_KIRMIZI_KALPLI: { weightGram: 4.6, karat: 14, kind: 'gemstone' },
    MAWUS_HQ_ALTIN_KIRMIZI_TAS: { weightGram: 5.1, karat: 14, kind: 'gemstone' },
    MAWUS_HQ_CICEK_KIRMIZI_YUZUK: { weightGram: 4.7, karat: 14, kind: 'gemstone' },
    MAWUS_HQ_CICEK_YUZUK: { weightGram: 4.4, karat: 14, kind: 'jewelry' },
    MAWUS_HQ_ELMAS_YUZUK: { weightGram: 4.9, karat: 14, kind: 'gemstone' },
    MAWUS_HQ_GRI_YUZUK: { weightGram: 4.1, karat: 14, kind: 'jewelry' },
    MAWUS_HQ_YAKUT_YUZUK: { weightGram: 5.0, karat: 14, kind: 'gemstone' },
    MAWUS_HQ_ZUMRUT_YUZUK: { weightGram: 5.2, karat: 14, kind: 'gemstone' }
});

export const loadMawusProductPrices = async () => {
    const market = await loadMarket();
    const spotPrice = Number(market.spot.xau.price);
    const prices = Object.fromEntries(Object.entries(PRODUCT_PROFILES).map(([productId, profile]) => {
        const calculation = calculateGoldPrice(spotPrice, profile);
        return [productId, {
            price: Math.round(calculation.total),
            spotPrice,
            calculation,
            updatedAt: market.spot.price_as_of || market.spot.updated_at || null,
            estimatedWeight: profile.kind !== 'bullion',
            kind: profile.kind
        }];
    }));
    return { prices, cached: Boolean(market.cached), stale: Boolean(market.stale) };
};

const money = new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 0
});
const gramMoney = new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2
});

const readCache = () => {
    try {
        const value = JSON.parse(localStorage.getItem(CACHE_KEY));
        return value?.spot?.price > 0 ? value : null;
    } catch {
        return null;
    }
};

const fetchJson = async (url) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Piyasa verisi alınamadı (${response.status})`);
        return await response.json();
    } finally {
        window.clearTimeout(timer);
    }
};

const loadMarket = async () => {
    const cached = readCache();
    if (cached && Date.now() - cached.savedAt < CACHE_TTL) return { ...cached, cached: true };
    try {
        const [spot, history] = await Promise.all([fetchJson(SPOT_URL), fetchJson(HISTORY_URL)]);
        if (!Number.isFinite(Number(spot?.xau?.price))) throw new Error('Gram altın fiyatı bulunamadı.');
        const value = { spot, history, savedAt: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(value));
        return value;
    } catch (error) {
        if (cached) return { ...cached, cached: true, stale: true, error };
        throw error;
    }
};

export const calculateGoldPrice = (spotGram24, profile) => {
    const pureGoldValue = spotGram24 * profile.weightGram * (profile.karat / 24);
    const marginRate = profile.kind === 'bullion' ? MAWUS_TARIFF.bullionMarginRate : MAWUS_TARIFF.jewelryMarginRate;
    const workmanship = profile.kind === 'bullion' ? 0 : profile.weightGram * MAWUS_TARIFF.workmanshipPerGram;
    const serviceFee = profile.kind === 'gemstone' ? MAWUS_TARIFF.gemstoneServiceFee : 0;
    const margin = pureGoldValue * marginRate;
    return { pureGoldValue, workmanship, serviceFee, margin, total: pureGoldValue + workmanship + serviceFee + margin, marginRate };
};

const chartPoints = (history, fxRate) => (Array.isArray(history?.points) ? history.points : [])
    .slice(-30)
    .map((point) => ({ label: point.d, value: Number(point.c) / 31.1034768 * fxRate }))
    .filter((point) => Number.isFinite(point.value));

const drawChart = (canvas, points) => {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);
    if (points.length < 2) return;
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    const pad = 8;
    const xy = points.map((point, index) => ({
        x: pad + index / (points.length - 1) * (width - pad * 2),
        y: pad + (1 - (point.value - min) / range) * (height - pad * 2)
    }));
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(180, 132, 33, .28)');
    gradient.addColorStop(1, 'rgba(180, 132, 33, 0)');
    ctx.beginPath();
    ctx.moveTo(xy[0].x, height);
    xy.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(xy.at(-1).x, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.beginPath();
    xy.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.strokeStyle = '#b48421';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
};

export const createGoldPricingPanel = (root) => {
    const dom = {
        root,
        spot: root?.querySelector('[data-gold-spot]'),
        updated: root?.querySelector('[data-gold-updated]'),
        chart: root?.querySelector('[data-gold-chart]'),
        range: root?.querySelector('[data-gold-range]'),
        tariff: root?.querySelector('[data-gold-tariff]'),
        calculation: root?.querySelector('[data-gold-calculation]'),
        total: root?.querySelector('[data-gold-total]'),
        note: root?.querySelector('[data-gold-note]'),
        inspectorPrice: root?.closest('.product-detail')?.querySelector('#inspectorPrice')
    };
    let requestId = 0;

    const hide = () => {
        requestId += 1;
        dom.root?.classList.add('hidden');
    };

    const show = async (product, storeId) => {
        const profile = PRODUCT_PROFILES[product?.id];
        if (storeId !== 'nisantasi' || !profile || !dom.root) return hide();
        const activeRequest = ++requestId;
        dom.root.classList.remove('hidden');
        dom.spot.textContent = 'Güncel fiyat alınıyor…';
        dom.updated.textContent = '';
        dom.total.textContent = '—';
        if (dom.inspectorPrice) dom.inspectorPrice.textContent = 'Canlı fiyat hesaplanıyor…';
        dom.calculation.replaceChildren();
        dom.note.textContent = 'Fiyat, canlı gram altın referansı üzerinden hesaplanır.';
        dom.tariff.textContent = profile.kind === 'bullion'
            ? `%${(MAWUS_TARIFF.bullionMarginRate * 100).toLocaleString('tr-TR')} mağaza payı`
            : `%${(MAWUS_TARIFF.jewelryMarginRate * 100).toLocaleString('tr-TR')} mağaza payı + ${money.format(MAWUS_TARIFF.workmanshipPerGram)}/gr işçilik${profile.kind === 'gemstone' ? ` + ${money.format(MAWUS_TARIFF.gemstoneServiceFee)} taş montür hizmeti` : ''}`;
        try {
            const market = await loadMarket();
            if (activeRequest !== requestId) return;
            const spotPrice = Number(market.spot.xau.price);
            const calculation = calculateGoldPrice(spotPrice, profile);
            const updatedAt = market.spot.price_as_of || market.spot.updated_at;
            dom.spot.textContent = `${gramMoney.format(spotPrice)} / gram`;
            dom.updated.textContent = updatedAt
                ? `${market.stale ? 'Son bilinen fiyat' : 'Güncellendi'}: ${new Date(updatedAt).toLocaleString('tr-TR')}`
                : 'Canlı piyasa referansı';
            dom.total.textContent = money.format(calculation.total);
            if (dom.inspectorPrice) dom.inspectorPrice.textContent = money.format(calculation.total);
            const rows = [
                ['Ürün', profile.label || `${profile.kind === 'bullion' ? '' : 'Tahmini '}${profile.weightGram.toLocaleString('tr-TR')} gr · ${profile.karat} ayar`],
                ['Altın değeri', money.format(calculation.pureGoldValue)],
                calculation.workmanship ? ['İşçilik', money.format(calculation.workmanship)] : null,
                calculation.serviceFee ? ['Taş montür hizmeti', money.format(calculation.serviceFee)] : null,
                ['Mağaza payı', money.format(calculation.margin)]
            ].filter(Boolean);
            rows.forEach(([label, value]) => {
                const row = document.createElement('div');
                const term = document.createElement('span');
                const amount = document.createElement('strong');
                term.textContent = label;
                amount.textContent = value;
                row.append(term, amount);
                dom.calculation.append(row);
            });
            const points = chartPoints(market.history, Number(market.spot.fx_rate) || 1);
            drawChart(dom.chart, points);
            if (points.length) {
                const first = points[0].value;
                const last = points.at(-1).value;
                const change = (last - first) / first * 100;
                dom.range.textContent = `Son 30 gün · ${change >= 0 ? '+' : ''}%${change.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
            } else {
                dom.range.textContent = 'Grafik verisi bulunamadı';
            }
            dom.note.textContent = `${market.stale ? 'Son bilinen piyasa verisi kullanılıyor. ' : ''}Gösterilen tutar bilgilendirme amaçlı tahmini satış fiyatıdır; mağazadaki tartım ve ürün özellikleriyle kesinleşir.${profile.kind === 'gemstone' ? ' Taşın gerçek değeri bu hesaba dahil değildir.' : ''}`;
        } catch {
            if (activeRequest !== requestId) return;
            dom.spot.textContent = 'Piyasa verisine ulaşılamadı';
            if (dom.inspectorPrice) dom.inspectorPrice.textContent = 'Güncel fiyat alınamadı';
            dom.updated.textContent = 'Bağlantı geldiğinde otomatik olarak yeniden hesaplanır.';
            dom.range.textContent = '';
            dom.note.textContent = 'Güncel veri alınamadığı için ürün fiyatı gösterilemiyor.';
        }
    };

    return { show, hide };
};
