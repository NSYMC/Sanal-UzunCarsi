import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createStoreEntranceShot,
    easeInOutCubic,
    sampleStoreEntranceShot
} from '../src/store-entry-cinematic.js';
import anchors from '../src/store-anchors.json' with { type: 'json' };

test('sinematik giriş her mağazada dışarıdan başlayıp güvenli biçimde içeri yerleşir', () => {
    for (const [storeId, rawBounds] of Object.entries(anchors.stores)) {
        const bounds = {
            ...rawBounds,
            ...rawBounds.bounds,
            entrance: { x: rawBounds.entrance[0], y: rawBounds.entrance[1], z: rawBounds.entrance[2] },
            entranceTarget: {
                x: rawBounds.entranceTarget[0],
                y: rawBounds.entranceTarget[1],
                z: rawBounds.entranceTarget[2]
            }
        };
        const shot = createStoreEntranceShot(bounds);
        assert.ok(shot.start.z > bounds.maxZ, `${storeId} başlangıcı dışarıda olmalı`);
        assert.ok(shot.settle.z < bounds.entrance.z, `${storeId} bitişi kapının içinde olmalı`);
        assert.ok(shot.settle.x >= bounds.minX && shot.settle.x <= bounds.maxX);
        assert.equal(shot.settle.y, bounds.entrance.y);
    }
});

test('kamera rotası başlangıç ve bitiş noktalarını kesin korur', () => {
    const bounds = {
        ...anchors.stores['guzel-optik'],
        entrance: { x: 27.445, y: -6.72, z: 16.35 },
        entranceTarget: { x: 27.445, y: -6.72, z: 10.2 }
    };
    const shot = createStoreEntranceShot(bounds);
    assert.deepEqual(sampleStoreEntranceShot(shot, 0), shot.start);
    assert.deepEqual(sampleStoreEntranceShot(shot, 1), shot.settle);
});

test('sinematik easing monoton ve sınırlar içinde kalır', () => {
    const samples = Array.from({ length: 101 }, (_, index) => easeInOutCubic(index / 100));
    assert.equal(samples[0], 0);
    assert.equal(samples.at(-1), 1);
    samples.forEach((value, index) => {
        assert.ok(value >= 0 && value <= 1);
        if (index) assert.ok(value >= samples[index - 1]);
    });
});
