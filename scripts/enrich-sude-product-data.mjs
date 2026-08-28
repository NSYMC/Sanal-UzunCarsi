import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sudeProducts } from '../src/data/sude-product-matches.js';

const productsPath = path.join(process.cwd(), 'src', 'data', 'products.json');
const bindingsPath = path.join(process.cwd(), 'src', 'data', 'scene-product-bindings.json');
const data = JSON.parse(await readFile(productsPath, 'utf8'));
const bindings = JSON.parse(await readFile(bindingsPath, 'utf8'));
data.products = [
    ...data.products.filter((product) => product.storeId !== 'sude-home'),
    ...sudeProducts.map(({ aliases, family, ...product }) => product)
];
await writeFile(productsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
bindings.bindings = bindings.bindings.filter((binding) => binding.storeId !== 'sude-home');
await writeFile(bindingsPath, `${JSON.stringify(bindings, null, 2)}\n`, 'utf8');
console.log(`${sudeProducts.length} Sude Home ürünü kataloğa eklendi.`);
