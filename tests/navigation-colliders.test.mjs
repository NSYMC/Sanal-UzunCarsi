import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createNavigationColliderSpec,
    createNavigationColliderSpecs
} from '../src/navigation-colliders.js';

const store = {
    minX: 0,
    maxX: 10,
    minZ: -12,
    maxZ: 0,
    floorY: -1,
    entrance: { x: 5, y: 0.92, z: 0 }
};

const candidate = (label, minimum, maximum, extra = {}) => ({ label, minimum, maximum, ...extra });

test('yürüyüş seviyesindeki tezgâh için hafif proxy collider üretir', () => {
    const spec = createNavigationColliderSpec(candidate('Wood counter',
        { x: 1, y: -1, z: -6 },
        { x: 3.2, y: 0.05, z: -4.8 }
    ), store);
    assert.ok(spec);
    assert.equal(spec.width, 2.2);
    assert.equal(spec.height, 1.05);
    assert.deepEqual(spec.position, { x: 2.1, y: -0.475, z: -5.4 });
});

test('zemin, tavan, ürün ve kapı açıklığı collider olmaz', () => {
    assert.equal(createNavigationColliderSpec(candidate('floor',
        { x: 0, y: -1.04, z: -12 }, { x: 10, y: -0.96, z: 0 }
    ), store), null);
    assert.equal(createNavigationColliderSpec(candidate('ceiling panel',
        { x: 2, y: 1, z: -8 }, { x: 8, y: 1.12, z: -2 }
    ), store), null);
    assert.equal(createNavigationColliderSpec(candidate('OPTIK_PRODUCT_101',
        { x: 2, y: -0.5, z: -4 }, { x: 3, y: 0.2, z: -3 }, { isProduct: true }
    ), store), null);
    assert.equal(createNavigationColliderSpec(candidate('front frame',
        { x: 4.6, y: -1, z: -0.3 }, { x: 5.4, y: 1.4, z: 0.2 }
    ), store), null);
    assert.equal(createNavigationColliderSpec(candidate('combined store shell',
        { x: 0.5, y: -1, z: -11 }, { x: 9.5, y: 1.5, z: -2 }
    ), store), null);
});

test('alçak eşik step metadata alır ve collider sayısı sınırlanır', () => {
    const low = createNavigationColliderSpec(candidate('low plinth',
        { x: 1, y: -1, z: -3 }, { x: 2, y: -0.7, z: -2 }
    ), store);
    assert.equal(low.stepHeight, 0.3);

    const many = Array.from({ length: 12 }, (_, index) => candidate(`fixture ${index}`,
        { x: 0.4 + index * 0.6, y: -1, z: -6 },
        { x: 0.8 + index * 0.6, y: 0, z: -5.4 }
    ));
    assert.equal(createNavigationColliderSpecs(many, store, { limit: 5 }).length, 5);
});
