import { assetRevision } from './scripts/asset-revision.mjs';
import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    define: { 'import.meta.env.VITE_ASSET_REVISION': JSON.stringify(assetRevision('public')) },
    // Varsayılan 5173; PORT verilirse ona uyar, böylece aynı depoda ikinci bir
    // geliştirme sunucusu port çakışmadan açılabilir.
    server: {
        port: Number(process.env.PORT) || 5173
    },
    build: {
        target: 'es2022'
    }
});
