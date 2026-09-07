import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { configureColorManagement, TOUR_EXPOSURE } from '../src/color-management.js';

test('display calibration preserves authored material colors and dynamic exposure', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
        const material = new PBRMaterial('authored red fabric', scene);
        material.albedoColor = new Color3(0.8, 0.03, 0.015);
        const before = material.albedoColor.asArray();
        const image = configureColorManagement(scene, { exposure: TOUR_EXPOSURE.outside });
        const defines = {};
        image.prepareDefines(defines, false);
        assert.equal(defines.TONEMAPPING, 2); // Babylon's ACES shader branch.
        assert.equal(defines.COLORCURVES, true);
        assert.deepEqual(material.albedoColor.asArray(), before);
        image.exposure = TOUR_EXPOSURE.inside;
        assert.equal(image.exposure, 0.54);
        assert.equal(image.colorCurves.globalSaturation, -12);
        assert.equal(image.colorCurves.highlightsSaturation, -8);
    } finally {
        scene.dispose();
        engine.dispose();
    }
});
