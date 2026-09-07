import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/loaders/glTF/index.js';
import { loadBoundedSceneAsset } from '../src/scene-light-budget.js';

test('later glTF imports cannot raise earlier materials above the tour light budget', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
        const earlierMaterial = new PBRMaterial('earlier store material', scene);
        earlierMaterial.maxSimultaneousLights = 5;
        earlierMaterial.albedoColor.set(0.8, 0.25, 0.1);
        const authoredColor = earlierMaterial.albedoColor.asArray();
        for (let i = 0; i < 25; i++) new PointLight(`light${i}`, Vector3.Zero(), scene);
        const data = `data:${JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] })}`;
        const container = await loadBoundedSceneAsset('', data, scene, undefined, '.gltf');
        assert.equal(scene.lights.length, 25, 'Authored lights must remain intact');
        assert.equal(earlierMaterial.maxSimultaneousLights, 5);
        assert.deepEqual(earlierMaterial.albedoColor.asArray(), authoredColor);
        container.dispose();
    } finally { scene.dispose(); engine.dispose(); }
});
