import test from 'node:test';
import assert from 'node:assert/strict';
import { isInspectableProductMeshForStore } from '../src/product-interaction.js';

const productMesh = (storeId) => ({
    metadata: { productId: 'PRODUCT_1', storeId }
});

test('ürün inceleme hedefi yalnızca etkin mağazadan seçilir', () => {
    assert.equal(isInspectableProductMeshForStore(productMesh('guzel-optik'), 'guzel-optik'), true);
    assert.equal(isInspectableProductMeshForStore(productMesh('nisantasi'), 'guzel-optik'), false);
    assert.equal(isInspectableProductMeshForStore({ metadata: { isGeneratedProduct: true } }, 'guzel-optik'), true);
    assert.equal(isInspectableProductMeshForStore({ metadata: {} }, 'guzel-optik'), false);
});
