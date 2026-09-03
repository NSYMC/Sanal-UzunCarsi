export const isInspectableProductMeshForStore = (mesh, storeId) => {
    const metadata = mesh?.metadata;
    const isProduct = Boolean(metadata?.isGeneratedProduct || metadata?.modeledProductId || metadata?.productId);
    if (!isProduct) return false;
    return !metadata.storeId || !storeId || metadata.storeId === storeId;
};
