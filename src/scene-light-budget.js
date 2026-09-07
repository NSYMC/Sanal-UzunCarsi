import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js';

export const SCENE_MATERIAL_LIGHT_LIMIT = 5;

export const capSceneMaterialLights = (scene) => {
    // The glTF loader raises *all* scene materials to scene.lights.length,
    // including materials from earlier, concurrent imports. Cap the whole scene
    // after each import so readiness checks cannot compile 25-light shaders.
    for (const material of scene.materials) {
        if (Number.isFinite(material.maxSimultaneousLights)
            && material.maxSimultaneousLights > SCENE_MATERIAL_LIGHT_LIMIT) {
            material.maxSimultaneousLights = SCENE_MATERIAL_LIGHT_LIMIT;
        }
    }
};

export const loadBoundedSceneAsset = async (rootUrl, filename, scene, ...options) => {
    const container = await SceneLoader.LoadAssetContainerAsync(rootUrl, filename, scene, ...options);
    capSceneMaterialLights(scene);
    return container;
};
