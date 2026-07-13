import './style.css';
import { Engine, Scene, Vector3, HemisphericLight, MeshBuilder, UniversalCamera } from '@babylonjs/core';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true);

const createScene = () => {
    const scene = new Scene(engine);

    const camera = new UniversalCamera('vrCamera', new Vector3(0, 5, -10), scene);
    camera.setTarget(Vector3.Zero());
    camera.attachControl(canvas, true);

    camera.keysUp.push(87);
    camera.keysDown.push(83);
    camera.keysLeft.push(65);
    camera.keysRight.push(68);

    const light = new HemisphericLight('envLight', new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    const ground = MeshBuilder.CreateGround('baseGround', { width: 50, height: 50 }, scene);
    
    const referenceBox = MeshBuilder.CreateBox('refBox', { size: 2 }, scene);
    referenceBox.position.y = 1;

    return scene;
};

const scene = createScene();

engine.runRenderLoop(() => {
    scene.render();
});

window.addEventListener('resize', () => {
    engine.resize();
});
