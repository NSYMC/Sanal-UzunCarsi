const previewTransform = Object.freeze({
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
});

const descriptions = Object.freeze({
    MAWUS_HQ_1000G_ALTIN: 'Damgalı 1 kilogram altın külçe.',
    MAWUS_HQ_12_5KG_ALTIN: 'Damgalı 12,5 kilogram altın külçe.',
    MAWUS_HQ_ALTIN_YUZUK: 'İki renkli, katmanlı altın yüzük.',
    MAWUS_HQ_ALTIN_YUZUK_TASLI: 'Açık mavi ve beyaz taşlı altın yüzük.',
    MAWUS_HQ_ALTIN_KIRMIZI_KALPLI: 'Kırmızı kalp taşlı altın yüzük.',
    MAWUS_HQ_ALTIN_KIRMIZI_TAS: 'Kırmızı merkez taşlı altın yüzük.',
    MAWUS_HQ_CICEK_KIRMIZI_YUZUK: 'Kırmızı taşlı çiçek yüzük.',
    MAWUS_HQ_CICEK_YUZUK: 'Çiçek biçimli taşlı yüzük.',
    MAWUS_HQ_ELMAS_YUZUK: 'Berrak merkez taşlı altın yüzük.',
    MAWUS_HQ_GRAM_ALTIN: 'Damgalı gram altın.',
    MAWUS_HQ_GRI_YUZUK: 'Çok taşlı gri metal yüzük.',
    MAWUS_HQ_YAKUT_YUZUK: 'Bordo merkez taşlı yüzük.',
    MAWUS_HQ_CEYREK_ALTIN: '22 ayar çeyrek altın.',
    MAWUS_HQ_YARIM_ALTIN: '22 ayar yarım altın.',
    MAWUS_HQ_TAM_ALTIN: '22 ayar tam altın.',
    MAWUS_HQ_ZUMRUT_YUZUK: 'Yeşil taşlı altın yüzük.'
});

const product = (id, name, category, model, tags = []) => ({
    id,
    storeId: 'mawus',
    name,
    category,
    price: null,
    currency: 'TRY',
    priceType: 'live-gold',
    priceNote: 'Tahmini fiyat; güncel altın değeri, ürün ağırlığı, ayarı, işçilik ve mağaza payına göre hesaplanır.',
    description: descriptions[id],
    tags: ['mawus', 'kuyumculuk', category.toLocaleLowerCase('tr-TR'), ...tags],
    highQualityModel: `/models/products/mawus/${model}.glb`,
    previewTransform,
    active: true
});

const binding = (productId, meshNames, meshNamePatterns, confidence = 'high') => ({
    id: `binding:mawus:${productId}`,
    storeId: 'mawus',
    productId,
    meshNames,
    meshNamePatterns,
    matchConfidence: confidence,
    matchSource: 'Products GLB adı, sahne düğüm adı ve geometri parmak izi analizi'
});

const rowBinding = (productId, row) => ({
    ...binding(
        productId,
        [`MAWUS_ORIGINAL_M03_ROW${row}_SIX_RINGS`],
        [`^MAWUS_ORIGINAL_M03_ROW${row}_SIX_RINGS$`],
        'medium'
    ),
    matchSource: 'Mawuş vitrinindeki altılı yüzük sırası'
});

export const mawusProductMatches = {
    schemaVersion: 1,
    products: [
        product('MAWUS_HQ_1000G_ALTIN', '1000 Gram Altın Külçe', 'Altın', '1000g-altin', ['külçe', '1000 gram']),
        product('MAWUS_HQ_12_5KG_ALTIN', '12,5 Kilogram Altın Külçe', 'Altın', '12-5kg-altin', ['külçe', '12,5 kilogram']),
        product('MAWUS_HQ_ALTIN_YUZUK', 'Altın Yüzük', 'Yüzük', 'altin-yuzuk', ['altın']),
        product('MAWUS_HQ_ALTIN_YUZUK_TASLI', 'Akuamarin Görünümlü Taşlı Altın Yüzük', 'Yüzük', 'altin-yuzuk-tasli', ['altın', 'taşlı', 'akuamarin görünümlü']),
        product('MAWUS_HQ_ALTIN_KIRMIZI_KALPLI', 'Kırmızı Kalpli Altın Yüzük', 'Yüzük', 'altin-kirmizi-kalpli', ['altın', 'kırmızı', 'kalp']),
        product('MAWUS_HQ_ALTIN_KIRMIZI_TAS', 'Kırmızı Taşlı Altın Yüzük', 'Yüzük', 'altin-kirmizi-tas', ['altın', 'kırmızı', 'taşlı']),
        product('MAWUS_HQ_CICEK_KIRMIZI_YUZUK', 'Kırmızı Çiçek Yüzük', 'Yüzük', 'ciciek-kirmizi-yuzuk', ['çiçek', 'kırmızı']),
        product('MAWUS_HQ_CICEK_YUZUK', 'Çiçek Yüzük', 'Yüzük', 'ciciek-yuzuk', ['çiçek']),
        product('MAWUS_HQ_ELMAS_YUZUK', 'Berrak Taşlı Altın Yüzük', 'Yüzük', 'elmas-yuzuk', ['berrak taş', 'altın']),
        product('MAWUS_HQ_GRAM_ALTIN', 'Gram Altın', 'Altın', 'gram-altin', ['gram']),
        product('MAWUS_HQ_GRI_YUZUK', 'Gri Yüzük', 'Yüzük', 'gri-yuzuk', ['gri']),
        product('MAWUS_HQ_YAKUT_YUZUK', 'Bordo Taşlı Yüzük', 'Yüzük', 'yakut-yuzuk', ['bordo taş', 'kırmızı taş']),
        product('MAWUS_HQ_CEYREK_ALTIN', 'Çeyrek Altın', 'Altın', 'yarim-tam-ceyrekaltin', ['çeyrek', '22 ayar']),
        product('MAWUS_HQ_YARIM_ALTIN', 'Yarım Altın', 'Altın', 'yarim-tam-ceyrekaltin', ['yarım', '22 ayar']),
        product('MAWUS_HQ_TAM_ALTIN', 'Tam Altın', 'Altın', 'yarim-tam-ceyrekaltin', ['tam', '22 ayar']),
        product('MAWUS_HQ_ZUMRUT_YUZUK', 'Yeşil Taşlı Altın Yüzük', 'Yüzük', 'zumrut-yuzuk', ['yeşil taş', 'altın'])
    ],
    bindings: [
        binding('MAWUS_HQ_1000G_ALTIN', [
            'SM_asset_goldingot1kg_001.005',
            'SM_asset_goldingot1kg_001.006'
        ], ['^SM_asset_goldingot1kg_001(?:\\.\\d+)?$']),
        binding('MAWUS_HQ_12_5KG_ALTIN', [
            'SM__asset_goldblock125_001.001',
            'SM__asset_goldblock125_001.002'
        ], ['^SM__asset_goldblock125_001(?:\\.\\d+)?$']),
        binding('MAWUS_HQ_ALTIN_YUZUK', ['pattern01_right'], ['^pattern01_right$']),
        rowBinding('MAWUS_HQ_ALTIN_YUZUK_TASLI', '01'),
        rowBinding('MAWUS_HQ_ALTIN_KIRMIZI_KALPLI', '02'),
        binding('MAWUS_HQ_ALTIN_KIRMIZI_TAS', [
            'Gold womens ring - Regal Crimson',
            'Gold_Ring_big_prong_02'
        ], ['^Gold womens ring - Regal Crimson$', '^Gold_Ring_big_prong_02$']),
        rowBinding('MAWUS_HQ_CICEK_KIRMIZI_YUZUK', '03'),
        binding('MAWUS_CUMHURIYET_ALTINI', [
            'Cumhuriyet altını',
            'Cumhuriyet altını.001'
        ], ['^Cumhuriyet altını(?:\\.\\d+)?$']),
        binding('MAWUS_HQ_CICEK_YUZUK', ['Retopo_Plane.002'], ['^Retopo_Plane\\.002$'], 'medium'),
        rowBinding('MAWUS_HQ_ELMAS_YUZUK', '04'),
        binding('MAWUS_HQ_GRAM_ALTIN', [
            'gram', 'gram.001', 'gram.002', 'gram.003'
        ], ['^gram(?:\\.\\d+)?$']),
        rowBinding('MAWUS_HQ_GRI_YUZUK', '05'),
        rowBinding('MAWUS_HQ_YAKUT_YUZUK', '06'),
        binding('MAWUS_HQ_CEYREK_ALTIN', [
            'ceyrek', 'ceyrek.001', 'ceyrek.002', 'ceyrek.003'
        ], ['^ceyrek(?:\\.\\d+)?$']),
        binding('MAWUS_HQ_YARIM_ALTIN', [
            'yarım', 'yarım.001'
        ], ['^yarım(?:\\.\\d+)?$']),
        binding('MAWUS_HQ_TAM_ALTIN', [
            'Tam', 'Tam.001', 'Tam.002', 'Tam.003'
        ], ['^Tam(?:\\.\\d+)?$']),
        binding('MAWUS_HQ_ZUMRUT_YUZUK', [
            'Crystal Circle', 'Crystal Clamp', 'Crystal Stand', 'Gem', 'Ring'
        ], ['^Crystal (?:Circle|Clamp|Stand)$', '^Gem$', '^Ring$'])
    ]
};

export default mawusProductMatches;
