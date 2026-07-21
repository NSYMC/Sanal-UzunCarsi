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

// UI Elements
const uiOverlay = document.getElementById('uiOverlay');
const closeBtn = document.getElementById('closeBtn');
const productBrand = document.getElementById('productBrand');
const productName = document.getElementById('productName');
const productDesc = document.getElementById('productDesc');
const productPrice = document.getElementById('productPrice');

// Editor UI
const editorToggleBtn = document.getElementById('editorToggleBtn');
const editorControls = document.getElementById('editorControls');
const buildModeHint = document.getElementById('buildModeHint');
const addDecoBtn = document.getElementById('addDecoBtn');
const addCounterBtn = document.getElementById('addCounterBtn');
const addRackBtn = document.getElementById('addRackBtn');
const paintModeBtn = document.getElementById('paintModeBtn');

// Assign UI
const assignFormOverlay = document.getElementById('assignFormOverlay');
const productListEl = document.getElementById('productList');
const newBrandInput = document.getElementById('newBrand');
const newNameInput = document.getElementById('newName');
const newPriceInput = document.getElementById('newPrice');
const newDescInput = document.getElementById('newDesc');
const addToListBtn = document.getElementById('addToListBtn');
const saveBoxBtn = document.getElementById('saveBoxBtn');
const cancelBoxBtn = document.getElementById('cancelBoxBtn');
const deleteBoxBtn = document.getElementById('deleteBoxBtn');

// Color Editor UI
const colorEditorOverlay = document.getElementById('colorEditorOverlay');
const colorEditorTargetName = document.getElementById('colorEditorTargetName');
const meshColorInput = document.getElementById('meshColorInput');
const saveColorBtn = document.getElementById('saveColorBtn');
const cancelColorBtn = document.getElementById('cancelColorBtn');
const resetColorBtn = document.getElementById('resetColorBtn');

// State
let isEditorMode = false;
let isPaintMode = false;
let currentPlacementType = null; // 'deco', 'counter', 'rack'
let ghostMesh = null;
let activeProduct = null;
let activeBoxId = null; 
let activeColorMesh = null;
let originalColorHex = null;
let tempProductList = [];
let camera = null;
let scene = null;
let shadowGenerator = null;
let pipeline = null;

let originalPosition = null;
let originalRotation = null;
let entityIdCounter = 1;

// Entities Array for memory
let entities = []; 
// Contains: { id, type, x, y, z, rotY, modelUrl, products: [] }

// --- IndexedDB Setup ---
const DB_NAME = "UzunCarsiDB_v2";
const STORE_NAME = "entities";
const COLOR_STORE = "sceneColors";

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 3);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(COLOR_STORE)) {
                db.createObjectStore(COLOR_STORE, { keyPath: "meshId" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveEntityToDB = async (entityData) => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entityData);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
};

const deleteEntityFromDB = async (id) => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
};

const loadEntitiesFromDB = async () => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result);
    });
};

const saveColorToDB = async (meshId, hexColor) => {
    const db = await initDB();
    const tx = db.transaction(COLOR_STORE, "readwrite");
    tx.objectStore(COLOR_STORE).put({ meshId, hexColor });
    return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
    });
};

const loadColorsFromDB = async () => {
    const db = await initDB();
    const tx = db.transaction(COLOR_STORE, "readonly");
    const store = tx.objectStore(COLOR_STORE);
    const request = store.getAll();
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result);
    });
};

// --- Scene Setup ---
const createScene = async () => {
    scene = new Scene(engine);
    scene.clearColor = new Color3(0.05, 0.05, 0.06);
    scene.collisionsEnabled = true;
    scene.gravity = new Vector3(0, -0.9, 0); 
    
    // Yansimalar (IBL)
    const envTexture = CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/environment.env", scene);
    scene.environmentTexture = envTexture;
    
    camera = new UniversalCamera('vrCamera', new Vector3(0, 5, -4), scene);
    camera.setTarget(new Vector3(0, 1.7, 0));
    camera.attachControl(canvas, true);

    // Default: flying enabled for testing
    camera.applyGravity = false;
    camera.checkCollisions = false;
    camera.ellipsoid = new Vector3(0.5, 1.7, 0.5); 
    camera.keysUp.push(87);
    camera.keysDown.push(83);
    camera.keysLeft.push(65);
    camera.keysRight.push(68);
    camera.speed = 0.15;
    camera.inertia = 0.8;
    camera.minZ = 0.1;

    // Lighting
    const ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.2; 
    ambientLight.groundColor = new Color3(0.05, 0.05, 0.05);

    const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -0.5, -1), scene);
    dirLight.position = new Vector3(20, 10, 20);
    dirLight.intensity = 1.7; 
    dirLight.diffuse = new Color3(1.0, 0.6, 0.3); 
    
    shadowGenerator = new ShadowGenerator(1024, dirLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32; 

    pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
    pipeline.samples = 4; 
    pipeline.fxaaEnabled = true; 
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.85; 
    pipeline.bloomWeight = 0.25; 
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = 1; 
    pipeline.imageProcessing.exposure = 1.0; 
    pipeline.imageProcessing.contrast = 1.1;
    pipeline.depthOfFieldEnabled = false; 

    const ssao = new SSAO2RenderingPipeline("ssao", scene, 0.75, [camera]);
    ssao.radius = 2.0;
    ssao.totalStrength = 1.2;
    ssao.base = 0.5;

    // Load Main Scene
    engine.displayLoadingUI();
    try {
        await SceneLoader.AppendAsync("/models/", "binaaktıf2.glb", scene);
        const savedColors = await loadColorsFromDB();
        
        scene.meshes.forEach(mesh => {
            mesh.checkCollisions = true;
            mesh.receiveShadows = true;
            
            if (savedColors) {
                const colorData = savedColors.find(c => c.meshId === mesh.name);
                if (colorData && mesh.material) {
                    if (mesh.material.albedoColor) {
                        mesh.material.albedoColor = Color3.FromHexString(colorData.hexColor);
                    }
                }
            }
        });
    } catch (err) {
        console.error("Ana sahne yuklenirken hata:", err);
    }
    engine.hideLoadingUI();

    // Load Entities
    try {
        entities = await loadEntitiesFromDB();
        if (entities && entities.length > 0) {
            let maxId = 0;
            for (const ent of entities) {
                const numericId = parseInt(ent.id.replace('ent_', ''));
                if (numericId > maxId) maxId = numericId;
                
                await instantiateEntity(ent);
            }
            entityIdCounter = maxId + 1;
        }
    } catch(e) {
        console.error("Failed to load entities from DB:", e);
    }

    // Pointer Events for Placement and Editing
    scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
            if (isEditorMode && ghostMesh) {
                const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh.checkCollisions && mesh.name !== 'ghost');
                if (pickResult.hit) {
                    ghostMesh.position = pickResult.pickedPoint.clone();
                }
            }
        }
        else if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
            if (pointerInfo.event.button !== 0) return; 

            // Paint mode click
            if (isEditorMode && isPaintMode) {
                const pickResult = scene.pick(scene.pointerX, scene.pointerY);
                if (pickResult.hit && pickResult.pickedMesh) {
                    if (pickResult.pickedMesh.name !== 'ghost') {
                        openColorEditor(pickResult.pickedMesh);
                    }
                }
                return;
            }

            // Placing a new item
            if (isEditorMode && ghostMesh) {
                const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh.checkCollisions && mesh.name !== 'ghost');
                if (pickResult.hit) {
                    createNewEntity(currentPlacementType, pickResult.pickedPoint.clone());
                    cancelPlacement();
                }
            } 
            // Clicking an existing box in Editor Mode (Left Click)
            else if (isEditorMode && !ghostMesh) {
                const pickResult = scene.pick(scene.pointerX, scene.pointerY);
                if (pickResult.hit && pickResult.pickedMesh) {
                    if (pickResult.pickedMesh.metadata && pickResult.pickedMesh.metadata.isBox) {
                        openAssignForm(pickResult.pickedMesh.metadata.entityId);
                    }
                }
            }
        }
        else if (pointerInfo.type === PointerEventTypes.POINTERDOWN && pointerInfo.event.button === 2) {
            // Right click for Color Picker in Editor Mode (Backup)
            if (isEditorMode && !ghostMesh) {
                const pickResult = scene.pick(scene.pointerX, scene.pointerY);
                if (pickResult.hit && pickResult.pickedMesh) {
                    // Ignore UI or ghost meshes
                    if (pickResult.pickedMesh.name !== 'ghost') {
                        openColorEditor(pickResult.pickedMesh);
                    }
                }
            }
        }
    });

    // Disable context menu so right click works smoothly
    window.addEventListener('contextmenu', (e) => {
        if (isEditorMode) e.preventDefault();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (ghostMesh) cancelPlacement();
            else if (!assignFormOverlay.classList.contains('hidden')) closeAssignForm();
            else if (!uiOverlay.classList.contains('hidden')) closeProductView();
        }
    });

    return scene;
};

// --- Entity Instantiation & Layout Algorithms ---
const instantiateEntity = async (ent) => {
    if (ent.type === 'deco') {
        try {
            const result = await SceneLoader.ImportMeshAsync("", "/products/", "valiz.glb", scene);
            const root = result.meshes[0];
            root.position = new Vector3(ent.x, ent.y, ent.z);
            root.scaling = new Vector3(0.5, 0.5, 0.5);
            root.metadata = { isBox: true, entityId: ent.id };
            
            result.meshes.forEach(m => {
                if (m.name !== root.name) {
                    shadowGenerator.getShadowMap().renderList.push(m);
                    m.receiveShadows = true;
                    m.isPickable = false; // pick root instead
                }
            });
            
            const bb = MeshBuilder.CreateBox(ent.id, {width: 0.6, height: 0.8, depth: 0.6}, scene);
            bb.position = new Vector3(ent.x, ent.y + 0.4, ent.z);
            bb.isVisible = false;
            bb.isPickable = true;
            bb.metadata = { isBox: true, entityId: ent.id };
            root.setParent(bb);

        } catch (e) {
            console.warn("Valiz modeli bulunamadi, placeholder kutu konuluyor.");
            const box = MeshBuilder.CreateBox(ent.id, {width: 0.6, height: 0.8, depth: 0.6}, scene);
            box.position = new Vector3(ent.x, ent.y + 0.4, ent.z);
            box.metadata = { isBox: true, entityId: ent.id };
        }
    } 
    else if (ent.type === 'counter' || ent.type === 'rack') {
        // Create base structure as a transparent zone container
        const boxRoot = MeshBuilder.CreateBox(ent.id, { width: 2, height: 1, depth: 1 }, scene);
        boxRoot.position = new Vector3(ent.x, ent.y + 0.5, ent.z);
        boxRoot.metadata = { isBox: true, entityId: ent.id };
        
        const mat = new PBRMaterial("mat_" + ent.id, scene);
        mat.albedoColor = new Color3(0, 1, 0.5); // Green-cyan boundary
        mat.alpha = 0.3;
        mat.unlit = true;
        
        boxRoot.material = mat;
        boxRoot.visibility = isEditorMode ? 1 : 0; // Hide outside editor mode
        
        // Layout algorithm
        if (ent.products && ent.products.length > 0) {
            if (ent.type === 'counter') {
                // Grid layout on top of counter
                // 3 columns, 2 rows max on a 2x1 counter
                let xStart = -0.7;
                let zStart = 0.25;
                ent.products.forEach((prod, index) => {
                    const col = index % 3;
                    const row = Math.floor(index / 3);
                    const pX = xStart + col * 0.7;
                    const pZ = zStart - row * 0.5;
                    
                    createInteractiveProduct(scene, ent.id + "_p_" + index, prod, new Vector3(pX, 0.75, pZ), boxRoot);
                });
            } else {
                // Rack layout (Line)
                // Linear spacing
                let xStart = -0.8;
                ent.products.forEach((prod, index) => {
                    const pX = xStart + index * 0.4;
                    createInteractiveProduct(scene, ent.id + "_p_" + index, prod, new Vector3(pX, 0.7, 0), boxRoot);
                });
            }
        }
    }
};

const createInteractiveProduct = (scene, id, prodInfo, localPosition, parentMesh) => {
    const mesh = MeshBuilder.CreateBox(id, { width: 0.3, height: 0.4, depth: 0.1 }, scene);
    mesh.setParent(parentMesh);
    mesh.position = localPosition.clone();
    
    const mat = new PBRMaterial(id + "_mat", scene);
    mat.albedoColor = new Color3(Math.random(), Math.random(), Math.random());
    mat.metallic = 0.1;
    mat.roughness = 0.7;
    mesh.material = mat;
    shadowGenerator.getShadowMap().renderList.push(mesh);
    
    mesh.metadata = { 
        isProduct: true,
        brand: prodInfo.brand, 
        name: prodInfo.name, 
        desc: prodInfo.desc, 
        price: prodInfo.price 
    };
    
    mesh.actionManager = new ActionManager(scene);
    
    mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
        if(!activeProduct && !isEditorMode) {
            document.getElementById('renderCanvas').style.cursor = 'pointer';
            mesh.material.emissiveColor = new Color3(0.2, 0.2, 0.2); 
        }
    }));
    
    mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
        document.getElementById('renderCanvas').style.cursor = 'default';
        mesh.material.emissiveColor = new Color3(0, 0, 0);
    }));
    
    mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
        if(!activeProduct && !isEditorMode) {
            openProductView(mesh);
        }
    }));
};

const createNewEntity = async (type, position) => {
    const ent = {
        id: "ent_" + entityIdCounter++,
        type: type,
        x: position.x,
        y: position.y,
        z: position.z,
        rotY: 0,
        products: []
    };
    
    entities.push(ent);
    await saveEntityToDB(ent);
    await instantiateEntity(ent);
};

// --- Editor Mode UI ---
editorToggleBtn.addEventListener('click', () => {
    isEditorMode = !isEditorMode;
    
    // Toggle visibility of box zones
    scene.meshes.forEach(m => {
        if (m.metadata && m.metadata.isBox && m.name.startsWith("ent_")) {
            const ent = entities.find(e => e.id === m.metadata.entityId);
            if (ent && (ent.type === 'counter' || ent.type === 'rack')) {
                m.visibility = isEditorMode ? 1 : 0;
            }
        }
    });

    if (isEditorMode) {
        editorToggleBtn.innerText = "Editörden Çık";
        editorToggleBtn.style.background = "#ff5555";
        editorControls.classList.remove('hidden');
    } else {
        editorToggleBtn.innerText = "Editör Modu";
        editorToggleBtn.style.background = "";
        editorControls.classList.add('hidden');
        cancelPlacement();
        
        if (isPaintMode) {
            isPaintMode = false;
            paintModeBtn.style.background = "";
            paintModeBtn.innerText = "Boya (Renk Değiştir)";
        }
    }
});

paintModeBtn.addEventListener('click', () => {
    isPaintMode = !isPaintMode;
    if (isPaintMode) {
        paintModeBtn.style.background = "#ff5555";
        paintModeBtn.innerText = "Boya Modu (Aktif)";
        cancelPlacement(); // clear ghost if any
    } else {
        paintModeBtn.style.background = "";
        paintModeBtn.innerText = "Boya (Renk Değiştir)";
    }
});

const startPlacement = (type) => {
    cancelPlacement();
    currentPlacementType = type;
    buildModeHint.classList.remove('hidden');
    
    // Ghost mesh
    if (type === 'deco') ghostMesh = MeshBuilder.CreateBox('ghost', {width: 0.6, height: 0.8, depth: 0.6}, scene);
    else ghostMesh = MeshBuilder.CreateBox('ghost', {width: 2, height: 1, depth: 1}, scene);
    
    const ghostMat = new PBRMaterial('ghostMat', scene);
    ghostMat.albedoColor = new Color3(0.2, 0.8, 0.2);
    ghostMat.alpha = 0.5;
    ghostMat.emissiveColor = new Color3(0.1, 0.4, 0.1);
    ghostMesh.material = ghostMat;
    ghostMesh.isPickable = false;
};

const cancelPlacement = () => {
    currentPlacementType = null;
    buildModeHint.classList.add('hidden');
    if (ghostMesh) {
        ghostMesh.dispose();
        ghostMesh = null;
    }
};

addDecoBtn.addEventListener('click', () => startPlacement('deco'));
addCounterBtn.addEventListener('click', () => startPlacement('counter'));
addRackBtn.addEventListener('click', () => startPlacement('rack'));

// --- Assign Products UI ---
const openAssignForm = (entityId) => {
    activeBoxId = entityId;
    const ent = entities.find(e => e.id === entityId);
    if (!ent) return;
    
    tempProductList = [...(ent.products || [])];
    renderProductList();
    
    assignFormOverlay.classList.remove('hidden');
    camera.detachControl();
};

const closeAssignForm = () => {
    assignFormOverlay.classList.add('hidden');
    activeBoxId = null;
    camera.attachControl(canvas, true);
};

const renderProductList = () => {
    productListEl.innerHTML = "";
    tempProductList.forEach((prod, index) => {
        const item = document.createElement('div');
        item.className = 'product-list-item';
        item.innerHTML = `
            <div><strong>${prod.brand}</strong> - ${prod.name} (${prod.price})</div>
            <button class="remove-btn" data-index="${index}">✖</button>
        `;
        productListEl.appendChild(item);
    });
    
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            tempProductList.splice(idx, 1);
            renderProductList();
        });
    });
};

addToListBtn.addEventListener('click', () => {
    tempProductList.push({
        brand: newBrandInput.value || "Marka",
        name: newNameInput.value || "Ürün",
        price: newPriceInput.value || "₺0",
        desc: newDescInput.value || "Açıklama"
    });
    newBrandInput.value = "";
    newNameInput.value = "";
    newPriceInput.value = "";
    newDescInput.value = "";
    renderProductList();
});

saveBoxBtn.addEventListener('click', async () => {
    const entIndex = entities.findIndex(e => e.id === activeBoxId);
    if (entIndex > -1) {
        entities[entIndex].products = [...tempProductList];
        await saveEntityToDB(entities[entIndex]);
        
        // Quick visual refresh: remove old mesh, instantiate new
        const oldMesh = scene.getMeshByName(activeBoxId);
        if (oldMesh) oldMesh.dispose(false, true); // dispose children too
        
        await instantiateEntity(entities[entIndex]);
    }
    closeAssignForm();
});

cancelBoxBtn.addEventListener('click', closeAssignForm);

deleteBoxBtn.addEventListener('click', async () => {
    if (activeBoxId) {
        await deleteEntityFromDB(activeBoxId);
        entities = entities.filter(e => e.id !== activeBoxId);
        const oldMesh = scene.getMeshByName(activeBoxId);
        if (oldMesh) oldMesh.dispose(false, true);
    }
    closeAssignForm();
});

// --- Product Inspection Logic (Animation) ---
const animateValue = (target, property, startValue, endValue, onEnd) => {
    const frameRate = 60;
    const anim = new Animation("anim", property, frameRate, 
        typeof startValue === "number" ? Animation.ANIMATIONTYPE_FLOAT : Animation.ANIMATIONTYPE_VECTOR3, 
        Animation.ANIMATIONLOOPMODE_CONSTANT);
        
    anim.setKeys([ { frame: 0, value: startValue }, { frame: frameRate, value: endValue } ]);
    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    anim.setEasingFunction(easing);
    
    target.animations = [anim];
    scene.beginAnimation(target, 0, frameRate, false, 1.0, onEnd);
};

let idleRotationObserver = null;

const openProductView = (mesh) => {
    activeProduct = mesh;
    // Get absolute position instead of local because it's parented now
    originalPosition = mesh.getAbsolutePosition().clone();
    originalRotation = mesh.rotationQuaternion ? mesh.rotationQuaternion.toEulerAngles() : mesh.rotation.clone();
    
    // Detach parent for inspection
    mesh.setParent(null);
    mesh.position = originalPosition.clone();
    mesh.rotation = originalRotation.clone();

    camera.detachControl();
    document.getElementById('renderCanvas').style.cursor = 'default';
    
    const cameraForward = camera.getDirection(Vector3.Forward());
    const cameraRight = camera.getDirection(Vector3.Right());
    const targetPos = camera.position.add(cameraForward.scale(1.2)).subtract(cameraRight.scale(0.35));
    targetPos.y -= 0.05;
    
    productBrand.innerText = mesh.metadata.brand;
    productName.innerText = mesh.metadata.name;
    productDesc.innerText = mesh.metadata.desc;
    productPrice.innerText = mesh.metadata.price;
    
    pipeline.depthOfFieldEnabled = true;
    
    animateValue(mesh, "position", mesh.position, targetPos);
    animateValue(mesh, "rotation", mesh.rotation, new Vector3(0, camera.rotation.y, 0), () => {
        uiOverlay.classList.remove('hidden');
        uiOverlay.classList.add('active');
        idleRotationObserver = scene.onBeforeRenderObservable.add(() => activeProduct.rotation.y += 0.01);
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
        
        animateValue(activeProduct, "position", activeProduct.position, originalPosition);
        animateValue(activeProduct, "rotation", activeProduct.rotation, originalRotation, () => {
            // Re-parent is tricky, but we can just snap it back by disposing and refreshing or keeping absolute
            // Let's just leave it unparented in exactly the same spot
            activeProduct.material.emissiveColor = new Color3(0,0,0);
            activeProduct = null;
            camera.attachControl(canvas, true);
        });
    }, 500); 
};

closeBtn.addEventListener('click', closeProductView);

// --- Color Editor Logic ---
const openColorEditor = (mesh) => {
    if (!mesh.material || !mesh.material.albedoColor) return;
    
    activeColorMesh = mesh;
    originalColorHex = mesh.material.albedoColor.toHexString();
    
    colorEditorTargetName.innerText = "Hedef: " + mesh.name;
    meshColorInput.value = originalColorHex;
    
    colorEditorOverlay.classList.remove('hidden');
    camera.detachControl();
};

const closeColorEditor = () => {
    colorEditorOverlay.classList.add('hidden');
    activeColorMesh = null;
    camera.attachControl(canvas, true);
};

meshColorInput.addEventListener('input', (e) => {
    if (activeColorMesh && activeColorMesh.material) {
        activeColorMesh.material.albedoColor = Color3.FromHexString(e.target.value);
    }
});

saveColorBtn.addEventListener('click', async () => {
    if (activeColorMesh) {
        const hex = meshColorInput.value;
        await saveColorToDB(activeColorMesh.name, hex);
    }
    closeColorEditor();
});

cancelColorBtn.addEventListener('click', () => {
    if (activeColorMesh && activeColorMesh.material && originalColorHex) {
        activeColorMesh.material.albedoColor = Color3.FromHexString(originalColorHex);
    }
    closeColorEditor();
});

resetColorBtn.addEventListener('click', async () => {
    if (activeColorMesh && activeColorMesh.material) {
        activeColorMesh.material.albedoColor = new Color3(1, 1, 1);
        await saveColorToDB(activeColorMesh.name, "#ffffff"); // Default white/base
    }
    closeColorEditor();
});

createScene().then(() => {
    engine.runRenderLoop(() => { if(scene) scene.render(); });
});
window.addEventListener('resize', () => engine.resize());
