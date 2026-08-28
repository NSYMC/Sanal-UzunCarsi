import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProductDataset } from '../src/product-registry.js';
import mawusProductMatches from '../src/data/mawus-product-matches.js';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productsPath = path.resolve(workspaceRoot, process.argv[2] || 'src/data/products.json');
const bindingsPath = path.resolve(workspaceRoot, process.argv[3] || 'src/data/scene-product-bindings.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const productsFile = readJson(productsPath);
const bindingsFile = readJson(bindingsPath);
const dataset = {
    schemaVersion: productsFile.schemaVersion ?? bindingsFile.schemaVersion,
    products: [...productsFile.products, ...mawusProductMatches.products],
    bindings: [...bindingsFile.bindings, ...mawusProductMatches.bindings]
};

const validation = validateProductDataset(dataset);
const fileIssues = [];

for (const [index, product] of dataset.products.entries()) {
    const modelPath = product.highQualityModel;
    if (!modelPath || /^https?:\/\//i.test(modelPath)) continue;
    const relative = modelPath.replace(/^\/+/, '').replace(/^public\//, '');
    const absolute = path.resolve(workspaceRoot, 'public', relative);
    const publicRoot = path.resolve(workspaceRoot, 'public');
    if (!absolute.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(absolute)) {
        fileIssues.push({
            severity: 'error',
            code: 'model_file_not_found',
            path: `$.products[${index}].highQualityModel`,
            message: `Model dosyası bulunamadı: ${modelPath}`
        });
    }
}

const issues = [...validation.issues, ...fileIssues];
const errors = issues.filter((entry) => entry.severity === 'error');
const warnings = issues.filter((entry) => entry.severity === 'warning');

for (const entry of errors) console.error(`ERROR [${entry.code}] ${entry.path}: ${entry.message}`);
for (const entry of warnings) console.warn(`WARN  [${entry.code}] ${entry.path}: ${entry.message}`);

console.log(`Ürün verisi: ${dataset.products.length} ürün, ${dataset.bindings.length} bağlantı, ${errors.length} hata, ${warnings.length} uyarı.`);
if (errors.length) process.exitCode = 1;
