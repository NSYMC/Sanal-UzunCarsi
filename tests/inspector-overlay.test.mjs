import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readProjectFile = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('arama sonuç şeridi ürün inceleme ve sepetin üstüne binmez', async () => {
    const css = await readProjectFile('src/product-search-highlight.css');
    // Şerit z-index 620 ile duruyor; kapatılmazsa açık panellerin üstünde kalıyor.
    assert.match(css, /body\.product-inspector-open \.scene-filter-status[\s\S]{0,80}display: none/);
    assert.match(css, /body\.commerce-panel-open \.scene-filter-status[\s\S]{0,80}display: none/);
});

test('sepet paneli ürün inceleme ekranının üstünde açılır', async () => {
    const inspector = await readProjectFile('src/style.css');
    const commerce = await readProjectFile('src/commerce.css');
    const highest = Math.max(...[...inspector.matchAll(/z-index:\s*(\d+)/g)].map(([, value]) => Number(value)));
    const panel = Number(commerce.match(/\.commerce-panel \{[\s\S]*?z-index:\s*(\d+)/)[1]);
    const backdrop = Number(commerce.match(/\.commerce-backdrop \{[\s\S]*?z-index:\s*(\d+)/)[1]);
    assert.ok(panel > highest, `Sepet paneli (${panel}) sahne katmanlarının (${highest}) üstünde olmalı.`);
    assert.ok(backdrop < panel);
});

test('geliştirme derlemesinde ürün inceleme betikten açılabilir', async () => {
    const source = await readProjectFile('src/main.js');
    // Otomatik denetimlerde imleç kilidi verilmediği için tıklama simüle edilemiyor.
    assert.match(source, /openProduct: \(productId\) => editor\.openProduct\(productId\)/);
    assert.match(source, /closeProduct: \(\) =>/);
    const debugBlock = source.slice(source.indexOf('__UZUNCARSI_DEBUG__'), source.indexOf('setLoadingProgress(100'));
    assert.ok(debugBlock.includes('openProduct'), 'Kanca DEV blokunun içinde kalmalı.');
});
