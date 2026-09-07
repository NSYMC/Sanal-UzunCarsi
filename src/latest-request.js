// Temizleme ve yeni seçimler, bekleyen önceki işi geçersiz kılar.
export const createLatestRequest = () => {
    let version = 0;
    return {
        begin() {
            const request = ++version;
            return () => request === version;
        },
        invalidate() { version += 1; }
    };
};
