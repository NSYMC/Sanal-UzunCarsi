import './style.css';
import { 
    Engine, Scene, Vector3, HemisphericLight, DirectionalLight, MeshBuilder, UniversalCamera, 
    PBRMaterial, Color3, ActionManager, ExecuteCodeAction, Animation, 
    CubicEase, EasingFunction, ShadowGenerator, DefaultRenderingPipeline, DepthOfFieldEffectBlurLevel,
    PointerEventTypes
} from '@babylonjs/core';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true);

const uiOverlay = document.getElementById('uiOverlay');
const closeBtn = document.getElementById('closeBtn');
const productBrand = document.getElementById('productBrand');
const productName = document.getElementById('productName');
const productDesc = document.getElementById('productDesc');
const productPrice = document.getElementById('productPrice');

// Builder UI Elements
const addBtn = document.getElementById('addBtn');
const buildModeHint = document.getElementById('buildModeHint');
const addFormOverlay = document.getElementById('addFormOverlay');
const saveProductBtn = document.getElementById('saveProductBtn');
const cancelProductBtn = document.getElementById('cancelProductBtn');
const newBrandInput = document.getElementById('newBrand');
const newNameInput = document.getElementById('newName');
const newDescInput = document.getElementById('newDesc');
const newPriceInput = document.getElementById('newPrice');
const newColorInput = document.getElementById('newColor');

let activeProduct = null;
let originalPosition = null;
let originalRotation = null;
let camera = null;
let scene = null;
let shadowGenerator = null;
let pipeline = null;

// Builder State
let isBuildMode = false;
let ghostProduct = null;
let ghostPedestal = null;
let placedPosition = null;
let productIdCounter = 4;

const createScene = () => {
    scene = new Scene(engine);
    scene.clearColor = new Color3(0.05, 0.05, 0.06);
    
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

    const ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.3; 
    ambientLight.groundColor = new Color3(0.1, 0.1, 0.1);

    const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), scene);
    dirLight.position = new Vector3(5, 10, 5);
    dirLight.intensity = 1.5;
    
    shadowGenerator = new ShadowGenerator(1024, dirLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 16;

    pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
    pipeline.samples = 2; 
    pipeline.fxaaEnabled = true; 
    
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.6;
    pipeline.bloomWeight = 0.8;
    
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = 1; 
    
    pipeline.depthOfFieldEnabled = false; 
    pipeline.depthOfField.focusDistance = 1000; 
    pipeline.depthOfField.focalLength = 50; 
    pipeline.depthOfField.fStop = 1.4;

    buildStore(scene);

    createProduct(scene, "id_1", "Maraş İpliği", "Klasik Kesim T-Shirt", "100% Pamuklu, Kahramanmaraş üretimi yüksek kaliteli kumaş.", "₺450.00", new Vector3(-1.8, 1.45, 1.5), new Color3(0.8, 0.2, 0.2));
    createProduct(scene, "id_2", "Uzun Çarşı Butik", "Oversize Sokak T-Shirt", "Bol kesim, rahat ve modern sokak modası tasarımı.", "₺550.00", new Vector3(0, 1.45, 1.5), new Color3(0.2, 0.5, 0.8));
    createProduct(scene, "id_3", "Yöresel Dokuma", "Nakışlı Özel Gömlek", "Yöresel motiflerle el işlemesi özel tasarım gömlek.", "₺850.00", new Vector3(1.8, 1.45, 1.5), new Color3(0.9, 0.8, 0.2));

    // Pointer events for Builder Mode
    scene.onPointerObservable.add((pointerInfo) => {
        if (!isBuildMode) return;

        switch (pointerInfo.type) {
            case PointerEventTypes.POINTERMOVE:
                if (ghostProduct && ghostPedestal) {
                    const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh.name === 'storeFloor');
                    if (pickResult.hit) {
                        ghostPedestal.position = pickResult.pickedPoint.clone();
                        ghostPedestal.position.y = 0.55;
                        
                        ghostProduct.position = pickResult.pickedPoint.clone();
                        ghostProduct.position.y = 1.45;
                    }
                }
                break;
            case PointerEventTypes.POINTERDOWN:
                if (pointerInfo.event.button !== 0) return; // Left click only
                if (ghostProduct && ghostPedestal && addFormOverlay.classList.contains('hidden')) {
                    const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh.name === 'storeFloor');
                    if (pickResult.hit) {
                        placedPosition = pickResult.pickedPoint.clone();
                        openProductForm();
                    }
                }
                break;
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isBuildMode) {
            cancelBuildMode();
        }
    });

    return scene;
};

const buildStore = (scene) => {
    // Zemin
    const ground = MeshBuilder.CreateGround('storeFloor', { width: 15, height: 15 }, scene);
    const groundMat = new PBRMaterial('floorMat', scene);
    groundMat.albedoColor = new Color3(0.05, 0.05, 0.06);
    groundMat.metallic = 0.3;
    groundMat.roughness = 0.4;
    ground.material = groundMat;
    ground.receiveShadows = true;

    // Koyu duvarlar
    const wallMat = new PBRMaterial('wallMat', scene);
    wallMat.albedoColor = new Color3(0.15, 0.15, 0.18);
    wallMat.metallic = 0.1;
    wallMat.roughness = 0.8;

    const backWall = MeshBuilder.CreateBox('backWall', { width: 15, height: 5, depth: 0.5 }, scene);
    backWall.position = new Vector3(0, 2.5, 5.25);
    backWall.material = wallMat;
    backWall.receiveShadows = true;

    const leftWall = MeshBuilder.CreateBox('leftWall', { width: 0.5, height: 5, depth: 15 }, scene);
    leftWall.position = new Vector3(-5.25, 2.5, 0);
    leftWall.material = wallMat;
    leftWall.receiveShadows = true;

    const rightWall = MeshBuilder.CreateBox('rightWall', { width: 0.5, height: 5, depth: 15 }, scene);
    rightWall.position = new Vector3(5.25, 2.5, 0);
    rightWall.material = wallMat;
    rightWall.receiveShadows = true;
    
    // Kolonlar
    const colMat = new PBRMaterial('colMat', scene);
    colMat.albedoColor = new Color3(0.08, 0.08, 0.1);
    colMat.metallic = 0.6;
    colMat.roughness = 0.3;
    
    const createColumn = (x, z) => {
        const col = MeshBuilder.CreateBox('col', { width: 0.4, height: 5, depth: 0.4 }, scene);
        col.position = new Vector3(x, 2.5, z);
        col.material = colMat;
        shadowGenerator.getShadowMap().renderList.push(col);
        col.receiveShadows = true;
    };
    
    createColumn(-4.8, 4.8);
    createColumn(4.8, 4.8);
    createColumn(-4.8, -4.8);
    createColumn(4.8, -4.8);
    
    // Tavan izgarasi
    const beamMat = new PBRMaterial('beamMat', scene);
    beamMat.albedoColor = new Color3(0.05, 0.05, 0.05);
    beamMat.metallic = 0.1;
    beamMat.roughness = 0.9;
    
    for(let i = -4; i <= 4; i += 2) {
        const beam = MeshBuilder.CreateBox('beam', { width: 15, height: 0.2, depth: 0.4 }, scene);
        beam.position = new Vector3(0, 4.9, i);
        beam.material = beamMat;
        shadowGenerator.getShadowMap().renderList.push(beam);
    }
    
    // Orta halili platform
    const stage = MeshBuilder.CreateCylinder('stage', { diameter: 7, height: 0.1 }, scene);
    stage.position = new Vector3(0, 0.05, 1.5);
    const stageMat = new PBRMaterial('stageMat', scene);
    stageMat.albedoColor = new Color3(0.1, 0.1, 0.15);
    stageMat.metallic = 0.1;
    stageMat.roughness = 0.8;
    stage.material = stageMat;
    stage.receiveShadows = true;
    
    // Stantlar
    const createPedestal = (x, z) => {
        const ped = MeshBuilder.CreateCylinder('ped', { diameter: 0.5, height: 1.1 }, scene);
        ped.position = new Vector3(x, 0.55, z);
        
        const pedMat = new PBRMaterial('pedMat', scene);
        pedMat.albedoColor = new Color3(0.05, 0.05, 0.05);
        pedMat.metallic = 0.9; 
        pedMat.roughness = 0.2;
        ped.material = pedMat;
        
        shadowGenerator.getShadowMap().renderList.push(ped);
        ped.receiveShadows = true;
    };
    
    createPedestal(-1.8, 1.5);
    createPedestal(0, 1.5);
    createPedestal(1.8, 1.5);
};

const createProduct = (scene, id, brand, name, desc, price, position, color) => {
    const mesh = MeshBuilder.CreateBox(id, { width: 0.5, height: 0.7, depth: 0.1 }, scene);
    mesh.position = position.clone();
    
    const mat = new PBRMaterial(id + "_mat", scene);
    mat.albedoColor = color;
    mat.metallic = 0.1; 
    mat.roughness = 0.7; 
    mesh.material = mat;
    
    shadowGenerator.getShadowMap().renderList.push(mesh);
    
    mesh.metadata = { brand, name, desc, price };
    
    mesh.actionManager = new ActionManager(scene);
    
    mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
        if(!activeProduct && !isBuildMode) {
            document.getElementById('renderCanvas').style.cursor = 'pointer';
            mat.emissiveColor = color.scale(0.8); 
        }
    }));
    
    mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
        document.getElementById('renderCanvas').style.cursor = 'default';
        mat.emissiveColor = new Color3(0, 0, 0);
    }));
    
    mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
        if(activeProduct === null && !isBuildMode) {
            openProductView(mesh);
        }
    }));
};

// --- Builder Mode Logic ---
addBtn.addEventListener('click', () => {
    if (isBuildMode) {
        cancelBuildMode();
    } else {
        enterBuildMode();
    }
});

const enterBuildMode = () => {
    isBuildMode = true;
    addBtn.innerText = "❌ İptal Et";
    buildModeHint.classList.remove('hidden');
    
    ghostPedestal = MeshBuilder.CreateCylinder('ghostPed', { diameter: 0.5, height: 1.1 }, scene);
    ghostProduct = MeshBuilder.CreateBox('ghostProd', { width: 0.5, height: 0.7, depth: 0.1 }, scene);
    
    const ghostMat = new PBRMaterial('ghostMat', scene);
    ghostMat.albedoColor = new Color3(0.2, 0.8, 0.2);
    ghostMat.alpha = 0.6;
    ghostMat.metallic = 0.1;
    ghostMat.roughness = 0.5;
    ghostMat.emissiveColor = new Color3(0.1, 0.4, 0.1);
    
    ghostPedestal.material = ghostMat;
    ghostProduct.material = ghostMat;
    
    ghostPedestal.isPickable = false;
    ghostProduct.isPickable = false;
};

const cancelBuildMode = () => {
    isBuildMode = false;
    addBtn.innerText = "➕ Yeni Ürün Ekle";
    buildModeHint.classList.add('hidden');
    addFormOverlay.classList.add('hidden');
    
    if (ghostPedestal) ghostPedestal.dispose();
    if (ghostProduct) ghostProduct.dispose();
    ghostPedestal = null;
    ghostProduct = null;
    placedPosition = null;
    
    camera.attachControl(canvas, true);
};

const openProductForm = () => {
    camera.detachControl();
    buildModeHint.classList.add('hidden');
    addFormOverlay.classList.remove('hidden');
    
    newBrandInput.value = "";
    newNameInput.value = "";
    newDescInput.value = "";
    newPriceInput.value = "";
    newColorInput.value = "#4444ff";
};

saveProductBtn.addEventListener('click', () => {
    if (!placedPosition) return;
    
    const hex = newColorInput.value.replace('#', '');
    const r = parseInt(hex.substring(0,2), 16) / 255;
    const g = parseInt(hex.substring(2,4), 16) / 255;
    const b = parseInt(hex.substring(4,6), 16) / 255;
    const color = new Color3(r, g, b);
    
    const brand = newBrandInput.value || "Yeni Marka";
    const name = newNameInput.value || "Yeni Ürün";
    const desc = newDescInput.value || "Açıklama yok.";
    const price = newPriceInput.value || "₺0";
    
    const pX = placedPosition.x;
    const pZ = placedPosition.z;
    
    const ped = MeshBuilder.CreateCylinder('ped_' + productIdCounter, { diameter: 0.5, height: 1.1 }, scene);
    ped.position = new Vector3(pX, 0.55, pZ);
    const pedMat = new PBRMaterial('pedMat_' + productIdCounter, scene);
    pedMat.albedoColor = new Color3(0.05, 0.05, 0.05);
    pedMat.metallic = 0.9; 
    pedMat.roughness = 0.2;
    ped.material = pedMat;
    shadowGenerator.getShadowMap().renderList.push(ped);
    ped.receiveShadows = true;
    
    createProduct(scene, "id_" + productIdCounter, brand, name, desc, price, new Vector3(pX, 1.45, pZ), color);
    
    productIdCounter++;
    
    cancelBuildMode();
});

cancelProductBtn.addEventListener('click', cancelBuildMode);

// --- Product Inspection Logic ---
const animateValue = (target, property, startValue, endValue, onEnd) => {
    const frameRate = 60;
    const duration = 1.0; 
    
    const anim = new Animation("anim", property, frameRate, 
        typeof startValue === "number" ? Animation.ANIMATIONTYPE_FLOAT : Animation.ANIMATIONTYPE_VECTOR3, 
        Animation.ANIMATIONLOOPMODE_CONSTANT);
        
    const keys = [
        { frame: 0, value: startValue },
        { frame: frameRate * duration, value: endValue }
    ];
    anim.setKeys(keys);
    
    const easingFunction = new CubicEase();
    easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    anim.setEasingFunction(easingFunction);
    
    target.animations = target.animations || [];
    target.animations.push(anim);
    
    scene.beginAnimation(target, 0, frameRate * duration, false, 1.0, onEnd);
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
    
    const targetPos = camera.position.add(cameraForward.scale(1.0)); 
    targetPos.subtractInPlace(cameraRight.scale(0.35)); 
    targetPos.y -= 0.05;
    
    const targetRot = new Vector3(0, camera.rotation.y, 0);
    
    productBrand.innerText = mesh.metadata.brand;
    productName.innerText = mesh.metadata.name;
    productDesc.innerText = mesh.metadata.desc;
    productPrice.innerText = mesh.metadata.price;
    
    pipeline.depthOfFieldEnabled = true;
    
    mesh.animations = []; 
    animateValue(mesh, "position", mesh.position, targetPos);
    animateValue(mesh, "rotation", mesh.rotation, targetRot, () => {
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
        
        pipeline.depthOfFieldEnabled = false;
        
        activeProduct.animations = [];
        animateValue(activeProduct, "position", activeProduct.position, originalPosition);
        animateValue(activeProduct, "rotation", activeProduct.rotation, originalRotation, () => {
            activeProduct.rotation.y = 0; 
            activeProduct.material.emissiveColor = new Color3(0,0,0);
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
