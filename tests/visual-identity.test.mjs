import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const projectRoot = new URL('..', import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, projectRoot), 'utf8');

const styleSheets = async () => {
    const directory = new URL('src/', projectRoot);
    // Yalnız uygulamanın yüklediği stiller; yerel/dağıtılmayan editör dosyaları dahil değil.
    const files = ['style.css', 'commerce.css', 'product-search-highlight.css', 'store-entry-cinematic.css', 'theme.css'];
    return Promise.all(files.map(async (name) => [name, await readFile(new URL(name, directory), 'utf8')]));
};

test('arayüzde ikon yerine emoji kullanılmaz', async () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}]/u;
    for (const file of ['index.html', 'src/main.js', 'src/commerce-ui.js']) {
        const source = await read(file);
        const found = source.match(new RegExp(emoji, 'gu'));
        assert.equal(found, null, `${file} içinde emoji/ok karakteri kaldı: ${found?.join(' ')}`);
    }
});

test('buzlu cam yüzey bırakılmaz', async () => {
    for (const [name, css] of await styleSheets()) {
        if (name === 'theme.css') continue;
        const active = [...css.matchAll(/backdrop-filter:\s*([^;]+);/g)]
            .map(([, value]) => value.trim())
            .filter((value) => value !== 'none');
        assert.deepEqual(active, [], `${name} içinde etkin backdrop-filter kaldı.`);
    }
});

test('mavi/mor degrade ve renkli parlama gölgesi kullanılmaz', async () => {
    for (const [name, css] of await styleSheets()) {
        assert.doesNotMatch(css, /#0052FF|#00C2FF|#38BDF8|#6366f1|#8b5cf6/i, `${name} eski mavi/mor paleti taşıyor.`);
        assert.doesNotMatch(css, /rgba\(\s*255,\s*96,\s*0/, `${name} turuncu parlama taşıyor.`);
    }
});

test('kimlik katmanı tek bir palet ve iki yazı tipi tanımlar', async () => {
    const theme = await read('src/theme.css');
    for (const token of ['--uc-ink', '--uc-brass', '--uc-kilim', '--uc-paper', '--uc-display', '--uc-sans']) {
        assert.match(theme, new RegExp(`${token}:`), `${token} tanımlı olmalı.`);
    }
    const html = await read('index.html');
    // Başlık serifi ve arayüz groteski birlikte yüklenmeli.
    assert.match(html, /family=Archivo/);
    assert.match(html, /family=Fraunces/);
    assert.doesNotMatch(html, /Figtree|Plus\+Jakarta/);
});

test('numaralı adım etiketleri kaldırıldı', async () => {
    const html = await read('index.html');
    assert.doesNotMatch(html, /<b>0?1<\/b>/);
    assert.doesNotMatch(html, /<b>0?2<\/b>/);
});

test('kimlik katmanı en son yüklenir', async () => {
    const main = await read('src/main.js');
    const theme = main.indexOf("import './theme.css'");
    const base = main.indexOf("import './style.css'");
    assert.ok(base >= 0 && theme > base, 'theme.css style.css sonrasında yüklenmeli.');
});
