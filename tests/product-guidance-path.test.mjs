import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createGuidanceControlPoints,
    pathLength,
    samplePathAtDistance,
    sampleRoundedGuidancePath
} from '../src/product-guidance-path.js';

const bounds = {
    minX: 24.86,
    maxX: 30.03,
    minZ: -11.45,
    maxZ: 18,
    center: { x: 27.445, z: 3.28 },
    entrance: { x: 27.445, z: 16.35 }
};

test('dışarıdaki kullanıcı için rota kapıdan ve güvenli orta koridordan geçer', () => {
    const controls = createGuidanceControlPoints({
        origin: { x: 30, z: 25 },
        target: { x: 25.15, z: -4 },
        bounds,
        floorY: -8.62
    });
    assert.deepEqual(controls[1], { x: bounds.entrance.x, y: -8.575, z: bounds.entrance.z + 0.9 });
    assert.ok(controls.some((point) => point.x === bounds.center.x && point.z < bounds.entrance.z));
    assert.ok(controls.at(-1).x > 25.15, 'rota rafın içine girmeden ürünün önünde bitmeli');
});

test('içerideki rota raflara yönelmeden önce orta koridora bağlanır', () => {
    const controls = createGuidanceControlPoints({
        origin: { x: 25.1, z: 8 },
        target: { x: 29.8, z: -2 },
        bounds,
        floorY: -8.62
    });
    assert.equal(controls[1].x, bounds.center.x);
    assert.equal(controls[1].z, 8);
    assert.ok(controls.at(-1).x < 29.8);
});

test('yuvarlatılmış rota sonlu, sıralı ve mesafe boyunca örneklenebilir', () => {
    const controls = createGuidanceControlPoints({
        origin: { x: 27.445, z: 14 },
        target: { x: 25.2, z: -6 },
        bounds,
        floorY: -8.62
    });
    const path = sampleRoundedGuidancePath(controls);
    const length = pathLength(path);
    assert.ok(path.length > controls.length);
    assert.ok(length > 15 && length < 30);
    const middle = samplePathAtDistance(path, length / 2);
    assert.ok(Number.isFinite(middle.x));
    assert.ok(Number.isFinite(middle.z));
    assert.ok(Math.abs(Math.hypot(middle.direction.x, middle.direction.z) - 1) < 0.001);
});
