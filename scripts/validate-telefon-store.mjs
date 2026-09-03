/**
 * Telefon mağazasının sahne↔ürün bağlantısını doğrular.
 *
 * `public/models/telefon/store-raw.glb` içindeki düğüm adlarını okur, main.js
 * ile aynı kuralları uygulayarak ürün kimliği türetir ve her kimliğin
 * kayıtta bir ürüne ve diskte bir modele karşılık geldiğini denetler.
 */

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import telefonProductMatches from '../src/data/telefon-product-matches.js';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const glbPath = path.join(kok, 'public', 'models', 'telefon', 'store-raw.glb');

// main.js içindeki telefonProductIdForName ile birebir aynı kurallar.
const productIdForName = (name) => {
    const normalized = String(name || '').trim();
    const telefon = normalized.match(/^TEL_(compact|promax|bar|budget|rugged)_Cube_\d+_\d+/i);
    if (telefon) return `TEL_PHONE_${telefon[1].toUpperCase()}`;
    const kilif = normalized.match(/^PK_kilif_([a-z]+)_([a-z]+)_/i);
    if (kilif) return `TEL_BOX_KILIF_${kilif[1].toUpperCase()}_${kilif[2].toUpperCase()}`;
    const aksesuar = normalized.match(/^PK_aks_([a-z]+)_(\d+)_/i);
    if (aksesuar) return `TEL_BOX_${aksesuar[1].toUpperCase()}_${Number(aksesuar[2]) + 1}`;
    return null;
};

const buffer = await readFile(glbPath);
const jsonLength = buffer.readUInt32LE(12);
const gltf = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trim());
const adlar = (gltf.nodes || []).map((n) => n.name || '');

const sayim = new Map();
let eslesmeyen = 0;
for (const ad of adlar) {
    const id = productIdForName(ad);
    if (!id) {
        eslesmeyen += 1;
        continue;
    }
    sayim.set(id, (sayim.get(id) || 0) + 1);
}

const kayit = new Map(telefonProductMatches.products.map((p) => [p.id, p]));
const hatalar = [];
for (const [id, adet] of [...sayim].sort()) {
    const urun = kayit.get(id);
    if (!urun) {
        hatalar.push(`kayitta yok: ${id} (sahnede ${adet} mesh)`);
        continue;
    }
    if (!urun.highQualityModel) {
        hatalar.push(`yuksek kaliteli model tanimsiz: ${id}`);
        continue;
    }
    const dosya = path.join(kok, 'public', urun.highQualityModel.replace(/^\/+/, ''));
    try {
        await access(dosya);
    } catch {
        hatalar.push(`model dosyasi yok: ${id} -> ${urun.highQualityModel}`);
    }
}

// Sahnede karşılığı olmayan bağlantılar da hatadır.
for (const b of telefonProductMatches.bindings) {
    const desen = new RegExp(b.meshNamePatterns[0], 'i');
    if (!adlar.some((ad) => desen.test(ad))) {
        hatalar.push(`baglanti sahnede eslesmiyor: ${b.productId} (${b.meshNamePatterns[0]})`);
    }
}

console.log(`Telefon sahnesi: ${adlar.length} dugum, ${sayim.size} urun kimligi, `
    + `${[...sayim.values()].reduce((a, b) => a + b, 0)} eslesen mesh, `
    + `${eslesmeyen} urun disi dugum.`);
for (const [id, adet] of [...sayim].sort()) console.log(`  ${id.padEnd(28)} ${adet}`);
if (hatalar.length) {
    for (const h of hatalar) console.error(`HATA ${h}`);
    process.exitCode = 1;
} else {
    console.log('Tum urun kimlikleri kayitta ve model dosyalari yerinde.');
}
