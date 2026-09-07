import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readProjectFile = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('sepet, ürün kaydındaki canlı fiyatı okur', async () => {
    const source = await readProjectFile('src/main.js');
    // Altın fiyatları çalışma anında güncellendiği için sepet satırlarında ürün
    // kopyası değil kimlik tutulur; çözüm kayıt üzerinden yapılır.
    assert.match(source, /createCommerceStore\(\{\s*resolveProduct: \(id\) => productRegistry\.getProduct\(id\)/);
});

test('ürün inceleme açılıp kapandığında satın alma bloğu güncellenir', async () => {
    const main = await readProjectFile('src/main.js');
    const editor = await readProjectFile('src/editor.js');
    assert.match(main, /onProductOpened: \(product\) => \{[\s\S]{0,200}?commerceUi\?\.setInspectedProduct\(lastViewedProduct\)/);
    assert.match(main, /onProductClosed: \(\) => \{\s*commerceUi\?\.setInspectedProduct\(null\)/);
    // editor.js kapanış kancasını çağırmazsa blok önceki üründe takılı kalır.
    assert.match(editor, /const closeInspector = \(\) => \{[\s\S]{0,180}?dom\.inspector\.classList\.add\('hidden'\);\s*onProductClosed\?\.\(\)/);
});

test('katalog filtreleri ürün listesini besler', async () => {
    const source = await readProjectFile('src/main.js');
    assert.match(source, /commerceUi\?\.renderCatalog\(\s*productRegistry\.filterProducts\(activePortalFilters\)/);
});

test('mağaza kartlarındaki ürün sayısı kayıttan üretilir', async () => {
    const source = await readProjectFile('src/main.js');
    // Sayılar index.html'e elle yazıldığında katalog değiştikçe eskiyordu.
    assert.match(source, /const syncStoreCardCounts[\s\S]*productRegistry\.filterProducts\(\{ storeId: store\.id \}\)\.length/);
    assert.match(source, /syncStoreCardCounts\(\);/);
});

test('altın fiyatları geldiğinde sepet toplamı tazelenir', async () => {
    const source = await readProjectFile('src/main.js');
    // Fiyatlar sepet açıkken güncellenebiliyor; panel kendiliğinden yenilenmezse
    // satırlar ve toplam eski değerde kalıyor.
    const hydrate = source.slice(
        source.indexOf('const hydrateNisantasiPrices'),
        source.indexOf('const selectStore')
    );
    assert.match(hydrate, /commerceUi\?\.refresh\(\)/);
});

test('sepet arayüzünde sipariş, kupon ve kargo akışı bulunmaz', async () => {
    const commerce = await readProjectFile('src/commerce.js');
    const ui = await readProjectFile('src/commerce-ui.js');
    for (const removed of ['placeOrder', 'applyCoupon', 'validateCustomer', 'SHIPPING_FEE', 'VAT_RATE', 'COUPONS']) {
        assert.doesNotMatch(commerce, new RegExp(removed), `${removed} kaldırılmalıydı.`);
    }
    for (const removed of ['checkout', 'Siparişler', 'İndirim kodu', 'freeship']) {
        assert.doesNotMatch(ui, new RegExp(removed, 'i'), `${removed} arayüzden kaldırılmalıydı.`);
    }
});
