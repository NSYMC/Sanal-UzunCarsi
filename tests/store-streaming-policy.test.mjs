import test from 'node:test';
import assert from 'node:assert/strict';
import {
    containsXZ,
    createStoreSpatialLimits,
    orderBackgroundStores
} from '../src/store-streaming-policy.js';

const bounds = {
    minX: 24.86,
    maxX: 30.03,
    minZ: -11.45,
    maxZ: 18,
    entrance: { x: 27.445, z: 16.35 },
    entranceTarget: { x: 27.445, z: 10.2 },
    center: { x: 27.445, z: 3.28 }
};

test('outside sahnesi kapı eşiğinde açık kalır ve kullanıcı tamamen içerideyken kapanır', () => {
    const limits = createStoreSpatialLimits(bounds);
    assert.equal(containsXZ(limits.insideEnter, { x: 27.445, z: 16.1 }), false);
    assert.equal(containsXZ(limits.insideEnter, { x: 27.445, z: 15.0 }), true);
    assert.equal(containsXZ(limits.insideExit, { x: 27.445, z: 15.9 }), true);
    assert.equal(containsXZ(limits.insideExit, { x: 27.445, z: 16.1 }), false);
});

test('mağaza uzaktan görünür ve çıkış eşiği titreşimi önler', () => {
    const limits = createStoreSpatialLimits(bounds);
    assert.equal(containsXZ(limits.proximityEnter, { x: 27.445, z: 58 }), true);
    assert.equal(containsXZ(limits.proximityEnter, { x: 27.445, z: 61 }), false);
    assert.equal(containsXZ(limits.proximityExit, { x: 27.445, z: 61 }), true);
});

test('arka plan indirme sırası seçilen mağazaya yakınlığa göre belirlenir', () => {
    const stores = {
        selected: { id: 'selected', bounds: { center: { x: 0, z: 0 } } },
        far: { id: 'far', bounds: { center: { x: 100, z: 0 } } },
        near: { id: 'near', bounds: { center: { x: 20, z: 0 } } }
    };
    assert.deepEqual(orderBackgroundStores(stores.selected, stores).map(({ id }) => id), ['near', 'far']);
});
