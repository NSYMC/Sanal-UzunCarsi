import './style.css';
import { 
    Engine, Scene, Vector3, HemisphericLight, DirectionalLight, MeshBuilder, UniversalCamera, 
    PBRMaterial, Color3, ActionManager, ExecuteCodeAction, Animation, 
    CubicEase, EasingFunction, ShadowGenerator, DefaultRenderingPipeline, SceneLoader, PointerEventTypes,
    CubeTexture, SSAO2RenderingPipeline
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';


const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true);


const uiOverlay = document.getElementById('uiOverlay');
const closeBtn = document.getElementById('closeBtn');
const productBrand = document.getElementById('productBrand');
const productName = document.getElementById('productName');
const productDesc = document.getElementById('productDesc');
const productPrice = document.getElementById('productPrice');


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
const modelUploadInput = document.getElementById('modelUpload');


let activeProduct = null;
let originalPosition = null;
let originalRotation = null;
let camera = null;
let scene = null;
let shadowGenerator = null;
let pipeline = null;


let isBuildMode = false;
let ghostProduct = null;
let ghostPedestal = null;
let placedPosition = null;
let productIdCounter = 4;


const DB_NAME = "UzunCarsiDB";
const STORE_NAME = "products";


const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};


const saveProductToDB = async (productData) => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(productData);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
};


const loadProductsFromDB = async () => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result);
    });
};


const createScene = async () => {
    scene = new Scene(engine);
    scene.clearColor = new Color3(0.05, 0.05, 0.06);


    scene.collisionsEnabled = true;
    scene.gravity = new Vector3(0, -0.9, 0); 
    
    // Yansimalar (IBL) icin HDRI
    const envTexture = CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/environment.env", scene);
    scene.environmentTexture = envTexture;
    
    camera = new UniversalCamera('vrCamera', new Vector3(0, 1.7, -4), scene);
    camera.setTarget(new Vector3(0, 1.7, 0));
    camera.attachControl(canvas, true);


    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new Vector3(0.5, 1.7, 0.5); 


    camera.keysUp.push(87);
    camera.keysDown.push(83);
    camera.keysLeft.push(65);
    camera.keysRight.push(68);
    camera.speed = 0.15;
    camera.inertia = 0.8;
    camera.minZ = 0.1;


    // Gun Batimi Igi
    const ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.2; 
    ambientLight.groundColor = new Color3(0.05, 0.05, 0.05);

    const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -0.5, -1), scene);
    dirLight.position = new Vector3(20, 10, 20);
    dirLight.intensity = 2.0;
    dirLight.diffuse = new Color3(1.0, 0.6, 0.3); // Sicak turuncu gun batimi
    
    shadowGenerator = new ShadowGenerator(1024, dirLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32; // Daha yumusak golgeler

    pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
    pipeline.samples = 4; // Daha yuksek anti-aliasing
    pipeline.fxaaEnabled = true; 
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.7;
    pipeline.bloomWeight = 0.5;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = 1; 
    pipeline.imageProcessing.exposure = 1.2;
    pipeline.imageProcessing.contrast = 1.1;
    pipeline.depthOfFieldEnabled = false; 

    // SSAO: Bina koseleri icin mikro golgeler
    const ssao = new SSAO2RenderingPipeline("ssao", scene, 0.75, [camera]);
    ssao.radius = 2.0;
    ssao.totalStrength = 1.2;
    ssao.base = 0.5;


    engine.displayLoadingUI();
    
    try {
        await SceneLoader.AppendAsync("/models/", "binaaktıf2.glb", scene);
        scene.meshes.forEach(mesh => {
            mesh.checkCollisions = true;
            mesh.receiveShadows = true;
        });
        
        // Move camera slightly up so it falls gracefully onto the scene
        camera.position.y += 5;
    } catch (err) {
        console.error("Ana sahne yuklenirken hata olustu:", err);
    }
    
    engine.hideLoadingUI();


    try {
        const customProducts = await loadProductsFromDB();
        if (customProducts && customProducts.length > 0) {
            let maxId = 3;
            for (const prod of customProducts) {
                const numericId = parseInt(prod.id.replace('id_', ''));
                if (numericId > maxId) maxId = numericId;


                const pos = new Vector3(prod.x, prod.y || 1.45, prod.z);


                if (prod.modelDataUrl) {
                    await createExternalProduct(scene, prod.id, prod.brand, prod.name, prod.desc, prod.price, pos, prod.modelDataUrl, true);
                } else {
                    const r = parseInt(prod.color.substring(1,3), 16) / 255;
                    const g = parseInt(prod.color.substring(3,5), 16) / 255;
                    const b = parseInt(prod.color.substring(5,7), 16) / 255;
                    createProduct(scene, prod.id, prod.brand, prod.name, prod.desc, prod.price, pos, new Color3(r, g, b), true);
                }
            }
            productIdCounter = maxId + 1;
        }
    } catch(e) {
        console.error("Failed to load products from DB:", e);
    }


    scene.onPointerObservable.add((pointerInfo) => {
        if (!isBuildMode) return;


        switch (pointerInfo.type) {
            case PointerEventTypes.POINTERMOVE:
                if (ghostProduct && ghostPedestal) {
                    const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh.name !== 'ghostProd' && mesh.name !== 'ghostPed' && mesh.checkCollisions);
                    if (pickResult.hit) {
                        ghostPedestal.position = pickResult.pickedPoint.clone();
                        ghostPedestal.position.y = 0.55;


                        ghostProduct.position = pickResult.pickedPoint.clone();
                        ghostProduct.position.y = 1.45;
                    }
                }
                break;
            case PointerEventTypes.POINTERDOWN:
                if (pointerInfo.event.button !== 0) return; 
                if (ghostProduct && ghostPedestal && addFormOverlay.classList.contains('hidden')) {
                    const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh.name !== 'ghostProd' && mesh.name !== 'ghostPed' && mesh.checkCollisions);
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


const createPedestalForProduct = (scene, pX, pZ, idSuffix) => {
    const ped = MeshBuilder.CreateCylinder('ped_' + idSuffix, { diameter: 0.5, height: 1.1 }, scene);
    ped.position = new Vector3(pX, 0.55, pZ);
    const pedMat = new PBRMaterial('pedMat_' + idSuffix, scene);
    pedMat.albedoColor = new Color3(0.05, 0.05, 0.05);
    pedMat.metallic = 0.9; 
    pedMat.roughness = 0.2;
    ped.material = pedMat;
    shadowGenerator.getShadowMap().renderList.push(ped);
    ped.receiveShadows = true;
    ped.checkCollisions = true;
};


const registerInteractions = (mesh, color, metadata) => {
    mesh.metadata = metadata;
    mesh.actionManager = new ActionManager(scene);


    mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
        if(!activeProduct && !isBuildMode) {
            document.getElementById('renderCanvas').style.cursor = 'pointer';
            if (mesh.material && mesh.material.emissiveColor) {
                mesh.material.emissiveColor = color ? color.scale(0.8) : new Color3(0.2, 0.2, 0.2); 
            }
        }
    }));


    mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
        document.getElementById('renderCanvas').style.cursor = 'default';
        if (mesh.material && mesh.material.emissiveColor) {
            mesh.material.emissiveColor = new Color3(0, 0, 0);
        }
    }));


    mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
        if(activeProduct === null && !isBuildMode) {
            openProductView(mesh);
        }
    }));
};


const createProduct = (scene, id, brand, name, desc, price, position, color, makePedestal = false) => {
    if (makePedestal) {
        createPedestalForProduct(scene, position.x, position.z, id);
    }
    const mesh = MeshBuilder.CreateBox(id, { width: 0.5, height: 0.7, depth: 0.1 }, scene);
    mesh.position = position.clone();
    mesh.checkCollisions = true;


    const mat = new PBRMaterial(id + "_mat", scene);
    mat.albedoColor = color;
    mat.metallic = 0.1; 
    mat.roughness = 0.7; 
    mesh.material = mat;


    shadowGenerator.getShadowMap().renderList.push(mesh);
    registerInteractions(mesh, color, { brand, name, desc, price });
};


const createExternalProduct = async (scene, id, brand, name, desc, price, position, dataUrl, makePedestal = false) => {
    if (makePedestal) {
        createPedestalForProduct(scene, position.x, position.z, id);
    }


    try {
        const result = await SceneLoader.ImportMeshAsync("", dataUrl, "", scene, undefined, ".glb");
        const rootNode = result.meshes[0];
        rootNode.position = position.clone();


        rootNode.scaling = new Vector3(0.5, 0.5, 0.5);


        result.meshes.forEach(m => {
            if (m.name !== rootNode.name) {
                shadowGenerator.getShadowMap().renderList.push(m);
                m.receiveShadows = true;


                if (m.geometry) m.checkCollisions = true;
            }
        });


        const boundingBox = MeshBuilder.CreateBox(id, { width: 0.6, height: 0.8, depth: 0.6 }, scene);
        boundingBox.position = position.clone();
        boundingBox.position.y += 0.2; 
        boundingBox.isVisible = false;
        boundingBox.isPickable = true;


        rootNode.setParent(boundingBox);
        rootNode.position = new Vector3(0, -0.4, 0); 


        registerInteractions(boundingBox, new Color3(0.5, 0.5, 0.5), { brand, name, desc, price });
    } catch (e) {
        console.error("Error loading external model", e);
    }
};


addBtn.addEventListener('click', () => {
    if (isBuildMode) {
        cancelBuildMode();
    } else {
        enterBuildMode();
    }
});


const enterBuildMode = () => {
    isBuildMode = true;
    addBtn.innerText = "İptal Et";
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
    addBtn.innerText = "Yeni Ürün Ekle";
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
    newColorInput.value = "#8c5a3c";
    modelUploadInput.value = "";
};


saveProductBtn.addEventListener('click', async () => {
    if (!placedPosition) return;


    const hexColor = newColorInput.value;
    const r = parseInt(hexColor.substring(1,3), 16) / 255;
    const g = parseInt(hexColor.substring(3,5), 16) / 255;
    const b = parseInt(hexColor.substring(5,7), 16) / 255;
    const color = new Color3(r, g, b);


    const brand = newBrandInput.value || "Yeni Marka";
    const name = newNameInput.value || "Yeni Ürün";
    const desc = newDescInput.value || "Açıklama yok.";
    const price = newPriceInput.value || "₺0";


    const pX = placedPosition.x;
    const pZ = placedPosition.z;
    const id = "id_" + productIdCounter;


    let dataUrl = null;
    if (modelUploadInput.files && modelUploadInput.files.length > 0) {
        const file = modelUploadInput.files[0];
        dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }


    const productData = {
        id: id,
        brand: brand,
        name: name,
        desc: desc,
        price: price,
        color: hexColor,
        x: pX,
        y: 1.45,
        z: pZ,
        modelDataUrl: dataUrl
    };


    await saveProductToDB(productData);


    if (dataUrl) {
        await createExternalProduct(scene, id, brand, name, desc, price, new Vector3(pX, 1.45, pZ), dataUrl, true);
    } else {
        createProduct(scene, id, brand, name, desc, price, new Vector3(pX, 1.45, pZ), color, true);
    }


    productIdCounter++;
    cancelBuildMode();
});


cancelProductBtn.addEventListener('click', cancelBuildMode);


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


    const targetPos = camera.position.add(cameraForward.scale(1.2)); 
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


            if (activeProduct.material && activeProduct.material.emissiveColor) {
                activeProduct.material.emissiveColor = new Color3(0,0,0);
            }


            activeProduct = null;
            camera.attachControl(canvas, true);
        });
    }, 500); 
};


closeBtn.addEventListener('click', closeProductView);


createScene().then(() => {
    engine.runRenderLoop(() => {
        if(scene) scene.render();
    });
});


window.addEventListener('resize', () => {
    engine.resize();
});
