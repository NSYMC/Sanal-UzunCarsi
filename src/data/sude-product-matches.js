const previewTransform = Object.freeze({
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1]
});

const product = (slug, name, category, price, description, aliases, family) => ({
    id: `SUDE_HQ_${slug.toUpperCase().replaceAll('-', '_')}`,
    storeId: 'sude-home',
    name,
    brand: 'Sude Home',
    category,
    price,
    currency: 'TRY',
    priceType: 'catalog',
    priceNote: 'Mağaza tarafından tanımlanan katalog fiyatıdır.',
    description: `${name}.`,
    tags: ['sude home', category.toLocaleLowerCase('tr-TR'), ...name.toLocaleLowerCase('tr-TR').split(' ')],
    highQualityModel: `/models/products/sude-home/${slug}.glb`,
    runtimeBinding: 'nearest-scene-root',
    previewTransform,
    aliases,
    family,
    active: true
});

export const sudeProducts = [
    product('altin-desenli-kase', 'Altın Desenli Porselen Kase', 'Kase', 1190, 'Açık renkli porselen görünümü ve altın renkli bezemeleriyle dekoratif servis kasesi.', ['bowl made of enamel material'], 'bowl'),
    product('bakir-surahi', 'Klasik Bakır Sürahi', 'Sürahi', 1790, 'İnce uzun gövdesi ve bakır renkli yüzeyiyle geleneksel sunumlara uygun sürahi.', ['karaca.001', 'cylinder.047'], 'jug'),
    product('bakir-caydanlik', 'Bakır Çaydanlık', 'Çaydanlık', 2190, 'Bakır renkli gövdesi ve açık renkli sap ayrıntısıyla geleneksel çay sunumuna uygun çaydanlık.', ['persian copper kettle dish'], 'kettle'),
    product('bakir-surahi2', 'Dövme Görünümlü Bakır Sürahi', 'Sürahi', 2490, 'Geniş gövdesi, belirgin kulpu ve dokulu bakır görünümüyle gösterişli servis sürahisi.', ['jug copper'], 'jug'),
    product('bakir-tencere', 'Bakır Servis Tenceresi', 'Tencere', 1890, 'Bakır renkli gövdesi ve sade formuyla servis ve sunum amaçlı tencere.', ['nurbspath.004', 'persian copper cop dish'], 'pot'),
    product('bakir-tencere-set', 'Bakır Tencere Seti', 'Tencere Seti', 3290, 'Farklı boylardaki üç parçadan oluşan, metalik bakır tonlu tencere seti.', ['kitchen copper pots set', 'pots'], 'set'),
    product('beyaz-kase', 'Beyaz Seramik Kase', 'Kase', 449, 'Sade beyaz yüzeyi ve geniş servis formuyla günlük kullanıma uygun seramik kase.', ['ceramic bowl big'], 'bowl'),
    product('buyuk-metal-ketil', 'Büyük Metal Kettle', 'Kettle', 2290, 'Geniş metal gövdesi, tabanı ve kulp ayrıntılarıyla tezgâh üstü sıcak içecek hazırlama ürünü.', ['electric coffee maker', 'electric coffee maker.001'], 'kettle'),
    product('buyuk-porselen-kase', 'Büyük Porselen Kase', 'Kase', 749, 'Yumuşak geçişli geniş formu ve porselen görünümüyle sofrada servis için uygun kase.', ['bowl.001'], 'bowl'),
    product('buyuk-porselen-kavanoz', 'Büyük Porselen Kavanoz', 'Kavanoz', 1090, 'Kapaklı, geniş porselen gövdesiyle mutfak ve dekoratif saklama kullanımına uygun kavanoz.', ['jar'], 'jar'),
    product('buyuk-tava', 'Ahşap Saplı Büyük Tava', 'Tava', 1390, 'Geniş pişirme yüzeyi ve ahşap görünümlü uzun sapıyla büyük boy tava.', ['куб.028'], 'pan'),
    product('buyuk-vazo', 'Büyük Porselen Vazo', 'Vazo', 1290, 'Uzun gövdesi ve sade porselen görünümüyle masa veya konsol üstü dekoratif vazo.', ['ornate gold vase', 'vase.001'], 'vase'),
    product('caydanlik-cicek-desenli', 'Çiçek Desenli Çaydanlık', 'Çaydanlık', 1490, 'Açık renkli gövdesi, kırmızı ayrıntıları ve çiçek bezemeleriyle dekoratif çaydanlık.', ['circle.068', 'ceramic teapot'], 'kettle'),
    product('celik-termos', 'Çelik Termos', 'Termos', 799, 'Çelik görünümlü gövdesi ve siyah kapak ayrıntısıyla sade, günlük kullanıma uygun termos.', ['stainless steel water bottle', 'water bottle stainless steel', 'bottle.001'], 'thermos'),
    product('desenli-termos', 'Çiçek Desenli Termos', 'Termos', 1290, 'Çiçek desenli gövdesi, metalik yüzeyleri ve doğal tonlu kapak ayrıntısıyla dekoratif termos.', ['classic floral thermos'], 'thermos'),
    product('ketil', 'Beyaz Çelik Kettle', 'Kettle', 1590, 'Beyaz ve çelik görünümlü gövdesi, ahşap tonlu kapak düğmesiyle modern kettle.', ['knob'], 'kettle'),
    product('ketil-tahta-kulplu', 'Ahşap Kulplu Kettle', 'Kettle', 1890, 'Mat metal gövdesi ve ahşap görünümlü kulp ayrıntılarıyla modern ocak üstü kettle.', ['fellow kettle info degrees', 'fellow kettle pro'], 'kettle'),
    product('kucuk-porselen-kase', 'Küçük Desenli Porselen Kase', 'Kase', 499, 'İç yüzeyindeki yumuşak renk geçişleriyle küçük porselen servis kasesi.', ['bowl l hermitage cinza e bege'], 'bowl'),
    product('kucuk-porselen-kavanoz', 'Küçük Porselen Kavanoz', 'Kavanoz', 649, 'Kompakt kapaklı formu ve porselen görünümüyle küçük mutfak saklama kavanozu.', ['jar.001'], 'jar'),
    product('orta-porselen-vazo', 'Orta Boy Porselen Vazo', 'Vazo', 899, 'Dengeli gövde oranları ve sade porselen görünümüyle orta boy dekoratif vazo.', ['vase'], 'vase'),
    product('porselen-beyaz-kase', 'Mermer Görünümlü Beyaz Kase', 'Kase', 990, 'Beyaz mermer görünümü ve metalik altın renkli ayrıntılarıyla dekoratif kase.', ['marble bowl'], 'bowl'),
    product('porselen-kase', 'Mavi Beyaz Porselen Kase', 'Kase', 849, 'Mavi-beyaz geleneksel desenleri ve yuvarlak servis formuyla porselen kase.', ['blue_and_white_porcelain_bowl'], 'bowl'),
    product('porselen-kavanoz', 'Desenli Porselen Kavanoz', 'Kavanoz', 890, 'Kapaklı porselen gövdesi ve dekoratif yüzey görünümüyle saklama kavanozu.', ['jar.003'], 'jar'),
    product('porselen-mavi-buyuk-kae', 'Büyük Mavi Porselen Kase', 'Kase', 790, 'Mavi tonlu geniş porselen formuyla servis ve dekoratif kullanım için büyük kase.', ['geo_x_bowl', 'blue marble ceramic vase'], 'bowl'),
    product('siyah-termos', 'Siyah Termos', 'Termos', 899, 'Mat siyah gövdesi ve metalik bağlantı ayrıntılarıyla sade, güçlü görünümlü termos.', ['thermos bottle g'], 'thermos'),
    product('tava', 'Kırmızı Gövdeli Tava', 'Tava', 1190, 'Kırmızı dış yüzeyi, koyu pişirme tabanı ve ergonomik sapıyla günlük kullanıma uygun tava.', ['cooking pan.001'], 'pan'),
    product('tencere', 'Kapaklı Çelik Tencere', 'Tencere', 1390, 'Çelik görünümlü gövdesi ve kapağıyla orta boy günlük kullanım tenceresi.', ['cooking pot medium with lid'], 'pot'),
    product('tencere-turuncu-kulp', 'Turuncu Kulplu Tencere', 'Tencere', 1690, 'Metalik gövdesi, cam görünümlü kapağı ve turuncu-bakır tonlu kulplarıyla modern tencere.', ['circle.001'], 'pot')
];

const normalize = (value) => String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яё_]+/gi, ' ')
    .trim();

const familyFromText = (value) => {
    const text = normalize(value);
    if (/pan|frying|tava/.test(text)) return 'pan';
    if (/cookset| set |pots|tencere set/.test(` ${text} `)) return 'set';
    if (/pot|tencere/.test(text)) return 'pot';
    if (/kettle|teapot| tea |caydanlik|ketil/.test(` ${text} `)) return 'kettle';
    if (/thermos|bottle|termos/.test(text)) return 'thermos';
    if (/plate|bowl|kase/.test(text)) return 'bowl';
    if (/jar|kavanoz/.test(text)) return 'jar';
    if (/vase|vazo/.test(text)) return 'vase';
    if (/jug|surahi/.test(text)) return 'jug';
    return null;
};

const stableIndex = (value, length) => [...String(value || '')]
    .reduce((sum, character) => (sum * 31 + character.codePointAt(0)) >>> 0, 0) % length;

export const resolveSudeProduct = ({ rootName, sourceName }) => {
    const root = normalize(rootName);
    const source = normalize(sourceName);
    if (source.includes('sude bk kettle 003')) {
        return sudeProducts.find(({ id }) => id === 'SUDE_HQ_KETIL') || null;
    }
    const exact = sudeProducts.find((candidate) => candidate.aliases.some((alias) => {
        const normalizedAlias = normalize(alias);
        return normalizedAlias.length >= 4 && (root === normalizedAlias || root.includes(normalizedAlias));
    }));
    if (exact) return exact;
    const family = familyFromText(`${rootName} ${sourceName}`);
    const candidates = sudeProducts.filter((candidate) => candidate.family === family);
    return candidates.length ? candidates[stableIndex(`${rootName}|${sourceName}`, candidates.length)] : null;
};

export default { products: sudeProducts, resolve: resolveSudeProduct };
