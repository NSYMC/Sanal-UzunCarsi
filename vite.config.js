import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    // Varsayılan 5173; PORT verilirse ona uyar, böylece aynı depoda ikinci bir
    // geliştirme sunucusu port çakışmadan açılabilir.
    server: {
        port: Number(process.env.PORT) || 5173
    },
    build: {
        target: 'es2022'
    }
});
