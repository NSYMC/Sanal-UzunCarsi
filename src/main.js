import './style.css';
import { 
    Engine, Scene, Vector3, HemisphericLight, MeshBuilder, UniversalCamera, 
    StandardMaterial, Color3, ActionManager, ExecuteCodeAction, Animation, 
    CubicEase, EasingFunction
} from '@babylonjs/core';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true);

const uiOverlay = document.getElementById('uiOverlay');
const closeBtn = document.getElementById('closeBtn');
const productBrand = document.getElementById('productBrand');
const productName = document.getElementById('productName');
const productDesc = document.getElementById('productDesc');
const productPrice = document.getElementById('productPrice');

let activeProduct = null;
let originalPosition = null;
let originalRotation = null;
let camera = null;
let scene = null;

const createScene = () => {
    scene = new Scene(engine);
    
    camera = new UniversalCamera('vrCamera', new Vector3(0, 1.7, -4), scene);
    camera.setTarget(new Vector3(0, 1.7, 0));
    camera.attachControl(canvas, true);
    
    camera.keysUp.push(87);
    camera.keysDown.push(83);
    camera.keysLeft.push(65);
    camera.keysRight.push(68);
    camera.speed = 0.12;
    camera.inertia = 0.8;
    camera.minZ = 0.1;

    const light = new HemisphericLight('envLight', new Vector3(0.5, 1, 0.2), scene);
    light.intensity = 0.9;
    light.groundColor = new Color3(0.2, 0.2, 0.2);

    buildStore(scene);

    createProduct(scene, "id_1", "Maraş İpliği", "Klasik Kesim T-Shirt", "100% Pamuklu, Kahramanmaraş üretimi yüksek kaliteli kumaş.", "₺450.00", new Vector3(-1.5, 1.35, 1.5), new Color3(0.8, 0.2, 0.2));
    createProduct(scene, "id_2", "Uzun Çarşı Butik", "Oversize Sokak T-Shirt", "Bol kesim, rahat ve modern sokak modası tasarımı.", "₺550.00", new Vector3(0, 1.35, 1.5), new Color3(0.2, 0.5, 0.8));
    createProduct(scene, "id_3", "Yöresel Dokuma", "Nakışlı Özel Gömlek", "Yöresel motiflerle el işlemesi özel tasarım gömlek.", "₺850.00", new Vector3(1.5, 1.35, 1.5), new Color3(0.9, 0.8, 0.2));

    return scene;
};

const buildStore = (scene) => {
    const ground = MeshBuilder.CreateGround('storeFloor', { width: 10, height: 10 }, scene);
    const groundMat = new StandardMaterial('floorMat', scene);
    groundMat.diffuseColor = new Color3(0.12, 0.12, 0.15);
    groundMat.specularColor = new Color3(0.05, 0.05, 0.05);
    ground.material = groundMat;

    const wallMat = new StandardMaterial('wallMat', scene);
    wallMat.diffuseColor = new Color3(0.85, 0.85, 0.88);

    const backWall = MeshBuilder.CreateBox('backWall', { width: 10, height: 4, depth: 0.2 }, scene);
    backWall.position = new Vector3(0, 2, 5);
    backWall.material = wallMat;

    const leftWall = MeshBuilder.CreateBox('leftWall', { width: 0.2, height: 4, depth: 10 }, scene);
    leftWall.position = new Vector3(-5, 2, 0);
    leftWall.material = wallMat;

    const rightWall = MeshBuilder.CreateBox('rightWall', { width: 0.2, height: 4, depth: 10 }, scene);
    rightWall.position = new Vector3(5, 2, 0);
    rightWall.material = wallMat;
    
    const createPedestal = (x, z) => {
        const ped = MeshBuilder.CreateCylinder('ped', { diameter: 0.6, height: 1 }, scene);
        ped.position = new Vector3(x, 0.5, z);
        const pedMat = new StandardMaterial('pedMat', scene);
        pedMat.diffuseColor = new Color3(0.25, 0.25, 0.25);
        ped.material = pedMat;
    };
    
    createPedestal(-1.5, 1.5);
    createPedestal(0, 1.5);
    createPedestal(1.5, 1.5);
};

const createProduct = (scene, id, brand, name, desc, price, position, color) => {
    const mesh = MeshBuilder.CreateBox(id, { width: 0.5, height: 0.7, depth: 0.1 }, scene);
    mesh.position = position.clone();
    
    const mat = new StandardMaterial(id + "_mat", scene);
    mat.diffuseColor = color;
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    mesh.material = mat;
    
    mesh.metadata = { brand, name, desc, price };
    
    mesh.actionManager = new ActionManager(scene);
    
    mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
        if(!activeProduct) document.getElementById('renderCanvas').style.cursor = 'pointer';
        mat.emissiveColor = new Color3(0.2, 0.2, 0.2);
    }));
    
    mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
        document.getElementById('renderCanvas').style.cursor = 'default';
        mat.emissiveColor = new Color3(0, 0, 0);
    }));
    
    mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
        if(activeProduct === null) {
            openProductView(mesh);
        }
    }));
};

const animateMesh = (mesh, targetPos, targetRot, onEnd) => {
    const frameRate = 60;
    const duration = 1.0; 
    
    const posAnim = new Animation("posAnim", "position", frameRate, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
    const posKeys = [
        { frame: 0, value: mesh.position },
        { frame: frameRate * duration, value: targetPos }
    ];
    posAnim.setKeys(posKeys);
    
    const rotAnim = new Animation("rotAnim", "rotation", frameRate, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
    const rotKeys = [
        { frame: 0, value: mesh.rotation },
        { frame: frameRate * duration, value: targetRot }
    ];
    rotAnim.setKeys(rotKeys);
    
    const easingFunction = new CubicEase();
    easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    posAnim.setEasingFunction(easingFunction);
    rotAnim.setEasingFunction(easingFunction);
    
    mesh.animations = [];
    mesh.animations.push(posAnim);
    mesh.animations.push(rotAnim);
    
    scene.beginAnimation(mesh, 0, frameRate * duration, false, 1.0, onEnd);
};

let idleRotationObserver = null;

const openProductView = (mesh) => {
    activeProduct = mesh;
    originalPosition = mesh.position.clone();
    originalRotation = mesh.rotation.clone();
    
    camera.detachControl();
    
    document.getElementById('renderCanvas').style.cursor = 'default';
    
    const cameraForward = camera.getDirection(Vector3.Forward());
    const cameraRight = camera.getDirection(Vector3.Right());
    
    const targetPos = camera.position.add(cameraForward.scale(1.2));
    targetPos.subtractInPlace(cameraRight.scale(0.35)); 
    targetPos.y -= 0.1;
    
    const targetRot = new Vector3(0, camera.rotation.y, 0);
    
    productBrand.innerText = mesh.metadata.brand;
    productName.innerText = mesh.metadata.name;
    productDesc.innerText = mesh.metadata.desc;
    productPrice.innerText = mesh.metadata.price;
    
    animateMesh(mesh, targetPos, targetRot, () => {
        uiOverlay.classList.remove('hidden');
        void uiOverlay.offsetWidth;
        uiOverlay.classList.add('active');
        
        idleRotationObserver = scene.onBeforeRenderObservable.add(() => {
            if(activeProduct) activeProduct.rotation.y += 0.01;
        });
    });
};

const closeProductView = () => {
    if (!activeProduct) return;
    
    uiOverlay.classList.remove('active');
    
    setTimeout(() => {
        uiOverlay.classList.add('hidden');
        
        if(idleRotationObserver) {
            scene.onBeforeRenderObservable.remove(idleRotationObserver);
            idleRotationObserver = null;
        }
        
        animateMesh(activeProduct, originalPosition, originalRotation, () => {
            activeProduct.rotation.y = 0; 
            activeProduct = null;
            camera.attachControl(canvas, true);
        });
    }, 500); 
};

closeBtn.addEventListener('click', closeProductView);

createScene();

engine.runRenderLoop(() => {
    if(scene) scene.render();
});

window.addEventListener('resize', () => {
    engine.resize();
});
